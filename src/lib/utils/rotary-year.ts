import { TZDate } from "@date-fns/tz";

export const CLUB_TIMEZONE = "Asia/Manila";

/** Returns the wall-clock parts of an instant in Asia/Manila. */
function manilaParts(instant: Date): { year: number; month: number } {
  const z = new TZDate(instant.getTime(), CLUB_TIMEZONE);
  return { year: z.getFullYear(), month: z.getMonth() + 1 };
}

/**
 * Rotary year runs 1 July – 30 June. Label format "2026-27".
 * The boundary is evaluated in Asia/Manila time.
 */
export function rotaryYearFor(instant: Date = new Date(), startMonth = 7): string {
  const { year, month } = manilaParts(instant);
  const startYear = month >= startMonth ? year : year - 1;
  const endShort = String((startYear + 1) % 100).padStart(2, "0");
  return `${startYear}-${endShort}`;
}

/** Inclusive start / exclusive end instants (UTC) for a Rotary year label. */
export function rotaryYearRange(label: string, startMonth = 7): { start: Date; end: Date } {
  const m = /^(\d{4})-(\d{2})$/.exec(label);
  if (!m) throw new Error(`Invalid Rotary year label: ${label}`);
  const startYear = Number(m[1]);
  const expectedEnd = String((startYear + 1) % 100).padStart(2, "0");
  if (m[2] !== expectedEnd) throw new Error(`Invalid Rotary year label: ${label}`);
  const start = new TZDate(startYear, startMonth - 1, 1, 0, 0, 0, CLUB_TIMEZONE);
  const end = new TZDate(startYear + 1, startMonth - 1, 1, 0, 0, 0, CLUB_TIMEZONE);
  return { start: new Date(start.getTime()), end: new Date(end.getTime()) };
}
