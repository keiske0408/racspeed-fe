import { z } from "zod";
import { env } from "@/lib/env";
import {
  formatActivityStatusLabel,
  type DeckCalendarEntry,
  type DeckCalendarMonth,
  type DeckMemberWorkload,
  type DeckProject,
  type ExportMonthTarget,
  type PresentationDeckDTO,
} from "@/features/activities/export-types";
import {
  expandActivityOccurrences,
  formatRecurrenceSummary,
  getNextActivityOccurrence,
  isRecurringSchedule,
} from "@/features/activities/recurrence";
import {
  ACTIVITY_KIND_META,
  type ActivitySummaryDTO,
} from "@/features/activities/types";
import type { GroupTaskDTO } from "@/lib/data/tasks-types";
import { daysBetween, formatManila } from "@/lib/utils/dates";

function formatMonthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month, 1)));
}

function formatCommitteeLabel(code: string | null | undefined): string {
  if (!code) return "Club-wide";
  return code
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function stripNonPrintableAndEmoji(text: string): string {
  return text
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildDeterministicDeck({
  title,
  clubName,
  districtCode,
  rotaryYear,
  presenterName,
  months,
  activities,
  tasks,
  includeCalendar = true,
  includeTasks = true,
  includeWorkload = true,
  referenceNow = new Date(),
}: {
  title?: string;
  clubName: string;
  districtCode: string;
  rotaryYear: string;
  presenterName: string;
  months: ExportMonthTarget[];
  activities: ActivitySummaryDTO[];
  tasks: GroupTaskDTO[];
  includeCalendar?: boolean;
  includeTasks?: boolean;
  includeWorkload?: boolean;
  referenceNow?: Date;
}): PresentationDeckDTO {
  const sortedActivities = [...activities].sort((a, b) =>
    a.startAt.localeCompare(b.startAt),
  );
  const includedActivityIds = new Set(sortedActivities.map((a) => a.id));

  // Build calendar months structure for selected timeframe
  const calendarMonths: DeckCalendarMonth[] = [];
  let plottedSessionsCount = 0;

  for (const target of months) {
    const prefix = `${target.year}-${String(target.month + 1).padStart(2, "0")}`;
    const entriesByDate: Record<string, DeckCalendarEntry[]> = {};

    const pushEntry = (dateKey: string, entry: DeckCalendarEntry) => {
      if (!entriesByDate[dateKey]) entriesByDate[dateKey] = [];
      entriesByDate[dateKey].push(entry);
    };

    for (const activity of sortedActivities) {
      const recurring = isRecurringSchedule(activity.recurrence);
      for (const occ of expandActivityOccurrences(activity)) {
        if (!occ.dateKey.startsWith(prefix)) continue;
        plottedSessionsCount += 1;
        pushEntry(occ.dateKey, {
          kind: "activity",
          title: activity.title,
          timeLabel: activity.allDay
            ? "All Day"
            : formatManila(occ.startAt, "h:mm a"),
          tag: ACTIVITY_KIND_META[activity.kind]?.label || activity.kind,
          priority: activity.priority,
          sessionLabel: recurring
            ? `S${occ.index}/${occ.total}`
            : undefined,
        });
      }
    }

    if (includeTasks) {
      for (const task of tasks) {
        if (task.status === "COMPLETED") continue;
        const dueKey = task.dueDate?.slice(0, 10) || "";
        if (!dueKey.startsWith(prefix)) continue;
        pushEntry(dueKey, {
          kind: "task",
          title: task.title,
          tag: task.assignedMemberNames[0] || "Unassigned",
          priority: task.priority,
        });
      }
    }

    if (includeCalendar) {
      calendarMonths.push({
        year: target.year,
        month: target.month,
        label: formatMonthLabel(target.year, target.month),
        entriesByDate,
      });
    }
  }

  // Group tasks linked to selected activities OR open deliverables
  const relevantTasks = includeTasks
    ? tasks.filter(
        (t) =>
          (t.projectId && includedActivityIds.has(t.projectId)) ||
          t.status !== "COMPLETED",
      )
    : [];

  let totalSubtasks = 0;
  let completedSubtasks = 0;
  for (const t of relevantTasks) {
    totalSubtasks += t.checklist.length;
    completedSubtasks += t.checklist.filter((c) => c.completed).length;
  }

  const openTasks = relevantTasks.filter((t) => t.status !== "COMPLETED").length;
  const completedTasks = relevantTasks.filter(
    (t) => t.status === "COMPLETED",
  ).length;
  const urgentCount =
    sortedActivities.filter((a) => a.priority === "URGENT").length +
    relevantTasks.filter(
      (t) => t.priority === "URGENT" && t.status !== "COMPLETED",
    ).length;

  // Build Project Spotlights with tasks & subtasks
  const projects: DeckProject[] = sortedActivities.map((act) => {
    const nextOcc = getNextActivityOccurrence(act, referenceNow);
    const displayStart = nextOcc?.startAt ?? act.startAt;
    const displayEnd = nextOcc?.endAt ?? act.endAt;
    const recurrenceSummary = formatRecurrenceSummary(
      act.recurrence,
      act.startAt,
      act.endAt,
    );
    const scheduleLabel = act.allDay
      ? formatManila(displayStart, "EEE, MMM d, yyyy")
      : `${formatManila(displayStart, "EEE, MMM d")} · ${formatManila(
          displayStart,
          "h:mm a",
        )} – ${formatManila(displayEnd, "h:mm a")}`;

    const linkedTasks = includeTasks
      ? tasks
          .filter((t) => t.projectId === act.id)
          .sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"))
          .map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            priority: t.priority,
            dueDate: t.dueDate || "No deadline",
            assignees:
              t.assignedMemberNames.length > 0
                ? t.assignedMemberNames
                : ["Unassigned"],
            checklist: t.checklist.map((item) => ({
              title: item.title,
              completed: Boolean(item.completed),
              ...(item.assignedMemberName
                ? { assignedMemberName: item.assignedMemberName }
                : {}),
            })),
          }))
      : [];

    const openProjectTasks = linkedTasks.filter(
      (t) => t.status !== "COMPLETED",
    ).length;
    const descBase = stripNonPrintableAndEmoji(act.shortDescription || "");
    const talkingPoint = [
      descBase || `${ACTIVITY_KIND_META[act.kind]?.label || act.kind} led by ${act.ownerName || "assigned committee"}.`,
      recurrenceSummary
        ? `Schedule spans ${recurrenceSummary}.`
        : null,
      openProjectTasks > 0
        ? `${openProjectTasks} open task${openProjectTasks === 1 ? "" : "s"} currently tracked for completion.`
        : null,
    ]
      .filter(Boolean)
      .join(" ");

    return {
      id: act.id,
      title: act.title,
      kindLabel: ACTIVITY_KIND_META[act.kind]?.label || act.kind,
      statusLabel: formatActivityStatusLabel(act.status),
      priority: act.priority,
      scheduleLabel,
      ...(recurrenceSummary ? { recurrenceLabel: recurrenceSummary } : {}),
      location: act.location || "Venue TBA",
      chairName: act.ownerName || "Unassigned Chair",
      committeeLabel: formatCommitteeLabel(act.committee),
      rsvpGoing: act.rsvp.going,
      minMembersRequired: act.minMembersRequired,
      shortDescription: descBase,
      talkingPoint,
      tasks: linkedTasks,
    };
  });

  // Member workload aggregation
  const memberWorkloads: DeckMemberWorkload[] = [];
  if (includeWorkload) {
    const workloadMap = new Map<string, DeckMemberWorkload>();
    const projectTitleById = new Map(sortedActivities.map((a) => [a.id, a.title]));

    for (const task of relevantTasks) {
      const assignees =
        task.assignedMemberNames.length > 0
          ? task.assignedMemberNames
          : ["Unassigned"];
      const pendingSubtasks = task.checklist
        .filter((c) => !c.completed)
        .map((c) =>
          c.assignedMemberName
            ? `${c.title} (${c.assignedMemberName})`
            : c.title,
        );

      for (const name of assignees) {
        const entry = workloadMap.get(name) ?? {
          memberName: name,
          openTasks: 0,
          completedTasks: 0,
          urgentTasks: 0,
          items: [],
        };
        if (task.status === "COMPLETED") {
          entry.completedTasks += 1;
        } else {
          entry.openTasks += 1;
          if (task.priority === "URGENT" || task.priority === "HIGH") {
            entry.urgentTasks += 1;
          }
          entry.items.push({
            taskTitle: task.title,
            projectTitle:
              task.projectTitle ||
              (task.projectId ? projectTitleById.get(task.projectId) : undefined),
            dueDate: task.dueDate || "No deadline",
            priority: task.priority,
            status: task.status,
            pendingSubtasks,
          });
        }
        workloadMap.set(name, entry);
      }
    }

    memberWorkloads.push(
      ...Array.from(workloadMap.values())
        .filter((m) => m.openTasks > 0 || m.completedTasks > 0)
        .sort(
          (a, b) =>
            b.openTasks - a.openTasks ||
            b.urgentTasks - a.urgentTasks ||
            a.memberName.localeCompare(b.memberName),
        ),
    );
  }

  // Deterministic attention callouts & highlights
  const attentionItems: string[] = [];
  for (const act of sortedActivities) {
    const daysAway = daysBetween(referenceNow, new Date(act.startAt));
    if (act.status === "DRAFT" && daysAway >= -1 && daysAway <= 14) {
      attentionItems.push(
        `Publish draft "${act.title}" (${formatManila(act.startAt, "MMM d")}) so members can RSVP and see tasks.`,
      );
    } else if (
      act.minMembersRequired &&
      act.rsvp.going < act.minMembersRequired &&
      daysAway >= 0 &&
      daysAway <= 14
    ) {
      attentionItems.push(
        `Quorum needed for "${act.title}": ${act.rsvp.going}/${act.minMembersRequired} confirmed going.`,
      );
    }
  }
  const urgentOpenTasks = relevantTasks.filter(
    (t) =>
      t.status !== "COMPLETED" &&
      (t.priority === "URGENT" || t.priority === "HIGH"),
  );
  for (const task of urgentOpenTasks.slice(0, 4)) {
    const owner = task.assignedMemberNames[0] || "Unassigned";
    attentionItems.push(
      `[${task.priority}] ${task.title} — ${owner} (Due ${task.dueDate || "TBA"}).`,
    );
  }

  const periodLabel =
    months.length === 1
      ? formatMonthLabel(months[0].year, months[0].month)
      : `${formatMonthLabel(months[0].year, months[0].month)} – ${formatMonthLabel(
          months[months.length - 1].year,
          months[months.length - 1].month,
        )}`;

  const recurringProjectsCount = sortedActivities.filter((a) =>
    isRecurringSchedule(a.recurrence),
  ).length;

  const executiveSummary =
    sortedActivities.length === 0
      ? `No scheduled projects or events were matched for ${periodLabel}, with ${openTasks} open club tasks currently tracked.`
      : `${clubName} has ${sortedActivities.length} project${
          sortedActivities.length === 1 ? "" : "s"
        } & activit${sortedActivities.length === 1 ? "y" : "ies"} across ${
          plottedSessionsCount || sortedActivities.length
        } calendar session${
          (plottedSessionsCount || sortedActivities.length) === 1 ? "" : "s"
        } during ${periodLabel}, supported by ${openTasks} active member task${
          openTasks === 1 ? "" : "s"
        } and ${totalSubtasks - completedSubtasks} pending subtask checklist item${
          totalSubtasks - completedSubtasks === 1 ? "" : "s"
        }.`;

  const highlights: string[] = [
    `${sortedActivities.length} scheduled projects & club activities (${recurringProjectsCount} recurring / multi-session).`,
    `${plottedSessionsCount || sortedActivities.length} plotted calendar sessions during ${periodLabel}.`,
    `${completedTasks} of ${openTasks + completedTasks} tracked tasks completed (${completedSubtasks}/${totalSubtasks} subtasks done).`,
  ];
  if (memberWorkloads.length > 0) {
    highlights.push(
      `${memberWorkloads.filter((m) => m.memberName !== "Unassigned").length} club members actively holding assigned deliverables.`,
    );
  }

  const nextSteps: string[] = [
    attentionItems.length > 0
      ? "Resolve urgent tasks, pending drafts, and RSVP quorums listed in Needs Attention."
      : "Confirm venue readiness and volunteer attendance reminders for upcoming sessions.",
    "Share the exported Excel calendar and PDF summary deck with the club GC ahead of execution.",
    "Update completed tasks and subtasks on Racspeed after each session for accomplishment reporting.",
  ];

  const ryLabel =
    rotaryYear && rotaryYear !== "ALL" ? `RY ${rotaryYear}` : "Rotary Operations";

  return {
    title: title?.trim() || `${clubName} — Project Roadmap & Action Plan`,
    subtitle: `${periodLabel} · ${ryLabel} · District ${districtCode}`,
    clubName,
    districtCode,
    rotaryYear,
    presenterName,
    generatedAtLabel: formatManila(referenceNow, "MMM d, yyyy h:mm a") + " (PHT)",
    aiEnhanced: false,
    kpis: {
      totalActivities: sortedActivities.length,
      totalSessions: plottedSessionsCount || sortedActivities.length,
      openTasks,
      completedTasks,
      totalSubtasks,
      completedSubtasks,
      urgentCount,
    },
    executiveSummary,
    highlights,
    attentionItems: attentionItems.slice(0, 6),
    calendarMonths,
    projects,
    memberWorkloads,
    nextSteps,
  };
}

const geminiNarrativeSchema = z.object({
  executiveSummary: z.string().trim().min(10).max(700),
  highlights: z.array(z.string().trim().min(4).max(200)).min(2).max(5),
  attentionItems: z.array(z.string().trim().min(4).max(220)).max(6).default([]),
  projectTalkingPoints: z.record(z.string(), z.string().trim().max(320)).default({}),
  nextSteps: z.array(z.string().trim().min(4).max(220)).min(2).max(5),
});

export async function enrichDeckWithGemini(
  deck: PresentationDeckDTO,
  options?: {
    fetchImpl?: typeof fetch;
    apiKeyOverride?: string;
    modelOverride?: string;
  },
): Promise<PresentationDeckDTO> {
  const apiKey = (
    options?.apiKeyOverride ??
    env.GEMINI_API_KEY ??
    process.env.GOOGLE_GENAI_API_KEY ??
    ""
  ).trim();

  if (!apiKey) {
    return deck;
  }

  const fetchImpl = options?.fetchImpl ?? fetch;
  const model = (
    options?.modelOverride ??
    env.GEMINI_MODEL ??
    "gemini-2.5-flash"
  ).trim();
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent`;

  const compactContext = {
    clubName: deck.clubName,
    subtitle: deck.subtitle,
    kpis: deck.kpis,
    existingAttentionItems: deck.attentionItems,
    projects: deck.projects.slice(0, 12).map((p) => ({
      id: p.id,
      title: p.title,
      kind: p.kindLabel,
      status: p.statusLabel,
      priority: p.priority,
      schedule: p.scheduleLabel,
      recurrence: p.recurrenceLabel,
      location: p.location,
      chair: p.chairName,
      rsvpGoing: p.rsvpGoing,
      minMembersRequired: p.minMembersRequired,
      summary: p.shortDescription,
      openTasks: p.tasks
        .filter((t) => t.status !== "COMPLETED")
        .map((t) => ({
          title: t.title,
          dueDate: t.dueDate,
          assignees: t.assignees,
          pendingSubtasks: t.checklist
            .filter((c) => !c.completed)
            .map((c) => c.title),
        })),
    })),
    memberWorkloads: deck.memberWorkloads.slice(0, 10).map((m) => ({
      memberName: m.memberName,
      openTasks: m.openTasks,
      urgentTasks: m.urgentTasks,
    })),
  };

  const prompt = `You are a Rotaract Club executive briefing writer preparing a concise, board-ready presentation deck from live club database records.

Rules:
1. Rely ONLY on the factual JSON provided below. Never invent dates, locations, names, headcounts, or project titles.
2. Keep copy crisp and slide-ready (no markdown, no emojis).
3. Return valid JSON matching this exact shape:
{
  "executiveSummary": "2-3 sentences summarizing upcoming club focus, calendar density, and team execution readiness.",
  "highlights": ["3 to 4 crisp bullet points"],
  "attentionItems": ["Up to 5 urgent risks, drafts to publish, or overdue deliverables (keep empty array if none)"],
  "projectTalkingPoints": { "<project_id>": "1-2 sentence presenter note highlighting objective, readiness, and key tasks" },
  "nextSteps": ["3 concrete immediate actions for officers and members"]
}

Club Snapshot JSON:
${JSON.stringify(compactContext)}`;

  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.25,
          responseMimeType: "application/json",
        },
      }),
      signal: AbortSignal.timeout(25_000),
    });

    if (!response.ok) {
      return deck;
    }

    const payload = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const rawText =
      payload.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("") || "";
    if (!rawText.trim()) return deck;

    const fenced = rawText.trim().match(/```(?:json)?\s*([\s\S]*?)```/i);
    const parsedJson = JSON.parse(fenced ? fenced[1].trim() : rawText.trim());
    const validated = geminiNarrativeSchema.safeParse(parsedJson);
    if (!validated.success) {
      return deck;
    }

    const ai = validated.data;
    return {
      ...deck,
      aiEnhanced: true,
      executiveSummary: stripNonPrintableAndEmoji(ai.executiveSummary),
      highlights: ai.highlights.map(stripNonPrintableAndEmoji),
      attentionItems:
        ai.attentionItems.length > 0
          ? ai.attentionItems.map(stripNonPrintableAndEmoji)
          : deck.attentionItems,
      projects: deck.projects.map((p) => {
        const aiPoint = ai.projectTalkingPoints[p.id];
        return aiPoint
          ? { ...p, talkingPoint: stripNonPrintableAndEmoji(aiPoint) }
          : p;
      }),
      nextSteps: ai.nextSteps.map(stripNonPrintableAndEmoji),
    };
  } catch {
    return deck;
  }
}

