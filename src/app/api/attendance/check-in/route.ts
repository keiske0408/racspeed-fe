import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

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
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized: Please sign in to check in." }, { status: 401 });
    }

    const body = await request.json();
    const parsed = checkInSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request payload", details: parsed.error.issues }, { status: 400 });
    }

    const sessionToken = (parsed.data.sessionToken || parsed.data.token)!.trim();

    // Verify attendance session exists and is ACTIVE
    const { data: session, error: sessionError } = await supabase
      .from("attendance_sessions")
      .select("id, event_id, status, expires_at, events(host_club_id, volunteer_hours_default)")
      .eq("session_token", sessionToken)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Invalid or expired check-in session token." }, { status: 404 });
    }

    if (session.status !== "ACTIVE" || new Date(session.expires_at) < new Date()) {
      return NextResponse.json({ error: "Check-in window for this session has closed." }, { status: 410 });
    }

    const event = (session as any).events;
    const hours = event?.volunteer_hours_default || 0.0;

    // Check if user has already checked in for this event
    const { data: existingCheckIn } = await supabase
      .from("attendance_records")
      .select("id")
      .eq("event_id", session.event_id)
      .eq("profile_id", user.id)
      .single();

    if (existingCheckIn) {
      return NextResponse.json({
        error: "Duplicate check-in rejected: You have already checked in for this event.",
      }, { status: 409 });
    }

    // Insert verified attendance record
    const { data: record, error: insertError } = await supabase
      .from("attendance_records")
      .insert({
        event_id: session.event_id,
        profile_id: user.id,
        session_id: session.id,
        attended: true,
        check_in_method: "QR",
        volunteer_hours: hours,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: "Failed to record attendance. Please try again." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Check-in confirmed! ${hours} volunteer hours recorded.`,
      recordId: record.id,
      volunteerHours: hours,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
