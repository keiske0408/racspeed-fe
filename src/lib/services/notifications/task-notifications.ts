import "server-only";

import type { GroupTaskDTO, TaskStatus } from "@/lib/data/tasks-types";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClubSettings } from "@/features/settings/queries";
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

function formatTaskStatusLabel(status: TaskStatus): string {
  switch (status) {
    case "TODO":
      return "To Do";
    case "IN_PROGRESS":
      return "In Progress";
    case "IN_REVIEW":
      return "In Review";
    case "COMPLETED":
      return "Done";
  }
}

function taskLinkUrl(projectId?: string): string {
  return projectId && isUuid(projectId)
    ? `/project-center/${projectId}?tab=tasks`
    : "/tasks";
}

async function resolveProjectStakeholderIds(
  projectId?: string,
): Promise<string[]> {
  if (!isUuid(projectId)) return [];
  try {
    const admin = createAdminClient();
    const [{ data: activity }, { data: chairs }] = await Promise.all([
      admin
        .from("activities")
        .select("owner_id")
        .eq("id", projectId)
        .maybeSingle(),
      admin
        .from("activity_team")
        .select("profile_id")
        .eq("activity_id", projectId)
        .in("team_role", ["CHAIR", "CO_CHAIR"]),
    ]);
    return uniqueUuids([
      activity?.owner_id,
      ...(chairs || []).map((row) => row.profile_id),
    ]);
  } catch (err) {
    console.warn("Could not resolve project stakeholders for task notification:", err);
    return [];
  }
}

export async function notifyTaskAssigned(params: {
  clubId: string;
  task: Pick<GroupTaskDTO, "id" | "title" | "dueDate" | "projectId" | "projectTitle">;
  assigneeIds: string[];
  actorId: string;
  actorName: string;
  slaConfig?: NotificationSlaConfig;
}): Promise<number> {
  const sla = params.slaConfig ?? (await getClubSettings(params.clubId)).notificationSla;
  if (!sla.notifyOnTaskAssigned) return 0;

  const recipients = uniqueUuids(params.assigneeIds);
  if (recipients.length === 0) return 0;

  const linkUrl = taskLinkUrl(params.task.projectId);
  const projectContext = params.task.projectTitle
    ? ` in ${params.task.projectTitle}`
    : "";
  const bucket = Math.floor(Date.now() / 10_000);

  const results = await Promise.allSettled(
    recipients.map((profileId) => {
      const isSelf = profileId === params.actorId;
      return dispatchNotification({
        profileId,
        clubId: params.clubId,
        type: "TASK_ASSIGNED",
        title: isSelf
          ? `Assigned to task: ${params.task.title}`
          : `Task assigned: ${params.task.title}`,
        message: isSelf
          ? `Assigned to you${projectContext}. Due: ${params.task.dueDate} (PHT). Open the project tasks board to track or update progress.`
          : `${params.actorName} assigned this task to you${projectContext}. Due: ${params.task.dueDate} (PHT). Open the project tasks board to review deliverables.`,
        linkUrl,
        dedupeKey: `task-assigned:${params.task.id}:${profileId}:${bucket}`,
        sendPush: true,
        sendEmail: !isSelf,
        sendTelegram: true,
        isSelfAction: isSelf,
      });
    }),
  );

  let created = 0;
  for (const res of results) {
    if (res.status === "fulfilled" && res.value.created) {
      created += 1;
    } else if (res.status === "rejected") {
      console.warn("Could not send task assignment notification:", res.reason);
    }
  }
  return created;
}

export async function notifyTaskStatusMarked(params: {
  clubId: string;
  task: Pick<
    GroupTaskDTO,
    "id" | "title" | "dueDate" | "assignedMemberIds" | "projectId" | "projectTitle"
  >;
  previousStatus: TaskStatus;
  nextStatus: TaskStatus;
  actorId: string;
  actorName: string;
  slaConfig?: NotificationSlaConfig;
}): Promise<number> {
  if (params.previousStatus === params.nextStatus) return 0;
  const sla = params.slaConfig ?? (await getClubSettings(params.clubId)).notificationSla;
  if (!sla.notifyOnTaskMarked) return 0;

  const stakeholderIds = await resolveProjectStakeholderIds(params.task.projectId);
  const recipients = uniqueUuids([
    params.actorId,
    ...params.task.assignedMemberIds,
    ...stakeholderIds,
  ]);
  if (recipients.length === 0) return 0;

  const statusLabel = formatTaskStatusLabel(params.nextStatus);
  const linkUrl = taskLinkUrl(params.task.projectId);
  const projectContext = params.task.projectTitle
    ? ` (${params.task.projectTitle})`
    : "";
  const taskTitle = params.task.title;
  const bucket = Math.floor(Date.now() / 10_000);

  const results = await Promise.allSettled(
    recipients.map((profileId) => {
      const isActor = profileId === params.actorId;
      return dispatchNotification({
        profileId,
        clubId: params.clubId,
        type: "TASK_UPDATED",
        title: `Task marked as ${statusLabel}: ${taskTitle}${projectContext}`,
        message: isActor
          ? `You moved "${taskTitle}"${projectContext} to ${statusLabel}. Due: ${params.task.dueDate} (PHT).`
          : `${params.actorName} moved "${taskTitle}"${projectContext} to ${statusLabel} (relevant because you are assigned or leading this project). Due: ${params.task.dueDate} (PHT).`,
        linkUrl,
        dedupeKey: `task-status:${params.task.id}:${params.nextStatus}:${profileId}:${bucket}`,
        sendPush: true,
        sendEmail: false,
        sendTelegram: true,
        isSelfAction: isActor,
      });
    }),
  );

  let created = 0;
  for (const res of results) {
    if (res.status === "fulfilled" && res.value.created) {
      created += 1;
    } else if (res.status === "rejected") {
      console.warn("Could not send task status notification:", res.reason);
    }
  }
  return created;
}

export async function notifyTaskChecklistMarked(params: {
  clubId: string;
  task: Pick<
    GroupTaskDTO,
    "id" | "title" | "dueDate" | "assignedMemberIds" | "projectId" | "projectTitle"
  >;
  itemId: string;
  itemTitle: string;
  autoCompleted: boolean;
  actorId: string;
  actorName: string;
  slaConfig?: NotificationSlaConfig;
}): Promise<number> {
  const sla = params.slaConfig ?? (await getClubSettings(params.clubId)).notificationSla;
  if (!sla.notifyOnTaskMarked) return 0;

  if (params.autoCompleted) {
    return notifyTaskStatusMarked({
      clubId: params.clubId,
      task: params.task,
      previousStatus: "IN_PROGRESS",
      nextStatus: "COMPLETED",
      actorId: params.actorId,
      actorName: params.actorName,
      slaConfig: sla,
    });
  }

  const stakeholderIds = await resolveProjectStakeholderIds(params.task.projectId);
  const recipients = uniqueUuids([
    params.actorId,
    ...params.task.assignedMemberIds,
    ...stakeholderIds,
  ]);
  if (recipients.length === 0) return 0;

  const linkUrl = taskLinkUrl(params.task.projectId);
  const bucket = Math.floor(Date.now() / 10_000);

  const results = await Promise.allSettled(
    recipients.map((profileId) => {
      const isActor = profileId === params.actorId;
      return dispatchNotification({
        profileId,
        clubId: params.clubId,
        type: "TASK_UPDATED",
        title: `Checklist updated: ${params.task.title}`,
        message: isActor
          ? `You completed "${params.itemTitle}" in "${params.task.title}"${params.task.projectTitle ? ` (${params.task.projectTitle})` : ""}.`
          : `${params.actorName} completed "${params.itemTitle}" in "${params.task.title}"${params.task.projectTitle ? ` (${params.task.projectTitle})` : ""}.`,
        linkUrl,
        dedupeKey: `task-checklist:${params.task.id}:${params.itemId}:${profileId}:${bucket}`,
        sendPush: true,
        sendEmail: false,
        sendTelegram: true,
        isSelfAction: isActor,
      });
    }),
  );

  let created = 0;
  for (const res of results) {
    if (res.status === "fulfilled" && res.value.created) {
      created += 1;
    } else if (res.status === "rejected") {
      console.warn("Could not send checklist notification:", res.reason);
    }
  }
  return created;
}

