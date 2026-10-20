import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { CLUB_TIMEZONE } from "./rotary-year";

type DateInput = Date | string | number | null | undefined;

function toDate(v: DateInput): Date | null {
  if (v === null || v === undefined || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Format an instant in Asia/Manila. Default: "Oct 20, 2026 9:20 PM". */
export function formatManila(v: DateInput, pattern = "MMM d, yyyy h:mm a"): string {
  const d = toDate(v);
  if (!d) return "—";
  return format(new TZDate(d.getTime(), CLUB_TIMEZONE), pattern);
}

export function formatManilaDate(v: DateInput): string {
  return formatManila(v, "MMM d, yyyy");
}

/** Calendar date (YYYY-MM-DD) of an instant in Asia/Manila. */
export function manilaDateKey(v: DateInput): string {
  return formatManila(v, "yyyy-MM-dd");
}

/**
 * Convert a `datetime-local` input value (wall clock in Asia/Manila, e.g. "2026-10-20T18:00")
 * to an ISO UTC string. Inputs from the browser are interpreted in the club timezone, never
 * in the browser's own timezone.
 */
export function manilaLocalToISO(local: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(local);
  if (!m) throw new Error(`Invalid local datetime: ${local}`);
  const [, y, mo, d, h, mi, s] = m;
  const z = new TZDate(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s ?? 0), CLUB_TIMEZONE);
  return new Date(z.getTime()).toISOString();
}

/** Inverse of manilaLocalToISO for pre-filling datetime-local inputs. */
export function isoToManilaLocal(v: DateInput): string {
  const d = toDate(v);
  if (!d) return "";
  return format(new TZDate(d.getTime(), CLUB_TIMEZONE), "yyyy-MM-dd'T'HH:mm");
}

export function daysBetween(a: Date, b: Date): number {
  const MS = 24 * 60 * 60 * 1000;
  const ka = manilaDateKey(a);
  const kb = manilaDateKey(b);
  return Math.round((Date.parse(`${kb}T00:00:00Z`) - Date.parse(`${ka}T00:00:00Z`)) / MS);
}
