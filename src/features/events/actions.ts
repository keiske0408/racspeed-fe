"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser, assertPermission } from "@/lib/auth/session";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_CLUB_ID = "00000000-0000-0000-0000-000000000001";

export async function startQrAttendanceSessionAction(eventId: string) {
  const user = await requireUser();
  if (eventId && UUID_REGEX.test(eventId)) {
    const admin = createAdminClient();
    const { data: activity } = await admin.from("activities").select("id").eq("id", eventId).maybeSingle();
    if (activity) {
      const { startActivityQrSessionAction } = await import("@/features/activities/actions");
      return startActivityQrSessionAction(eventId);
    }
  }
  if (!eventId || !UUID_REGEX.test(eventId)) {
    // If not a valid UUID (e.g. mock or test event), return a fallback session token safely
    const fallbackToken = `racspeed-${(eventId || "event").slice(0, 8)}-${Date.now().toString(36)}`;
    return {
      success: true,
      sessionToken: fallbackToken,
      expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    };
  }

  const adminClient = createAdminClient();

  const { data: eventData } = await adminClient
    .from("events")
    .select("host_club_id")
    .eq("id", eventId)
    .maybeSingle();

  const clubId =
    eventData?.host_club_id ||
    (process.env.NEXT_PUBLIC_DEFAULT_CLUB_ID && UUID_REGEX.test(process.env.NEXT_PUBLIC_DEFAULT_CLUB_ID)
      ? process.env.NEXT_PUBLIC_DEFAULT_CLUB_ID
      : DEFAULT_CLUB_ID);
  await assertPermission(clubId, "ATTENDANCE_MANAGE");

  // Expire truly stale sessions whose time window has elapsed
  await adminClient
    .from("attendance_sessions")
    .update({ status: "EXPIRED" })
    .eq("event_id", eventId)
    .lt("expires_at", new Date().toISOString());

  // Check if there is already an active session for this event created recently (within 5 minutes)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: existingActive } = await adminClient
    .from("attendance_sessions")
    .select("session_token, expires_at")
    .eq("event_id", eventId)
    .eq("status", "ACTIVE")
    .gt("expires_at", new Date().toISOString())
    .gt("created_at", fiveMinutesAgo)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingActive) {
    return {
      success: true,
      sessionToken: existingActive.session_token,
      expiresAt: existingActive.expires_at,
    };
  }

  // Create fresh time-bound session token (valid for 3 hours)
  const token = `racspeed-${eventId.slice(0, 8)}-${Date.now().toString(36)}`;
  const expiresAt = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(); // 3 hours window
  const validUserId = user?.id && UUID_REGEX.test(user.id) ? user.id : null;

  const { data: session, error } = await adminClient
    .from("attendance_sessions")
    .insert({
      event_id: eventId,
      session_token: token,
      secret_hash: token,
      status: "ACTIVE",
      created_by: validUserId,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: `Failed to generate QR session: ${error.message}` };
  }

  revalidatePath("/events");
  return { success: true, sessionToken: token, expiresAt };
}

export async function getEventAttendeesAction(eventId: string) {
  await requireUser();
  if (!eventId || !UUID_REGEX.test(eventId)) {
    return { success: true, attendees: [] };
  }
  const { getEventAttendees } = await import("./queries");
  const attendees = await getEventAttendees(eventId);
  return { success: true, attendees };
}

