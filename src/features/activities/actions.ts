"use server";

import { createHash, randomBytes, randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserAccessContext, requireUser } from "@/lib/auth/session";
import { manilaLocalToISO } from "@/lib/utils/dates";
import { rotaryYearFor } from "@/lib/utils/rotary-year";
import { awardEngagementPoints } from "@/lib/services/rewards";
import {
  dispatchNotification,
  type NotificationType,
} from "@/lib/services/notifications/dispatch";
import type { TeamRole } from "./types";
import {
  createTask,
  updateTask,
  deleteTask,
  readTasksStore,
  writeTasksStore,
  type TaskCommittee,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/data/tasks-storage";
import { readPartnershipsStore } from "@/lib/data/partnerships-storage";
import {
  ALLOWED_MEDIA_TYPES,
  MAX_MEDIA_BYTES,
  commentSchema,
  createActivitySchema,
  resolveMinMembers,
  rsvpSchema,
  teamMemberSchema,
  UUID_PATTERN,
  uuidString,
  type CreateActivityData,
  type CreateActivityInput,
} from "./schemas";
import {
  canTransition,
  DEFAULT_QR_EXPIRATION_MINUTES,
  decodeSessionSecretMeta,
  encodeSessionSecretMeta,
  evaluateRsvp,
  evaluateSelfCheckIn,
  isQrCheckInApplicable,
  normalizeQrDurationMinutes,
  resolveArchiveState,
  resolveQrSessionLifecycle,
  type QrSessionLifecycleStatus,
} from "./rules";
import {
  getActivityMediaPage,
  isClubParticipant,
  MEDIA_BUCKET,
} from "./queries";
import {
  ACTIVITY_STATUSES,
  COMMITTEES,
  isProjectKind,
  type ActivityMediaDTO,
  type ActivityStatus,
  type RsvpResponse,
} from "./types";

type ActionResult<T = object> =
  ({ success: true; message?: string } & T) | { success: false; error: string };

function revalidateActivity(activityId?: string) {
  revalidatePath("/project-center");
  revalidatePath("/partnerships");
  if (activityId) revalidatePath(`/project-center/${activityId}`);
  revalidatePath("/dashboard");
}

async function notifyProjectAudience({
  activityId,
  clubId,
  title,
  message,
  type = "GENERAL",
  excludeProfileIds = [],
  dedupePrefix,
}: {
  activityId: string;
  clubId: string;
  title: string;
  message: string;
  type?: NotificationType;
  excludeProfileIds?: string[];
  dedupePrefix: string;
}) {
  try {
    const admin = createAdminClient();
    const [teamRes, rsvpRes, followerRes] = await Promise.all([
      admin.from("activity_team").select("profile_id").eq("activity_id", activityId),
      admin
        .from("activity_rsvps")
        .select("profile_id")
        .eq("activity_id", activityId)
        .eq("response", "GOING"),
      admin.from("activity_followers").select("profile_id").eq("activity_id", activityId),
    ]);

    const recipientSet = new Set<string>();
    for (const row of teamRes.data || []) recipientSet.add(row.profile_id);
    for (const row of rsvpRes.data || []) recipientSet.add(row.profile_id);
    for (const row of followerRes.data || []) recipientSet.add(row.profile_id);

    for (const id of excludeProfileIds) {
      recipientSet.delete(id);
    }

    if (recipientSet.size === 0) return;

    await Promise.all(
      Array.from(recipientSet).map((profileId) =>
        dispatchNotification({
          profileId,
          clubId,
          title,
          message,
          type,
          linkUrl: `/project-center/${activityId}`,
          dedupeKey: `${dedupePrefix}_${profileId}`,
          sendPush: true,
          sendEmail: false,
        }),
      ),
    );
  } catch (err) {
    console.warn("Could not dispatch project audience notifications:", err);
  }
}

async function logActivity(
  activityId: string,
  actorId: string,
  action: string,
  details: Record<string, unknown> = {},
) {
  try {
    await createAdminClient()
      .from("activity_log")
      .insert({ activity_id: activityId, actor_id: actorId, action, details });
  } catch (err) {
    console.warn("Could not write activity log:", err);
  }
}

/** Loads an activity and resolves what the current user may do with it. */
async function loadActivityAccess(activityId: string) {
  const user = await requireUser();
  if (!uuidString.safeParse(activityId).success) return null;

  const admin = createAdminClient();
  const { data: activity } = await admin
    .from("activities")
    .select(
      "id, club_id, kind, status, title, owner_id, start_at, end_at, rsvp_enabled, rsvp_deadline, capacity, self_check_in_enabled, qr_check_in_enabled, check_in_window_minutes, volunteer_hours_default, legacy_event_id",
    )
    .eq("id", activityId)
    .maybeSingle();
  if (!activity) return null;

  const [context, participant, chair] = await Promise.all([
    getUserAccessContext(activity.club_id),
    isClubParticipant(activity.club_id, user.id),
    admin
      .from("activity_team")
      .select("team_role")
      .eq("activity_id", activityId)
      .eq("profile_id", user.id)
      .in("team_role", ["CHAIR", "CO_CHAIR"])
      .maybeSingle(),
  ]);

  const perms = context.permissions;
  const canManage =
    context.isPlatformAdmin ||
    activity.owner_id === user.id ||
    Boolean(chair.data) ||
    perms.has("EVENT_UPDATE") ||
    perms.has("PROJECT_UPDATE") ||
    perms.has("ROLE_ASSIGN") ||
    perms.has("SETTINGS_MANAGE");

  const canManageTasks = canManage || perms.has("TASK_MANAGE");
  const canManageArchive = canManage || perms.has("PROJECT_ARCHIVE");
  const canManageMedia = canManage || perms.has("MEDIA_MANAGE");
  const canModerateDiscussion = canManage || perms.has("DISCUSSION_MODERATE");

  const canReassignOwner =
    context.isPlatformAdmin ||
    perms.has("PROJECT_UPDATE") ||
    perms.has("EVENT_UPDATE") ||
    perms.has("SETTINGS_MANAGE");

  return {
    user,
    activity,
    isParticipant: participant || context.isPlatformAdmin,
    canManage,
    canManageTasks,
    canManageArchive,
    canManageMedia,
    canModerateDiscussion,
    canManageAttendance: canManage || perms.has("ATTENDANCE_MANAGE"),
    canReassignOwner,
    qrCheckInEnabled: isQrCheckInApplicable({
      qr_check_in_enabled: (activity as any)?.qr_check_in_enabled,
      title: activity.title,
      kind: activity.kind,
    }),
  };
}

function toActivityRow(data: CreateActivityData) {
  const startIso = manilaLocalToISO(data.startAt);
  return {
    kind: data.kind,
    meeting_type: "meetingType" in data ? data.meetingType : null,
    title: data.title,
    short_description: data.shortDescription || null,
    description: data.description || null,
    location: data.location || null,
    start_at: startIso,
    end_at: manilaLocalToISO(data.endAt),
    all_day: data.allDay,
    committee: data.committee || null,
    min_members_required: resolveMinMembers(data),
    capacity: data.capacity || null,
    rsvp_enabled: data.rsvpEnabled,
    rsvp_deadline: data.rsvpDeadline
      ? manilaLocalToISO(data.rsvpDeadline)
      : null,
    self_check_in_enabled: data.selfCheckInEnabled,
    qr_check_in_enabled: data.qrCheckInEnabled ?? true,
    check_in_window_minutes: data.checkInWindowMinutes,
    volunteer_hours_default: data.volunteerHoursDefault,
    rotary_year: rotaryYearFor(new Date(startIso)),
  };
}

async function syncProjectRelations(
  activityId: string,
  data: CreateActivityData,
) {
  if (!("areasOfFocus" in data)) return;
  const admin = createAdminClient();

  await admin.from("activity_project_details").upsert({
    activity_id: activityId,
    objective: data.objective || null,
    beneficiary_type: data.beneficiaryType || null,
    beneficiary_count: data.beneficiaryTarget,
    funding_total: data.fundingTarget,
    funding_source: data.fundingSource || null,
    updated_at: new Date().toISOString(),
  });

  await admin
    .from("activity_areas_of_focus")
    .delete()
    .eq("activity_id", activityId);
  if (data.areasOfFocus.length > 0) {
    const { data: areas } = await admin
      .from("areas_of_focus")
      .select("id, code")
      .in("code", data.areasOfFocus);
    if (areas?.length) {
      await admin.from("activity_areas_of_focus").insert(
        areas.map((a) => ({
          activity_id: activityId,
          area_of_focus_id: a.id,
        })),
      );
    }
  }

  await admin.from("activity_sdgs").delete().eq("activity_id", activityId);
  if (data.sdgs.length > 0) {
    const { data: goals } = await admin
      .from("sdgs")
      .select("id, number")
      .in("number", data.sdgs);
    if (goals?.length) {
      await admin
        .from("activity_sdgs")
        .insert(goals.map((g) => ({ activity_id: activityId, sdg_id: g.id })));
    }
  }

  await admin.from("activity_partners").delete().eq("activity_id", activityId);
  if (data.partners.length > 0) {
    await admin.from("activity_partners").insert(
      data.partners.map((p) => ({
        activity_id: activityId,
        name: p.name,
        partner_role: p.role,
        sister_club_id:
          p.sisterClubId && UUID_PATTERN.test(p.sisterClubId)
            ? p.sisterClubId
            : null,
      })),
    );
  }
}

async function validateProjectPartners(data: CreateActivityData) {
  if (!("partners" in data)) return null;
  const partnerIds = [
    ...new Set([
      ...(data.sisterClubId ? [data.sisterClubId] : []),
      ...data.partners.flatMap((partner) =>
        partner.sisterClubId ? [partner.sisterClubId] : [],
      ),
    ]),
  ];
  if (partnerIds.length === 0) return null;

  const uuidPartnerIds = partnerIds.filter((id) => UUID_PATTERN.test(id));
  const { data: registeredPartners, error } = await createAdminClient()
    .from("sister_clubs")
    .select("id")
    .eq("home_club_id", data.clubId)
    .in("id", uuidPartnerIds);

  const registeredIdSet = new Set(
    (registeredPartners || []).map((p: { id: string }) => p.id),
  );

  try {
    const store = readPartnershipsStore();
    if (store && Array.isArray(store.customClubs)) {
      for (const club of store.customClubs) {
        registeredIdSet.add(club.id);
      }
    }
  } catch {
    // ignore if store is mocked or unavailable
  }

  const allFound = partnerIds.every((id) => registeredIdSet.has(id));
  if (!allFound || error) {
    return "The selected partners are not all registered to this club.";
  }
  return null;
}

export async function createActivityAction(
  input: CreateActivityInput,
): Promise<ActionResult<{ activityId: string }>> {
  const user = await requireUser();
  const parsed = createActivitySchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid activity details",
    };
  }
  const data = parsed.data;

  const context = await getUserAccessContext(data.clubId);
  const required = isProjectKind(data.kind) ? "PROJECT_CREATE" : "EVENT_CREATE";
  if (!context.isPlatformAdmin && !context.permissions.has(required)) {
    return {
      success: false,
      error: "You do not have permission to create this kind of activity.",
    };
  }

  const partnerError = await validateProjectPartners(data);
  if (partnerError) return { success: false, error: partnerError };
  const admin = createAdminClient();
  const ownerId =
    (context.isPlatformAdmin || context.permissions.has("PROJECT_UPDATE")) &&
    data.ownerId
      ? data.ownerId
      : user.id;
  const { data: created, error } = await admin
    .from("activities")
    .insert({
      ...toActivityRow(data),
      status: data.status,
      club_id: data.clubId,
      owner_id: ownerId,
      created_by: user.id,
      is_published: data.status !== "DRAFT",
    })
    .select("id")
    .single();

  if (error || !created) {
    return {
      success: false,
      error: `Failed to create activity: ${error?.message ?? "unknown error"}`,
    };
  }

  const teamInserts: {
    activity_id: string;
    profile_id: string;
    team_role: TeamRole;
  }[] = [
    {
      activity_id: created.id,
      profile_id: ownerId,
      team_role: "CHAIR",
    },
  ];

  const followerIds = new Set<string>([user.id, ownerId]);
  for (const cm of data.committeeMembers || []) {
    if (cm.profileId !== ownerId) {
      teamInserts.push({
        activity_id: created.id,
        profile_id: cm.profileId,
        team_role: (cm.role as TeamRole) || "COMMITTEE",
      });
      followerIds.add(cm.profileId);
    }
  }

  await Promise.all([
    admin.from("activity_team").insert(teamInserts),
    admin.from("activity_followers").upsert(
      Array.from(followerIds).map((profile_id) => ({
        activity_id: created.id,
        profile_id,
      })),
    ),
    syncProjectRelations(created.id, data),
  ]);

  // Dispatch notifications to appointed committee members
  for (const cm of data.committeeMembers || []) {
    if (cm.profileId !== user.id) {
      dispatchNotification({
        profileId: cm.profileId,
        clubId: data.clubId,
        title: "Appointed to Project Committee",
        message: `You were appointed to the committee for "${data.title}" as ${(cm.role || "COMMITTEE").replaceAll("_", " ")}.`,
        type: "GENERAL",
        linkUrl: `/project-center/${created.id}`,
        dedupeKey: `committee_add_${created.id}_${cm.profileId}`,
        sendPush: true,
      }).catch((e) => console.warn("Failed committee notif:", e));
    }
  }

  await logActivity(created.id, user.id, "CREATED", { kind: data.kind });

  revalidateActivity(created.id);
  return {
    success: true,
    message: `'${data.title}' created.`,
    activityId: created.id,
  };
}

export async function updateActivityAction(
  activityId: string,
  input: CreateActivityInput,
): Promise<ActionResult> {
  const access = await loadActivityAccess(activityId);
  if (!access) return { success: false, error: "Activity not found." };
  if (!access.canManage)
    return {
      success: false,
      error: "Only the chair or officers can edit this activity.",
    };

  const parsed = createActivitySchema.safeParse({
    ...input,
    clubId: access.activity.club_id,
  });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid activity details",
    };
  }
  if (parsed.data.kind !== access.activity.kind) {
    return {
      success: false,
      error: "The activity type cannot be changed after creation.",
    };
  }

  const partnerError = await validateProjectPartners(parsed.data);
  if (partnerError) return { success: false, error: partnerError };
  const admin = createAdminClient();
  const updatePayload: Record<string, unknown> = {
    ...toActivityRow(parsed.data),
    updated_at: new Date().toISOString(),
  };

  if (
    parsed.data.ownerId &&
    access.canReassignOwner &&
    parsed.data.ownerId !== access.activity.owner_id
  ) {
    updatePayload.owner_id = parsed.data.ownerId;
    await admin.from("activity_team").upsert(
      {
        activity_id: activityId,
        profile_id: parsed.data.ownerId,
        team_role: "CHAIR",
      },
      { onConflict: "activity_id,profile_id" },
    );
    await logActivity(activityId, access.user.id, "REASSIGNED_OWNER", {
      from: access.activity.owner_id,
      to: parsed.data.ownerId,
    });
  }

  const { error } = await admin
    .from("activities")
    .update(updatePayload)
    .eq("id", activityId);
  if (error)
    return {
      success: false,
      error: `Failed to update activity: ${error.message}`,
    };

  await syncProjectRelations(activityId, parsed.data);
  await logActivity(activityId, access.user.id, "UPDATED");
  revalidateActivity(activityId);
  return { success: true, message: "Activity updated." };
}

export async function updateActivityStatusAction(
  activityId: string,
  status: ActivityStatus,
): Promise<ActionResult> {
  if (!(ACTIVITY_STATUSES as readonly string[]).includes(status)) {
    return { success: false, error: "Unknown status." };
  }
  const access = await loadActivityAccess(activityId);
  if (!access) return { success: false, error: "Activity not found." };
  if (!access.canManage)
    return {
      success: false,
      error: "Only the chair or officers can change the status.",
    };

  const rule = canTransition(
    access.activity.status as ActivityStatus,
    status,
    isProjectKind(access.activity.kind),
  );
  if (!rule.allowed) return { success: false, error: rule.reason! };

  const { error } = await createAdminClient()
    .from("activities")
    .update({
      status,
      is_published: status !== "DRAFT",
      updated_at: new Date().toISOString(),
    })
    .eq("id", activityId);
  if (error) return { success: false, error: error.message };

  await logActivity(activityId, access.user.id, "STATUS_CHANGED", {
    from: access.activity.status,
    to: status,
  });
  revalidateActivity(activityId);
  return { success: true, message: "Status updated." };
}

export async function archiveActivityAction(
  activityId: string,
  archived: boolean,
  note?: string,
): Promise<ActionResult<{ isArchived: boolean }>> {
  const access = await loadActivityAccess(activityId);
  if (!access) return { success: false, error: "Activity not found." };
  if (!access.canManageArchive) {
    return {
      success: false,
      error: "Only the project owner, chair, or club officers can archive or restore this activity.",
    };
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  // Attempt to update explicit archive columns (if migration 0012 is applied), fallback to updated_at
  const { error: colErr } = await admin
    .from("activities")
    .update({
      is_archived: archived,
      archived_at: archived ? nowIso : null,
      archived_by: archived ? access.user.id : null,
      updated_at: nowIso,
    } as Record<string, unknown>)
    .eq("id", activityId);

  if (colErr) {
    await admin
      .from("activities")
      .update({ updated_at: nowIso })
      .eq("id", activityId);
  }

  await logActivity(
    activityId,
    access.user.id,
    archived ? "ARCHIVED" : "UNARCHIVED",
    {
      previous_status: access.activity.status,
      ...(note?.trim() ? { note: note.trim() } : {}),
    },
  );

  revalidateActivity(activityId);
  return {
    success: true,
    isArchived: archived,
    message: archived
      ? `'${access.activity.title}' moved to archive.`
      : `'${access.activity.title}' restored to active workspace.`,
  };
}

export async function hardDeleteActivityAction(
  activityId: string,
): Promise<ActionResult> {
  const access = await loadActivityAccess(activityId);
  if (!access) return { success: false, error: "Activity not found." };
  if (!access.canManageArchive && !access.user.isPlatformAdmin) {
    return {
      success: false,
      error: "Only project owners, club officers, or platform administrators can permanently delete this project.",
    };
  }

  const admin = createAdminClient();

  // Ensure activity is archived before hard delete (querying * and activity_log separately
  // so missing optional columns never cause PostgREST to return null)
  const [{ data: actRow }, { data: logRows }] = await Promise.all([
    admin.from("activities").select("*").eq("id", activityId).maybeSingle(),
    admin
      .from("activity_log")
      .select("action, created_at")
      .eq("activity_id", activityId),
  ]);

  const archiveState = resolveArchiveState({
    ...((actRow as Record<string, unknown>) || {}),
    activity_log: (logRows as Array<{ action: string; created_at: string }>) || [],
  });
  if (!archiveState.isArchived) {
    return {
      success: false,
      error: "Only archived projects can be permanently deleted. Please archive the project first.",
    };
  }

  // 1. Purge any uploaded media files from Supabase storage
  try {
    const { data: mediaFiles } = await admin
      .from("activity_media")
      .select("storage_path")
      .eq("activity_id", activityId);

    if (mediaFiles && mediaFiles.length > 0) {
      const paths = mediaFiles
        .map((m) => m.storage_path)
        .filter((p) => Boolean(p));
      if (paths.length > 0) {
        await admin.storage.from(MEDIA_BUCKET).remove(paths);
      }
    }
  } catch (err) {
    console.warn("Storage media purge on hard delete fallback:", err);
  }

  // 2. Clean up linked tasks in local tasks store and database child tables
  try {
    const currentTasks = readTasksStore();
    const remainingTasks = currentTasks.filter(
      (t) =>
        t.projectId !== activityId &&
        t.projectTitle !== access.activity.title,
    );
    if (remainingTasks.length !== currentTasks.length) {
      writeTasksStore(remainingTasks);
    }
  } catch (err) {
    console.warn("Local task cleanup on activity delete fallback:", err);
  }

  await Promise.allSettled([
    admin.from("activity_media").delete().eq("activity_id", activityId),
    admin.from("activity_comments").delete().eq("activity_id", activityId),
    admin.from("activity_rsvps").delete().eq("activity_id", activityId),
    admin.from("activity_check_ins").delete().eq("activity_id", activityId),
    admin.from("activity_team").delete().eq("activity_id", activityId),
    admin.from("activity_followers").delete().eq("activity_id", activityId),
    admin.from("activity_reports").delete().eq("activity_id", activityId),
    admin.from("activity_log").delete().eq("activity_id", activityId),
  ]);

  // 3. Delete the activity row
  const { error } = await admin
    .from("activities")
    .delete()
    .eq("id", activityId);

  if (error) {
    return {
      success: false,
      error: `Failed to permanently delete activity: ${error.message}`,
    };
  }

  if (access.activity.legacy_event_id) {
    await admin
      .from("events")
      .delete()
      .eq("id", access.activity.legacy_event_id);
  }

  revalidateActivity(activityId);
  return {
    success: true,
    message: `'${access.activity.title}' has been permanently deleted.`,
  };
}

export async function bulkArchiveActivitiesAction(
  activityIds: string[],
): Promise<ActionResult<{ count: number }>> {
  const user = await requireUser();
  const validIds = Array.from(
    new Set(activityIds.filter((id) => uuidString.safeParse(id).success)),
  ).slice(0, 100);

  if (validIds.length === 0) {
    return { success: false, error: "Select at least one activity to archive." };
  }

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("activities")
    .select("id, club_id, title, status, owner_id")
    .in("id", validIds);

  if (!rows || rows.length === 0) {
    return { success: false, error: "No matching activities found." };
  }

  const clubId = rows[0].club_id;
  const context = await getUserAccessContext(clubId);
  const canManageClub =
    context.isPlatformAdmin ||
    context.permissions.has("PROJECT_ARCHIVE") ||
    context.permissions.has("PROJECT_UPDATE") ||
    context.permissions.has("EVENT_UPDATE");

  const allowedRows = rows.filter(
    (r) => canManageClub || r.owner_id === user.id,
  );
  if (allowedRows.length === 0) {
    return {
      success: false,
      error: "You do not have permission to archive the selected activities.",
    };
  }

  const allowedIds = allowedRows.map((r) => r.id);
  const nowIso = new Date().toISOString();

  const { error: colErr } = await admin
    .from("activities")
    .update({
      is_archived: true,
      archived_at: nowIso,
      archived_by: user.id,
      updated_at: nowIso,
    } as Record<string, unknown>)
    .in("id", allowedIds);

  if (colErr) {
    await admin
      .from("activities")
      .update({ updated_at: nowIso })
      .in("id", allowedIds);
  }

  await admin.from("activity_log").insert(
    allowedRows.map((r) => ({
      activity_id: r.id,
      actor_id: user.id,
      action: "ARCHIVED",
      details: { previous_status: r.status, bulk: true },
    })),
  );

  revalidateActivity();
  return {
    success: true,
    count: allowedIds.length,
    message: `Archived ${allowedIds.length} ${allowedIds.length === 1 ? "activity" : "activities"}.`,
  };
}


export async function setRsvpAction(input: {
  activityId: string;
  response: RsvpResponse;
  note?: string;
}): Promise<ActionResult> {
  const parsed = rsvpSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid RSVP",
    };

  const access = await loadActivityAccess(parsed.data.activityId);
  if (!access) return { success: false, error: "Activity not found." };

  const admin = createAdminClient();
  const [{ data: current }, { count: goingCount }] = await Promise.all([
    admin
      .from("activity_rsvps")
      .select("response")
      .eq("activity_id", parsed.data.activityId)
      .eq("profile_id", access.user.id)
      .maybeSingle(),
    admin
      .from("activity_rsvps")
      .select("profile_id", { count: "exact", head: true })
      .eq("activity_id", parsed.data.activityId)
      .eq("response", "GOING"),
  ]);

  const rule = evaluateRsvp({
    status: access.activity.status as ActivityStatus,
    rsvpEnabled: access.activity.rsvp_enabled,
    rsvpDeadline: access.activity.rsvp_deadline,
    startAt: access.activity.start_at,
    capacity: access.activity.capacity,
    goingCount: goingCount ?? 0,
    currentResponse: (current?.response as RsvpResponse) || null,
    nextResponse: parsed.data.response,
    isParticipant: access.isParticipant,
    now: new Date(),
  });
  if (!rule.allowed) return { success: false, error: rule.reason! };

  const { error } = await admin.from("activity_rsvps").upsert({
    activity_id: parsed.data.activityId,
    profile_id: access.user.id,
    response: parsed.data.response,
    note: parsed.data.note || null,
    responded_at: new Date().toISOString(),
  });
  if (error) return { success: false, error: error.message };

  if (parsed.data.response === "GOING") {
    // Add to project followers so they receive project updates
    await admin.from("activity_followers").upsert({
      activity_id: parsed.data.activityId,
      profile_id: access.user.id,
    });

    // Notify user of unlock confirmation
    dispatchNotification({
      profileId: access.user.id,
      clubId: access.activity.club_id,
      title: `You're going to "${access.activity.title}"!`,
      message: "Inside project tasks, discussion threads, and team updates are now unlocked.",
      type: "ACTIVITY_REMINDER",
      linkUrl: `/project-center/${parsed.data.activityId}`,
      dedupeKey: `rsvp_unlocked_${parsed.data.activityId}_${access.user.id}`,
      sendPush: false,
    }).catch((e) => console.warn("RSVP unlock notif error:", e));

    // Notify project owner of new attendee
    if (access.activity.owner_id && access.activity.owner_id !== access.user.id) {
      dispatchNotification({
        profileId: access.activity.owner_id,
        clubId: access.activity.club_id,
        title: "New RSVP: Going",
        message: `${access.user.fullName || "A member"} confirmed attendance for "${access.activity.title}".`,
        type: "GENERAL",
        linkUrl: `/project-center/${parsed.data.activityId}?tab=roster`,
        dedupeKey: `rsvp_owner_${parsed.data.activityId}_${access.user.id}`,
        sendPush: true,
      }).catch((e) => console.warn("RSVP owner notif error:", e));
    }
  }

  revalidateActivity(parsed.data.activityId);
  return { success: true, message: "RSVP saved." };
}

export async function selfCheckInAction(
  activityId: string,
): Promise<ActionResult<{ volunteerHours: number }>> {
  const access = await loadActivityAccess(activityId);
  if (!access) return { success: false, error: "Activity not found." };

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("attendance_records")
    .select("id")
    .eq("activity_id", activityId)
    .eq("profile_id", access.user.id)
    .maybeSingle();

  const a = access.activity;
  const rule = evaluateSelfCheckIn({
    activity: {
      status: a.status as ActivityStatus,
      selfCheckInEnabled: a.self_check_in_enabled,
      startAt: a.start_at,
      endAt: a.end_at,
      checkInWindowMinutes: a.check_in_window_minutes,
    },
    now: new Date(),
    isParticipant: access.isParticipant,
    alreadyCheckedIn: Boolean(existing),
  });
  if (!rule.allowed) return { success: false, error: rule.reason! };

  const hours = Number(a.volunteer_hours_default || 0);
  const { error } = await admin.from("attendance_records").insert({
    activity_id: activityId,
    event_id: a.legacy_event_id,
    profile_id: access.user.id,
    attended: true,
    check_in_method: "SELF",
    volunteer_hours: hours,
    check_in_time: new Date().toISOString(),
  });
  if (error) {
    if (error.code === "23505")
      return { success: false, error: "You are already checked in." };
    return {
      success: false,
      error: "Could not record your check-in. Please try again.",
    };
  }

  await awardEngagementPoints({
    clubId: a.club_id,
    profileId: access.user.id,
    sourceType: isProjectKind(a.kind) ? "SERVICE_CHECK_IN" : "CHECK_IN",
    sourceId: activityId,
    reason: isProjectKind(a.kind)
      ? `Attended Service Project: ${a.title}`
      : `Attended Activity: ${a.title}`,
  });
  await logActivity(activityId, access.user.id, "SELF_CHECK_IN");
  revalidateActivity(activityId);
  return {
    success: true,
    message: `Checked in to ${a.title}.`,
    volunteerHours: hours,
  };
}

export async function revokeAttendanceAction(
  activityId: string,
  recordId: string,
): Promise<ActionResult> {
  if (!uuidString.safeParse(recordId).success)
    return { success: false, error: "Invalid record." };
  const access = await loadActivityAccess(activityId);
  if (!access) return { success: false, error: "Activity not found." };
  if (!access.canManageAttendance)
    return {
      success: false,
      error: "You cannot manage attendance for this activity.",
    };

  const { error } = await createAdminClient()
    .from("attendance_records")
    .delete()
    .eq("id", recordId)
    .eq("activity_id", activityId);
  if (error) return { success: false, error: error.message };

  await logActivity(activityId, access.user.id, "ATTENDANCE_REVOKED", {
    recordId,
  });
  revalidateActivity(activityId);
  return { success: true, message: "Check-in removed." };
}

export interface QrSessionActionData {
  sessionToken: string;
  createdAt: string;
  expiresAt: string;
  durationMinutes: number;
  status: QrSessionLifecycleStatus;
  opensAt?: string | null;
  closesAt?: string | null;
}

export async function startActivityQrSessionAction(
  activityId: string,
  options?: {
    durationMinutes?: number;
    forceRegenerate?: boolean;
    opensAt?: string;
    closesAt?: string;
    sessionDate?: string;
    label?: string;
  },
): Promise<ActionResult<QrSessionActionData>> {
  const access = await loadActivityAccess(activityId);
  if (!access) return { success: false, error: "Activity not found." };
  if (!access.canManageAttendance)
    return {
      success: false,
      error: "You cannot run check-in for this activity.",
    };
  if (new Date(access.activity.end_at).getTime() < Date.now()) {
    return {
      success: false,
      error: "This activity has ended and is now archived.",
    };
  }

  const admin = createAdminClient();
  const now = new Date();
  const nowIso = now.toISOString();
  const durationMinutes = normalizeQrDurationMinutes(
    options?.durationMinutes ?? DEFAULT_QR_EXPIRATION_MINUTES,
  );

  // Expire any stale ACTIVE sessions whose timestamp has passed
  await admin
    .from("attendance_sessions")
    .update({ status: "EXPIRED" })
    .eq("activity_id", activityId)
    .eq("status", "ACTIVE")
    .lt("expires_at", nowIso);

  // If not forcing regeneration and no custom duration override was requested, reuse an active valid session
  if (!options?.forceRegenerate && options?.durationMinutes === undefined) {
    const { data: recent } = await admin
      .from("attendance_sessions")
      .select("session_token, created_at, expires_at, status, secret_hash")
      .eq("activity_id", activityId)
      .eq("status", "ACTIVE")
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recent) {
      const recentRow = recent as {
        session_token: string;
        created_at?: string;
        expires_at: string;
        status?: string;
        secret_hash?: string | null;
      };
      const resolved = resolveQrSessionLifecycle({
        dbStatus: recentRow.status,
        secretHash: recentRow.secret_hash,
        expiresAt: recentRow.expires_at,
        activityEndAt: access.activity.end_at,
        now,
      });
      if (resolved.status === "ACTIVE" || resolved.status === "SCHEDULED") {
        return {
          success: true,
          sessionToken: recentRow.session_token,
          createdAt: recentRow.created_at || nowIso,
          expiresAt: recentRow.expires_at,
          durationMinutes: resolved.durationMinutes,
          status: resolved.status,
          opensAt: resolved.opensAt,
          closesAt: resolved.closesAt,
        };
      }
    }
  }

  // Invalidate any previously active sessions for this activity before issuing a new token
  const revokedSecret = encodeSessionSecretMeta({
    hash: "revoked",
    lifecycleStatus: "REVOKED",
    durationMinutes,
  });
  await admin
    .from("attendance_sessions")
    .update({
      status: "CLOSED",
      secret_hash: revokedSecret,
      expires_at: nowIso,
    })
    .eq("activity_id", activityId)
    .eq("status", "ACTIVE");

  // Generate cryptographically secure 192-bit token
  const token = `racspeed-${randomBytes(24).toString("base64url")}`;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(
    now.getTime() + durationMinutes * 60_000,
  ).toISOString();
  const initialLifecycle: QrSessionLifecycleStatus =
    options?.opensAt && new Date(options.opensAt).getTime() > now.getTime()
      ? "SCHEDULED"
      : "ACTIVE";
  const secretHash = encodeSessionSecretMeta({
    hash: tokenHash,
    lifecycleStatus: initialLifecycle,
    durationMinutes,
    opensAt: options?.opensAt || null,
    closesAt: options?.closesAt || null,
    sessionDate: options?.sessionDate || null,
    label: options?.label || null,
  });

  const { error } = await admin.from("attendance_sessions").insert({
    activity_id: activityId,
    event_id: access.activity.legacy_event_id,
    session_token: token,
    secret_hash: secretHash,
    status: "ACTIVE",
    created_by: access.user.id,
    expires_at: expiresAt,
  });
  if (error)
    return {
      success: false,
      error: `Failed to start QR session: ${error.message}`,
    };

  await logActivity(
    activityId,
    access.user.id,
    options?.forceRegenerate ? "QR_REGENERATED" : "QR_GENERATED",
    {
      durationMinutes,
      expiresAt,
      opensAt: options?.opensAt || null,
      closesAt: options?.closesAt || null,
    },
  );

  return {
    success: true,
    sessionToken: token,
    createdAt: nowIso,
    expiresAt,
    durationMinutes,
    status: initialLifecycle,
    opensAt: options?.opensAt || null,
    closesAt: options?.closesAt || null,
  };
}

export async function revokeActivityQrSessionAction(
  activityId: string,
  sessionToken?: string,
): Promise<ActionResult<{ status: QrSessionLifecycleStatus }>> {
  const access = await loadActivityAccess(activityId);
  if (!access) return { success: false, error: "Activity not found." };
  if (!access.canManageAttendance) {
    return {
      success: false,
      error: "Unauthorized: You cannot revoke QR sessions for this activity.",
    };
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const revokedSecret = encodeSessionSecretMeta({
    hash: "revoked",
    lifecycleStatus: "REVOKED",
  });

  let query = admin
    .from("attendance_sessions")
    .update({
      status: "CLOSED",
      secret_hash: revokedSecret,
      expires_at: nowIso,
    })
    .eq("activity_id", activityId);

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

  await logActivity(activityId, access.user.id, "QR_REVOKED", {
    revokedAt: nowIso,
  });
  revalidateActivity(activityId);
  revalidatePath("/events");
  return {
    success: true,
    status: "REVOKED",
    message: "QR code has been revoked. Previous attendance records remain intact.",
  };
}

export async function updateActivityQrSessionStatusAction(
  activityId: string,
  nextStatus: "ACTIVE" | "PAUSED" | "CLOSED",
): Promise<ActionResult<{ status: QrSessionLifecycleStatus }>> {
  const access = await loadActivityAccess(activityId);
  if (!access) return { success: false, error: "Activity not found." };
  if (!access.canManageAttendance) {
    return {
      success: false,
      error: "Unauthorized: You cannot manage attendance sessions for this activity.",
    };
  }

  const admin = createAdminClient();
  const { data: latest } = await admin
    .from("attendance_sessions")
    .select("id, session_token, secret_hash, expires_at")
    .eq("activity_id", activityId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latest) {
    if (nextStatus === "ACTIVE") {
      const started = await startActivityQrSessionAction(activityId, {
        forceRegenerate: true,
      });
      if (!started.success) return started;
      return {
        success: true,
        status: started.status,
        message: "Attendance session started.",
      };
    }
    return {
      success: false,
      error: "No QR attendance session found for this activity.",
    };
  }

  const latestRow = latest as {
    id: string;
    session_token: string;
    secret_hash?: string | null;
    expires_at: string;
  };
  const currentMeta = decodeSessionSecretMeta(latestRow.secret_hash);
  const updatedSecret = encodeSessionSecretMeta({
    ...currentMeta,
    hash: currentMeta.hash || "session",
    lifecycleStatus: nextStatus,
  });

  const dbStatus = nextStatus === "CLOSED" ? "CLOSED" : "ACTIVE";
  const { error } = await admin
    .from("attendance_sessions")
    .update({
      status: dbStatus,
      secret_hash: updatedSecret,
    })
    .eq("id", latestRow.id);

  if (error) {
    return {
      success: false,
      error: `Failed to update session status: ${error.message}`,
    };
  }

  await logActivity(activityId, access.user.id, "SESSION_STATUS_CHANGED", {
    status: nextStatus,
  });
  revalidateActivity(activityId);
  revalidatePath("/events");

  const statusLabels: Record<"ACTIVE" | "PAUSED" | "CLOSED", string> = {
    ACTIVE: "Attendance session is now active.",
    PAUSED: "Attendance session paused.",
    CLOSED: "Attendance session closed.",
  };

  return {
    success: true,
    status: nextStatus,
    message: statusLabels[nextStatus],
  };
}

export async function manualCheckInMemberAction(
  activityId: string,
  profileId: string,
  customVolunteerHours?: number,
): Promise<ActionResult<{ recordId: string; volunteerHours: number }>> {
  if (!uuidString.safeParse(profileId).success) {
    return { success: false, error: "Please select a valid club member." };
  }
  const access = await loadActivityAccess(activityId);
  if (!access) return { success: false, error: "Activity not found." };
  if (!access.canManageAttendance) {
    return {
      success: false,
      error: "Unauthorized: Only attendance managers or officers can manually record attendance.",
    };
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("attendance_records")
    .select("id")
    .eq("activity_id", activityId)
    .eq("profile_id", profileId)
    .maybeSingle();

  if (existing) {
    return {
      success: false,
      error: "This member is already checked in for this activity.",
    };
  }

  const hours =
    customVolunteerHours !== undefined && Number.isFinite(customVolunteerHours)
      ? Math.max(0, Number(customVolunteerHours))
      : Number(access.activity.volunteer_hours_default || 0);
  const nowIso = new Date().toISOString();

  const { data: created, error } = await admin
    .from("attendance_records")
    .insert({
      activity_id: activityId,
      event_id: access.activity.legacy_event_id,
      profile_id: profileId,
      attended: true,
      check_in_method: "MANUAL",
      volunteer_hours: hours,
      verified_by: access.user.id,
      check_in_time: nowIso,
    })
    .select("id")
    .single();

  if (error || !created) {
    if (error?.code === "23505") {
      return {
        success: false,
        error: "This member is already checked in for this activity.",
      };
    }
    return {
      success: false,
      error: `Failed to record manual attendance: ${error?.message ?? "unknown error"}`,
    };
  }

  await Promise.allSettled([
    admin.from("activity_rsvps").upsert({
      activity_id: activityId,
      profile_id: profileId,
      response: "GOING",
      responded_at: nowIso,
    }),
    admin.from("activity_followers").upsert({
      activity_id: activityId,
      profile_id: profileId,
    }),
    awardEngagementPoints({
      clubId: access.activity.club_id,
      profileId,
      sourceType: isProjectKind(access.activity.kind)
        ? "SERVICE_CHECK_IN"
        : "CHECK_IN",
      sourceId: created.id,
      reason: isProjectKind(access.activity.kind)
        ? `Attended Service Project: ${access.activity.title}`
        : `Attended Activity: ${access.activity.title}`,
    }),
    logActivity(activityId, access.user.id, "MANUAL_CHECK_IN", {
      profileId,
      volunteerHours: hours,
    }),
  ]);

  revalidateActivity(activityId);
  revalidatePath("/events");
  return {
    success: true,
    recordId: created.id,
    volunteerHours: hours,
    message: "Member manually checked in.",
  };
}

export async function toggleActivityQrCheckInAction(
  activityId: string,
  enabled?: boolean,
): Promise<ActionResult<{ qrCheckInEnabled: boolean }>> {
  const access = await loadActivityAccess(activityId);
  if (!access) return { success: false, error: "Activity not found." };
  if (!access.canManage) {
    return {
      success: false,
      error: "Only project leaders or officers can change this setting.",
    };
  }

  const current = access.qrCheckInEnabled;
  const next = typeof enabled === "boolean" ? enabled : !current;

  const admin = createAdminClient();
  const { error } = await admin
    .from("activities")
    .update({ qr_check_in_enabled: next, updated_at: new Date().toISOString() })
    .eq("id", activityId);

  if (error && error.message?.includes("qr_check_in_enabled")) {
    console.warn("Column qr_check_in_enabled not migrated yet, updating in-memory only.");
  }

  await logActivity(activityId, access.user.id, "UPDATED", {
    qrCheckInEnabled: next,
  });
  revalidateActivity(activityId);
  revalidatePath("/events");
  revalidatePath("/project-center");
  return {
    success: true,
    message: next ? "QR check-in enabled." : "QR check-in disabled.",
    qrCheckInEnabled: next,
  };
}

export async function addCommentAction(input: {
  activityId: string;
  body: string;
  parentId?: string;
  mentions?: string[];
}): Promise<ActionResult<{ commentId: string }>> {
  const parsed = commentSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid comment",
    };

  const access = await loadActivityAccess(parsed.data.activityId);
  if (!access) return { success: false, error: "Activity not found." };
  if (!access.isParticipant)
    return { success: false, error: "Only club members can comment." };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("activity_comments")
    .insert({
      activity_id: parsed.data.activityId,
      author_id: access.user.id,
      parent_id: parsed.data.parentId || null,
      body: parsed.data.body,
      mentions: parsed.data.mentions,
    })
    .select("id")
    .single();
  if (error || !data)
    return { success: false, error: "Could not post your comment." };

  await admin.from("activity_followers").upsert({
    activity_id: parsed.data.activityId,
    profile_id: access.user.id,
  });

  const commenterName = access.user.fullName || "A member";
  const preview =
    parsed.data.body.length > 80
      ? parsed.data.body.slice(0, 80) + "..."
      : parsed.data.body;

  notifyProjectAudience({
    activityId: parsed.data.activityId,
    clubId: access.activity.club_id,
    title: `New comment in ${access.activity.title}`,
    message: `${commenterName}: "${preview}"`,
    type: "COMMENT",
    excludeProfileIds: [access.user.id],
    dedupePrefix: `comment_${data.id}`,
  }).catch((e) => console.warn("Failed comment notification:", e));

  revalidateActivity(parsed.data.activityId);
  return { success: true, commentId: data.id };
}

export async function deleteCommentAction(
  activityId: string,
  commentId: string,
): Promise<ActionResult> {
  if (!uuidString.safeParse(commentId).success)
    return { success: false, error: "Invalid comment." };
  const access = await loadActivityAccess(activityId);
  if (!access) return { success: false, error: "Activity not found." };

  const admin = createAdminClient();
  const { data: comment } = await admin
    .from("activity_comments")
    .select("author_id")
    .eq("id", commentId)
    .eq("activity_id", activityId)
    .maybeSingle();
  if (!comment) return { success: false, error: "Comment not found." };
  if (comment.author_id !== access.user.id && !access.canModerateDiscussion) {
    return { success: false, error: "You can only delete your own comments." };
  }

  await admin
    .from("activity_comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", commentId);
  revalidateActivity(activityId);
  return { success: true };
}

const reactionSchema = z.string().trim().min(1).max(16);

const publishProjectReportSchema = z.object({
  activityId: uuidString,
  objective: z
    .string()
    .trim()
    .min(10, "Add a meaningful project objective")
    .max(2000),
  inspiration: z
    .string()
    .trim()
    .min(20, "Describe what inspired this activity")
    .max(5000),
  detailedDescription: z
    .string()
    .trim()
    .min(30, "Add the activity's detailed description")
    .max(10000),
  outcomesSummary: z
    .string()
    .trim()
    .min(20, "Summarize the project outcomes")
    .max(5000),
  beneficiaryType: z.string().trim().min(2, "Describe who benefited").max(200),
  beneficiaryCount: z.number().int().min(0).max(10000000),
  volunteerNonmemberCount: z.number().int().min(0).max(1000000),
  fundingTotal: z.number().min(0).max(1000000000),
  totalExpenses: z.number().min(0).max(1000000000),
  fundingCurrency: z.string().trim().length(3).default("PHP"),
  fundingSource: z.string().trim().max(500).default(""),
  supportsPolio: z.boolean().default(false),
});

export type PublishProjectReportInput = z.input<
  typeof publishProjectReportSchema
>;

export async function publishProjectReportAction(
  input: PublishProjectReportInput,
): Promise<ActionResult<{ submissionId: string }>> {
  const parsed = publishProjectReportSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error:
        parsed.error.issues[0]?.message ||
        "Complete the required report fields.",
    };

  const access = await loadActivityAccess(parsed.data.activityId);
  if (!access) return { success: false, error: "Activity not found." };
  if (!isProjectKind(access.activity.kind))
    return {
      success: false,
      error: "Only service projects can publish accomplishment reports.",
    };
  if (!access.canManage)
    return {
      success: false,
      error: "Only the project chair or an officer can publish this report.",
    };
  if (new Date(access.activity.end_at) > new Date())
    return {
      success: false,
      error: "The project report can be published after the activity ends.",
    };
  if (
    !["ONGOING", "COMPLETED", "AWAITING_REPORT"].includes(
      access.activity.status,
    )
  ) {
    return {
      success: false,
      error: "This project is not ready for report submission.",
    };
  }

  const admin = createAdminClient();
  const [{ data: photos }, { data: template }] = await Promise.all([
    admin
      .from("activity_media")
      .select("id")
      .eq("activity_id", parsed.data.activityId),
    admin
      .from("report_templates")
      .select("id")
      .or(`club_id.eq.${access.activity.club_id},club_id.is.null`)
      .order("club_id", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!photos?.length)
    return {
      success: false,
      error: "Upload at least one project photo before publishing.",
    };
  if (!template)
    return {
      success: false,
      error:
        "No report template is configured. Ask an administrator to configure one.",
    };

  const [{ data: attendance }, { data: activity }] = await Promise.all([
    admin
      .from("attendance_records")
      .select("profile_id, volunteer_hours")
      .eq("activity_id", parsed.data.activityId)
      .eq("attended", true),
    admin
      .from("activities")
      .select("*")
      .eq("id", parsed.data.activityId)
      .single(),
  ]);
  if (!activity) return { success: false, error: "Project not found." };

  const attendanceRows = attendance || [];
  const volunteerCount = attendanceRows.length;
  const volunteerHours = attendanceRows.reduce(
    (total, row) => total + Number(row.volunteer_hours || 0),
    0,
  );
  const completedAt = new Date().toISOString();
  const report = parsed.data;
  const snapshot = {
    schemaVersion: 1,
    activityId: activity.id,
    activityKind: activity.kind,
    title: activity.title,
    shortDescription: activity.short_description,
    location: activity.location,
    startAt: activity.start_at,
    endAt: activity.end_at,
    rotaryYear: activity.rotary_year,
    objective: report.objective,
    inspiration: report.inspiration,
    detailedDescription: report.detailedDescription,
    outcomesSummary: report.outcomesSummary,
    beneficiaryType: report.beneficiaryType,
    beneficiaryCount: report.beneficiaryCount,
    volunteerMemberCount: volunteerCount,
    volunteerNonmemberCount: report.volunteerNonmemberCount,
    totalVolunteerHours: volunteerHours,
    fundingTotal: report.fundingTotal,
    totalExpenses: report.totalExpenses,
    fundingCurrency: report.fundingCurrency.toUpperCase(),
    fundingSource: report.fundingSource,
    supportsPolio: report.supportsPolio,
    photos: (photos || []).length,
    submittedBy: access.user.fullName || access.user.email,
    submittedAt: completedAt,
  };

  const { data: submission, error: reportError } = await admin
    .from("report_submissions")
    .insert({
      project_id: activity.legacy_project_id,
      activity_id: activity.id,
      template_id: template.id,
      submitted_by: access.user.id,
      status: "SUBMITTED",
      data_snapshot: snapshot,
      submitted_at: completedAt,
    })
    .select("id")
    .single();
  if (reportError || !submission)
    return {
      success: false,
      error: `Could not save report: ${reportError?.message || "unknown error"}`,
    };

  const { error: detailsError } = await admin
    .from("activity_project_details")
    .upsert({
      activity_id: activity.id,
      objective: report.objective,
      inspiration: report.inspiration,
      outcomes_summary: report.outcomesSummary,
      beneficiary_type: report.beneficiaryType,
      beneficiary_count: report.beneficiaryCount,
      volunteer_member_count: volunteerCount,
      volunteer_nonmember_count: report.volunteerNonmemberCount,
      total_volunteer_hours: volunteerHours,
      funding_total: report.fundingTotal,
      funding_currency: report.fundingCurrency.toUpperCase(),
      funding_source: report.fundingSource || null,
      total_expenses: report.totalExpenses,
      supports_polio: report.supportsPolio,
      completed_at: completedAt,
      completed_by: access.user.id,
      updated_at: completedAt,
    });
  if (detailsError)
    return {
      success: false,
      error: `Report saved but project details could not be updated: ${detailsError.message}`,
    };

  const { error: updateError } = await admin
    .from("activities")
    .update({
      description: report.detailedDescription,
      status: "ACCOMPLISHED",
      updated_at: completedAt,
    })
    .eq("id", activity.id);
  if (updateError)
    return {
      success: false,
      error: `Report saved but status could not be updated: ${updateError.message}`,
    };

  await logActivity(activity.id, access.user.id, "REPORT_PUBLISHED", {
    submissionId: submission.id,
  });
  revalidateActivity(activity.id);
  return {
    success: true,
    message: "Project published as accomplished.",
    submissionId: submission.id,
  };
}

export async function toggleReactionAction(
  activityId: string,
  commentId: string,
  emoji: string,
): Promise<ActionResult> {
  if (
    !uuidString.safeParse(commentId).success ||
    !reactionSchema.safeParse(emoji).success
  ) {
    return { success: false, error: "Invalid reaction." };
  }
  const access = await loadActivityAccess(activityId);
  if (!access?.isParticipant)
    return { success: false, error: "Only club members can react." };

  const admin = createAdminClient();
  const { data: comment } = await admin
    .from("activity_comments")
    .select("id, author_id")
    .eq("id", commentId)
    .eq("activity_id", activityId)
    .maybeSingle();
  if (!comment) return { success: false, error: "Comment not found." };

  const match = { comment_id: commentId, profile_id: access.user.id, emoji };
  const { data: existing } = await admin
    .from("activity_comment_reactions")
    .select("emoji")
    .match(match)
    .maybeSingle();
  if (existing) {
    await admin.from("activity_comment_reactions").delete().match(match);
  } else {
    await admin.from("activity_comment_reactions").insert(match);

    // Notify comment author about reaction if they didn't react to their own comment
    if (comment.author_id && comment.author_id !== access.user.id) {
      const reactorName = access.user.fullName || "A member";
      dispatchNotification({
        profileId: comment.author_id,
        clubId: access.activity.club_id,
        title: "Reaction on your comment",
        message: `${reactorName} reacted ${emoji} to your comment in "${access.activity.title}".`,
        type: "COMMENT",
        linkUrl: `/project-center/${activityId}?tab=comments`,
        dedupeKey: `react_${commentId}_${access.user.id}_${emoji}`,
        sendPush: true,
      }).catch((e) => console.warn("Failed reaction notification:", e));
    }
  }

  revalidateActivity(activityId);
  return { success: true };
}

export async function toggleFollowAction(
  activityId: string,
): Promise<ActionResult<{ following: boolean }>> {
  const access = await loadActivityAccess(activityId);
  if (!access?.isParticipant)
    return {
      success: false,
      error: "Only club members can follow activities.",
    };

  const admin = createAdminClient();
  const match = { activity_id: activityId, profile_id: access.user.id };
  const { data: existing } = await admin
    .from("activity_followers")
    .select("profile_id")
    .match(match)
    .maybeSingle();
  if (existing) await admin.from("activity_followers").delete().match(match);
  else await admin.from("activity_followers").insert(match);

  revalidateActivity(activityId);
  return { success: true, following: !existing };
}

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function getActivityMomentsAction(
  activityId: string,
  offset = 0,
): Promise<ActionResult<{ media: ActivityMediaDTO[]; hasMore: boolean }>> {
  if (!z.number().int().min(0).max(100000).safeParse(offset).success) {
    return { success: false, error: "Invalid photo page." };
  }
  const access = await loadActivityAccess(activityId);
  if (
    !access ||
    (!access.isParticipant && !access.canManage) ||
    (access.activity.status === "DRAFT" && !access.canManage)
  ) {
    return {
      success: false,
      error: "This photo album is not available to you.",
    };
  }
  try {
    return {
      success: true,
      ...(await getActivityMediaPage(activityId, offset)),
    };
  } catch {
    return {
      success: false,
      error: "Photos could not be loaded. Please retry.",
    };
  }
}

export async function uploadActivityMediaAction(
  formData: FormData,
): Promise<ActionResult> {
  const activityId = String(formData.get("activityId") || "");
  const access = await loadActivityAccess(activityId);
  if (!access) return { success: false, error: "Activity not found." };
  if (!access.canManageMedia)
    return {
      success: false,
      error: "Only the chair or officers can upload photos.",
    };

  const caption = String(formData.get("caption") || "")
    .trim()
    .slice(0, 280);
  const files = formData
    .getAll("files")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0)
    return { success: false, error: "Choose at least one photo." };
  if (files.length > 10)
    return { success: false, error: "Upload up to 10 photos at a time." };

  for (const file of files) {
    if (!(ALLOWED_MEDIA_TYPES as readonly string[]).includes(file.type)) {
      return {
        success: false,
        error: `${file.name}: only JPG, PNG, WEBP or GIF images are allowed.`,
      };
    }
    if (file.size > MAX_MEDIA_BYTES)
      return {
        success: false,
        error: `${file.name} is larger than 3 MB. Compress it before uploading.`,
      };
  }
  if (files.reduce((total, file) => total + file.size, 0) > MAX_MEDIA_BYTES) {
    return {
      success: false,
      error:
        "This photo batch exceeds 3 MB. Upload compressed photos individually.",
    };
  }

  const admin = createAdminClient();
  const { count } = await admin
    .from("activity_media")
    .select("id", { count: "exact", head: true })
    .eq("activity_id", activityId);
  let nextOrder = count ?? 0;

  for (const file of files) {
    // Server-generated path; the original filename is never used in storage.
    const path = `${access.activity.club_id}/${activityId}/${randomUUID()}.${EXTENSION_BY_TYPE[file.type]}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await admin.storage
      .from(MEDIA_BUCKET)
      .upload(path, buffer, { contentType: file.type, upsert: false });
    if (uploadError)
      return { success: false, error: `Upload failed: ${uploadError.message}` };

    const { error: recordError } = await admin.from("activity_media").insert({
      activity_id: activityId,
      storage_path: path,
      caption: caption || null,
      mime_type: file.type,
      size_bytes: file.size,
      sort_order: nextOrder++,
      uploaded_by: access.user.id,
    });
    if (recordError) {
      await admin.storage.from(MEDIA_BUCKET).remove([path]);
      return {
        success: false,
        error: "The photo could not be saved to the album. Please retry.",
      };
    }
  }

  const { data: activity } = await admin
    .from("activities")
    .select("cover_storage_path")
    .eq("id", activityId)
    .single();
  if (!activity?.cover_storage_path) {
    const { data: first } = await admin
      .from("activity_media")
      .select("storage_path")
      .eq("activity_id", activityId)
      .order("sort_order")
      .limit(1)
      .maybeSingle();
    if (first)
      await admin
        .from("activities")
        .update({ cover_storage_path: first.storage_path })
        .eq("id", activityId);
  }

  await logActivity(activityId, access.user.id, "MEDIA_UPLOADED", {
    count: files.length,
  });
  revalidateActivity(activityId);
  return { success: true, message: `${files.length} photo(s) uploaded.` };
}

export async function deleteActivityMediaAction(
  activityId: string,
  mediaId: string,
): Promise<ActionResult> {
  if (!uuidString.safeParse(mediaId).success)
    return { success: false, error: "Invalid photo." };
  const access = await loadActivityAccess(activityId);
  if (!access?.canManageMedia)
    return {
      success: false,
      error: "Only the chair or officers can remove photos.",
    };

  const admin = createAdminClient();
  const { data: media } = await admin
    .from("activity_media")
    .select("storage_path")
    .eq("id", mediaId)
    .eq("activity_id", activityId)
    .maybeSingle();
  if (!media) return { success: false, error: "Photo not found." };

  await admin.storage.from(MEDIA_BUCKET).remove([media.storage_path]);
  await admin.from("activity_media").delete().eq("id", mediaId);
  await admin
    .from("activities")
    .update({ cover_storage_path: null })
    .eq("id", activityId)
    .eq("cover_storage_path", media.storage_path);

  revalidateActivity(activityId);
  return { success: true };
}

export async function setCoverMediaAction(
  activityId: string,
  mediaId: string,
): Promise<ActionResult> {
  if (!uuidString.safeParse(mediaId).success)
    return { success: false, error: "Invalid photo." };
  const access = await loadActivityAccess(activityId);
  if (!access?.canManageMedia)
    return {
      success: false,
      error: "Only the chair or officers can change the cover.",
    };

  const admin = createAdminClient();
  const { data: media } = await admin
    .from("activity_media")
    .select("storage_path")
    .eq("id", mediaId)
    .eq("activity_id", activityId)
    .maybeSingle();
  if (!media) return { success: false, error: "Photo not found." };

  await admin
    .from("activity_media")
    .update({ is_featured: false })
    .eq("activity_id", activityId);
  await admin
    .from("activity_media")
    .update({ is_featured: true })
    .eq("id", mediaId);
  await admin
    .from("activities")
    .update({ cover_storage_path: media.storage_path })
    .eq("id", activityId);

  revalidateActivity(activityId);
  return { success: true };
}

export async function setTeamMemberAction(input: {
  activityId: string;
  profileId: string;
  role: string;
}): Promise<ActionResult> {
  const parsed = teamMemberSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid team member." };
  const access = await loadActivityAccess(parsed.data.activityId);
  if (!access?.canManage)
    return {
      success: false,
      error: "Only the chair or officers can manage the team.",
    };
  if (
    !(await isClubParticipant(access.activity.club_id, parsed.data.profileId))
  ) {
    return {
      success: false,
      error: "That person is not an active member of this club.",
    };
  }

  const { error } = await createAdminClient().from("activity_team").upsert({
    activity_id: parsed.data.activityId,
    profile_id: parsed.data.profileId,
    team_role: parsed.data.role,
  });
  if (error) return { success: false, error: error.message };

  await logActivity(parsed.data.activityId, access.user.id, "TEAM_UPDATED", {
    profileId: parsed.data.profileId,
    role: parsed.data.role,
  });
  revalidateActivity(parsed.data.activityId);
  return { success: true };
}

export async function removeTeamMemberAction(
  activityId: string,
  profileId: string,
): Promise<ActionResult> {
  if (!uuidString.safeParse(profileId).success)
    return { success: false, error: "Invalid team member." };
  const access = await loadActivityAccess(activityId);
  if (!access?.canManage)
    return {
      success: false,
      error: "Only the chair or officers can manage the team.",
    };

  await createAdminClient()
    .from("activity_team")
    .delete()
    .eq("activity_id", activityId)
    .eq("profile_id", profileId);
  revalidateActivity(activityId);
  return { success: true };
}

const activityTaskSchema = z.object({
  activityId: uuidString,
  title: z
    .string()
    .trim()
    .min(3, "Task title must be at least 3 characters")
    .max(200),
  description: z.string().trim().max(2000).default(""),
  committee: z.enum(COMMITTEES).default("CLUB_SERVICE"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Due date is required"),
  assigneeIds: z.array(uuidString).max(20).default([]),
});

export async function createActivityTaskAction(
  input: z.input<typeof activityTaskSchema>,
): Promise<ActionResult> {
  const parsed = activityTaskSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid task",
    };
  const access = await loadActivityAccess(parsed.data.activityId);
  if (!access) return { success: false, error: "Activity not found." };
  if (!access.canManageTasks)
    return {
      success: false,
      error: "Only the chair or officers can add tasks.",
    };

  const admin = createAdminClient();
  const { data: assignees } = parsed.data.assigneeIds.length
    ? await admin
        .from("profiles")
        .select("id, full_name")
        .in("id", parsed.data.assigneeIds)
    : { data: [] as { id: string; full_name: string }[] };

  const created = createTask({
    clubId: access.activity.club_id,
    title: parsed.data.title,
    description: parsed.data.description,
    committee: parsed.data.committee as TaskCommittee,
    priority: parsed.data.priority as TaskPriority,
    status: "TODO",
    dueDate: parsed.data.dueDate,
    assignedMemberIds: (assignees || []).map((a) => a.id),
    assignedMemberNames: (assignees || []).map((a) => a.full_name),
    checklist: [],
    createdBy: access.user.fullName || access.user.email,
    projectId: parsed.data.activityId,
    projectTitle: access.activity.title,
  });

  const { error } = await admin.from("tasks").insert({
    id: created.id,
    club_id: created.clubId,
    activity_id: parsed.data.activityId,
    title: created.title,
    description: created.description,
    committee: created.committee,
    status: created.status,
    priority: created.priority,
    due_date: created.dueDate,
    assigned_member_ids: created.assignedMemberIds,
    assigned_member_names: created.assignedMemberNames,
    checklist: created.checklist,
    created_by: created.createdBy,
    created_at: created.createdAt,
    updated_at: created.updatedAt,
  });
  if (error)
    console.warn("Could not sync activity task to Supabase:", error.message);

  // 1. Notify assignees directly
  for (const assignee of assignees || []) {
    if (assignee.id !== access.user.id) {
      dispatchNotification({
        profileId: assignee.id,
        clubId: access.activity.club_id,
        title: `Task assigned: ${created.title}`,
        message: `You were assigned to "${created.title}" in ${access.activity.title}. Due: ${created.dueDate}.`,
        type: "GENERAL",
        linkUrl: `/project-center/${parsed.data.activityId}?tab=tasks`,
        dedupeKey: `task_assign_${created.id}_${assignee.id}`,
        sendPush: true,
      }).catch((e) => console.warn("Failed assignee task notif:", e));
    }
  }

  // 2. Notify other committee & going members about the new task
  const assignedIds = (assignees || []).map((a) => a.id);
  notifyProjectAudience({
    activityId: parsed.data.activityId,
    clubId: access.activity.club_id,
    title: `New task in ${access.activity.title}`,
    message: `Task "${created.title}" was added for ${(created.committee || "CLUB_SERVICE").replaceAll("_", " ")}.`,
    type: "GENERAL",
    excludeProfileIds: [access.user.id, ...assignedIds],
    dedupePrefix: `task_new_${created.id}`,
  }).catch((e) => console.warn("Failed task audience notif:", e));

  await logActivity(parsed.data.activityId, access.user.id, "TASK_CREATED", {
    title: created.title,
  });
  revalidateActivity(parsed.data.activityId);
  revalidatePath("/tasks");
  return { success: true, message: "Task added." };
}

const updateActivityTaskSchema = z.object({
  activityId: uuidString,
  taskId: z.string().trim().min(1),
  title: z
    .string()
    .trim()
    .min(3, "Task title must be at least 3 characters")
    .max(200),
  description: z.string().trim().max(2000).default(""),
  committee: z.enum(COMMITTEES).default("CLUB_SERVICE"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  status: z
    .enum(["TODO", "IN_PROGRESS", "IN_REVIEW", "COMPLETED"])
    .default("TODO"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Due date is required"),
  assigneeIds: z.array(z.string().trim().min(1)).max(20).default([]),
});

export async function updateActivityTaskAction(
  input: z.input<typeof updateActivityTaskSchema>,
): Promise<ActionResult> {
  const parsed = updateActivityTaskSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid task update",
    };

  const access = await loadActivityAccess(parsed.data.activityId);
  if (!access) return { success: false, error: "Activity not found." };
  if (!access.canManageTasks)
    return {
      success: false,
      error:
        "Only administrators, authorized officers, or the project chair can edit tasks.",
    };

  const admin = createAdminClient();
  const validUuids = parsed.data.assigneeIds.filter((id) =>
    UUID_PATTERN.test(id),
  );
  const { data: assignees } = validUuids.length
    ? await admin
        .from("profiles")
        .select("id, full_name")
        .in("id", validUuids)
    : { data: [] as { id: string; full_name: string }[] };

  const assignedMemberIds = (assignees || []).map((a) => a.id);
  const assignedMemberNames = (assignees || []).map((a) => a.full_name);

  updateTask(parsed.data.taskId, {
    title: parsed.data.title,
    description: parsed.data.description,
    committee: parsed.data.committee as TaskCommittee,
    priority: parsed.data.priority as TaskPriority,
    status: parsed.data.status as TaskStatus,
    dueDate: parsed.data.dueDate,
    assignedMemberIds,
    assignedMemberNames,
  });

  const nowIso = new Date().toISOString();
  const { error } = await admin
    .from("tasks")
    .update({
      title: parsed.data.title,
      description: parsed.data.description,
      committee: parsed.data.committee,
      priority: parsed.data.priority,
      status: parsed.data.status,
      due_date: parsed.data.dueDate,
      assigned_member_ids: assignedMemberIds,
      assigned_member_names: assignedMemberNames,
      updated_at: nowIso,
    })
    .eq("id", parsed.data.taskId);

  if (error) {
    console.warn(
      "Could not sync activity task update to Supabase:",
      error.message,
    );
  }

  for (const assignee of assignees || []) {
    if (assignee.id !== access.user.id) {
      dispatchNotification({
        profileId: assignee.id,
        clubId: access.activity.club_id,
        title: `Task assigned: ${parsed.data.title}`,
        message: `You were assigned to "${parsed.data.title}" in ${access.activity.title}. Due: ${parsed.data.dueDate}.`,
        type: "GENERAL",
        linkUrl: `/project-center/${parsed.data.activityId}?tab=tasks`,
        dedupeKey: `task_assign_${parsed.data.taskId}_${assignee.id}`,
        sendPush: true,
      }).catch((e) => console.warn("Failed assignee task notif:", e));
    }
  }

  revalidateActivity(parsed.data.activityId);
  revalidatePath("/tasks");
  return { success: true, message: "Task updated." };
}

export async function deleteActivityTaskAction(
  activityId: string,
  taskId: string,
): Promise<ActionResult> {
  const access = await loadActivityAccess(activityId);
  if (!access) return { success: false, error: "Activity not found." };
  if (!access.canManageTasks)
    return {
      success: false,
      error:
        "Only administrators, authorized officers, or the project chair can delete tasks.",
    };

  deleteTask(taskId);
  const admin = createAdminClient();
  await admin.from("tasks").delete().eq("id", taskId);

  revalidateActivity(activityId);
  revalidatePath("/tasks");
  return { success: true, message: "Task deleted." };
}
