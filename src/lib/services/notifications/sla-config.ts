import { z } from "zod";

export interface NotificationSlaConfig {
  taskDueSoonHours: number;
  taskOverdueReminderEnabled: boolean;
  projectNearbyHours: number;
  projectDeadlineHours: number;
  draftReadinessDays: number;
  reportDueSlaDays: number;
  notifyOnTaskAssigned: boolean;
  notifyOnTaskMarked: boolean;
}

export const DEFAULT_NOTIFICATION_SLA_CONFIG: NotificationSlaConfig = {
  taskDueSoonHours: 48,
  taskOverdueReminderEnabled: true,
  projectNearbyHours: 48,
  projectDeadlineHours: 24,
  draftReadinessDays: 7,
  reportDueSlaDays: 7,
  notifyOnTaskAssigned: true,
  notifyOnTaskMarked: true,
};

export const notificationSlaSchema = z.object({
  taskDueSoonHours: z.coerce.number().int().min(1).max(336).default(48),
  taskOverdueReminderEnabled: z.boolean().default(true),
  projectNearbyHours: z.coerce.number().int().min(1).max(336).default(48),
  projectDeadlineHours: z.coerce.number().int().min(1).max(336).default(24),
  draftReadinessDays: z.coerce.number().int().min(1).max(30).default(7),
  reportDueSlaDays: z.coerce.number().int().min(1).max(60).default(7),
  notifyOnTaskAssigned: z.boolean().default(true),
  notifyOnTaskMarked: z.boolean().default(true),
});

function clampInt(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.round(num)));
}

function coerceBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

export function normalizeNotificationSlaConfig(
  raw: unknown,
): NotificationSlaConfig {
  const source =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    taskDueSoonHours: clampInt(
      source.taskDueSoonHours,
      1,
      336,
      DEFAULT_NOTIFICATION_SLA_CONFIG.taskDueSoonHours,
    ),
    taskOverdueReminderEnabled: coerceBool(
      source.taskOverdueReminderEnabled,
      DEFAULT_NOTIFICATION_SLA_CONFIG.taskOverdueReminderEnabled,
    ),
    projectNearbyHours: clampInt(
      source.projectNearbyHours,
      1,
      336,
      DEFAULT_NOTIFICATION_SLA_CONFIG.projectNearbyHours,
    ),
    projectDeadlineHours: clampInt(
      source.projectDeadlineHours,
      1,
      336,
      DEFAULT_NOTIFICATION_SLA_CONFIG.projectDeadlineHours,
    ),
    draftReadinessDays: clampInt(
      source.draftReadinessDays,
      1,
      30,
      DEFAULT_NOTIFICATION_SLA_CONFIG.draftReadinessDays,
    ),
    reportDueSlaDays: clampInt(
      source.reportDueSlaDays,
      1,
      60,
      DEFAULT_NOTIFICATION_SLA_CONFIG.reportDueSlaDays,
    ),
    notifyOnTaskAssigned: coerceBool(
      source.notifyOnTaskAssigned,
      DEFAULT_NOTIFICATION_SLA_CONFIG.notifyOnTaskAssigned,
    ),
    notifyOnTaskMarked: coerceBool(
      source.notifyOnTaskMarked,
      DEFAULT_NOTIFICATION_SLA_CONFIG.notifyOnTaskMarked,
    ),
  };
}

