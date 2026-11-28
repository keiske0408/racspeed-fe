"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckSquare,
  Download,
  FileSpreadsheet,
  Loader2,
  X,
} from "lucide-react";
import { expandActivityOccurrences } from "@/features/activities/recurrence";
import type { ActivitySummaryDTO } from "@/features/activities/types";
import type { GroupTaskDTO } from "@/lib/data/tasks-types";
import { manilaDateKey } from "@/lib/utils/dates";
import { buildMonthsFromStart } from "@/lib/services/exports/calendar-excel-helpers";
import { notifyToast } from "@/components/shared/toast-viewport";

export interface ExportCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  activities: ActivitySummaryDTO[];
  tasks: GroupTaskDTO[];
  rotaryYear: string;
  kindFilter: string;
  canManageClub: boolean;
  initialYear?: number;
  initialMonth?: number;
}

export function ExportCalendarModal({
  isOpen,
  onClose,
  activities,
  tasks,
  rotaryYear,
  kindFilter,
  canManageClub,
  initialYear,
  initialMonth,
}: ExportCalendarModalProps) {
  const defaultYm = useMemo(() => {
    if (
      typeof initialYear === "number" &&
      typeof initialMonth === "number" &&
      initialMonth >= 0 &&
      initialMonth <= 11
    ) {
      return `${initialYear}-${String(initialMonth + 1).padStart(2, "0")}`;
    }
    return manilaDateKey(new Date()).slice(0, 7);
  }, [initialMonth, initialYear]);

  const [monthValue, setMonthValue] = useState(defaultYm);
  const [rangeMonths, setRangeMonths] = useState<1 | 2 | 3>(1);
  const [includeTasks, setIncludeTasks] = useState(true);
  const [includeDrafts, setIncludeDrafts] = useState(canManageClub);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMonthValue(defaultYm);
    }
  }, [defaultYm, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !downloading) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [downloading, isOpen, onClose]);

  const targetMonths = useMemo(() => {
    const [yStr, mStr] = monthValue.split("-");
    const year = Number(yStr) || new Date().getUTCFullYear();
    const monthIdx = Math.max(0, Math.min(11, (Number(mStr) || 1) - 1));
    return buildMonthsFromStart(year, monthIdx, rangeMonths);
  }, [monthValue, rangeMonths]);

  const previewStats = useMemo(() => {
    const prefixes = new Set(
      targetMonths.map(
        (m) => `${m.year}-${String(m.month + 1).padStart(2, "0")}`,
      ),
    );
    const eligibleActivities = activities.filter((a) => {
      if (a.isArchived) return false;
      if (!(includeDrafts && canManageClub) && a.status === "DRAFT") return false;
      if (rotaryYear !== "ALL" && a.rotaryYear && a.rotaryYear !== rotaryYear) {
        return false;
      }
      if (kindFilter !== "ALL" && a.kind !== kindFilter) return false;
      return true;
    });

    let sessionsCount = 0;
    for (const act of eligibleActivities) {
      for (const occ of expandActivityOccurrences(act)) {
        if (prefixes.has(occ.dateKey.slice(0, 7))) {
          sessionsCount += 1;
        }
      }
    }

    const openTaskCount = includeTasks
      ? tasks.filter(
          (t) =>
            t.status !== "COMPLETED" &&
            t.dueDate &&
            prefixes.has(t.dueDate.slice(0, 7)),
        ).length
      : 0;

    return {
      activityCount: eligibleActivities.length,
      sessionsCount,
      openTaskCount,
    };
  }, [
    activities,
    canManageClub,
    includeDrafts,
    includeTasks,
    kindFilter,
    rotaryYear,
    targetMonths,
    tasks,
  ]);

  if (!isOpen) return null;

  async function handleExport() {
    setDownloading(true);
    try {
      const response = await fetch("/api/project-center/export-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          months: targetMonths,
          rotaryYear,
          includeTasks,
          includeDrafts: Boolean(includeDrafts && canManageClub),
          kindFilter,
        }),
      });

      if (!response.ok) {
        const err = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(err?.error || "Could not generate Excel calendar.");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") || "";
      const filenameMatch = disposition.match(/filename="([^"]+)"/i);
      const filename =
        filenameMatch?.[1] || `racspeed-calendar-${monthValue}.xlsx`;

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      notifyToast({
        title: "Excel Calendar Ready",
        message: `Downloaded ${filename} — ready to send to your club GC.`,
        kind: "success",
      });
      onClose();
    } catch (err) {
      notifyToast({
        title: "Export failed",
        message:
          err instanceof Error ? err.message : "Could not export Excel calendar.",
        kind: "error",
      });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-calendar-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-xs"
      onClick={() => !downloading && onClose()}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-[#EDEDF2] bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-[#161B26] sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#EDEDF2] pb-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              <FileSpreadsheet className="h-5 w-5" />
            </span>
            <div>
              <h2
                id="export-calendar-modal-title"
                className="text-base font-bold text-[#111625] dark:text-white"
              >
                Export Styled Excel Calendar
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Download a color-coded .xlsx workbook ready to share in your GC.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={downloading}
            onClick={onClose}
            aria-label="Close export modal"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
              <span>Starting month</span>
              <input
                type="month"
                value={monthValue}
                onChange={(e) => setMonthValue(e.target.value)}
                className="w-full rounded-xl border border-[#DDE1EA] bg-white px-3 py-2 text-xs font-medium text-[#111625] outline-none focus:border-[#0D3594] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </label>

            <div className="space-y-1.5">
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Calendar sheets
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {([1, 2, 3] as const).map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setRangeMonths(count)}
                    className={`cursor-pointer rounded-xl border px-2.5 py-2 text-xs font-semibold transition ${
                      rangeMonths === count
                        ? "border-[#0D3594] bg-[#0D3594] text-white"
                        : "border-[#DDE1EA] bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    }`}
                  >
                    {count} {count === 1 ? "Month" : "Months"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-[#EDEDF2] bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/40">
            <label className="flex cursor-pointer items-start gap-2.5 text-xs">
              <input
                type="checkbox"
                checked={includeTasks}
                onChange={(e) => setIncludeTasks(e.target.checked)}
                className="mt-0.5 accent-[#0D3594]"
              />
              <span>
                <strong className="block text-[#111625] dark:text-white">
                  Include member tasks &amp; subtasks
                </strong>
                <span className="text-slate-500 dark:text-slate-400">
                  Plots open task deadlines onto calendar days and builds a Tasks &amp; Deliverables sheet.
                </span>
              </span>
            </label>

            {canManageClub && (
              <label className="flex cursor-pointer items-start gap-2.5 border-t border-slate-200/70 pt-2.5 text-xs dark:border-slate-800">
                <input
                  type="checkbox"
                  checked={includeDrafts}
                  onChange={(e) => setIncludeDrafts(e.target.checked)}
                  className="mt-0.5 accent-[#0D3594]"
                />
                <span>
                  <strong className="block text-[#111625] dark:text-white">
                    Include unpublished drafts
                  </strong>
                  <span className="text-slate-500 dark:text-slate-400">
                    Useful for officer / board GC alignment before publishing.
                  </span>
                </span>
              </label>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50/70 px-3.5 py-2.5 text-xs text-[#0D3594] dark:border-blue-500/30 dark:bg-blue-950/30 dark:text-blue-200">
            <div className="flex items-center gap-2 font-semibold">
              <CalendarDays className="h-4 w-4 shrink-0" />
              <span>
                {previewStats.sessionsCount} plotted session
                {previewStats.sessionsCount === 1 ? "" : "s"}
              </span>
            </div>
            <div className="flex items-center gap-2 font-semibold">
              <CheckSquare className="h-4 w-4 shrink-0" />
              <span>
                {previewStats.openTaskCount} task deadline
                {previewStats.openTaskCount === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            Workbook includes monthly Sun–Sat grid sheet(s), a{" "}
            <strong>Projects &amp; Schedule</strong> index, and a{" "}
            <strong>Tasks &amp; Deliverables</strong> breakdown formatted for landscape print or mobile viewing.
          </p>
        </div>

        <div className="mt-5 flex justify-end gap-2 border-t border-[#EDEDF2] pt-4 dark:border-slate-800">
          <button
            type="button"
            disabled={downloading}
            onClick={onClose}
            className="min-h-[40px] cursor-pointer rounded-xl border border-[#DDE1EA] px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={downloading}
            onClick={handleExport}
            className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl bg-[#0D3594] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#092569] disabled:opacity-60"
          >
            {downloading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Building Workbook...
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" />
                Download Excel Calendar (.xlsx)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

