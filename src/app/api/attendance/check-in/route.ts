import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
      const val = obj.token || obj.sessionToken || obj.session_token || obj.checkInToken;
      if (val) return String(val).trim();
    } catch {}
  }

  // 2. If full URL or URL path with query params
  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.includes("?")) {
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
  const match = trimmed.match(/[?&](?:token|sessionToken|checkInToken)=([^&#\s]+)/i);
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
    eventId: z.string().uuid("Invalid event ID").optional(),
  })
  .refine((data) => Boolean(data.sessionToken || data.token), {
    message: "Session token is required",
    path: ["sessionToken"],
  });

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
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = checkInSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const rawToken = (parsed.data.sessionToken || parsed.data.token)!.trim();
    const sessionToken = extractToken(rawToken);

    if (!sessionToken) {
      return NextResponse.json(
        { error: "Invalid check-in token provided." },
        { status: 400 }
      );
    }

    // Use admin client to verify attendance session and insert record (bypasses RLS for attendees)
    const admin = createAdminClient();

    // Verify attendance session exists
    const { data: session, error: sessionError } = await admin
      .from("attendance_sessions")
      .select("id, event_id, status, expires_at, events(title, host_club_id, volunteer_hours_default)")
      .eq("session_token", sessionToken)
      .maybeSingle();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: "Invalid check-in session token. Please scan the active QR code." },
        { status: 404 }
      );
    }

    // Verify session has not expired by timestamp and is not explicitly closed
    const isPastExpiry = new Date(session.expires_at) < new Date();
    if (session.status === "CLOSED" || isPastExpiry) {
      return NextResponse.json(
        { error: "Check-in window for this session has closed." },
        { status: 410 }
      );
    }

    const event = (session as any).events;
    const hours = Number(event?.volunteer_hours_default || 3.0);
    const eventTitle = event?.title || "Event";

    // Check if user has already checked in for this event
    const { data: existingCheckIn } = await admin
      .from("attendance_records")
      .select("id, check_in_time")
      .eq("event_id", session.event_id)
      .eq("profile_id", user.id)
      .maybeSingle();

    if (existingCheckIn) {
      return NextResponse.json(
        {
          error: `You have already checked in for ${eventTitle}.`,
          alreadyCheckedIn: true,
          eventId: session.event_id,
          eventTitle,
          volunteerHours: hours,
          checkInTime: existingCheckIn.check_in_time,
        },
        { status: 409 }
      );
    }

    // Insert verified attendance record with admin client
    const { data: record, error: insertError } = await admin
      .from("attendance_records")
      .insert({
        event_id: session.event_id,
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
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Check-in confirmed for ${eventTitle}! ${hours} volunteer hours recorded.`,
      recordId: record.id,
      volunteerHours: hours,
      eventTitle,
      eventId: session.event_id,
    });
  } catch (err: any) {
    console.error("Unexpected error during check-in:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

