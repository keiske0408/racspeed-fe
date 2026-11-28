"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Plus, Repeat, X } from "lucide-react";
import type {
  ActivityRecurrence,
  RecurrenceFrequency,
} from "@/features/activities/types";
import {
  MAX_RECURRENCE_OCCURRENCES,
  addDaysYmd,
  expandActivityOccurrences,
  formatRecurrenceSummary,
  normalizeRecurrence,
} from "@/features/activities/recurrence";
import { manilaLocalToISO } from "@/lib/utils/dates";
import { CLUB_TIMEZONE } from "@/lib/utils/rotary-year";

export interface RecurrenceEditorProps {
  recurrence: ActivityRecurrence | null;
  onChange: (next: ActivityRecurrence | null) => void;
  startAt: string;
  endAt: string;
  allDay?: boolean;
}

const MODE_OPTIONS: {
  value: RecurrenceFrequency;
  label: string;
  description: string;
}[] = [
  { value: "NONE", label: "Single Event", description: "One-time schedule" },
  { value: "WEEKLY", label: "Weekly", description: "Same weekday each week" },
  {
    value: "BIWEEKLY",
    label: "Every 2 Weeks",
    description: "Alternate weeks",
  },
  { value: "MONTHLY", label: "Monthly", description: "Same day each month" },
  {
    value: "CUSTOM_DATES",
    label: "Specific Dates",
    description: "Pick exact dates (e.g. Nov 28 & Dec 20)",
  },
];

function formatSessionPill(ymd: string): string {
  const date = new Date(`${ymd}T12:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return ymd;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: CLUB_TIMEZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function RecurrenceEditor({
  recurrence,
  onChange,
  startAt,
  endAt,
  allDay = false,
}: RecurrenceEditorProps) {
  const activeFrequency: RecurrenceFrequency =
    recurrence?.frequency ?? "NONE";
  const startDate = /^\d{4}-\d{2}-\d{2}/.test(startAt)
    ? startAt.slice(0, 10)
    : "";
  const endDate = /^\d{4}-\d{2}-\d{2}/.test(endAt) ? endAt.slice(0, 10) : "";
  const defaultSessionEndTime =
    endAt.length >= 16 && /^\d{2}:\d{2}/.test(endAt.slice(11, 16))
      ? endAt.slice(11, 16)
      : "17:00";

  const [newDateInput, setNewDateInput] = useState("");

  const sessionEndTime =
    recurrence?.sessionEndTime && /^\d{2}:\d{2}$/.test(recurrence.sessionEndTime)
      ? recurrence.sessionEndTime
      : defaultSessionEndTime;

  const handleFrequencySelect = (nextFreq: RecurrenceFrequency) => {
    if (nextFreq === "NONE") {
      onChange(null);
      return;
    }

    if (nextFreq === "CUSTOM_DATES") {
      const seededDates = Array.from(
        new Set([startDate, endDate].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))),
      ).sort();
      onChange(
        normalizeRecurrence({
          frequency: "CUSTOM_DATES",
          dates:
            recurrence?.frequency === "CUSTOM_DATES" &&
            (recurrence.dates?.length ?? 0) > 0
              ? recurrence.dates
              : seededDates,
          sessionEndTime,
        }),
      );
      return;
    }

    const defaultOffset = nextFreq === "MONTHLY" ? 90 : 28;
    const baseUntil =
      endDate && startDate && endDate > startDate
        ? endDate
        : startDate
          ? addDaysYmd(startDate, defaultOffset)
          : "";

    onChange(
      normalizeRecurrence({
        frequency: nextFreq,
        until: recurrence?.until || baseUntil || null,
        sessionEndTime,
      }),
    );
  };

  const handleAddCustomDate = () => {
    const candidate = newDateInput.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return;
    const currentDates = recurrence?.dates ?? (startDate ? [startDate] : []);
    const next = normalizeRecurrence({
      frequency: "CUSTOM_DATES",
      dates: [...currentDates, candidate],
      sessionEndTime,
    });
    onChange(next);
    setNewDateInput("");
  };

  const handleRemoveCustomDate = (targetDate: string) => {
    const currentDates = recurrence?.dates ?? [];
    if (currentDates.length <= 1) return;
    onChange(
      normalizeRecurrence({
        frequency: "CUSTOM_DATES",
        dates: currentDates.filter((d) => d !== targetDate),
        sessionEndTime,
      }),
    );
  };

  const previewOccurrences = useMemo(() => {
    if (!recurrence || recurrence.frequency === "NONE") return [];
    const startIso = manilaLocalToISO(startAt);
    const endIso = manilaLocalToISO(endAt || startAt);
    if (!startIso || !endIso) return [];
    return expandActivityOccurrences({
      startAt: startIso,
      endAt: endIso,
      allDay,
      recurrence,
    });
  }, [allDay, endAt, recurrence, startAt]);

  const summaryText = useMemo(() => {
    if (!recurrence || recurrence.frequency === "NONE") return null;
    const startIso = manilaLocalToISO(startAt);
    const endIso = manilaLocalToISO(endAt || startAt);
    return formatRecurrenceSummary(
      recurrence,
      startIso || undefined,
      endIso || undefined,
    );
  }, [endAt, recurrence, startAt]);

  return (
    <div className="space-y-3 rounded-xl border border-[#EDEDF2] bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Repeat className="h-3.5 w-3.5 text-[#0D3594] dark:text-blue-400" />
          <span className="text-xs font-bold text-[#111625] dark:text-white">
            Repeat / Multi-Session Schedule
          </span>
        </div>
        {summaryText && (
          <span className="rounded-full bg-[#0D3594]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#0D3594] dark:bg-blue-500/15 dark:text-blue-300">
            {summaryText}
          </span>
        )}
      </div>

      <div
        role="radiogroup"
        aria-label="Schedule recurrence frequency"
        className="flex flex-wrap gap-1.5"
      >
        {MODE_OPTIONS.map((opt) => {
          const active = activeFrequency === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => handleFrequencySelect(opt.value)}
              title={opt.description}
              className={`cursor-pointer rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                active
                  ? "border-[#0D3594] bg-[#0D3594] text-white shadow-2xs dark:border-blue-500 dark:bg-blue-600"
                  : "border-[#DDE1EA] bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {activeFrequency !== "NONE" && (
        <div className="space-y-3 border-t border-slate-200/80 pt-3 dark:border-slate-800">
          {activeFrequency === "CUSTOM_DATES" ? (
            <div className="space-y-2.5">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Add another session date
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={newDateInput}
                      onChange={(e) => setNewDateInput(e.target.value)}
                      className="w-full rounded-lg border border-[#DDE1EA] bg-white px-2.5 py-1.5 text-xs text-[#111625] outline-none focus:border-[#0D3594] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomDate}
                      disabled={
                        !newDateInput ||
                        (recurrence?.dates?.length ?? 0) >=
                          MAX_RECURRENCE_OCCURRENCES
                      }
                      className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-[#DDE1EA] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#0D3594] transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-blue-300"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add
                    </button>
                  </div>
                </div>

                {!allDay && (
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      Each session ends at
                    </label>
                    <input
                      type="time"
                      value={sessionEndTime}
                      onChange={(e) =>
                        onChange(
                          normalizeRecurrence({
                            frequency: "CUSTOM_DATES",
                            dates: recurrence?.dates ?? [],
                            sessionEndTime: e.target.value,
                          }),
                        )
                      }
                      className="w-full rounded-lg border border-[#DDE1EA] bg-white px-2.5 py-1.5 text-xs text-[#111625] outline-none focus:border-[#0D3594] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />
                  </div>
                )}
              </div>

              {(recurrence?.dates?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {(recurrence?.dates ?? []).map((dateKey) => {
                    const canRemove = (recurrence?.dates?.length ?? 0) > 1;
                    return (
                      <span
                        key={dateKey}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-[#111625] dark:border-blue-500/30 dark:bg-slate-800 dark:text-slate-100"
                      >
                        <CalendarDays className="h-3 w-3 text-[#0D3594] dark:text-blue-400" />
                        {formatSessionPill(dateKey)}
                        {canRemove && (
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomDate(dateKey)}
                            aria-label={`Remove session ${dateKey}`}
                            className="ml-0.5 cursor-pointer rounded p-0.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Repeat until (inclusive)
                </label>
                <input
                  type="date"
                  min={startDate || undefined}
                  value={recurrence?.until ?? ""}
                  onChange={(e) =>
                    onChange(
                      normalizeRecurrence({
                        frequency: activeFrequency,
                        until: e.target.value || null,
                        sessionEndTime,
                      }),
                    )
                  }
                  className="w-full rounded-lg border border-[#DDE1EA] bg-white px-2.5 py-1.5 text-xs text-[#111625] outline-none focus:border-[#0D3594] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>

              {!allDay && (
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Each session ends at
                  </label>
                  <input
                    type="time"
                    value={sessionEndTime}
                    onChange={(e) =>
                      onChange(
                        normalizeRecurrence({
                          frequency: activeFrequency,
                          until: recurrence?.until ?? null,
                          sessionEndTime: e.target.value,
                        }),
                      )
                    }
                    className="w-full rounded-lg border border-[#DDE1EA] bg-white px-2.5 py-1.5 text-xs text-[#111625] outline-none focus:border-[#0D3594] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                </div>
              )}
            </div>
          )}

          {previewOccurrences.length > 0 && (
            <div className="rounded-lg border border-blue-100 bg-blue-50/70 px-3 py-2 text-[11px] text-blue-950 dark:border-blue-500/20 dark:bg-blue-950/25 dark:text-blue-100">
              <p className="font-semibold">
                Calendar will plot {previewOccurrences.length} session
                {previewOccurrences.length === 1 ? "" : "s"} under one project
                workspace
                {previewOccurrences.length >= MAX_RECURRENCE_OCCURRENCES
                  ? ` (capped at ${MAX_RECURRENCE_OCCURRENCES})`
                  : ""}
                :
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {previewOccurrences.slice(0, 8).map((occ) => (
                  <span
                    key={occ.dateKey}
                    className="rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-[#0D3594] ring-1 ring-blue-200 dark:bg-slate-900/80 dark:text-blue-300 dark:ring-blue-500/30"
                  >
                    #{occ.index} · {formatSessionPill(occ.dateKey)}
                  </span>
                ))}
                {previewOccurrences.length > 8 && (
                  <span className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                    +{previewOccurrences.length - 8} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

