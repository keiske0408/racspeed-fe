import type { ExportMonthTarget } from "@/features/activities/export-types";

export function buildMonthsFromStart(
  startYear: number,
  startMonth: number,
  count: number,
): ExportMonthTarget[] {
  const safeCount = Math.max(1, Math.min(6, Math.round(count)));
  return Array.from({ length: safeCount }, (_, offset) => {
    const totalMonths = startYear * 12 + startMonth + offset;
    return {
      year: Math.floor(totalMonths / 12),
      month: ((totalMonths % 12) + 12) % 12,
    };
  });
}

export function getCalendarFileSlug(months: ExportMonthTarget[]): string {
  if (months.length === 0) return "calendar";
  const first = months[0];
  const ym = `${first.year}-${String(first.month + 1).padStart(2, "0")}`;
  return months.length === 1
    ? `racspeed-calendar-${ym}`
    : `racspeed-calendar-${ym}-${months.length}m`;
}

