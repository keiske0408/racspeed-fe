import { TZDate } from "@date-fns/tz";
import {
  isProjectKind,
  type ActivityKind,
  type ActivityStatus,
  type ActivitySummaryDTO,
} from "./types";

export const CLUB_TIMEZONE = "Asia/Manila";
export const DRAFT_STARTING_SOON_DAYS = 7;
export const RELATIVE_DAYS_MAX = 30;
export const SEARCH_DEBOUNCE_MS = 250;
export const LAST_VIEW_STORAGE_KEY_PREFIX = "racspeed:project-center:view:";

export type ProjectStageTab =
  | "UPCOMING"
  | "ONGOING"
  | "REPORT_DUE"
  | "ACCOMPLISHED";

export type ProjectCenterView = "LIST" | "BOARD" | "CALENDAR";

export type RowVisualStatus =
  | "PAST_DUE"
  | "DRAFT"
  | "PLANNED"
  | "ONGOING"
  | "AWAITING_REPORT"
  | "ACCOMPLISHED"
  | "COMPLETED"
  | "CANCELLED";

export interface ActivityStepProgress {
  step: number;
  total: number;
  segments: ("done" | "current" | "upcoming")[];
}

export interface ContextualRowAction {
  label: string;
  href: string;
  tone: "attention" | "primary" | "default";
}

export interface AssignmentInfo {
  isAssignedToMe: boolean;
  myLabel: string | null;
  leadName: string | null;
}

function manilaParts(instant: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const z = new TZDate(instant.getTime(), CLUB_TIMEZONE);
  return {
    year: z.getFullYear(),
    month: z.getMonth(),
    day: z.getDate(),
    hour: z.getHours(),
    minute: z.getMinutes(),
  };
}

function manilaDayIndex(instant: Date): number {
  const { year, month, day } = manilaParts(instant);
  return Math.floor(Date.UTC(year, month, day) / 86_400_000);
}

/**
 * Past due = stage is Draft or Planned AND end date is before now.
 */
export function isPastDue(
  activity: Pick<ActivitySummaryDTO, "status" | "endAt">,
  now: Date = new Date(),
): boolean {
  if (activity.status !== "DRAFT" && activity.status !== "PLANNED") {
    return false;
  }
  const endMs = Date.parse(activity.endAt);
  if (Number.isNaN(endMs)) return false;
  return endMs < now.getTime();
}

/**
 * Draft starting soon = stage is Draft AND start date within 7 days in Asia/Manila (and not past due).
 */
export function isDraftStartingSoon(
  activity: Pick<ActivitySummaryDTO, "status" | "startAt" | "endAt">,
  now: Date = new Date(),
): boolean {
  if (activity.status !== "DRAFT") return false;
  if (isPastDue(activity, now)) return false;
  const startDate = new Date(activity.startAt);
  if (Number.isNaN(startDate.getTime())) return false;
  const diffDays = manilaDayIndex(startDate) - manilaDayIndex(now);
  return diffDays >= 0 && diffDays <= DRAFT_STARTING_SOON_DAYS;
}

/**
 * Needs attention = past due, or draft starting soon.
 */
export function needsAttention(
  activity: Pick<ActivitySummaryDTO, "status" | "startAt" | "endAt">,
  now: Date = new Date(),
): boolean {
  return isPastDue(activity, now) || isDraftStartingSoon(activity, now);
}

export function getProjectStageTab(
  status: ActivityStatus,
): ProjectStageTab | null {
  switch (status) {
    case "DRAFT":
    case "PLANNED":
      return "UPCOMING";
    case "ONGOING":
      return "ONGOING";
    case "AWAITING_REPORT":
      return "REPORT_DUE";
    case "ACCOMPLISHED":
    case "COMPLETED":
      return "ACCOMPLISHED";
    case "CANCELLED":
    default:
      return null;
  }
}

export function getRowVisualStatus(
  activity: Pick<ActivitySummaryDTO, "status" | "endAt">,
  now: Date = new Date(),
): RowVisualStatus {
  if (isPastDue(activity, now)) return "PAST_DUE";
  return activity.status;
}

/**
 * Single source of truth for step progress across all statuses and activity tracks.
 * Both DRAFT and PLANNED occupy Step 1 so counts stay consistent.
 */
export function getActivityStepProgress(
  kind: ActivityKind,
  status: ActivityStatus,
): ActivityStepProgress {
  const total = isProjectKind(kind) ? 4 : 3;
  let step = 1;
  switch (status) {
    case "DRAFT":
    case "PLANNED":
      step = 1;
      break;
    case "ONGOING":
      step = 2;
      break;
    case "AWAITING_REPORT":
      step = Math.min(3, total);
      break;
    case "ACCOMPLISHED":
    case "COMPLETED":
      step = total;
      break;
    case "CANCELLED":
    default:
      step = 1;
      break;
  }

  const segments: ("done" | "current" | "upcoming")[] = [];
  const isFinished = status === "ACCOMPLISHED" || status === "COMPLETED";
  for (let i = 1; i <= total; i += 1) {
    if (isFinished || i < step) {
      segments.push("done");
    } else if (i === step) {
      segments.push("current");
    } else {
      segments.push("upcoming");
    }
  }
  return { step, total, segments };
}

function formatManilaTimeShort(instant: Date): string {
  const { hour, minute } = manilaParts(instant);
  const suffix = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return minute === 0
    ? `${h12} ${suffix}`
    : `${h12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

export function formatCompactWhenManila(
  activity: Pick<ActivitySummaryDTO, "startAt" | "endAt" | "allDay">,
): string {
  const start = new Date(activity.startAt);
  const end = new Date(activity.endAt);
  if (Number.isNaN(start.getTime())) return "Schedule TBD";

  const sParts = manilaParts(start);
  const eParts = Number.isNaN(end.getTime()) ? sParts : manilaParts(end);

  const monthFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: CLUB_TIMEZONE,
    month: "short",
  });
  const weekdayFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: CLUB_TIMEZONE,
    weekday: "short",
  });

  const sameDay =
    sParts.year === eParts.year &&
    sParts.month === eParts.month &&
    sParts.day === eParts.day;
  const sameMonth =
    sParts.year === eParts.year && sParts.month === eParts.month;

  if (sameDay) {
    const dayPrefix = `${weekdayFmt.format(start)}, ${monthFmt.format(start)} ${sParts.day}`;
    if (activity.allDay) return dayPrefix;
    return `${dayPrefix} · ${formatManilaTimeShort(start)} – ${formatManilaTimeShort(end)}`;
  }

  if (sameMonth) {
    return `${monthFmt.format(start)} ${sParts.day} – ${eParts.day}`;
  }

  return `${monthFmt.format(start)} ${sParts.day} – ${monthFmt.format(end)} ${eParts.day}`;
}

/**
 * Relative date in Asia/Manila:
 * - Ended N days ago (when past due)
 * - Today / tomorrow / in N days (up to 30) / in N months
 */
export function formatRelativeWhenManila(
  activity: Pick<ActivitySummaryDTO, "status" | "startAt" | "endAt">,
  now: Date = new Date(),
): string {
  const nowDay = manilaDayIndex(now);
  const start = new Date(activity.startAt);
  const end = new Date(activity.endAt);

  if (isPastDue(activity, now) && !Number.isNaN(end.getTime())) {
    const endedDaysAgo = Math.max(0, nowDay - manilaDayIndex(end));
    if (endedDaysAgo === 0) return "Ended earlier today";
    if (endedDaysAgo === 1) return "Ended 1 day ago";
    return `Ended ${endedDaysAgo} days ago`;
  }

  if (Number.isNaN(start.getTime())) return "Date TBD";
  const diffDays = manilaDayIndex(start) - nowDay;
  const draftSoon = isDraftStartingSoon(activity, now);

  if (diffDays < 0) {
    if (!Number.isNaN(end.getTime())) {
      const endDiff = manilaDayIndex(end) - nowDay;
      if (endDiff === 0) return "Ends today";
      if (endDiff === 1) return "Ends tomorrow";
      if (endDiff > 1 && endDiff <= RELATIVE_DAYS_MAX) {
        return `Ends in ${endDiff} days`;
      }
      if (endDiff > RELATIVE_DAYS_MAX) {
        const months = Math.max(1, Math.round(endDiff / 30));
        return `Ends in ${months} ${months === 1 ? "month" : "months"}`;
      }
      const endedAgo = Math.abs(endDiff);
      return endedAgo === 1 ? "Ended 1 day ago" : `Ended ${endedAgo} days ago`;
    }
    const startedAgo = Math.abs(diffDays);
    return startedAgo === 1 ? "Started 1 day ago" : `Started ${startedAgo} days ago`;
  }

  if (diffDays === 0) {
    return draftSoon ? "Starts today" : "Today";
  }
  if (diffDays === 1) {
    return draftSoon ? "Starts tomorrow" : "Tomorrow";
  }
  if (diffDays <= RELATIVE_DAYS_MAX) {
    return draftSoon ? `Starts in ${diffDays} days` : `In ${diffDays} days`;
  }

  const months = Math.max(1, Math.round(diffDays / 30));
  return months === 1 ? "In 1 month" : `In ${months} months`;
}

export function getContextualRowAction(
  activity: Pick<ActivitySummaryDTO, "id" | "kind" | "status" | "endAt">,
  now: Date = new Date(),
): ContextualRowAction {
  if (isPastDue(activity, now)) {
    return {
      label: "Update status",
      href: `/project-center/${activity.id}`,
      tone: "attention",
    };
  }
  switch (activity.status) {
    case "DRAFT":
      return {
        label: "Finish draft",
        href: `/project-center/${activity.id}`,
        tone: "attention",
      };
    case "AWAITING_REPORT":
      return {
        label: "Write report",
        href: `/project-center/${activity.id}?tab=REPORT`,
        tone: "primary",
      };
    case "ACCOMPLISHED":
      return {
        label: "View report",
        href: `/project-center/${activity.id}?tab=REPORT`,
        tone: "default",
      };
    case "COMPLETED":
      return isProjectKind(activity.kind)
        ? {
            label: "View report",
            href: `/project-center/${activity.id}?tab=REPORT`,
            tone: "default",
          }
        : {
            label: "Open",
            href: `/project-center/${activity.id}`,
            tone: "default",
          };
    case "PLANNED":
    case "ONGOING":
    default:
      return {
        label: "Open",
        href: `/project-center/${activity.id}`,
        tone: "default",
      };
  }
}

function formatTeamRoleShort(role: string): string {
  switch (role) {
    case "CHAIR":
      return "Chair";
    case "CO_CHAIR":
      return "Co-Chair";
    case "VOLUNTEER":
      return "Volunteer";
    case "COMMITTEE":
    default:
      return "Committee";
  }
}

/**
 * Resolves who leads the activity and whether it is assigned to the current user
 * (Owner/Chair, Committee/Team Member, or assigned Task owner).
 */
export function getAssignmentInfo(
  activity: Pick<
    ActivitySummaryDTO,
    "id" | "ownerId" | "ownerName" | "isTeamMember" | "myTeamRole" | "teamMembers"
  >,
  currentUserId: string,
  assignedTaskProjectIds?: Set<string>,
): AssignmentInfo {
  const leadName = activity.ownerName || null;

  if (activity.ownerId === currentUserId) {
    return { isAssignedToMe: true, myLabel: "You (Lead)", leadName };
  }
  const teamMatch = activity.teamMembers?.find(
    (m) => m.profileId === currentUserId,
  );
  if (activity.isTeamMember || teamMatch) {
    const role = activity.myTeamRole || teamMatch?.role || "COMMITTEE";
    return {
      isAssignedToMe: true,
      myLabel: `You (${formatTeamRoleShort(role)})`,
      leadName,
    };
  }
  if (assignedTaskProjectIds?.has(activity.id)) {
    return {
      isAssignedToMe: true,
      myLabel: "You (Task assigned)",
      leadName,
    };
  }
  return {
    isAssignedToMe: false,
    myLabel: null,
    leadName,
  };
}

