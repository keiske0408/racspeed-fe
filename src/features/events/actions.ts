"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser, assertPermission } from "@/lib/auth/session";

const createEventSchema = z.object({
  title: z.string().min(3, "Event title must be at least 3 characters"),
  description: z.string().optional(),
  category: z.string().default("GENERAL_ASSEMBLY"),
  location: z.string().min(2, "Location is required"),
  startTime: z.string().min(10, "Start time is required"),
  endTime: z.string().min(10, "End time is required"),
  volunteerHoursDefault: z.coerce.number().min(0).default(3.0),
  clubId: z.string().uuid().default("00000000-0000-0000-0000-000000000001"),
});

export async function createEventAction(formData: FormData) {
  const user = await requireUser();
  const rawClubId = (formData.get("clubId") as string) || "00000000-0000-0000-0000-000000000001";
  await assertPermission(rawClubId, "EVENT_CREATE");

  const validated = createEventSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    category: formData.get("category"),
    location: formData.get("location"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    volunteerHoursDefault: formData.get("volunteerHoursDefault"),
    clubId: rawClubId,
  });

  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message || "Invalid event details" };
  }

  const { title, description, category, location, startTime, endTime, volunteerHoursDefault, clubId } = validated.data;
  const supabase = await createClient();

  const { data: newEvent, error: insertError } = await supabase
    .from("events")
    .insert({
      host_club_id: clubId,
      title,
      description: description || null,
      event_category: category,
      location,
      start_time: new Date(startTime).toISOString(),
      end_time: new Date(endTime).toISOString(),
      volunteer_hours_default: volunteerHoursDefault,
      attendance_manager_id: user.id,
      is_published: true,
    })
    .select()
    .single();

  if (insertError) {
    return { success: false, error: `Failed to create event: ${insertError.message}` };
  }

  // Auto-generate initial attendance session
  const adminClient = createAdminClient();
  const token = `racspeed-${newEvent.id.slice(0, 8)}-${Date.now().toString(36)}`;
  const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(); // 4 hours

    await adminClient.from("attendance_sessions").insert({
      event_id: newEvent.id,
      session_token: token,
      secret_hash: token,
      status: "ACTIVE",
      created_by: user.id,
      expires_at: expiresAt,
    });

  revalidatePath("/events");
  revalidatePath("/dashboard");
  return { success: true, message: `Event '${title}' registered successfully!`, eventId: newEvent.id };
}

export async function startQrAttendanceSessionAction(eventId: string) {
  const user = await requireUser();
  const adminClient = createAdminClient();

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

  const { data: session, error } = await adminClient
    .from("attendance_sessions")
    .insert({
      event_id: eventId,
      session_token: token,
      secret_hash: token,
      status: "ACTIVE",
      created_by: user.id,
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

