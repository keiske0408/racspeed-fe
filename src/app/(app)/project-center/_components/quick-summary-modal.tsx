"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Copy,
  Download,
  Image as ImageIcon,
  Layers,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import type { ActivitySummaryDTO } from "@/features/activities/types";
import type { GroupTaskDTO } from "@/lib/data/tasks-types";
import { manilaDateKey } from "@/lib/utils/dates";
import {
  buildQuickSummaryData,
  formatQuickSummaryPlainText,
  recalculateQuickSummaryStats,
  type QuickSummaryLayout,
  type QuickSummaryMode,
  type QuickSummaryProjectItem,
  type QuickSummaryTaskItem,
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

const smallInputClass =
  "w-full rounded-lg border border-[#DDE1EA] bg-white px-2.5 py-1.5 text-xs text-[#111625] outline-none focus:border-[#0D3594] dark:border-slate-700 dark:bg-slate-900 dark:text-white";

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
  const [leftTab, setLeftTab] = useState<"CONFIG" | "EDIT">("CONFIG");
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

  // Baseline DB snapshot (always includes both projects & tasks so mode switches preserve data)
  const baseCombined = useMemo(
    () =>
      buildQuickSummaryData({
        activities,
        tasks,
        mode: "COMBINED",
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
      rotaryYear,
      tasks,
      timeframe,
    ],
  );

  // Editable state seeded from baseCombined and kept in sync unless user clears/resets
  const [headlineOverride, setHeadlineOverride] = useState<string | null>(null);
  const [timeframeLabelOverride, setTimeframeLabelOverride] = useState<
    string | null
  >(null);
  const [editableProjects, setEditableProjects] = useState<
    QuickSummaryProjectItem[]
  >(baseCombined.projects);
  const [editableTasks, setEditableTasks] = useState<QuickSummaryTaskItem[]>(
    baseCombined.tasks,
  );
  const [isEdited, setIsEdited] = useState(false);

  useEffect(() => {
    setEditableProjects(baseCombined.projects);
    setEditableTasks(baseCombined.tasks);
    setHeadlineOverride(null);
    setTimeframeLabelOverride(null);
    setIsEdited(false);
  }, [baseCombined.projects, baseCombined.tasks, timeframe, includeDrafts, includeSubtasks]);

  const defaultHeadline =
    mode === "PROJECTS_ONLY"
      ? "Upcoming Projects & Activities"
      : mode === "TASKS_ONLY"
        ? "Member Tasks & Subtasks Summary"
        : "Projects & Action Tasks Summary";

  const summaryData = useMemo(
    () =>
      recalculateQuickSummaryStats(
        {
          ...baseCombined,
          mode,
          headline:
            headlineOverride !== null ? headlineOverride : defaultHeadline,
          timeframeLabel:
            timeframeLabelOverride !== null
              ? timeframeLabelOverride
              : baseCombined.timeframeLabel,
          customNote: customNote.trim(),
        },
        editableProjects,
        editableTasks,
      ),
    [
      baseCombined,
      customNote,
      defaultHeadline,
      editableProjects,
      editableTasks,
      headlineOverride,
      mode,
      timeframeLabelOverride,
    ],
  );

  function handleResetToDb() {
    setEditableProjects(baseCombined.projects);
    setEditableTasks(baseCombined.tasks);
    setHeadlineOverride(null);
    setTimeframeLabelOverride(null);
    setIsEdited(false);
  }

  function updateProjectItem(
    index: number,
    patch: Partial<QuickSummaryProjectItem>,
  ) {
    setIsEdited(true);
    setEditableProjects((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)),
    );
  }

  function removeProjectItem(index: number) {
    setIsEdited(true);
    setEditableProjects((prev) => prev.filter((_, idx) => idx !== index));
  }

  function addCustomProject() {
    setIsEdited(true);
    setEditableProjects((prev) => [
      {
        id: `custom-proj-${Date.now()}`,
        title: "New Project / Announcement",
        kindLabel: "Project",
        statusLabel: "Planned",
        priority: "MEDIUM",
        whenLabel: "Schedule TBA",
        recurrenceLabel: null,
        location: "Venue TBA",
        chairName: "Club Officer",
        rsvpGoing: 0,
        minMembersRequired: null,
        tasksProgressLabel: null,
      },
      ...prev,
    ]);
  }

  function updateTaskItem(index: number, patch: Partial<QuickSummaryTaskItem>) {
    setIsEdited(true);
    setEditableTasks((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)),
    );
  }

  function removeTaskItem(index: number) {
    setIsEdited(true);
    setEditableTasks((prev) => prev.filter((_, idx) => idx !== index));
  }

  function addCustomTask() {
    setIsEdited(true);
    setEditableTasks((prev) => [
      {
        id: `custom-task-${Date.now()}`,
        title: "New Action Item",
        priority: "High",
        statusLabel: "TODO",
        dueDateLabel: "TBA",
        isOverdue: false,
        projectTitle: null,
        assignees: ["Club Team"],
        checklist: [],
      },
      ...prev,
    ]);
  }

  function addSubtaskToTask(taskIndex: number) {
    setIsEdited(true);
    setEditableTasks((prev) =>
      prev.map((task, idx) =>
        idx === taskIndex
          ? {
              ...task,
              checklist: [
                ...task.checklist,
                { title: "New subtask item", completed: false },
              ],
            }
          : task,
      ),
    );
  }

  function updateSubtask(
    taskIndex: number,
    subIndex: number,
    patch: { title?: string; completed?: boolean },
  ) {
    setIsEdited(true);
    setEditableTasks((prev) =>
      prev.map((task, idx) =>
        idx === taskIndex
          ? {
              ...task,
              checklist: task.checklist.map((sub, sIdx) =>
                sIdx === subIndex ? { ...sub, ...patch } : sub,
              ),
            }
          : task,
      ),
    );
  }

  function removeSubtask(taskIndex: number, subIndex: number) {
    setIsEdited(true);
    setEditableTasks((prev) =>
      prev.map((task, idx) =>
        idx === taskIndex
          ? {
              ...task,
              checklist: task.checklist.filter((_, sIdx) => sIdx !== subIndex),
            }
          : task,
      ),
    );
  }

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
      const projectsData = recalculateQuickSummaryStats(
        {
          ...summaryData,
          mode: "PROJECTS_ONLY",
          headline:
            headlineOverride !== null
              ? headlineOverride
              : "Upcoming Projects & Activities",
        },
        editableProjects,
        [],
      );
      const tasksData = recalculateQuickSummaryStats(
        {
          ...summaryData,
          mode: "TASKS_ONLY",
          headline:
            headlineOverride !== null
              ? headlineOverride
              : "Member Tasks & Subtasks Summary",
        },
        [],
        editableTasks,
      );

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
          "Saved separate Projects PNG and Tasks PNG with your revisions.",
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
                Customize layout, revise any project/task wording inline, preview live, and export PNG or text for your GC.
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
        <div className="grid flex-1 gap-5 overflow-hidden p-5 lg:grid-cols-[410px_1fr]">
          {/* Left Column: Configure | Edit Content */}
          <div className="flex max-h-[64vh] flex-col overflow-hidden">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div
                role="tablist"
                aria-label="Quick summary customization tabs"
                className="inline-flex rounded-xl border border-[#EDEDF2] bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={leftTab === "CONFIG"}
                  onClick={() => setLeftTab("CONFIG")}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    leftTab === "CONFIG"
                      ? "bg-[#0D3594] text-white"
                      : "text-slate-600 hover:text-[#111625] dark:text-slate-300"
                  }`}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Configure
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={leftTab === "EDIT"}
                  onClick={() => setLeftTab("EDIT")}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    leftTab === "EDIT"
                      ? "bg-[#0D3594] text-white"
                      : "text-slate-600 hover:text-[#111625] dark:text-slate-300"
                  }`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit Content
                  {isEdited && (
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  )}
                </button>
              </div>

              {isEdited && (
                <button
                  type="button"
                  onClick={handleResetToDb}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#DDE1EA] px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset to DB
                </button>
              )}
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto pr-1">
              {leftTab === "CONFIG" ? (
                <>
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

                  <div className="flex items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50/70 px-3.5 py-2.5 text-xs font-medium text-[#0D3594] dark:border-blue-500/30 dark:bg-blue-950/30 dark:text-blue-200">
                    <div>
                      <p className="font-bold">Included in this image:</p>
                      <p className="mt-0.5">
                        {mode !== "TASKS_ONLY"
                          ? `${summaryData.projects.length} project${summaryData.projects.length === 1 ? "" : "s"}`
                          : "Projects hidden"}
                        {" · "}
                        {mode !== "PROJECTS_ONLY"
                          ? `${summaryData.tasks.length} open task${summaryData.tasks.length === 1 ? "" : "s"}`
                          : "Tasks hidden"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLeftTab("EDIT")}
                      className="shrink-0 cursor-pointer rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#0D3594] shadow-2xs hover:bg-blue-50 dark:bg-slate-800 dark:text-blue-300"
                    >
                      Edit items →
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  {/* Banner Header Fields */}
                  <div className="space-y-2.5 rounded-xl border border-[#EDEDF2] bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/40">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Header &amp; Footer Note
                    </p>
                    <label className="block space-y-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      <span>Summary headline</span>
                      <input
                        type="text"
                        aria-label="Summary headline"
                        value={summaryData.headline}
                        onChange={(e) => {
                          setIsEdited(true);
                          setHeadlineOverride(e.target.value);
                        }}
                        className={smallInputClass}
                      />
                    </label>
                    <label className="block space-y-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      <span>Timeframe / subtitle</span>
                      <input
                        type="text"
                        aria-label="Timeframe subtitle"
                        value={summaryData.timeframeLabel}
                        onChange={(e) => {
                          setIsEdited(true);
                          setTimeframeLabelOverride(e.target.value);
                        }}
                        className={smallInputClass}
                      />
                    </label>
                    <label className="block space-y-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      <span>GC reminder note (optional)</span>
                      <input
                        type="text"
                        aria-label="GC reminder note"
                        maxLength={180}
                        value={customNote}
                        onChange={(e) => setCustomNote(e.target.value)}
                        placeholder="Add a reminder note at the bottom..."
                        className={smallInputClass}
                      />
                    </label>
                  </div>

                  {/* Editable Projects Section */}
                  {mode !== "TASKS_ONLY" && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#111625] dark:text-white">
                          Projects ({editableProjects.length})
                        </span>
                        <button
                          type="button"
                          onClick={addCustomProject}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#DDE1EA] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0D3594] hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800 dark:text-blue-300"
                        >
                          <Plus className="h-3 w-3" />
                          Add Project
                        </button>
                      </div>

                      {editableProjects.length === 0 && (
                        <p className="rounded-lg border border-dashed border-slate-200 p-3 text-center text-[11px] text-slate-500 dark:border-slate-700">
                          No projects listed. Click Add Project to insert one manually.
                        </p>
                      )}

                      {editableProjects.map((proj, pIdx) => (
                        <div
                          key={proj.id}
                          className="space-y-2 rounded-xl border border-[#EDEDF2] bg-white p-3 dark:border-slate-800 dark:bg-slate-900/60"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              aria-label={`Project ${pIdx + 1} title`}
                              value={proj.title}
                              onChange={(e) =>
                                updateProjectItem(pIdx, {
                                  title: e.target.value,
                                })
                              }
                              className={`${smallInputClass} font-semibold`}
                            />
                            <button
                              type="button"
                              aria-label={`Remove project ${proj.title}`}
                              onClick={() => removeProjectItem(pIdx)}
                              className="shrink-0 cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            <input
                              type="text"
                              aria-label={`Project ${pIdx + 1} schedule`}
                              value={proj.whenLabel}
                              placeholder="Date & time"
                              onChange={(e) =>
                                updateProjectItem(pIdx, {
                                  whenLabel: e.target.value,
                                })
                              }
                              className={smallInputClass}
                            />
                            <input
                              type="text"
                              aria-label={`Project ${pIdx + 1} status`}
                              value={proj.statusLabel}
                              placeholder="Status"
                              onChange={(e) =>
                                updateProjectItem(pIdx, {
                                  statusLabel: e.target.value,
                                })
                              }
                              className={smallInputClass}
                            />
                            <input
                              type="text"
                              aria-label={`Project ${pIdx + 1} location`}
                              value={proj.location}
                              placeholder="Venue / Location"
                              onChange={(e) =>
                                updateProjectItem(pIdx, {
                                  location: e.target.value,
                                })
                              }
                              className={smallInputClass}
                            />
                            <input
                              type="text"
                              aria-label={`Project ${pIdx + 1} lead`}
                              value={proj.chairName}
                              placeholder="Lead / Chair"
                              onChange={(e) =>
                                updateProjectItem(pIdx, {
                                  chairName: e.target.value,
                                })
                              }
                              className={smallInputClass}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Editable Tasks & Subtasks Section */}
                  {mode !== "PROJECTS_ONLY" && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#111625] dark:text-white">
                          Tasks &amp; Subtasks ({editableTasks.length})
                        </span>
                        <button
                          type="button"
                          onClick={addCustomTask}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#DDE1EA] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0D3594] hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800 dark:text-blue-300"
                        >
                          <Plus className="h-3 w-3" />
                          Add Task
                        </button>
                      </div>

                      {editableTasks.length === 0 && (
                        <p className="rounded-lg border border-dashed border-slate-200 p-3 text-center text-[11px] text-slate-500 dark:border-slate-700">
                          No open tasks listed. Click Add Task to insert an action item manually.
                        </p>
                      )}

                      {editableTasks.map((task, tIdx) => (
                        <div
                          key={task.id}
                          className="space-y-2 rounded-xl border border-[#EDEDF2] bg-white p-3 dark:border-slate-800 dark:bg-slate-900/60"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              aria-label={`Task ${tIdx + 1} title`}
                              value={task.title}
                              onChange={(e) =>
                                updateTaskItem(tIdx, { title: e.target.value })
                              }
                              className={`${smallInputClass} font-semibold`}
                            />
                            <button
                              type="button"
                              aria-label={`Remove task ${task.title}`}
                              onClick={() => removeTaskItem(tIdx)}
                              className="shrink-0 cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <div className="grid grid-cols-3 gap-1.5">
                            <select
                              aria-label={`Task ${tIdx + 1} priority`}
                              value={task.priority}
                              onChange={(e) =>
                                updateTaskItem(tIdx, {
                                  priority: e.target.value,
                                })
                              }
                              className={smallInputClass}
                            >
                              <option value="Urgent">Urgent</option>
                              <option value="High">High</option>
                              <option value="Medium">Medium</option>
                              <option value="Low">Low</option>
                            </select>
                            <input
                              type="text"
                              aria-label={`Task ${tIdx + 1} due date`}
                              value={task.dueDateLabel}
                              placeholder="Due date"
                              onChange={(e) =>
                                updateTaskItem(tIdx, {
                                  dueDateLabel: e.target.value,
                                  isOverdue: false,
                                })
                              }
                              className={smallInputClass}
                            />
                            <input
                              type="text"
                              aria-label={`Task ${tIdx + 1} assignees`}
                              value={task.assignees.join(", ")}
                              placeholder="Assignees"
                              onChange={(e) =>
                                updateTaskItem(tIdx, {
                                  assignees: e.target.value
                                    .split(",")
                                    .map((s) => s.trim())
                                    .filter(Boolean),
                                })
                              }
                              className={smallInputClass}
                            />
                          </div>

                          {includeSubtasks && (
                            <div className="space-y-1.5 border-t border-slate-100 pt-2 dark:border-slate-800">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase text-slate-400">
                                  Subtasks ({task.checklist.length})
                                </span>
                                <button
                                  type="button"
                                  onClick={() => addSubtaskToTask(tIdx)}
                                  className="cursor-pointer text-[10px] font-semibold text-[#0D3594] hover:underline dark:text-blue-300"
                                >
                                  + Add subtask
                                </button>
                              </div>
                              {task.checklist.map((sub, sIdx) => (
                                <div
                                  key={sIdx}
                                  className="flex items-center gap-1.5"
                                >
                                  <input
                                    type="checkbox"
                                    aria-label={`Toggle subtask ${sIdx + 1}`}
                                    checked={sub.completed}
                                    onChange={(e) =>
                                      updateSubtask(tIdx, sIdx, {
                                        completed: e.target.checked,
                                      })
                                    }
                                    className="accent-[#0D3594]"
                                  />
                                  <input
                                    type="text"
                                    aria-label={`Subtask ${sIdx + 1} title`}
                                    value={sub.title}
                                    onChange={(e) =>
                                      updateSubtask(tIdx, sIdx, {
                                        title: e.target.value,
                                      })
                                    }
                                    className={smallInputClass}
                                  />
                                  <button
                                    type="button"
                                    aria-label={`Remove subtask ${sub.title}`}
                                    onClick={() => removeSubtask(tIdx, sIdx)}
                                    className="cursor-pointer rounded p-1 text-slate-400 hover:text-rose-600"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Live Summary Preview Column */}
          <div className="flex max-h-[64vh] flex-col rounded-2xl border border-[#EDEDF2] bg-slate-100/80 p-3 dark:border-slate-800 dark:bg-slate-950/60">
            <div className="mb-2 flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              <span>
                Live PNG Preview (Asia/Manila)
                {isEdited ? " · Custom revisions active" : ""}
              </span>
              <div className="flex items-center gap-2">
                <span>{summaryData.timeframeLabel}</span>
                {leftTab === "CONFIG" && (
                  <button
                    type="button"
                    onClick={() => setLeftTab("EDIT")}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-bold text-[#0D3594] hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800 dark:text-blue-300"
                  >
                    <Pencil className="h-2.5 w-2.5" />
                    Edit text
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto rounded-xl border border-slate-200/80 bg-white/60 p-2 dark:border-slate-800 dark:bg-slate-900/60">
              <canvas
                ref={canvasRef}
                className={
                  canvasRendered
                    ? "mx-auto h-auto max-w-full rounded-lg shadow-sm"
                    : "hidden"
                }
              />

              {/* Accessible HTML preview fallback */}
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
                            Due {t.dueDateLabel} ·{" "}
                            {t.assignees.join(", ") || "Unassigned"}
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

                  {summaryData.customNote && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-900">
                      Note: {summaryData.customNote}
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
