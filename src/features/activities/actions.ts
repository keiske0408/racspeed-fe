"use server";

import { randomBytes, randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserAccessContext, requireUser } from "@/lib/auth/session";
import { manilaLocalToISO } from "@/lib/utils/dates";
import { rotaryYearFor } from "@/lib/utils/rotary-year";
import { awardEngagementPoints } from "@/lib/services/rewards";
import { createTask, type TaskCommittee, type TaskPriority } from "@/lib/data/tasks-storage";
import {
  ALLOWED_MEDIA_TYPES,
  MAX_MEDIA_BYTES,
  commentSchema,
  createActivitySchema,
  resolveMinMembers,
  rsvpSchema,
  teamMemberSchema,
  uuidString,
  type CreateActivityData,
  type CreateActivityInput,
} from "./schemas";
import { canTransition, evaluateRsvp, evaluateSelfCheckIn } from "./rules";
import { isClubParticipant, MEDIA_BUCKET } from "./queries";
import { ACTIVITY_STATUSES, COMMITTEES, isProjectKind, type ActivityStatus, type RsvpResponse } from "./types";

type ActionResult<T = object> = ({ success: true; message?: string } & T) | { success: false; error: string };

function revalidateActivity(activityId?: string) {
  revalidatePath("/project-center");
  if (activityId) revalidatePath(`/project-center/${activityId}`);
  revalidatePath("/dashboard");
}

async function logActivity(activityId: string, actorId: string, action: string, details: Record<string, unknown> = {}) {
  try {
    await createAdminClient().from("activity_log").insert({ activity_id: activityId, actor_id: actorId, action, details });
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
      "id, club_id, kind, status, title, owner_id, start_at, end_at, rsvp_enabled, rsvp_deadline, capacity, self_check_in_enabled, check_in_window_minutes, volunteer_hours_default, legacy_event_id"
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
    perms.has("PROJECT_UPDATE");

  return {
    user,
    activity,
    isParticipant: participant || context.isPlatformAdmin,
    canManage,
    canManageAttendance: canManage || perms.has("ATTENDANCE_MANAGE"),
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
    rsvp_deadline: data.rsvpDeadline ? manilaLocalToISO(data.rsvpDeadline) : null,
    self_check_in_enabled: data.selfCheckInEnabled,
    check_in_window_minutes: data.checkInWindowMinutes,
    volunteer_hours_default: data.volunteerHoursDefault,
    rotary_year: rotaryYearFor(new Date(startIso)),
  };
}

async function syncProjectRelations(activityId: string, data: CreateActivityData) {
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

  await admin.from("activity_areas_of_focus").delete().eq("activity_id", activityId);
  if (data.areasOfFocus.length > 0) {
    const { data: areas } = await admin.from("areas_of_focus").select("id, code").in("code", data.areasOfFocus);
    if (areas?.length) {
      await admin.from("activity_areas_of_focus").insert(areas.map((a) => ({ activity_id: activityId, area_of_focus_id: a.id })));
    }
  }

  await admin.from("activity_sdgs").delete().eq("activity_id", activityId);
  if (data.sdgs.length > 0) {
    const { data: goals } = await admin.from("sdgs").select("id, number").in("number", data.sdgs);
    if (goals?.length) {
      await admin.from("activity_sdgs").insert(goals.map((g) => ({ activity_id: activityId, sdg_id: g.id })));
    }
  }

  await admin.from("activity_partners").delete().eq("activity_id", activityId);
  if (data.partners.length > 0) {
    await admin
      .from("activity_partners")
      .insert(data.partners.map((p) => ({ activity_id: activityId, name: p.name, partner_role: p.role })));
  }
}

export async function createActivityAction(input: CreateActivityInput): Promise<ActionResult<{ activityId: string }>> {
  const user = await requireUser();
  const parsed = createActivitySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Invalid activity details" };
  }
  const data = parsed.data;

  const context = await getUserAccessContext(data.clubId);
  const required = isProjectKind(data.kind) ? "PROJECT_CREATE" : "EVENT_CREATE";
  if (!context.isPlatformAdmin && !context.permissions.has(required)) {
    return { success: false, error: "You do not have permission to create this kind of activity." };
  }

  const admin = createAdminClient();
  const { data: created, error } = await admin
    .from("activities")
    .insert({
      ...toActivityRow(data),
      status: data.status,
      club_id: data.clubId,
      owner_id: user.id,
      created_by: user.id,
      is_published: data.status !== "DRAFT",
    })
    .select("id")
    .single();

  if (error || !created) {
    return { success: false, error: `Failed to create activity: ${error?.message ?? "unknown error"}` };
  }

  await Promise.all([
    admin.from("activity_team").insert({ activity_id: created.id, profile_id: user.id, team_role: "CHAIR" }),
    admin.from("activity_followers").insert({ activity_id: created.id, profile_id: user.id }),
    syncProjectRelations(created.id, data),
  ]);
  await logActivity(created.id, user.id, "CREATED", { kind: data.kind });

  revalidateActivity(created.id);
  return { success: true, message: `'${data.title}' created.`, activityId: created.id };
}

export async function updateActivityAction(activityId: string, input: CreateActivityInput): Promise<ActionResult> {
  const access = await loadActivityAccess(activityId);
  if (!access) return { success: false, error: "Activity not found." };
  if (!access.canManage) return { success: false, error: "Only the chair or officers can edit this activity." };

  const parsed = createActivitySchema.safeParse({ ...input, clubId: access.activity.club_id });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Invalid activity details" };
  }
  if (parsed.data.kind !== access.activity.kind) {
    return { success: false, error: "The activity type cannot be changed after creation." };
  }

  const { error } = await createAdminClient()
    .from("activities")
    .update({ ...toActivityRow(parsed.data), updated_at: new Date().toISOString() })
    .eq("id", activityId);
  if (error) return { success: false, error: `Failed to update activity: ${error.message}` };

  await syncProjectRelations(activityId, parsed.data);
  await logActivity(activityId, access.user.id, "UPDATED");
  revalidateActivity(activityId);
  return { success: true, message: "Activity updated." };
}

export async function updateActivityStatusAction(activityId: string, status: ActivityStatus): Promise<ActionResult> {
  if (!(ACTIVITY_STATUSES as readonly string[]).includes(status)) {
    return { success: false, error: "Unknown status." };
  }
  const access = await loadActivityAccess(activityId);
  if (!access) return { success: false, error: "Activity not found." };
  if (!access.canManage) return { success: false, error: "Only the chair or officers can change the status." };

  const rule = canTransition(access.activity.status as ActivityStatus, status, isProjectKind(access.activity.kind));
  if (!rule.allowed) return { success: false, error: rule.reason! };

  const { error } = await createAdminClient()
    .from("activities")
    .update({ status, is_published: status !== "DRAFT", updated_at: new Date().toISOString() })
    .eq("id", activityId);
  if (error) return { success: false, error: error.message };

  await logActivity(activityId, access.user.id, "STATUS_CHANGED", { from: access.activity.status, to: status });
  revalidateActivity(activityId);
  return { success: true, message: "Status updated." };
}

export async function setRsvpAction(input: { activityId: string; response: RsvpResponse; note?: string }): Promise<ActionResult> {
  const parsed = rsvpSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || "Invalid RSVP" };

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

  revalidateActivity(parsed.data.activityId);
  return { success: true, message: "RSVP saved." };
}

export async function selfCheckInAction(activityId: string): Promise<ActionResult<{ volunteerHours: number }>> {
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
    if (error.code === "23505") return { success: false, error: "You are already checked in." };
    return { success: false, error: "Could not record your check-in. Please try again." };
  }

  await awardEngagementPoints({
    clubId: a.club_id,
    profileId: access.user.id,
    sourceType: isProjectKind(a.kind) ? "SERVICE_CHECK_IN" : "CHECK_IN",
    sourceId: activityId,
    reason: isProjectKind(a.kind) ? "Verified service project attendance" : "Verified activity attendance",
  });
  await logActivity(activityId, access.user.id, "SELF_CHECK_IN");
  revalidateActivity(activityId);
  return { success: true, message: `Checked in to ${a.title}.`, volunteerHours: hours };
}

export async function revokeAttendanceAction(activityId: string, recordId: string): Promise<ActionResult> {
  if (!uuidString.safeParse(recordId).success) return { success: false, error: "Invalid record." };
  const access = await loadActivityAccess(activityId);
  if (!access) return { success: false, error: "Activity not found." };
  if (!access.canManageAttendance) return { success: false, error: "You cannot manage attendance for this activity." };

  const { error } = await createAdminClient()
    .from("attendance_records")
    .delete()
    .eq("id", recordId)
    .eq("activity_id", activityId);
  if (error) return { success: false, error: error.message };

  await logActivity(activityId, access.user.id, "ATTENDANCE_REVOKED", { recordId });
  revalidateActivity(activityId);
  return { success: true, message: "Check-in removed." };
}

export async function startActivityQrSessionAction(
  activityId: string
): Promise<ActionResult<{ sessionToken: string; expiresAt: string }>> {
  const access = await loadActivityAccess(activityId);
  if (!access) return { success: false, error: "Activity not found." };
  if (!access.canManageAttendance) return { success: false, error: "You cannot run check-in for this activity." };

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  await admin
    .from("attendance_sessions")
    .update({ status: "EXPIRED" })
    .eq("activity_id", activityId)
    .eq("status", "ACTIVE")
    .lt("expires_at", nowIso);

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60_000).toISOString();
  const { data: recent } = await admin
    .from("attendance_sessions")
    .select("session_token, expires_at")
    .eq("activity_id", activityId)
    .eq("status", "ACTIVE")
    .gt("expires_at", nowIso)
    .gt("created_at", fiveMinutesAgo)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recent) return { success: true, sessionToken: recent.session_token, expiresAt: recent.expires_at };

  // Unguessable token: knowing the activity id must not allow remote check-in.
  const token = `racspeed-${randomBytes(18).toString("base64url")}`;
  const expiresAt = new Date(Date.now() + 3 * 60 * 60_000).toISOString();
  const { error } = await admin.from("attendance_sessions").insert({
    activity_id: activityId,
    event_id: access.activity.legacy_event_id,
    session_token: token,
    secret_hash: token,
    status: "ACTIVE",
    created_by: access.user.id,
    expires_at: expiresAt,
  });
  if (error) return { success: false, error: `Failed to start QR session: ${error.message}` };

  return { success: true, sessionToken: token, expiresAt };
}

export async function addCommentAction(input: {
  activityId: string;
  body: string;
  parentId?: string;
  mentions?: string[];
}): Promise<ActionResult<{ commentId: string }>> {
  const parsed = commentSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || "Invalid comment" };

  const access = await loadActivityAccess(parsed.data.activityId);
  if (!access) return { success: false, error: "Activity not found." };
  if (!access.isParticipant) return { success: false, error: "Only club members can comment." };

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
  if (error || !data) return { success: false, error: "Could not post your comment." };

  await admin.from("activity_followers").upsert({ activity_id: parsed.data.activityId, profile_id: access.user.id });
  revalidateActivity(parsed.data.activityId);
  return { success: true, commentId: data.id };
}

export async function deleteCommentAction(activityId: string, commentId: string): Promise<ActionResult> {
  if (!uuidString.safeParse(commentId).success) return { success: false, error: "Invalid comment." };
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
  if (comment.author_id !== access.user.id && !access.canManage) {
    return { success: false, error: "You can only delete your own comments." };
  }

  await admin.from("activity_comments").update({ deleted_at: new Date().toISOString() }).eq("id", commentId);
  revalidateActivity(activityId);
  return { success: true };
}

const reactionSchema = z.string().trim().min(1).max(16);

const publishProjectReportSchema = z.object({
  activityId: uuidString,
  objective: z.string().trim().min(10, "Add a meaningful project objective").max(2000),
  inspiration: z.string().trim().min(20, "Describe what inspired this activity").max(5000),
  detailedDescription: z.string().trim().min(30, "Add the activity's detailed description").max(10000),
  outcomesSummary: z.string().trim().min(20, "Summarize the project outcomes").max(5000),
  beneficiaryType: z.string().trim().min(2, "Describe who benefited").max(200),
  beneficiaryCount: z.number().int().min(0).max(10000000),
  volunteerNonmemberCount: z.number().int().min(0).max(1000000),
  fundingTotal: z.number().min(0).max(1000000000),
  totalExpenses: z.number().min(0).max(1000000000),
  fundingCurrency: z.string().trim().length(3).default("PHP"),
  fundingSource: z.string().trim().max(500).default(""),
  supportsPolio: z.boolean().default(false),
});

export type PublishProjectReportInput = z.input<typeof publishProjectReportSchema>;

export async function publishProjectReportAction(input: PublishProjectReportInput): Promise<ActionResult<{ submissionId: string }>> {
  const parsed = publishProjectReportSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || "Complete the required report fields." };

  const access = await loadActivityAccess(parsed.data.activityId);
  if (!access) return { success: false, error: "Activity not found." };
  if (!isProjectKind(access.activity.kind)) return { success: false, error: "Only service projects can publish accomplishment reports." };
  if (!access.canManage) return { success: false, error: "Only the project chair or an officer can publish this report." };
  if (new Date(access.activity.end_at) > new Date()) return { success: false, error: "The project report can be published after the activity ends." };
  if (!["ONGOING", "COMPLETED", "AWAITING_REPORT"].includes(access.activity.status)) {
    return { success: false, error: "This project is not ready for report submission." };
  }

  const admin = createAdminClient();
  const [{ data: photos }, { data: template }] = await Promise.all([
    admin.from("activity_media").select("id").eq("activity_id", parsed.data.activityId),
    admin
      .from("report_templates")
      .select("id")
      .or(`club_id.eq.${access.activity.club_id},club_id.is.null`)
      .order("club_id", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!photos?.length) return { success: false, error: "Upload at least one project photo before publishing." };
  if (!template) return { success: false, error: "No report template is configured. Ask an administrator to configure one." };

  const [{ data: attendance }, { data: activity }] = await Promise.all([
    admin.from("attendance_records").select("profile_id, volunteer_hours").eq("activity_id", parsed.data.activityId).eq("attended", true),
    admin.from("activities").select("*").eq("id", parsed.data.activityId).single(),
  ]);
  if (!activity) return { success: false, error: "Project not found." };

  const attendanceRows = attendance || [];
  const volunteerCount = attendanceRows.length;
  const volunteerHours = attendanceRows.reduce((total, row) => total + Number(row.volunteer_hours || 0), 0);
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
  if (reportError || !submission) return { success: false, error: `Could not save report: ${reportError?.message || "unknown error"}` };

  const { error: detailsError } = await admin.from("activity_project_details").upsert({
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
  if (detailsError) return { success: false, error: `Report saved but project details could not be updated: ${detailsError.message}` };

  const { error: updateError } = await admin.from("activities").update({
    description: report.detailedDescription,
    status: "ACCOMPLISHED",
    updated_at: completedAt,
  }).eq("id", activity.id);
  if (updateError) return { success: false, error: `Report saved but status could not be updated: ${updateError.message}` };

  await logActivity(activity.id, access.user.id, "REPORT_PUBLISHED", { submissionId: submission.id });
  revalidateActivity(activity.id);
  return {
    success: true,
    message: "Project published as accomplished.",
    submissionId: submission.id,
  };
}

export async function toggleReactionAction(activityId: string, commentId: string, emoji: string): Promise<ActionResult> {
  if (!uuidString.safeParse(commentId).success || !reactionSchema.safeParse(emoji).success) {
    return { success: false, error: "Invalid reaction." };
  }
  const access = await loadActivityAccess(activityId);
  if (!access?.isParticipant) return { success: false, error: "Only club members can react." };

  const admin = createAdminClient();
  const { data: comment } = await admin
    .from("activity_comments")
    .select("id")
    .eq("id", commentId)
    .eq("activity_id", activityId)
    .maybeSingle();
  if (!comment) return { success: false, error: "Comment not found." };

  const match = { comment_id: commentId, profile_id: access.user.id, emoji };
  const { data: existing } = await admin.from("activity_comment_reactions").select("emoji").match(match).maybeSingle();
  if (existing) await admin.from("activity_comment_reactions").delete().match(match);
  else await admin.from("activity_comment_reactions").insert(match);

  revalidateActivity(activityId);
  return { success: true };
}

export async function toggleFollowAction(activityId: string): Promise<ActionResult<{ following: boolean }>> {
  const access = await loadActivityAccess(activityId);
  if (!access?.isParticipant) return { success: false, error: "Only club members can follow activities." };

  const admin = createAdminClient();
  const match = { activity_id: activityId, profile_id: access.user.id };
  const { data: existing } = await admin.from("activity_followers").select("profile_id").match(match).maybeSingle();
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

export async function uploadActivityMediaAction(formData: FormData): Promise<ActionResult> {
  const activityId = String(formData.get("activityId") || "");
  const access = await loadActivityAccess(activityId);
  if (!access) return { success: false, error: "Activity not found." };
  if (!access.canManage) return { success: false, error: "Only the chair or officers can upload photos." };

  const caption = String(formData.get("caption") || "").trim().slice(0, 280);
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { success: false, error: "Choose at least one photo." };
  if (files.length > 10) return { success: false, error: "Upload up to 10 photos at a time." };

  for (const file of files) {
    if (!(ALLOWED_MEDIA_TYPES as readonly string[]).includes(file.type)) {
      return { success: false, error: `${file.name}: only JPG, PNG, WEBP or GIF images are allowed.` };
    }
    if (file.size > MAX_MEDIA_BYTES) return { success: false, error: `${file.name} is larger than 10 MB.` };
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
    if (uploadError) return { success: false, error: `Upload failed: ${uploadError.message}` };

    await admin.from("activity_media").insert({
      activity_id: activityId,
      storage_path: path,
      caption: caption || null,
      mime_type: file.type,
      size_bytes: file.size,
      sort_order: nextOrder++,
      uploaded_by: access.user.id,
    });
  }

  const { data: activity } = await admin.from("activities").select("cover_storage_path").eq("id", activityId).single();
  if (!activity?.cover_storage_path) {
    const { data: first } = await admin
      .from("activity_media")
      .select("storage_path")
      .eq("activity_id", activityId)
      .order("sort_order")
      .limit(1)
      .maybeSingle();
    if (first) await admin.from("activities").update({ cover_storage_path: first.storage_path }).eq("id", activityId);
  }

  await logActivity(activityId, access.user.id, "MEDIA_UPLOADED", { count: files.length });
  revalidateActivity(activityId);
  return { success: true, message: `${files.length} photo(s) uploaded.` };
}

export async function deleteActivityMediaAction(activityId: string, mediaId: string): Promise<ActionResult> {
  if (!uuidString.safeParse(mediaId).success) return { success: false, error: "Invalid photo." };
  const access = await loadActivityAccess(activityId);
  if (!access?.canManage) return { success: false, error: "Only the chair or officers can remove photos." };

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

export async function setCoverMediaAction(activityId: string, mediaId: string): Promise<ActionResult> {
  if (!uuidString.safeParse(mediaId).success) return { success: false, error: "Invalid photo." };
  const access = await loadActivityAccess(activityId);
  if (!access?.canManage) return { success: false, error: "Only the chair or officers can change the cover." };

  const admin = createAdminClient();
  const { data: media } = await admin
    .from("activity_media")
    .select("storage_path")
    .eq("id", mediaId)
    .eq("activity_id", activityId)
    .maybeSingle();
  if (!media) return { success: false, error: "Photo not found." };

  await admin.from("activity_media").update({ is_featured: false }).eq("activity_id", activityId);
  await admin.from("activity_media").update({ is_featured: true }).eq("id", mediaId);
  await admin.from("activities").update({ cover_storage_path: media.storage_path }).eq("id", activityId);

  revalidateActivity(activityId);
  return { success: true };
}

export async function setTeamMemberAction(input: { activityId: string; profileId: string; role: string }): Promise<ActionResult> {
  const parsed = teamMemberSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid team member." };
  const access = await loadActivityAccess(parsed.data.activityId);
  if (!access?.canManage) return { success: false, error: "Only the chair or officers can manage the team." };
  if (!(await isClubParticipant(access.activity.club_id, parsed.data.profileId))) {
    return { success: false, error: "That person is not an active member of this club." };
  }

  const { error } = await createAdminClient().from("activity_team").upsert({
    activity_id: parsed.data.activityId,
    profile_id: parsed.data.profileId,
    team_role: parsed.data.role,
  });
  if (error) return { success: false, error: error.message };

  await logActivity(parsed.data.activityId, access.user.id, "TEAM_UPDATED", { profileId: parsed.data.profileId, role: parsed.data.role });
  revalidateActivity(parsed.data.activityId);
  return { success: true };
}

export async function removeTeamMemberAction(activityId: string, profileId: string): Promise<ActionResult> {
  if (!uuidString.safeParse(profileId).success) return { success: false, error: "Invalid team member." };
  const access = await loadActivityAccess(activityId);
  if (!access?.canManage) return { success: false, error: "Only the chair or officers can manage the team." };

  await createAdminClient().from("activity_team").delete().eq("activity_id", activityId).eq("profile_id", profileId);
  revalidateActivity(activityId);
  return { success: true };
}

const activityTaskSchema = z.object({
  activityId: uuidString,
  title: z.string().trim().min(3, "Task title must be at least 3 characters").max(200),
  description: z.string().trim().max(2000).default(""),
  committee: z.enum(COMMITTEES).default("CLUB_SERVICE"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Due date is required"),
  assigneeIds: z.array(uuidString).max(20).default([]),
});

export async function createActivityTaskAction(input: z.input<typeof activityTaskSchema>): Promise<ActionResult> {
  const parsed = activityTaskSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || "Invalid task" };
  const access = await loadActivityAccess(parsed.data.activityId);
  if (!access) return { success: false, error: "Activity not found." };
  if (!access.canManage) return { success: false, error: "Only the chair or officers can add tasks." };

  const admin = createAdminClient();
  const { data: assignees } = parsed.data.assigneeIds.length
    ? await admin.from("profiles").select("id, full_name").in("id", parsed.data.assigneeIds)
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
  if (error) console.warn("Could not sync activity task to Supabase:", error.message);

  await logActivity(parsed.data.activityId, access.user.id, "TASK_CREATED", { title: created.title });
  revalidateActivity(parsed.data.activityId);
  revalidatePath("/tasks");
  return { success: true, message: "Task added." };
}
