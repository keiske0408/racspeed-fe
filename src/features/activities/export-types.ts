import { z } from "zod";

export const exportMonthSchema = z.object({
  year: z.number().int().min(2020).max(2040),
  month: z.number().int().min(0).max(11),
});

export type ExportMonthTarget = z.infer<typeof exportMonthSchema>;

export const calendarExportRequestSchema = z.object({
  months: z.array(exportMonthSchema).min(1).max(6),
  rotaryYear: z.string().trim().max(32).optional(),
  includeTasks: z.boolean().default(true),
  includeDrafts: z.boolean().default(false),
  kindFilter: z.string().trim().max(40).optional(),
});

export type CalendarExportRequest = z.infer<typeof calendarExportRequestSchema>;

export const presentationGenerateRequestSchema = z.object({
  title: z.string().trim().max(160).optional(),
  months: z.array(exportMonthSchema).min(1).max(6),
  rotaryYear: z.string().trim().max(32).optional(),
  activityIds: z.array(z.string().trim().min(1)).max(100).optional(),
  includeDrafts: z.boolean().default(false),
  includeCalendar: z.boolean().default(true),
  includeTasks: z.boolean().default(true),
  includeWorkload: z.boolean().default(true),
  useAi: z.boolean().default(true),
});

export type PresentationGenerateRequest = z.infer<
  typeof presentationGenerateRequestSchema
>;

export const deckCalendarEntrySchema = z.object({
  kind: z.enum(["activity", "task"]),
  title: z.string(),
  timeLabel: z.string().optional(),
  tag: z.string().optional(),
  priority: z.string().optional(),
  sessionLabel: z.string().optional(),
});

export const deckCalendarMonthSchema = z.object({
  year: z.number().int().min(2020).max(2040),
  month: z.number().int().min(0).max(11),
  label: z.string(),
  entriesByDate: z.record(z.string(), z.array(deckCalendarEntrySchema)),
});

export const deckProjectSubtaskSchema = z.object({
  title: z.string(),
  completed: z.boolean(),
  assignedMemberName: z.string().optional(),
});

export const deckProjectTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  priority: z.string(),
  dueDate: z.string(),
  assignees: z.array(z.string()),
  checklist: z.array(deckProjectSubtaskSchema),
});

export const deckProjectSchema = z.object({
  id: z.string(),
  title: z.string(),
  kindLabel: z.string(),
  statusLabel: z.string(),
  priority: z.string(),
  scheduleLabel: z.string(),
  recurrenceLabel: z.string().optional(),
  location: z.string(),
  chairName: z.string(),
  committeeLabel: z.string(),
  rsvpGoing: z.number().int().min(0),
  minMembersRequired: z.number().int().nullable().optional(),
  shortDescription: z.string(),
  talkingPoint: z.string(),
  tasks: z.array(deckProjectTaskSchema),
});

export const deckMemberWorkloadItemSchema = z.object({
  taskTitle: z.string(),
  projectTitle: z.string().optional(),
  dueDate: z.string(),
  priority: z.string(),
  status: z.string(),
  pendingSubtasks: z.array(z.string()),
});

export const deckMemberWorkloadSchema = z.object({
  memberName: z.string(),
  openTasks: z.number().int().min(0),
  completedTasks: z.number().int().min(0),
  urgentTasks: z.number().int().min(0),
  items: z.array(deckMemberWorkloadItemSchema),
});

export const presentationDeckSchema = z.object({
  title: z.string().trim().min(1).max(160),
  subtitle: z.string().trim().max(240),
  clubName: z.string().trim().min(1).max(160),
  districtCode: z.string().trim().max(32),
  rotaryYear: z.string().trim().max(32),
  presenterName: z.string().trim().max(120),
  generatedAtLabel: z.string().trim().max(120),
  aiEnhanced: z.boolean(),
  kpis: z.object({
    totalActivities: z.number().int().min(0),
    totalSessions: z.number().int().min(0),
    openTasks: z.number().int().min(0),
    completedTasks: z.number().int().min(0),
    totalSubtasks: z.number().int().min(0),
    completedSubtasks: z.number().int().min(0),
    urgentCount: z.number().int().min(0),
  }),
  executiveSummary: z.string(),
  highlights: z.array(z.string()),
  attentionItems: z.array(z.string()),
  calendarMonths: z.array(deckCalendarMonthSchema),
  projects: z.array(deckProjectSchema),
  memberWorkloads: z.array(deckMemberWorkloadSchema),
  nextSteps: z.array(z.string()),
});

export type DeckCalendarEntry = z.infer<typeof deckCalendarEntrySchema>;
export type DeckCalendarMonth = z.infer<typeof deckCalendarMonthSchema>;
export type DeckProjectTask = z.infer<typeof deckProjectTaskSchema>;
export type DeckProject = z.infer<typeof deckProjectSchema>;
export type DeckMemberWorkload = z.infer<typeof deckMemberWorkloadSchema>;
export type PresentationDeckDTO = z.infer<typeof presentationDeckSchema>;

const ACTIVITY_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PLANNED: "Planned",
  ONGOING: "Ongoing",
  AWAITING_REPORT: "Report Due",
  ACCOMPLISHED: "Accomplished",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export function formatActivityStatusLabel(status: string): string {
  return (
    ACTIVITY_STATUS_LABELS[status] ||
    status
      .split("_")
      .map((s) => s.charAt(0) + s.slice(1).toLowerCase())
      .join(" ")
  );
}

