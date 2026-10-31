import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { awardEngagementPoints } from "@/lib/services/rewards";
import { z } from "zod";

function extractToken(raw: string): string {
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
  club_id: string;
  end_at: string;
  volunteer_hours_default: number | string | null;
  legacy_event_id: string | null;
}

interface EventCheckInSource {
  id: string;
  title: string;
  event_category: string;
  host_club_id: string;
  end_time: string;
  volunteer_hours_default: number | string | null;
}

interface MembershipCheckInRow {
  membership_status: string;
  profiles: { status: string } | null;
}

export async function POST(request: NextRequest) {
  try {
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
        { error: "Unauthorized: Please sign in to check in." },
        { status: 401 },
      );
    }

    const body = await request.json();
    const parsed = checkInSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const rawToken = (parsed.data.sessionToken || parsed.data.token)!.trim();
    const sessionToken = extractToken(rawToken);

    if (!sessionToken) {
      return NextResponse.json(
        { error: "Invalid check-in token provided." },
        { status: 400 },
      );
    }

    // Use admin client to verify attendance session and insert record (bypasses RLS for attendees)
    const admin = createAdminClient();

    // Verify attendance session exists
    const { data: session, error: sessionError } = await admin
      .from("attendance_sessions")
      .select(
        "id, event_id, activity_id, status, expires_at, events(title, event_category, host_club_id, end_time, volunteer_hours_default), activities(title, kind, club_id, end_at, volunteer_hours_default, legacy_event_id)",
      )
      .eq("session_token", sessionToken)
      .maybeSingle();

    if (sessionError || !session) {
      return NextResponse.json(
        {
          error:
            "Invalid check-in session token. Please scan the active QR code.",
        },
        { status: 404 },
      );
    }

    // Verify session has not expired by timestamp and is not explicitly closed
    const isPastExpiry = new Date(session.expires_at) < new Date();
    if (session.status !== "ACTIVE" || isPastExpiry) {
      return NextResponse.json(
        { error: "Check-in window for this session has closed." },
        { status: 410 },
      );
    }

    const joinedSession = session as unknown as typeof session & {
      activities: ActivityCheckInSource | null;
      events: EventCheckInSource | null;
    };
    const activity = joinedSession.activities;
    const event = joinedSession.events;
    const source = activity || event;
    const hours = Number(source?.volunteer_hours_default ?? 3.0);
    const eventTitle = source?.title || "Event";
    const targetId: string = session.activity_id || session.event_id;

    const activityEnd = activity?.end_at || event?.end_time;
    if (activityEnd && new Date(activityEnd).getTime() < Date.now()) {
      return NextResponse.json(
        { error: "This activity has ended and is now archived." },
        { status: 410 },
      );
    }

    const sourceClubId = activity?.club_id || event?.host_club_id;
    if (!sourceClubId) {
      return NextResponse.json(
        { error: "The activity is not linked to a club." },
        { status: 403 },
      );
    }
    const [{ data: membership }, { data: profile }] = await Promise.all([
      admin
        .from("club_memberships")
        .select("membership_status, profiles!inner(status)")
        .eq("club_id", sourceClubId)
        .eq("profile_id", user.id)
        .maybeSingle(),
      admin
        .from("profiles")
        .select("status, is_platform_admin")
        .eq("id", user.id)
        .maybeSingle(),
    ]);
    const member = membership as unknown as MembershipCheckInRow | null;
    const memberProfile = member?.profiles;
    const canCheckIn =
      profile?.status === "ACTIVE" &&
      (profile.is_platform_admin ||
        (["ACTIVE", "ASPIRANT"].includes(member?.membership_status || "") &&
          memberProfile?.status === "ACTIVE"));
    if (!canCheckIn) {
      return NextResponse.json(
        { error: "Only active club members and aspirants can check in." },
        { status: 403 },
      );
    }

    // Check if user has already checked in for this activity/event
    const { data: existingCheckIn } = await admin
      .from("attendance_records")
      .select("id, check_in_time")
      .eq(session.activity_id ? "activity_id" : "event_id", targetId)
      .eq("profile_id", user.id)
      .maybeSingle();

    if (existingCheckIn) {
      return NextResponse.json(
        {
          error: `You have already checked in for ${eventTitle}.`,
          alreadyCheckedIn: true,
          eventId: targetId,
          eventTitle,
          volunteerHours: hours,
          checkInTime: existingCheckIn.check_in_time,
        },
        { status: 409 },
      );
    }

    // Insert verified attendance record with admin client
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
        check_in_time: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Attendance check-in insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to record attendance. Please try again." },
        { status: 500 },
      );
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
        ? "Verified service project attendance"
        : "Verified activity attendance",
    });

    return NextResponse.json({
      success: true,
      message: `Check-in confirmed for ${eventTitle}! ${hours} volunteer hours recorded.`,
      recordId: record.id,
      volunteerHours: hours,
      eventTitle,
      eventId: targetId,
    });
  } catch (err: unknown) {
    console.error("Unexpected error during check-in:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}
