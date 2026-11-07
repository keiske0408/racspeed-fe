import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { awardEngagementPoints } from "@/lib/services/rewards";
import {
  evaluateQrScanCheckIn,
  isQrCheckInApplicable,
  resolveArchiveState,
  resolveQrSessionLifecycle,
} from "@/features/activities/rules";
import { z } from "zod";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function resetCheckInRateLimiter() {
  rateLimitStore.clear();
}

function checkRateLimit(key: string, nowMs = Date.now()): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const existing = rateLimitStore.get(key);
  if (!existing || nowMs >= existing.resetAt) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: nowMs + RATE_LIMIT_WINDOW_MS,
    });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (existing.count >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((existing.resetAt - nowMs) / 1000),
      ),
    };
  }
  existing.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function extractToken(raw: string): string {
  if (!raw) return "";
  let trimmed = raw.trim();

  // Strip wrapping quotes if any
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }

  // 1. If JSON payload string
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const obj = JSON.parse(trimmed);
      const val =
        obj.token || obj.sessionToken || obj.session_token || obj.checkInToken;
      if (val) return String(val).trim();
    } catch {}
  }

  // 2. If full URL or URL path with query params
  try {
    if (
      trimmed.startsWith("http://") ||
      trimmed.startsWith("https://") ||
      trimmed.includes("?")
    ) {
      const parsed = trimmed.startsWith("http")
        ? new URL(trimmed)
        : new URL(trimmed, "http://localhost");
      const qToken =
        parsed.searchParams.get("token") ||
        parsed.searchParams.get("sessionToken") ||
        parsed.searchParams.get("checkInToken");
      if (qToken) return qToken.trim();
    }
  } catch {}

  // 3. Query param regex match
  const match = trimmed.match(
    /[?&](?:token|sessionToken|checkInToken)=([^&#\s]+)/i,
  );
  if (match) {
    return decodeURIComponent(match[1]).trim();
  }

  // 4. Raw token
  return trimmed;
}

const checkInSchema = z
  .object({
    sessionToken: z.string().optional(),
    token: z.string().optional(),
    eventId: z.string().uuid("Invalid event ID").optional().or(z.literal("")),
  })
  .refine((data) => Boolean(data.sessionToken || data.token), {
    message: "Session token is required",
    path: ["sessionToken"],
  });

interface ActivityCheckInSource {
  id: string;
  title: string;
  kind: string;
  status?: string | null;
  club_id: string;
  start_at?: string | null;
  end_at: string;
  location?: string | null;
  qr_check_in_enabled?: boolean | null;
  volunteer_hours_default: number | string | null;
  legacy_event_id: string | null;
}

interface EventCheckInSource {
  id: string;
  title: string;
  event_category: string;
  host_club_id: string;
  start_time?: string | null;
  end_time: string;
  location?: string | null;
  volunteer_hours_default: number | string | null;
}

interface MembershipCheckInRow {
  membership_status: string;
  profiles: { status: string } | null;
}

export async function POST(request: NextRequest) {
  try {
    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "anonymous";

    const ipRate = checkRateLimit(`ip:${clientIp}`);
    if (!ipRate.allowed) {
      return NextResponse.json(
        {
          code: "RATE_LIMITED",
          error: "Too many attendance verification attempts. Please wait a moment and try again.",
        },
        {
          status: 429,
          headers: { "Retry-After": String(ipRate.retryAfterSeconds) },
        },
      );
    }

    const supabase = await createClient();
    let {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    // Also support Authorization Bearer token for mobile/PWA scanners and API requests
    if (!user) {
      const authHeader = request.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const jwt = authHeader.slice(7).trim();
        const { data: userRes } = await supabase.auth.getUser(jwt);
        if (userRes?.user) {
          user = userRes.user;
          authError = null;
        }
      }
    }

    if (authError || !user) {
      return NextResponse.json(
        {
          code: "UNAUTHENTICATED",
          requiresAuth: true,
          error: "Unauthorized: Please sign in to check in.",
        },
        { status: 401 },
      );
    }

    const userRate = checkRateLimit(`user:${user.id}`);
    if (!userRate.allowed) {
      return NextResponse.json(
        {
          code: "RATE_LIMITED",
          error: "Too many attendance verification attempts. Please wait a moment and try again.",
        },
        {
          status: 429,
          headers: { "Retry-After": String(userRate.retryAfterSeconds) },
        },
      );
    }

    const body = await request.json();
    const parsed = checkInSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          code: "INVALID_PAYLOAD",
          error: "Invalid request payload",
          details: parsed.error.issues,
        },
        { status: 400 },
      );
    }

    const rawToken = (parsed.data.sessionToken || parsed.data.token)!.trim();
    const sessionToken = extractToken(rawToken);

    if (!sessionToken || sessionToken.length > 256) {
      return NextResponse.json(
        {
          code: "INVALID_TOKEN",
          error: "Invalid check-in token provided.",
        },
        { status: 400 },
      );
    }

    // Use admin client to verify attendance session and insert record (bypasses RLS for attendees)
    const admin = createAdminClient();

    // Verify attendance session exists
    const { data: session, error: sessionError } = await admin
      .from("attendance_sessions")
      .select(
        "id, event_id, activity_id, status, secret_hash, created_at, expires_at, events(id, title, event_category, host_club_id, start_time, end_time, location, volunteer_hours_default), activities(id, title, kind, status, club_id, start_at, end_at, location, volunteer_hours_default, legacy_event_id)",
      )
      .eq("session_token", sessionToken)
      .maybeSingle();

    if (sessionError || !session) {
      return NextResponse.json(
        {
          code: "INVALID_TOKEN",
          error:
            "Invalid check-in session token. Please scan the active QR code.",
        },
        { status: 404 },
      );
    }

    const joinedSession = session as unknown as typeof session & {
      secret_hash?: string | null;
      activities: ActivityCheckInSource | null;
      events: EventCheckInSource | null;
    };
    const activity = joinedSession.activities;
    const event = joinedSession.events;
    const source = activity || event;
    const hours = Number(source?.volunteer_hours_default ?? 3.0);
    const eventTitle = source?.title || "Event";
    const targetId: string = session.activity_id || session.event_id;
    const now = new Date();

    // Check archive state & QR applicability if linked to an activity
    let isArchived = false;
    if (session.activity_id) {
      const { data: logRows } = await admin
        .from("activity_log")
        .select("action, created_at")
        .eq("activity_id", session.activity_id);
      isArchived = resolveArchiveState({
        activity_log: (logRows as { action: string; created_at: string }[]) || [],
      }).isArchived;
    }

    const qrCheckInEnabled = isQrCheckInApplicable({
      qr_check_in_enabled: activity?.qr_check_in_enabled,
      title: eventTitle,
      kind: activity?.kind || event?.event_category,
    });

    const lifecycle = resolveQrSessionLifecycle({
      dbStatus: session.status,
      secretHash: joinedSession.secret_hash,
      expiresAt: session.expires_at,
      activityEndAt: activity?.end_at || event?.end_time,
      now,
    });

    // Persist EXPIRED status if token time has elapsed while DB still says ACTIVE
    if (lifecycle.status === "EXPIRED" && session.status === "ACTIVE") {
      await admin
        .from("attendance_sessions")
        .update({ status: "EXPIRED" })
        .eq("id", session.id);
    }

    const sourceClubId = activity?.club_id || event?.host_club_id;
    if (!sourceClubId) {
      return NextResponse.json(
        {
          code: "INVALID_SESSION",
          error: "The activity is not linked to a club.",
        },
        { status: 403 },
      );
    }

    const [{ data: membership }, { data: profile }, { data: existingCheckIn }] =
      await Promise.all([
        admin
          .from("club_memberships")
          .select("membership_status, profiles!inner(status)")
          .eq("club_id", sourceClubId)
          .eq("profile_id", user.id)
          .maybeSingle(),
        admin
          .from("profiles")
          .select("full_name, email, status, is_platform_admin")
          .eq("id", user.id)
          .maybeSingle(),
        admin
          .from("attendance_records")
          .select("id, check_in_time")
          .eq(session.activity_id ? "activity_id" : "event_id", targetId)
          .eq("profile_id", user.id)
          .maybeSingle(),
      ]);

    const member = membership as unknown as MembershipCheckInRow | null;
    const memberProfile = member?.profiles;
    const profileRow = profile as {
      full_name?: string | null;
      email?: string | null;
      status?: string | null;
      is_platform_admin?: boolean | null;
    } | null;
    const participantName =
      profileRow?.full_name || user.email || "Club Member";

    const isEligibleParticipant =
      profileRow?.status === "ACTIVE" &&
      Boolean(
        profileRow.is_platform_admin ||
          (["ACTIVE", "ASPIRANT"].includes(member?.membership_status || "") &&
            memberProfile?.status === "ACTIVE"),
      );

    const rule = evaluateQrScanCheckIn({
      sessionLifecycle: lifecycle.status,
      activityStatus: activity?.status,
      isArchived,
      qrCheckInEnabled,
      isParticipant: isEligibleParticipant,
      alreadyCheckedIn: Boolean(existingCheckIn),
    });

    if (!rule.allowed) {
      if (rule.code === "ALREADY_CHECKED_IN" && existingCheckIn) {
        return NextResponse.json(
          {
            code: "ALREADY_CHECKED_IN",
            alreadyCheckedIn: true,
            error: "You are already checked in for this event.",
            eventId: targetId,
            eventTitle,
            projectName: eventTitle,
            participantName,
            volunteerHours: hours,
            checkInTime: existingCheckIn.check_in_time,
          },
          { status: 409 },
        );
      }

      const statusMap: Record<string, number> = {
        TOKEN_EXPIRED: 410,
        TOKEN_REVOKED: 410,
        SESSION_CLOSED: 410,
        NOT_ELIGIBLE: 403,
      };
      return NextResponse.json(
        {
          code: rule.code,
          error: rule.reason || "Attendance verification failed.",
          eventId: targetId,
          eventTitle,
          projectName: eventTitle,
        },
        { status: statusMap[rule.code] || 400 },
      );
    }

    const nowIso = now.toISOString();

    // Insert verified attendance record with admin client (atomic via unique constraint)
    const { data: record, error: insertError } = await admin
      .from("attendance_records")
      .insert({
        activity_id: session.activity_id,
        event_id: session.event_id ?? activity?.legacy_event_id ?? null,
        profile_id: user.id,
        session_id: session.id,
        attended: true,
        check_in_method: "QR",
        volunteer_hours: hours,
        check_in_time: nowIso,
      })
      .select()
      .single();

    if (insertError) {
      // Handle race condition where simultaneous scans hit the unique constraint
      if (insertError.code === "23505") {
        const { data: concurrentRecord } = await admin
          .from("attendance_records")
          .select("id, check_in_time")
          .eq(session.activity_id ? "activity_id" : "event_id", targetId)
          .eq("profile_id", user.id)
          .maybeSingle();

        return NextResponse.json(
          {
            code: "ALREADY_CHECKED_IN",
            alreadyCheckedIn: true,
            error: "You are already checked in for this event.",
            eventId: targetId,
            eventTitle,
            projectName: eventTitle,
            participantName,
            volunteerHours: hours,
            checkInTime: concurrentRecord?.check_in_time || nowIso,
          },
          { status: 409 },
        );
      }

      console.error("Attendance check-in insert error:", insertError);
      return NextResponse.json(
        {
          code: "INSERT_FAILED",
          error: "Failed to record attendance. Please try again.",
        },
        { status: 500 },
      );
    }

    // Automatically mark user as GOING and follower for the project so inside details are unlocked
    if (session.activity_id) {
      await Promise.allSettled([
        admin.from("activity_rsvps").upsert({
          activity_id: session.activity_id,
          profile_id: user.id,
          response: "GOING",
          responded_at: nowIso,
        }),
        admin.from("activity_followers").upsert({
          activity_id: session.activity_id,
          profile_id: user.id,
        }),
        admin.from("activity_log").insert({
          activity_id: session.activity_id,
          actor_id: user.id,
          action: "QR_CHECK_IN",
          details: {
            sessionId: session.id,
            volunteerHours: hours,
            method: "QR",
          },
        }),
      ]);
    }

    const sourceKind = activity?.kind || event?.event_category;
    const isServiceProject =
      sourceKind === "SERVICE_PROJECT" || sourceKind === "JOINT_PROJECT";
    await awardEngagementPoints({
      clubId: sourceClubId,
      profileId: user.id,
      sourceType: isServiceProject ? "SERVICE_CHECK_IN" : "CHECK_IN",
      sourceId: record.id,
      reason: isServiceProject
        ? `Attended Service Project: ${eventTitle}`
        : `Attended Activity: ${eventTitle}`,
    });

    return NextResponse.json({
      success: true,
      code: "CHECKED_IN",
      message: `Check-in confirmed for ${eventTitle}! ${hours} volunteer hours recorded.`,
      recordId: record.id,
      volunteerHours: hours,
      eventTitle,
      projectName: eventTitle,
      participantName,
      checkInTime: record.check_in_time || nowIso,
      eventId: targetId,
    });
  } catch (err: unknown) {
    console.error("Unexpected error during check-in:", err);
    return NextResponse.json(
      {
        code: "INTERNAL_ERROR",
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
