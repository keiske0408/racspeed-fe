import {
  formatActivityStatusLabel,
} from "@/features/activities/export-types";
import {
  addDaysYmd,
  expandActivityOccurrences,
  formatRecurrenceSummary,
  getNextActivityOccurrence,
  isRecurringSchedule,
} from "@/features/activities/recurrence";
import {
  ACTIVITY_KIND_META,
  ACTIVITY_PRIORITY_META,
  type ActivityPriority,
  type ActivitySummaryDTO,
} from "@/features/activities/types";
import type { GroupTaskDTO } from "@/lib/data/tasks-types";
import { buildMonthsFromStart } from "@/lib/services/exports/calendar-excel-helpers";
import { formatManila, manilaDateKey } from "@/lib/utils/dates";

export type QuickSummaryMode = "COMBINED" | "PROJECTS_ONLY" | "TASKS_ONLY";
export type QuickSummaryTimeframe =
  | "NEXT_14_DAYS"
  | "THIS_MONTH"
  | "TWO_MONTHS"
  | "ALL_UPCOMING";
export type QuickSummaryTheme = "LIGHT" | "DARK";
export type QuickSummaryLayout = "PORTRAIT" | "WIDE";

export interface QuickSummaryProjectItem {
  id: string;
  title: string;
  kindLabel: string;
  statusLabel: string;
  priority: ActivityPriority;
  whenLabel: string;
  recurrenceLabel: string | null;
  location: string;
  chairName: string;
  rsvpGoing: number;
  minMembersRequired: number | null;
  tasksProgressLabel: string | null;
}

export interface QuickSummaryTaskSubtask {
  title: string;
  completed: boolean;
  assignedMemberName?: string;
}

export interface QuickSummaryTaskItem {
  id: string;
  title: string;
  priority: string;
  statusLabel: string;
  dueDateLabel: string;
  isOverdue: boolean;
  projectTitle: string | null;
  assignees: string[];
  checklist: QuickSummaryTaskSubtask[];
}

export interface QuickSummaryData {
  mode: QuickSummaryMode;
  timeframe: QuickSummaryTimeframe;
  timeframeLabel: string;
  headline: string;
  clubName: string;
  districtCode: string;
  rotaryYear: string;
  generatedAtLabel: string;
  customNote: string;
  includeSubtasks: boolean;
  stats: {
    projectsCount: number;
    sessionsCount: number;
    openTasksCount: number;
    urgentTasksCount: number;
    subtasksDone: number;
    subtasksTotal: number;
  };
  projects: QuickSummaryProjectItem[];
  tasks: QuickSummaryTaskItem[];
}

const PRIORITY_RANK: Record<string, number> = {
  URGENT: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

function getTimeframeBounds(
  timeframe: QuickSummaryTimeframe,
  todayKey: string,
): { minKey: string; maxKey: string; label: string } {
  const year = Number(todayKey.slice(0, 4)) || 2026;
  const monthIdx = Math.max(0, Math.min(11, (Number(todayKey.slice(5, 7)) || 1) - 1));

  switch (timeframe) {
    case "NEXT_14_DAYS":
      return {
        minKey: todayKey,
        maxKey: addDaysYmd(todayKey, 14),
        label: "Next 14 Days",
      };
    case "THIS_MONTH": {
      const ym = todayKey.slice(0, 7);
      const monthName = new Intl.DateTimeFormat("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(Date.UTC(year, monthIdx, 1)));
      return {
        minKey: `${ym}-01`,
        maxKey: `${ym}-31`,
        label: monthName,
      };
    }
    case "TWO_MONTHS": {
      const [m1, m2] = buildMonthsFromStart(year, monthIdx, 2);
      const ym1 = `${m1.year}-${String(m1.month + 1).padStart(2, "0")}`;
      const ym2 = `${m2.year}-${String(m2.month + 1).padStart(2, "0")}`;
      const fmt = new Intl.DateTimeFormat("en-US", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
      return {
        minKey: `${ym1}-01`,
        maxKey: `${ym2}-31`,
        label: `${fmt.format(new Date(Date.UTC(m1.year, m1.month, 1)))} – ${fmt.format(new Date(Date.UTC(m2.year, m2.month, 1)))}`,
      };
    }
    case "ALL_UPCOMING":
    default:
      return {
        minKey: todayKey,
        maxKey: "9999-12-31",
        label: "All Upcoming Schedule",
      };
  }
}

export function buildQuickSummaryData({
  activities,
  tasks,
  mode,
  timeframe,
  rotaryYear,
  clubName,
  districtCode,
  includeSubtasks = true,
  includeDrafts = false,
  customNote = "",
  referenceNow = new Date(),
}: {
  activities: ActivitySummaryDTO[];
  tasks: GroupTaskDTO[];
  mode: QuickSummaryMode;
  timeframe: QuickSummaryTimeframe;
  rotaryYear: string;
  clubName: string;
  districtCode: string;
  includeSubtasks?: boolean;
  includeDrafts?: boolean;
  customNote?: string;
  referenceNow?: Date;
}): QuickSummaryData {
  const todayKey = manilaDateKey(referenceNow);
  const bounds = getTimeframeBounds(timeframe, todayKey);
  const ryFilteredActivities = activities.filter((a) => {
    if (a.isArchived) return false;
    if (!includeDrafts && a.status === "DRAFT") return false;
    if (rotaryYear !== "ALL" && a.rotaryYear && a.rotaryYear !== rotaryYear) {
      return false;
    }
    if (a.status === "CANCELLED") return false;
    return true;
  });

  const activityTitleMap = new Map(activities.map((a) => [a.id, a.title]));

  let sessionsCount = 0;
  const matchedProjects: { sortKey: string; item: QuickSummaryProjectItem }[] = [];

  for (const act of ryFilteredActivities) {
    const occs = expandActivityOccurrences(act);
    const matchingOccs = occs.filter(
      (occ) => occ.dateKey >= bounds.minKey && occ.dateKey <= bounds.maxKey,
    );
    const isOngoingActive =
      (act.status === "ONGOING" || act.status === "AWAITING_REPORT") &&
      manilaDateKey(act.endAt) >= bounds.minKey;

    if (matchingOccs.length === 0 && !isOngoingActive) {
      continue;
    }

    sessionsCount += Math.max(matchingOccs.length, isOngoingActive ? 1 : 0);

    const nextOcc =
      matchingOccs[0] ?? getNextActivityOccurrence(act, referenceNow) ?? occs[0];
    const displayStart = nextOcc?.startAt ?? act.startAt;
    const displayEnd = nextOcc?.endAt ?? act.endAt;
    const whenLabel = act.allDay
      ? `${formatManila(displayStart, "EEE, MMM d")} · All day`
      : `${formatManila(displayStart, "EEE, MMM d")} · ${formatManila(
          displayStart,
          "h:mm a",
        )} – ${formatManila(displayEnd, "h:mm a")}`;
    const recurrenceLabel = isRecurringSchedule(act.recurrence)
      ? formatRecurrenceSummary(act.recurrence, act.startAt, act.endAt)
      : null;

    matchedProjects.push({
      sortKey: nextOcc?.startAt ?? act.startAt,
      item: {
        id: act.id,
        title: act.title,
        kindLabel: ACTIVITY_KIND_META[act.kind]?.label ?? act.kind,
        statusLabel: formatActivityStatusLabel(act.status),
        priority: act.priority,
        whenLabel,
        recurrenceLabel,
        location: act.location || "Venue TBA",
        chairName: act.ownerName || "Unassigned Chair",
        rsvpGoing: act.rsvp.going,
        minMembersRequired: act.minMembersRequired ?? null,
        tasksProgressLabel:
          act.tasksTotal > 0 ? `${act.tasksDone}/${act.tasksTotal} tasks` : null,
      },
    });
  }

  matchedProjects.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  const matchedTasksRaw = tasks
    .filter((t) => {
      if (t.status === "COMPLETED") return false;
      const due = t.dueDate?.slice(0, 10) || "";
      if (!due) return timeframe === "ALL_UPCOMING";
      return due <= bounds.maxKey;
    })
    .sort((a, b) => {
      const rankA = PRIORITY_RANK[a.priority] ?? 9;
      const rankB = PRIORITY_RANK[b.priority] ?? 9;
      if (rankA !== rankB) return rankA - rankB;
      return (a.dueDate || "9999").localeCompare(b.dueDate || "9999");
    });

  let subtasksDone = 0;
  let subtasksTotal = 0;
  for (const t of matchedTasksRaw) {
    subtasksTotal += t.checklist.length;
    subtasksDone += t.checklist.filter((c) => c.completed).length;
  }

  const mappedTasks: QuickSummaryTaskItem[] = matchedTasksRaw.map((t) => {
    const dueKey = t.dueDate?.slice(0, 10) || "";
    const isOverdue = Boolean(dueKey && dueKey < todayKey);
    const dueDateLabel = dueKey
      ? formatManila(`${dueKey}T12:00:00+08:00`, "MMM d, yyyy")
      : "No deadline";
    return {
      id: t.id,
      title: t.title,
      priority: ACTIVITY_PRIORITY_META[t.priority]?.label ?? t.priority,
      statusLabel: t.status.replaceAll("_", " "),
      dueDateLabel,
      isOverdue,
      projectTitle:
        t.projectTitle ||
        (t.projectId ? activityTitleMap.get(t.projectId) ?? null : null),
      assignees:
        t.assignedMemberNames.length > 0
          ? t.assignedMemberNames
          : ["Unassigned"],
      checklist: includeSubtasks
        ? t.checklist.map((c) => ({
            title: c.title,
            completed: Boolean(c.completed),
            ...(c.assignedMemberName
              ? { assignedMemberName: c.assignedMemberName }
              : {}),
          }))
        : [],
    };
  });

  const headline =
    mode === "PROJECTS_ONLY"
      ? "Upcoming Projects & Activities"
      : mode === "TASKS_ONLY"
        ? "Member Tasks & Subtasks Summary"
        : "Projects & Action Tasks Summary";

  return {
    mode,
    timeframe,
    timeframeLabel: bounds.label,
    headline,
    clubName,
    districtCode,
    rotaryYear,
    generatedAtLabel: `${formatManila(referenceNow, "MMM d, yyyy h:mm a")} (PHT)`,
    customNote: customNote.trim(),
    includeSubtasks,
    stats: {
      projectsCount: matchedProjects.length,
      sessionsCount,
      openTasksCount: mappedTasks.length,
      urgentTasksCount: matchedTasksRaw.filter(
        (t) => t.priority === "URGENT" || t.priority === "HIGH",
      ).length,
      subtasksDone,
      subtasksTotal,
    },
    projects:
      mode === "TASKS_ONLY" ? [] : matchedProjects.map((entry) => entry.item),
    tasks: mode === "PROJECTS_ONLY" ? [] : mappedTasks,
  };
}

export function formatQuickSummaryPlainText(data: QuickSummaryData): string {
  const lines: string[] = [];
  const ryText =
    data.rotaryYear && data.rotaryYear !== "ALL"
      ? `RY ${data.rotaryYear}`
      : "All Rotary Years";

  lines.push(`*${data.clubName}* — ${data.headline}`);
  lines.push(`${data.timeframeLabel} | ${ryText} | District ${data.districtCode}`);
  lines.push("");

  if (data.mode !== "TASKS_ONLY") {
    lines.push(`PROJECTS & ACTIVITIES (${data.projects.length}):`);
    if (data.projects.length === 0) {
      lines.push("• No upcoming projects or activities in this timeframe.");
    } else {
      for (const p of data.projects.slice(0, 12)) {
        const rec = p.recurrenceLabel ? ` [${p.recurrenceLabel}]` : "";
        lines.push(
          `• ${p.title} (${p.statusLabel})${rec}\n  When: ${p.whenLabel} | Where: ${p.location} | Lead: ${p.chairName} | Going: ${p.rsvpGoing}`,
        );
      }
      if (data.projects.length > 12) {
        lines.push(`  ...and ${data.projects.length - 12} more on Racspeed.`);
      }
    }
    lines.push("");
  }

  if (data.mode !== "PROJECTS_ONLY") {
    lines.push(`OPEN TASKS & SUBTASKS (${data.tasks.length}):`);
    if (data.tasks.length === 0) {
      lines.push("• All tracked tasks are completed!");
    } else {
      for (const t of data.tasks.slice(0, 14)) {
        const overdue = t.isOverdue ? " [OVERDUE]" : "";
        const proj = t.projectTitle ? ` (${t.projectTitle})` : "";
        lines.push(
          `• [${t.priority.toUpperCase()}] ${t.title}${proj} — ${t.assignees.join(", ")} · Due ${t.dueDateLabel}${overdue}`,
        );
        if (data.includeSubtasks && t.checklist.length > 0) {
          for (const sub of t.checklist.slice(0, 4)) {
            lines.push(
              `   ${sub.completed ? "✓" : "☐"} ${sub.title}${
                sub.assignedMemberName ? ` (${sub.assignedMemberName})` : ""
              }`,
            );
          }
        }
      }
      if (data.tasks.length > 14) {
        lines.push(`  ...and ${data.tasks.length - 14} more tasks on Racspeed.`);
      }
    }
    lines.push("");
  }

  if (data.customNote) {
    lines.push(`Note: ${data.customNote}`);
    lines.push("");
  }

  lines.push(`Generated ${data.generatedAtLabel} via Racspeed`);
  return lines.join("\n").trim();
}

