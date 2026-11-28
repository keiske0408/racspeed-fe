"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Copy,
  Download,
  Image as ImageIcon,
  Layers,
  Loader2,
  X,
} from "lucide-react";
import type { ActivitySummaryDTO } from "@/features/activities/types";
import type { GroupTaskDTO } from "@/lib/data/tasks-types";
import { manilaDateKey } from "@/lib/utils/dates";
import {
  buildQuickSummaryData,
  formatQuickSummaryPlainText,
  type QuickSummaryLayout,
  type QuickSummaryMode,
  type QuickSummaryTheme,
  type QuickSummaryTimeframe,
} from "@/lib/services/exports/quick-summary-data";
import {
  exportQuickSummaryPngBlob,
  renderQuickSummaryCanvas,
} from "@/lib/services/exports/quick-summary-canvas";
import { notifyToast } from "@/components/shared/toast-viewport";

export interface QuickSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  activities: ActivitySummaryDTO[];
  tasks: GroupTaskDTO[];
  rotaryYear: string;
  clubName: string;
  districtCode: string;
  canManageClub: boolean;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export function QuickSummaryModal({
  isOpen,
  onClose,
  activities,
  tasks,
  rotaryYear,
  clubName,
  districtCode,
  canManageClub,
}: QuickSummaryModalProps) {
  const [mode, setMode] = useState<QuickSummaryMode>("COMBINED");
  const [timeframe, setTimeframe] =
    useState<QuickSummaryTimeframe>("NEXT_14_DAYS");
  const [theme, setTheme] = useState<QuickSummaryTheme>("LIGHT");
  const [layout, setLayout] = useState<QuickSummaryLayout>("PORTRAIT");
  const [includeSubtasks, setIncludeSubtasks] = useState(true);
  const [includeDrafts, setIncludeDrafts] = useState(false);
  const [customNote, setCustomNote] = useState("");
  const [busyAction, setBusyAction] = useState<
    "PNG" | "SEPARATE" | "COPY_IMAGE" | "COPY_TEXT" | null
  >(null);
  const [canvasRendered, setCanvasRendered] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const summaryData = useMemo(
    () =>
      buildQuickSummaryData({
        activities,
        tasks,
        mode,
        timeframe,
        rotaryYear,
        clubName,
        districtCode,
        includeSubtasks,
        includeDrafts: Boolean(includeDrafts && canManageClub),
        customNote,
      }),
    [
      activities,
      canManageClub,
      clubName,
      customNote,
      districtCode,
      includeDrafts,
      includeSubtasks,
      mode,
      rotaryYear,
      tasks,
      timeframe,
    ],
  );

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busyAction) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busyAction, isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;
    const result = renderQuickSummaryCanvas(canvasRef.current, summaryData, {
      theme,
      layout,
    });
    setCanvasRendered(Boolean(result));
  }, [isOpen, layout, summaryData, theme]);

  if (!isOpen) return null;

  const todaySlug = manilaDateKey(new Date());

  async function handleDownloadSinglePng() {
    setBusyAction("PNG");
    try {
      const blob = await exportQuickSummaryPngBlob(summaryData, {
        theme,
        layout,
      });
      if (!blob) {
        throw new Error("Could not render image in this browser.");
      }
      const modeSlug =
        mode === "PROJECTS_ONLY"
          ? "projects"
          : mode === "TASKS_ONLY"
            ? "tasks"
            : "combined";
      const filename = `racspeed-summary-${modeSlug}-${todaySlug}.png`;
      downloadBlob(blob, filename);
      notifyToast({
        title: "Quick Summary Image Ready",
        message: `Downloaded ${filename} — ready to send to your GC.`,
        kind: "success",
      });
    } catch (err) {
      notifyToast({
        title: "Image export failed",
        message:
          err instanceof Error
            ? err.message
            : "Could not render PNG summary image.",
        kind: "error",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDownloadSeparatePngs() {
    setBusyAction("SEPARATE");
    try {
      const projectsData = buildQuickSummaryData({
        activities,
        tasks,
        mode: "PROJECTS_ONLY",
        timeframe,
        rotaryYear,
        clubName,
        districtCode,
        includeSubtasks,
        includeDrafts: Boolean(includeDrafts && canManageClub),
        customNote,
      });
      const tasksData = buildQuickSummaryData({
        activities,
        tasks,
        mode: "TASKS_ONLY",
        timeframe,
        rotaryYear,
        clubName,
        districtCode,
        includeSubtasks,
        includeDrafts: Boolean(includeDrafts && canManageClub),
        customNote,
      });

      const [projBlob, taskBlob] = await Promise.all([
        exportQuickSummaryPngBlob(projectsData, { theme, layout: "PORTRAIT" }),
        exportQuickSummaryPngBlob(tasksData, { theme, layout: "PORTRAIT" }),
      ]);
      if (!projBlob || !taskBlob) {
        throw new Error("Could not render images in this browser.");
      }
      downloadBlob(projBlob, `racspeed-projects-summary-${todaySlug}.png`);
      downloadBlob(taskBlob, `racspeed-tasks-summary-${todaySlug}.png`);
      notifyToast({
        title: "2 Summary Images Downloaded",
        message:
          "Saved separate Projects PNG and Tasks PNG for your GC.",
        kind: "success",
      });
    } catch (err) {
      notifyToast({
        title: "Separate export failed",
        message:
          err instanceof Error ? err.message : "Could not export separate PNGs.",
        kind: "error",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCopyImage() {
    setBusyAction("COPY_IMAGE");
    try {
      const blob = await exportQuickSummaryPngBlob(summaryData, {
        theme,
        layout,
      });
      if (
        !blob ||
        typeof ClipboardItem === "undefined" ||
        !navigator.clipboard?.write
      ) {
        throw new Error(
          "Direct image copy is not supported in this browser. Use Download PNG instead.",
        );
      }
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      notifyToast({
        title: "Image Copied to Clipboard",
        message: "Paste directly (Ctrl+V) into your Messenger or Telegram GC!",
        kind: "success",
      });
    } catch (err) {
      notifyToast({
        title: "Copy image unavailable",
        message:
          err instanceof Error
            ? err.message
            : "Please use Download PNG to save and share the image.",
        kind: "error",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCopyText() {
    setBusyAction("COPY_TEXT");
    try {
      const text = formatQuickSummaryPlainText(summaryData);
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard write is not supported here.");
      }
      await navigator.clipboard.writeText(text);
      notifyToast({
        title: "GC Text Summary Copied",
        message: "Ready to paste directly into your club group chat.",
        kind: "success",
      });
    } catch (err) {
      notifyToast({
        title: "Could not copy text",
        message:
          err instanceof Error ? err.message : "Clipboard access was blocked.",
        kind: "error",
      });
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-summary-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-xs sm:p-5"
      onClick={() => !busyAction && onClose()}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-[#EDEDF2] bg-white shadow-2xl dark:border-slate-800 dark:bg-[#161B26]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EDEDF2] px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#0D3594] dark:bg-blue-500/15 dark:text-blue-300">
              <ImageIcon className="h-5 w-5" />
            </span>
            <div>
              <h2
                id="quick-summary-modal-title"
                className="text-base font-bold text-[#111625] dark:text-white"
              >
                Export Quick Summary Image
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Create a crisp PNG infographic or text summary for your GC — combined or separate for projects and tasks.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={Boolean(busyAction)}
            onClick={onClose}
            aria-label="Close quick summary modal"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="grid flex-1 gap-5 overflow-y-auto p-5 lg:grid-cols-[360px_1fr]">
          {/* Controls Column */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Summary content
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    ["COMBINED", "Combined"],
                    ["PROJECTS_ONLY", "Projects Only"],
                    ["TASKS_ONLY", "Tasks Only"],
                  ] as [QuickSummaryMode, string][]
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMode(value)}
                    className={`cursor-pointer rounded-xl border px-2.5 py-2 text-xs font-semibold transition ${
                      mode === value
                        ? "border-[#0D3594] bg-[#0D3594] text-white"
                        : "border-[#DDE1EA] bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Timeframe
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    ["NEXT_14_DAYS", "Next 14 Days"],
                    ["THIS_MONTH", "This Month"],
                    ["TWO_MONTHS", "This & Next Month"],
                    ["ALL_UPCOMING", "All Upcoming"],
                  ] as [QuickSummaryTimeframe, string][]
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTimeframe(value)}
                    className={`cursor-pointer rounded-xl border px-2.5 py-2 text-xs font-semibold transition ${
                      timeframe === value
                        ? "border-[#0D3594] bg-[#0D3594] text-white"
                        : "border-[#DDE1EA] bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Card theme
                </span>
                <div className="grid grid-cols-2 gap-1">
                  {(
                    [
                      ["LIGHT", "Light"],
                      ["DARK", "Dark"],
                    ] as [QuickSummaryTheme, string][]
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setTheme(val)}
                      className={`cursor-pointer rounded-lg border px-2 py-1.5 text-xs font-semibold ${
                        theme === val
                          ? "border-[#0D3594] bg-[#0D3594] text-white"
                          : "border-[#DDE1EA] bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Layout size
                </span>
                <div className="grid grid-cols-2 gap-1">
                  {(
                    [
                      ["PORTRAIT", "Mobile GC"],
                      ["WIDE", "Wide"],
                    ] as [QuickSummaryLayout, string][]
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setLayout(val)}
                      className={`cursor-pointer rounded-lg border px-2 py-1.5 text-xs font-semibold ${
                        layout === val
                          ? "border-[#0D3594] bg-[#0D3594] text-white"
                          : "border-[#DDE1EA] bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-[#EDEDF2] bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/40">
              {mode !== "PROJECTS_ONLY" && (
                <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={includeSubtasks}
                    onChange={(e) => setIncludeSubtasks(e.target.checked)}
                    className="accent-[#0D3594]"
                  />
                  <span>Include task subtasks / checklist items</span>
                </label>
              )}

              {canManageClub && mode !== "TASKS_ONLY" && (
                <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={includeDrafts}
                    onChange={(e) => setIncludeDrafts(e.target.checked)}
                    className="accent-[#0D3594]"
                  />
                  <span>Include unpublished drafts</span>
                </label>
              )}
            </div>

            <label className="block space-y-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
              <span>Optional GC note / reminder</span>
              <input
                type="text"
                maxLength={180}
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                placeholder="e.g. Please confirm RSVPs on Racspeed before Friday!"
                className="w-full rounded-xl border border-[#DDE1EA] bg-white px-3 py-2 text-xs font-medium text-[#111625] outline-none focus:border-[#0D3594] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </label>

            <div className="rounded-xl border border-blue-200 bg-blue-50/70 px-3.5 py-2.5 text-xs font-medium text-[#0D3594] dark:border-blue-500/30 dark:bg-blue-950/30 dark:text-blue-200">
              <p className="font-bold">Included in this image:</p>
              <p className="mt-0.5">
                {mode !== "TASKS_ONLY"
                  ? `${summaryData.projects.length} project${summaryData.projects.length === 1 ? "" : "s"} (${summaryData.stats.sessionsCount} sessions)`
                  : "Projects hidden"}
                {" · "}
                {mode !== "PROJECTS_ONLY"
                  ? `${summaryData.tasks.length} open task${summaryData.tasks.length === 1 ? "" : "s"}`
                  : "Tasks hidden"}
              </p>
            </div>
          </div>

          {/* Live Summary Preview Column */}
          <div className="flex flex-col rounded-2xl border border-[#EDEDF2] bg-slate-100/80 p-3 dark:border-slate-800 dark:bg-slate-950/60">
            <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              <span>Live PNG Preview (Asia/Manila)</span>
              <span>{summaryData.timeframeLabel}</span>
            </div>

            <div className="max-h-[56vh] flex-1 overflow-y-auto rounded-xl border border-slate-200/80 bg-white/60 p-2 dark:border-slate-800 dark:bg-slate-900/60">
              <canvas
                ref={canvasRef}
                className={
                  canvasRendered
                    ? "mx-auto h-auto max-w-full rounded-lg shadow-sm"
                    : "hidden"
                }
              />

              {/* Accessible HTML preview fallback (also useful when canvas 2d unavailable) */}
              {!canvasRendered && (
                <div
                  className={`space-y-3 rounded-xl p-4 text-xs ${
                    theme === "DARK"
                      ? "bg-[#0B1120] text-white"
                      : "bg-slate-50 text-[#111625]"
                  }`}
                >
                  <div className="rounded-xl bg-[#0D3594] p-4 text-white">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-blue-200">
                      {summaryData.clubName} · District {summaryData.districtCode}
                    </p>
                    <h3 className="mt-1 text-base font-bold">
                      {summaryData.headline}
                    </h3>
                    <p className="text-[11px] text-blue-100">
                      {summaryData.timeframeLabel}
                    </p>
                  </div>

                  {summaryData.mode !== "TASKS_ONLY" && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-bold uppercase text-[#0D3594]">
                        Projects &amp; Schedule ({summaryData.projects.length})
                      </p>
                      {summaryData.projects.map((p) => (
                        <div
                          key={p.id}
                          className="rounded-lg border border-slate-200 bg-white p-2.5 text-[#111625]"
                        >
                          <p className="font-bold">{p.title}</p>
                          <p className="text-[11px] text-slate-600">
                            {p.whenLabel} · {p.location} · Lead: {p.chairName}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {summaryData.mode !== "PROJECTS_ONLY" && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-bold uppercase text-[#0D3594]">
                        Tasks &amp; Deliverables ({summaryData.tasks.length})
                      </p>
                      {summaryData.tasks.map((t) => (
                        <div
                          key={t.id}
                          className="rounded-lg border border-slate-200 bg-white p-2.5 text-[#111625]"
                        >
                          <p className="font-bold">
                            [{t.priority}] {t.title}
                          </p>
                          <p className="text-[11px] text-slate-600">
                            Due {t.dueDateLabel} · {t.assignees.join(", ")}
                          </p>
                          {summaryData.includeSubtasks &&
                            t.checklist.map((c, idx) => (
                              <p
                                key={idx}
                                className="ml-2 text-[10px] text-slate-500"
                              >
                                {c.completed ? "✓" : "☐"} {c.title}
                              </p>
                            ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#EDEDF2] px-5 py-3.5 dark:border-slate-800">
          <button
            type="button"
            disabled={Boolean(busyAction)}
            onClick={onClose}
            className="min-h-[40px] cursor-pointer rounded-xl border border-[#DDE1EA] px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
          >
            Close
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={Boolean(busyAction)}
              onClick={handleCopyText}
              className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl border border-[#DDE1EA] bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {busyAction === "COPY_TEXT" ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              Copy GC Text
            </button>

            <button
              type="button"
              disabled={Boolean(busyAction)}
              onClick={handleCopyImage}
              className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl border border-[#DDE1EA] bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {busyAction === "COPY_IMAGE" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ImageIcon className="h-3.5 w-3.5" />
              )}
              Copy Image
            </button>

            {mode === "COMBINED" &&
              summaryData.projects.length > 0 &&
              summaryData.tasks.length > 0 && (
                <button
                  type="button"
                  disabled={Boolean(busyAction)}
                  onClick={handleDownloadSeparatePngs}
                  className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl border border-[#DDE1EA] bg-white px-3.5 py-2 text-xs font-semibold text-[#0D3594] hover:bg-blue-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-blue-300"
                >
                  {busyAction === "SEPARATE" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Layers className="h-3.5 w-3.5" />
                  )}
                  Download Separate PNGs (2)
                </button>
              )}

            <button
              type="button"
              disabled={Boolean(busyAction)}
              onClick={handleDownloadSinglePng}
              className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl bg-[#0D3594] px-4 py-2 text-xs font-bold text-white hover:bg-[#092569] disabled:opacity-60"
            >
              {busyAction === "PNG" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Download PNG
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

