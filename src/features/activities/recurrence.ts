import type {
  ActivityRecurrence,
  RecurrenceFrequency,
} from "@/features/activities/types";
import {
  isoToManilaLocal,
  manilaDateKey,
  manilaLocalToISO,
} from "@/lib/utils/dates";
import { CLUB_TIMEZONE } from "@/lib/utils/rotary-year";

export const MAX_RECURRENCE_OCCURRENCES = 52;
const MAX_SINGLE_SPAN_DAYS = 14;
const DAY_MS = 86_400_000;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_HM_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface ActivityOccurrence {
  dateKey: string;
  startAt: string;
  endAt: string;
  index: number;
  total: number;
}

function parseYmdUtcMs(ymd: string): number {
  return Date.parse(`${ymd}T00:00:00Z`);
}

function formatUtcMsAsYmd(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDaysYmd(ymd: string, days: number): string {
  return formatUtcMsAsYmd(parseYmdUtcMs(ymd) + days * DAY_MS);
}

function addMonthsYmd(
  startYmd: string,
  monthsToAdd: number,
  anchorDay: number,
): string {
  const [yStr, mStr] = startYmd.split("-");
  const baseYear = Number(yStr);
  const baseMonthIndex = Number(mStr) - 1;
  const targetTotalMonths = baseYear * 12 + baseMonthIndex + monthsToAdd;
  const targetYear = Math.floor(targetTotalMonths / 12);
  const targetMonthIndex = ((targetTotalMonths % 12) + 12) % 12;
  const daysInMonth = new Date(
    Date.UTC(targetYear, targetMonthIndex + 1, 0),
  ).getUTCDate();
  const clampedDay = Math.min(anchorDay, daysInMonth);
  return `${targetYear}-${String(targetMonthIndex + 1).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
}

export function isRecurringSchedule(
  recurrence: ActivityRecurrence | null | undefined,
): recurrence is ActivityRecurrence {
  return Boolean(recurrence && recurrence.frequency !== "NONE");
}

/**
 * Clean, deduplicate, and bound an ActivityRecurrence object.
 * Returns null for "NONE" or missing configs so single events stay null in DB.
 */
export function normalizeRecurrence(
  recurrence: ActivityRecurrence | null | undefined,
): ActivityRecurrence | null {
  if (!recurrence || recurrence.frequency === "NONE") {
    return null;
  }

  const frequency: RecurrenceFrequency = recurrence.frequency;
  const sessionEndTime =
    recurrence.sessionEndTime && TIME_HM_PATTERN.test(recurrence.sessionEndTime)
      ? recurrence.sessionEndTime
      : null;

  if (frequency === "CUSTOM_DATES") {
    const cleanDates = Array.from(
      new Set(
        (recurrence.dates ?? [])
          .map((d) => d.trim())
          .filter((d) => DATE_ONLY_PATTERN.test(d)),
      ),
    )
      .sort()
      .slice(0, MAX_RECURRENCE_OCCURRENCES);

    return {
      frequency,
      dates: cleanDates,
      ...(sessionEndTime ? { sessionEndTime } : {}),
    };
  }

  const until =
    recurrence.until && DATE_ONLY_PATTERN.test(recurrence.until.trim())
      ? recurrence.until.trim()
      : null;

  return {
    frequency,
    ...(until ? { until } : {}),
    ...(sessionEndTime ? { sessionEndTime } : {}),
  };
}

function generateRecurringDateKeys(
  startDateKey: string,
  endDateKey: string,
  recurrence: ActivityRecurrence,
): string[] {
  if (recurrence.frequency === "CUSTOM_DATES") {
    const cleaned = Array.from(
      new Set(
        (recurrence.dates ?? [])
          .map((d) => d.trim())
          .filter((d) => DATE_ONLY_PATTERN.test(d)),
      ),
    )
      .sort()
      .slice(0, MAX_RECURRENCE_OCCURRENCES);
    return cleaned.length > 0 ? cleaned : [startDateKey];
  }

  const rawUntil =
    recurrence.until && DATE_ONLY_PATTERN.test(recurrence.until)
      ? recurrence.until
      : endDateKey;
  const untilKey = rawUntil >= startDateKey ? rawUntil : startDateKey;
  const result: string[] = [];

  if (recurrence.frequency === "MONTHLY") {
    const anchorDay = Number(startDateKey.slice(8, 10)) || 1;
    let monthOffset = 0;
    while (result.length < MAX_RECURRENCE_OCCURRENCES) {
      const candidate = addMonthsYmd(startDateKey, monthOffset, anchorDay);
      if (candidate > untilKey) break;
      result.push(candidate);
      monthOffset += 1;
    }
    return result.length > 0 ? result : [startDateKey];
  }

  const stepDays = recurrence.frequency === "BIWEEKLY" ? 14 : 7;
  let cursor = startDateKey;
  while (cursor <= untilKey && result.length < MAX_RECURRENCE_OCCURRENCES) {
    result.push(cursor);
    cursor = addDaysYmd(cursor, stepDays);
  }
  return result.length > 0 ? result : [startDateKey];
}

/**
 * Expand an activity into its Manila-calendar session occurrences.
 * Single events (`recurrence` missing or `NONE`) preserve contiguous multi-day spans (capped at 14 days).
 * Recurring / custom-date events emit exact sessions up to MAX_RECURRENCE_OCCURRENCES.
 */
export function expandActivityOccurrences(activity: {
  startAt: string;
  endAt: string;
  allDay?: boolean;
  recurrence?: ActivityRecurrence | null;
}): ActivityOccurrence[] {
  const startLocal = isoToManilaLocal(activity.startAt);
  const endLocal = isoToManilaLocal(activity.endAt);
  const startDateKey = startLocal
    ? startLocal.slice(0, 10)
    : manilaDateKey(activity.startAt);
  const endDateKey = endLocal
    ? endLocal.slice(0, 10)
    : manilaDateKey(activity.endAt);

  if (!DATE_ONLY_PATTERN.test(startDateKey)) {
    return [];
  }

  const normalized = normalizeRecurrence(activity.recurrence);
  if (!normalized) {
    let cursorMs = parseYmdUtcMs(startDateKey);
    const lastMs = DATE_ONLY_PATTERN.test(endDateKey)
      ? Math.max(cursorMs, parseYmdUtcMs(endDateKey))
      : cursorMs;
    const spanKeys: string[] = [];
    while (cursorMs <= lastMs && spanKeys.length < MAX_SINGLE_SPAN_DAYS) {
      spanKeys.push(formatUtcMsAsYmd(cursorMs));
      cursorMs += DAY_MS;
    }
    return spanKeys.map((dateKey, idx) => ({
      dateKey,
      startAt: activity.startAt,
      endAt: activity.endAt,
      index: idx + 1,
      total: spanKeys.length,
    }));
  }

  const sessionStartTime = activity.allDay
    ? "00:00"
    : startLocal
      ? startLocal.slice(11, 16)
      : "09:00";
  const rawEndTime = activity.allDay
    ? "23:59"
    : (normalized.sessionEndTime ??
      (endLocal ? endLocal.slice(11, 16) : "17:00"));
  const effectiveEndTime =
    rawEndTime >= sessionStartTime ? rawEndTime : "23:59";

  const dateKeys = generateRecurringDateKeys(
    startDateKey,
    DATE_ONLY_PATTERN.test(endDateKey) ? endDateKey : startDateKey,
    normalized,
  );

  return dateKeys.map((dateKey, idx) => ({
    dateKey,
    startAt:
      manilaLocalToISO(`${dateKey}T${sessionStartTime}`) || activity.startAt,
    endAt: manilaLocalToISO(`${dateKey}T${effectiveEndTime}`) || activity.endAt,
    index: idx + 1,
    total: dateKeys.length,
  }));
}

/**
 * Compute overall Manila local bounds (`YYYY-MM-DDTHH:mm`) to persist in `start_at` / `end_at`
 * so the parent activity covers the full series while keeping per-session end times intact.
 */
export function computeSeriesBoundsLocal(input: {
  startAtLocal: string;
  endAtLocal: string;
  recurrence: ActivityRecurrence | null | undefined;
}): {
  startAtLocal: string;
  endAtLocal: string;
  recurrence: ActivityRecurrence | null;
} {
  const normalized = normalizeRecurrence(input.recurrence);
  if (!normalized) {
    return {
      startAtLocal: input.startAtLocal,
      endAtLocal: input.endAtLocal,
      recurrence: null,
    };
  }

  const startDate = input.startAtLocal.slice(0, 10);
  const startTime = input.startAtLocal.slice(11, 16) || "09:00";
  const fallbackEndTime = input.endAtLocal.slice(11, 16) || "17:00";
  const sessionEndTime =
    normalized.sessionEndTime ??
    (fallbackEndTime >= startTime ? fallbackEndTime : "17:00");
  const effectiveEndTime =
    sessionEndTime >= startTime ? sessionEndTime : "23:59";

  const withEndTime: ActivityRecurrence = {
    ...normalized,
    sessionEndTime: effectiveEndTime,
  };

  const sessionDates = generateRecurringDateKeys(
    startDate,
    normalized.until ?? (input.endAtLocal.slice(0, 10) || startDate),
    withEndTime,
  );

  const firstDate = sessionDates[0] ?? startDate;
  const lastDate = sessionDates[sessionDates.length - 1] ?? firstDate;

  return {
    startAtLocal: `${firstDate}T${startTime}`,
    endAtLocal: `${lastDate}T${effectiveEndTime}`,
    recurrence: withEndTime,
  };
}

function formatShortMonthDay(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00+08:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: CLUB_TIMEZONE,
    month: "short",
    day: "numeric",
  }).format(d);
}

/**
 * Human-readable badge label for recurring / multi-session activities.
 */
export function formatRecurrenceSummary(
  recurrence: ActivityRecurrence | null | undefined,
  startAt?: string,
  endAt?: string,
): string | null {
  const normalized = normalizeRecurrence(recurrence);
  if (!normalized) return null;

  const occurrences = startAt
    ? expandActivityOccurrences({
        startAt,
        endAt: endAt ?? startAt,
        recurrence: normalized,
      })
    : [];

  if (normalized.frequency === "CUSTOM_DATES") {
    const dates = normalized.dates ?? [];
    if (dates.length === 0) return "Custom sessions";
    if (dates.length <= 3) {
      const label = dates.map(formatShortMonthDay).join(", ");
      return `${dates.length} sessions · ${label}`;
    }
    return `${dates.length} sessions · ${formatShortMonthDay(dates[0])} – ${formatShortMonthDay(dates[dates.length - 1])}`;
  }

  const countSuffix =
    occurrences.length > 1 ? ` · ${occurrences.length} sessions` : "";

  if (normalized.frequency === "WEEKLY") {
    if (startAt) {
      const weekday = new Intl.DateTimeFormat("en-US", {
        timeZone: CLUB_TIMEZONE,
        weekday: "short",
      }).format(new Date(startAt));
      return `Weekly (${weekday}s)${countSuffix}`;
    }
    return `Weekly${countSuffix}`;
  }

  if (normalized.frequency === "BIWEEKLY") {
    return `Every 2 weeks${countSuffix}`;
  }

  if (normalized.frequency === "MONTHLY") {
    return `Monthly${countSuffix}`;
  }

  return null;
}

/**
 * Find the next session that hasn't ended yet (in Manila/wall clock time).
 */
export function getNextActivityOccurrence(
  activity: {
    startAt: string;
    endAt: string;
    allDay?: boolean;
    recurrence?: ActivityRecurrence | null;
  },
  referenceNow: Date = new Date(),
): ActivityOccurrence | null {
  const occurrences = expandActivityOccurrences(activity);
  const nowMs = referenceNow.getTime();
  for (const occ of occurrences) {
    const endMs = Date.parse(occ.endAt);
    if (!Number.isNaN(endMs) && endMs >= nowMs) {
      return occ;
    }
  }
  return null;
}

