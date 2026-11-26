import "server-only";

import { getClubSettings } from "@/features/settings/queries";
import { getGroupTasksList } from "@/features/tasks/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatManila, manilaDateKey } from "@/lib/utils/dates";
import { dispatchNotification } from "./dispatch";
import type { NotificationSlaConfig } from "./sla-config";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string | null | undefined): value is string {
  return Boolean(value && UUID_REGEX.test(value));
}

function uniqueUuids(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter(isUuid)));
}

export interface SlaEvaluationSummary {
  tasksDueSoon: number;
  tasksOverdue: number;
  projectsNearby: number;
  projectDeadlines: number;
  draftsSoon: number;
  reportsDue: number;
  totalCreated: number;
  slaConfig: NotificationSlaConfig;
}

interface ActivitySlaRow {
  id: string;
  title: string;
  kind: string;
  status: string;
  is_published: boolean;
  start_at: string;
  end_at: string;
  rsvp_deadline: string | null;
  owner_id: string | null;
  activity_rsvps: { profile_id: string; response: string }[] | null;
  activity_team: { profile_id: string; team_role: string | null }[] | null;
  activity_followers: { profile_id: string }[] | null;
}

export function parseManilaEndOfDayMs(dateStr: string): number {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return Date.parse(`${dateStr}T23:59:59+08:00`);
  }
  return Date.parse(dateStr);
}

function formatRemainingWindow(hours: number): string {
  if (hours <= 1) return "within 1 hour";
  if (hours < 24) return `in ${Math.ceil(hours)} hours`;
  const days = Math.max(1, Math.round(hours / 24));
  return days === 1 ? "in 1 day" : `in ${days} days`;
}

export async function evaluateDeadlineAndSlaNotifications(
  clubId: string,
  options?: {
    now?: Date;
    deferDelivery?: boolean;
    slaConfig?: NotificationSlaConfig;
  },
): Promise<SlaEvaluationSummary> {
  const sla =
    options?.slaConfig ?? (await getClubSettings(clubId)).notificationSla;
  const now = options?.now ?? new Date();
  const nowMs = now.getTime();
  const todayKey = manilaDateKey(now);
  const deferDelivery = options?.deferDelivery ?? true;

  const summary: SlaEvaluationSummary = {
    tasksDueSoon: 0,
    tasksOverdue: 0,
    projectsNearby: 0,
    projectDeadlines: 0,
    draftsSoon: 0,
    reportsDue: 0,
    totalCreated: 0,
    slaConfig: sla,
  };

  const admin = createAdminClient();
  const buildActivitiesQuery = (includeArchiveFilter: boolean) => {
    let query = admin
      .from("activities")
      .select(
        "id, title, kind, status, is_published, start_at, end_at, rsvp_deadline, owner_id, activity_rsvps(profile_id, response), activity_team(profile_id, team_role), activity_followers(profile_id)",
      )
      .eq("club_id", clubId);
    if (includeArchiveFilter) {
      query = query.eq("is_archived", false);
    }
    return query.neq("status", "CANCELLED");
  };

  const [tasks, primaryActivitiesResult] = await Promise.all([
    getGroupTasksList(clubId),
    buildActivitiesQuery(true),
  ]);

  let activitiesResult = primaryActivitiesResult;
  if (
    activitiesResult.error &&
    activitiesResult.error.message?.includes("is_archived")
  ) {
    activitiesResult = await buildActivitiesQuery(false);
  }

  if (activitiesResult.error) {
    throw new Error(
      `Could not load activities for SLA evaluation: ${activitiesResult.error.message}`,
    );
  }

  const activities = (activitiesResult.data || []) as ActivitySlaRow[];
  const activityOwnerMap = new Map<string, string>();
  for (const act of activities) {
    if (isUuid(act.owner_id)) {
      activityOwnerMap.set(act.id, act.owner_id);
    }
  }

  // Fallback lookup if any incomplete task references an archived or separate activity UUID
  const missingProjectIds = Array.from(
    new Set(
      tasks
        .filter(
          (t) =>
            t.status !== "COMPLETED" &&
            isUuid(t.projectId) &&
            !activityOwnerMap.has(t.projectId),
        )
        .map((t) => t.projectId as string),
    ),
  );
  if (missingProjectIds.length > 0) {
    const { data: extraOwners } = await admin
      .from("activities")
      .select("id, owner_id")
      .in("id", missingProjectIds);
    for (const row of extraOwners || []) {
      if (isUuid(row.owner_id)) {
        activityOwnerMap.set(row.id, row.owner_id);
      }
    }
  }

  // 1. Evaluate incomplete tasks (nearing due date & overdue)
  for (const task of tasks) {
    if (task.status === "COMPLETED") continue;
    const dueMs = parseManilaEndOfDayMs(task.dueDate);
    if (Number.isNaN(dueMs)) continue;

    const hoursUntilDue = (dueMs - nowMs) / 3_600_000;
    const directAssignees = uniqueUuids(task.assignedMemberIds);
    const linkedOwnerId = task.projectId
      ? activityOwnerMap.get(task.projectId)
      : undefined;
    const linkUrl =
      task.projectId && isUuid(task.projectId)
        ? `/project-center/${task.projectId}?tab=tasks`
        : "/tasks";
    const projectContext = task.projectTitle ? ` (${task.projectTitle})` : "";

    if (hoursUntilDue >= 0 && hoursUntilDue <= sla.taskDueSoonHours) {
      const recipients = uniqueUuids(
        directAssignees.length > 0 ? directAssignees : [linkedOwnerId],
      );
      for (const profileId of recipients) {
        const isAssigned = directAssignees.includes(profileId);
        try {
          const res = await dispatchNotification({
            profileId,
            clubId,
            type: "TASK_DEADLINE",
            title: `Task due ${formatRemainingWindow(hoursUntilDue)}: ${task.title}`,
            message: `${isAssigned ? "Assigned to you" : "Project Lead alert"}${projectContext} · Due ${task.dueDate} at 11:59 PM PHT (${formatRemainingWindow(hoursUntilDue)}). Open the tasks board to mark progress.`,
            linkUrl,
            dedupeKey: `task-due-soon:${task.id}:${task.dueDate}:${sla.taskDueSoonHours}h:${profileId}`,
            sendEmail: true,
            sendPush: true,
            sendTelegram: true,
            deferDelivery,
          });
          if (res.created) {
            summary.tasksDueSoon += 1;
            summary.totalCreated += 1;
          }
        } catch (err) {
          console.warn("Could not dispatch task due-soon notification:", err);
        }
      }
    } else if (hoursUntilDue < 0 && sla.taskOverdueReminderEnabled) {
      const recipients = uniqueUuids([...directAssignees, linkedOwnerId]);
      for (const profileId of recipients) {
        const isAssigned = directAssignees.includes(profileId);
        try {
          const res = await dispatchNotification({
            profileId,
            clubId,
            type: "TASK_DEADLINE",
            title: `Task overdue: ${task.title}`,
            message: `${isAssigned ? "Assigned to you" : "Project Lead alert"}${projectContext} · Passed due date (${task.dueDate}) and still ${task.status.replaceAll("_", " ")}. Update status or reschedule.`,
            linkUrl,
            dedupeKey: `task-overdue:${task.id}:${todayKey}:${profileId}`,
            sendEmail: true,
            sendPush: true,
            sendTelegram: true,
            deferDelivery,
          });
          if (res.created) {
            summary.tasksOverdue += 1;
            summary.totalCreated += 1;
          }
        } catch (err) {
          console.warn("Could not dispatch task overdue notification:", err);
        }
      }
    }
  }

  // 2. Evaluate Projects & Activities against SLA rules
  for (const activity of activities) {
    const startMs = Date.parse(activity.start_at);
    const endMs = Date.parse(activity.end_at);
    const rsvpDeadlineMs = activity.rsvp_deadline
      ? Date.parse(activity.rsvp_deadline)
      : Number.NaN;

    const team = activity.activity_team || [];
    const chairIds = uniqueUuids(
      team
        .filter((m) => m.team_role === "CHAIR" || m.team_role === "CO_CHAIR")
        .map((m) => m.profile_id),
    );
    const allTeamIds = uniqueUuids(team.map((m) => m.profile_id));
    const goingIds = uniqueUuids(
      (activity.activity_rsvps || [])
        .filter((r) => r.response === "GOING")
        .map((r) => r.profile_id),
    );
    const followerIds = uniqueUuids(
      (activity.activity_followers || []).map((f) => f.profile_id),
    );

    const leaders = uniqueUuids([
      activity.owner_id,
      ...(chairIds.length > 0 ? chairIds : allTeamIds),
    ]);
    const teamAndOwner = uniqueUuids([activity.owner_id, ...allTeamIds]);
    const allAudience = uniqueUuids([
      activity.owner_id,
      ...allTeamIds,
      ...goingIds,
      ...followerIds,
    ]);

    // 2a. Project / Activity nearby
    if (
      activity.status === "PLANNED" &&
      activity.is_published &&
      !Number.isNaN(startMs) &&
      startMs >= nowMs &&
      startMs - nowMs <= sla.projectNearbyHours * 3_600_000
    ) {
      const hoursUntilStart = (startMs - nowMs) / 3_600_000;
      const startText = formatManila(activity.start_at, "MMM d, h:mm a");
      for (const profileId of allAudience) {
        const relevance =
          profileId === activity.owner_id
            ? "Project Lead"
            : allTeamIds.includes(profileId)
              ? "Project Committee"
              : goingIds.includes(profileId)
                ? "You RSVP'd Going"
                : "Following project";
        try {
          const res = await dispatchNotification({
            profileId,
            clubId,
            type: "ACTIVITY_REMINDER",
            title: `Starting ${formatRemainingWindow(hoursUntilStart)}: ${activity.title}`,
            message: `${relevance} · Starts ${startText} PHT. Review venue, tasks, and attendance readiness before kickoff.`,
            linkUrl: `/project-center/${activity.id}`,
            dedupeKey: `project-nearby:${activity.id}:${sla.projectNearbyHours}h:${profileId}`,
            sendEmail: true,
            sendPush: true,
            sendTelegram: true,
            deferDelivery,
          });
          if (res.created) {
            summary.projectsNearby += 1;
            summary.totalCreated += 1;
          }
        } catch (err) {
          console.warn("Could not dispatch project nearby notification:", err);
        }
      }
    }

    // 2b. Draft Readiness SLA
    if (
      activity.status === "DRAFT" &&
      !Number.isNaN(startMs) &&
      !Number.isNaN(endMs) &&
      endMs >= nowMs &&
      startMs >= nowMs &&
      startMs - nowMs <= sla.draftReadinessDays * 86_400_000
    ) {
      const hoursUntilStart = (startMs - nowMs) / 3_600_000;
      const startText = formatManila(activity.start_at, "MMM d, h:mm a");
      for (const profileId of teamAndOwner) {
        try {
          const res = await dispatchNotification({
            profileId,
            clubId,
            type: "PROJECT_DEADLINE",
            title: `Draft needs publishing: ${activity.title}`,
            message: `Project Committee · Scheduled ${startText} PHT (${formatRemainingWindow(hoursUntilStart)}). Complete details and publish from Draft.`,
            linkUrl: `/project-center/${activity.id}`,
            dedupeKey: `draft-readiness:${activity.id}:${sla.draftReadinessDays}d:${profileId}`,
            sendEmail: true,
            sendPush: true,
            sendTelegram: true,
            deferDelivery,
          });
          if (res.created) {
            summary.draftsSoon += 1;
            summary.totalCreated += 1;
          }
        } catch (err) {
          console.warn("Could not dispatch draft readiness notification:", err);
        }
      }
    }

    // 2c. RSVP Deadline Nearing
    if (
      (activity.status === "PLANNED" || activity.status === "ONGOING") &&
      !Number.isNaN(rsvpDeadlineMs) &&
      rsvpDeadlineMs >= nowMs &&
      rsvpDeadlineMs - nowMs <= sla.projectDeadlineHours * 3_600_000
    ) {
      const hoursLeft = (rsvpDeadlineMs - nowMs) / 3_600_000;
      const deadlineText = formatManila(activity.rsvp_deadline, "MMM d, h:mm a");
      for (const profileId of allAudience) {
        try {
          const res = await dispatchNotification({
            profileId,
            clubId,
            type: "RSVP_REMINDER",
            title: `RSVP closes ${formatRemainingWindow(hoursLeft)}: ${activity.title}`,
            message: `RSVP cutoff is ${deadlineText} PHT. Confirm your attendance roster now.`,
            linkUrl: `/project-center/${activity.id}`,
            dedupeKey: `project-rsvp-deadline:${activity.id}:${sla.projectDeadlineHours}h:${profileId}`,
            sendEmail: false,
            sendPush: true,
            sendTelegram: true,
            deferDelivery,
          });
          if (res.created) {
            summary.projectDeadlines += 1;
            summary.totalCreated += 1;
          }
        } catch (err) {
          console.warn("Could not dispatch RSVP deadline notification:", err);
        }
      }
    }

    // 2d. Project / Activity End Deadline Nearing
    if (
      (activity.status === "PLANNED" || activity.status === "ONGOING") &&
      !Number.isNaN(endMs) &&
      endMs >= nowMs &&
      endMs - nowMs <= sla.projectDeadlineHours * 3_600_000
    ) {
      const hoursLeft = (endMs - nowMs) / 3_600_000;
      const endText = formatManila(activity.end_at, "MMM d, h:mm a");
      for (const profileId of teamAndOwner) {
        try {
          const res = await dispatchNotification({
            profileId,
            clubId,
            type: "PROJECT_DEADLINE",
            title: `Project ends ${formatRemainingWindow(hoursLeft)}: ${activity.title}`,
            message: `Project Team · Ends ${endText} PHT. Wrap up open tasks and check-in attendance.`,
            linkUrl: `/project-center/${activity.id}`,
            dedupeKey: `project-end-deadline:${activity.id}:${sla.projectDeadlineHours}h:${profileId}`,
            sendEmail: true,
            sendPush: true,
            sendTelegram: true,
            deferDelivery,
          });
          if (res.created) {
            summary.projectDeadlines += 1;
            summary.totalCreated += 1;
          }
        } catch (err) {
          console.warn("Could not dispatch project end deadline notification:", err);
        }
      }
    }

    // 2e. Missed / Past-Due Project Deadline
    if (
      (activity.status === "DRAFT" || activity.status === "PLANNED") &&
      !Number.isNaN(endMs) &&
      endMs < nowMs
    ) {
      const endText = formatManila(activity.end_at, "MMM d, yyyy");
      for (const profileId of leaders) {
        try {
          const res = await dispatchNotification({
            profileId,
            clubId,
            type: "PROJECT_DEADLINE",
            title: `Past due schedule: ${activity.title}`,
            message: `Project Lead · Ended ${endText} while still in ${activity.status}. Update its status or reschedule.`,
            linkUrl: `/project-center/${activity.id}`,
            dedupeKey: `project-missed-deadline:${activity.id}:${todayKey}:${profileId}`,
            sendEmail: true,
            sendPush: true,
            sendTelegram: true,
            deferDelivery,
          });
          if (res.created) {
            summary.projectDeadlines += 1;
            summary.totalCreated += 1;
          }
        } catch (err) {
          console.warn("Could not dispatch project missed deadline notification:", err);
        }
      }
    }

    // 2f. Report Submission SLA
    if (activity.status === "AWAITING_REPORT" && !Number.isNaN(endMs)) {
      const reportDueMs = endMs + sla.reportDueSlaDays * 86_400_000;
      if (nowMs >= reportDueMs - 24 * 3_600_000) {
        const isOverdue = nowMs > reportDueMs;
        for (const profileId of leaders) {
          try {
            const res = await dispatchNotification({
              profileId,
              clubId,
              type: "REPORT_DUE",
              title: isOverdue
                ? `Report SLA overdue: ${activity.title}`
                : `Report due soon: ${activity.title}`,
              message: isOverdue
                ? `Project Lead · Exceeded the ${sla.reportDueSlaDays}-day report SLA. Attach at least 1 photo and complete the 6 Rotary Showcase fields.`
                : `Project Lead · Nearing the ${sla.reportDueSlaDays}-day report SLA. Open the Report tab to publish as Accomplished.`,
              linkUrl: `/project-center/${activity.id}?tab=REPORT`,
              dedupeKey: `report-sla-due:${activity.id}:${todayKey}:${profileId}`,
              sendEmail: true,
              sendPush: true,
              sendTelegram: true,
              deferDelivery,
            });
            if (res.created) {
              summary.reportsDue += 1;
              summary.totalCreated += 1;
            }
          } catch (err) {
            console.warn("Could not dispatch report SLA notification:", err);
          }
        }
      }
    }
  }

  return summary;
}

const lastEvaluatedAtByClub = new Map<string, number>();
const inFlightByClub = new Map<string, Promise<SlaEvaluationSummary>>();

export function resetSlaEvaluationCooldown() {
  lastEvaluatedAtByClub.clear();
  inFlightByClub.clear();
}

export async function ensureSlaNotificationsEvaluated(
  clubId: string,
  cooldownMs = 5 * 60_000,
): Promise<SlaEvaluationSummary | null> {
  const nowMs = Date.now();
  const lastRun = lastEvaluatedAtByClub.get(clubId) || 0;
  if (nowMs - lastRun < cooldownMs) {
    return null;
  }

  const existingPromise = inFlightByClub.get(clubId);
  if (existingPromise) {
    return existingPromise;
  }

  const promise = evaluateDeadlineAndSlaNotifications(clubId, {
    deferDelivery: true,
  })
    .then((summary) => {
      lastEvaluatedAtByClub.set(clubId, Date.now());
      return summary;
    })
    .finally(() => {
      inFlightByClub.delete(clubId);
    });

  inFlightByClub.set(clubId, promise);
  return promise;
}

