"use server";

import { createHash, randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser, assertPermission } from "@/lib/auth/session";
import {
  DEFAULT_QR_EXPIRATION_MINUTES,
  decodeSessionSecretMeta,
  encodeSessionSecretMeta,
  normalizeQrDurationMinutes,
  resolveQrSessionLifecycle,
  type QrSessionLifecycleStatus,
} from "@/features/activities/rules";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_CLUB_ID = "00000000-0000-0000-0000-000000000001";

export async function startQrAttendanceSessionAction(
  eventId: string,
  options?: {
    durationMinutes?: number;
    forceRegenerate?: boolean;
    opensAt?: string;
    closesAt?: string;
  },
) {
  const user = await requireUser();
  const durationMinutes = normalizeQrDurationMinutes(
    options?.durationMinutes ?? DEFAULT_QR_EXPIRATION_MINUTES,
  );

  if (eventId && UUID_REGEX.test(eventId)) {
    const admin = createAdminClient();
    const { data: activity } = await admin
      .from("activities")
      .select("id")
      .eq("id", eventId)
      .maybeSingle();
    if (activity) {
      const { startActivityQrSessionAction } =
        await import("@/features/activities/actions");
      return startActivityQrSessionAction(eventId, options);
    }
  }

  const defaultClubId =
    process.env.NEXT_PUBLIC_DEFAULT_CLUB_ID &&
    UUID_REGEX.test(process.env.NEXT_PUBLIC_DEFAULT_CLUB_ID)
      ? process.env.NEXT_PUBLIC_DEFAULT_CLUB_ID
      : DEFAULT_CLUB_ID;

  if (!eventId || !UUID_REGEX.test(eventId)) {
    try {
      await assertPermission(defaultClubId, "ATTENDANCE_MANAGE");
    } catch (err) {
      return {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : "Unauthorized: You cannot generate QR codes.",
      };
    }
    const nowIso = new Date().toISOString();
    const fallbackToken = `racspeed-${randomBytes(24).toString("base64url")}`;
    return {
      success: true,
      sessionToken: fallbackToken,
      createdAt: nowIso,
      expiresAt: new Date(
        Date.now() + durationMinutes * 60_000,
      ).toISOString(),
      durationMinutes,
      status: "ACTIVE" as QrSessionLifecycleStatus,
    };
  }

  const adminClient = createAdminClient();

  const { data: eventData } = await adminClient
    .from("events")
    .select("host_club_id, end_time")
    .eq("id", eventId)
    .maybeSingle();

  if (
    eventData?.end_time &&
    new Date(eventData.end_time).getTime() < Date.now()
  ) {
    return {
      success: false,
      error: "This event has ended and is now archived.",
    };
  }

  const clubId = eventData?.host_club_id || defaultClubId;
  try {
    await assertPermission(clubId, "ATTENDANCE_MANAGE");
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Unauthorized: You cannot generate QR codes.",
    };
  }

  const now = new Date();
  const nowIso = now.toISOString();

  // Expire truly stale sessions whose time window has elapsed
  await adminClient
    .from("attendance_sessions")
    .update({ status: "EXPIRED" })
    .eq("event_id", eventId)
    .eq("status", "ACTIVE")
    .lt("expires_at", nowIso);

  if (!options?.forceRegenerate && options?.durationMinutes === undefined) {
    const { data: existingActive } = await adminClient
      .from("attendance_sessions")
      .select("session_token, created_at, expires_at, status, secret_hash")
      .eq("event_id", eventId)
      .eq("status", "ACTIVE")
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingActive) {
      const row = existingActive as {
        session_token: string;
        created_at?: string;
        expires_at: string;
        status?: string;
        secret_hash?: string | null;
      };
      const resolved = resolveQrSessionLifecycle({
        dbStatus: row.status,
        secretHash: row.secret_hash,
        expiresAt: row.expires_at,
        activityEndAt: eventData?.end_time,
        now,
      });
      if (resolved.status === "ACTIVE" || resolved.status === "SCHEDULED") {
        return {
          success: true,
          sessionToken: row.session_token,
          createdAt: row.created_at || nowIso,
          expiresAt: row.expires_at,
          durationMinutes: resolved.durationMinutes,
          status: resolved.status,
        };
      }
    }
  }

  // Revoke any previous active sessions for this event before issuing a new token
  const revokedSecret = encodeSessionSecretMeta({
    hash: "revoked",
    lifecycleStatus: "REVOKED",
    durationMinutes,
  });
  await adminClient
    .from("attendance_sessions")
    .update({
      status: "CLOSED",
      secret_hash: revokedSecret,
      expires_at: nowIso,
    })
    .eq("event_id", eventId)
    .eq("status", "ACTIVE");

  // Create fresh time-bound cryptographically random session token
  const token = `racspeed-${randomBytes(24).toString("base64url")}`;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(
    now.getTime() + durationMinutes * 60_000,
  ).toISOString();
  const validUserId = user?.id && UUID_REGEX.test(user.id) ? user.id : null;
  const secretHash = encodeSessionSecretMeta({
    hash: tokenHash,
    lifecycleStatus: "ACTIVE",
    durationMinutes,
    opensAt: options?.opensAt || null,
    closesAt: options?.closesAt || null,
  });

  const { error } = await adminClient
    .from("attendance_sessions")
    .insert({
      event_id: eventId,
      session_token: token,
      secret_hash: secretHash,
      status: "ACTIVE",
      created_by: validUserId,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) {
    return {
      success: false,
      error: `Failed to generate QR session: ${error.message}`,
    };
  }

  revalidatePath("/events");
  return {
    success: true,
    sessionToken: token,
    createdAt: nowIso,
    expiresAt,
    durationMinutes,
    status: "ACTIVE" as QrSessionLifecycleStatus,
  };
}

export async function revokeQrAttendanceSessionAction(
  eventId: string,
  sessionToken?: string,
) {
  await requireUser();
  if (eventId && UUID_REGEX.test(eventId)) {
    const admin = createAdminClient();
    const { data: activity } = await admin
      .from("activities")
      .select("id")
      .eq("id", eventId)
      .maybeSingle();
    if (activity) {
      const { revokeActivityQrSessionAction } =
        await import("@/features/activities/actions");
      return revokeActivityQrSessionAction(eventId, sessionToken);
    }
  }

  const defaultClubId =
    process.env.NEXT_PUBLIC_DEFAULT_CLUB_ID &&
    UUID_REGEX.test(process.env.NEXT_PUBLIC_DEFAULT_CLUB_ID)
      ? process.env.NEXT_PUBLIC_DEFAULT_CLUB_ID
      : DEFAULT_CLUB_ID;

  try {
    await assertPermission(defaultClubId, "ATTENDANCE_MANAGE");
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Unauthorized: You cannot revoke QR codes.",
    };
  }

  if (!eventId || !UUID_REGEX.test(eventId)) {
    return {
      success: true,
      status: "REVOKED" as QrSessionLifecycleStatus,
      message: "QR code revoked.",
    };
  }

  const adminClient = createAdminClient();
  const nowIso = new Date().toISOString();
  const revokedSecret = encodeSessionSecretMeta({
    hash: "revoked",
    lifecycleStatus: "REVOKED",
  });

  let query = adminClient
    .from("attendance_sessions")
    .update({
      status: "CLOSED",
      secret_hash: revokedSecret,
      expires_at: nowIso,
    })
    .eq("event_id", eventId);

  if (sessionToken) {
    query = query.eq("session_token", sessionToken);
  } else {
    query = query.eq("status", "ACTIVE");
  }

  const { error } = await query;
  if (error) {
    return {
      success: false,
      error: `Failed to revoke QR session: ${error.message}`,
    };
  }

  revalidatePath("/events");
  return {
    success: true,
    status: "REVOKED" as QrSessionLifecycleStatus,
    message: "QR code has been revoked. Attendance records remain preserved.",
  };
}

export async function updateQrAttendanceSessionStatusAction(
  eventId: string,
  nextStatus: "ACTIVE" | "PAUSED" | "CLOSED",
) {
  await requireUser();
  if (eventId && UUID_REGEX.test(eventId)) {
    const admin = createAdminClient();
    const { data: activity } = await admin
      .from("activities")
      .select("id")
      .eq("id", eventId)
      .maybeSingle();
    if (activity) {
      const { updateActivityQrSessionStatusAction } =
        await import("@/features/activities/actions");
      return updateActivityQrSessionStatusAction(eventId, nextStatus);
    }
  }

  const defaultClubId =
    process.env.NEXT_PUBLIC_DEFAULT_CLUB_ID &&
    UUID_REGEX.test(process.env.NEXT_PUBLIC_DEFAULT_CLUB_ID)
      ? process.env.NEXT_PUBLIC_DEFAULT_CLUB_ID
      : DEFAULT_CLUB_ID;

  try {
    await assertPermission(defaultClubId, "ATTENDANCE_MANAGE");
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Unauthorized: You cannot manage attendance sessions.",
    };
  }

  if (!eventId || !UUID_REGEX.test(eventId)) {
    return {
      success: true,
      status: nextStatus as QrSessionLifecycleStatus,
      message: `Session ${nextStatus.toLowerCase()}.`,
    };
  }

  const adminClient = createAdminClient();
  const { data: latest } = await adminClient
    .from("attendance_sessions")
    .select("id, secret_hash")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latest) {
    return {
      success: false,
      error: "No QR session found for this event.",
    };
  }

  const currentMeta = decodeSessionSecretMeta(
    (latest as { secret_hash?: string | null }).secret_hash,
  );
  const updatedSecret = encodeSessionSecretMeta({
    ...currentMeta,
    hash: currentMeta.hash || "session",
    lifecycleStatus: nextStatus,
  });

  const { error } = await adminClient
    .from("attendance_sessions")
    .update({
      status: nextStatus === "CLOSED" ? "CLOSED" : "ACTIVE",
      secret_hash: updatedSecret,
    })
    .eq("id", (latest as { id: string }).id);

  if (error) {
    return {
      success: false,
      error: `Failed to update session status: ${error.message}`,
    };
  }

  revalidatePath("/events");
  return {
    success: true,
    status: nextStatus as QrSessionLifecycleStatus,
    message: `Attendance session marked as ${nextStatus.toLowerCase()}.`,
  };
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
