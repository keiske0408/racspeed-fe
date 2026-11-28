"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Download,
  Image as ImageIcon,
  Layers,
  Loader2,
  Palette,
  Pencil,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { ActivitySummaryDTO } from "@/features/activities/types";
import type { GroupTaskDTO } from "@/lib/data/tasks-types";
import { manilaDateKey } from "@/lib/utils/dates";
import {
  DEFAULT_QUICK_SUMMARY_DESIGN,
  QUICK_SUMMARY_COLOR_PRESETS,
  buildQuickSummaryData,
  formatQuickSummaryPlainText,
  recalculateQuickSummaryStats,
  type QuickSummaryCardRadius,
  type QuickSummaryDesignConfig,
  type QuickSummaryFontScale,
  type QuickSummaryHeaderAlign,
  type QuickSummaryLayout,
  type QuickSummaryLogoSize,
  type QuickSummaryMode,
  type QuickSummaryNoteTone,
  type QuickSummaryProjectItem,
  type QuickSummarySectionOrder,
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

function moveArrayItem<T>(items: T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (target < 0 || target >= items.length) return items;
  const copy = [...items];
  const [moved] = copy.splice(index, 1);
  copy.splice(target, 0, moved);
  return copy;
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
  const [leftTab, setLeftTab] = useState<"CONFIG" | "DESIGN" | "EDIT">("CONFIG");
  const [mode, setMode] = useState<QuickSummaryMode>("COMBINED");
  const [timeframe, setTimeframe] =
    useState<QuickSummaryTimeframe>("NEXT_14_DAYS");
  const [theme, setTheme] = useState<QuickSummaryTheme>("LIGHT");
  const [layout, setLayout] = useState<QuickSummaryLayout>("PORTRAIT");
  const [includeSubtasks, setIncludeSubtasks] = useState(true);
  const [includeDrafts, setIncludeDrafts] = useState(false);
  const [customNote, setCustomNote] = useState("");
  const [design, setDesign] = useState<QuickSummaryDesignConfig>(
    DEFAULT_QUICK_SUMMARY_DESIGN,
  );
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const [busyAction, setBusyAction] = useState<
    "PNG" | "SEPARATE" | "COPY_IMAGE" | "COPY_TEXT" | null
  >(null);
  const [canvasRendered, setCanvasRendered] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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
  }, [
    baseCombined.projects,
    baseCombined.tasks,
    timeframe,
    includeDrafts,
    includeSubtasks,
  ]);

  useEffect(() => {
    if (!design.logoDataUrl || typeof Image === "undefined") {
      setLogoImg(null);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setLogoImg(img);
    };
    img.onerror = () => {
      if (!cancelled) setLogoImg(null);
    };
    img.src = design.logoDataUrl;
    return () => {
      cancelled = true;
    };
  }, [design.logoDataUrl]);

  const isDesignModified = useMemo(
    () =>
      JSON.stringify(design) !== JSON.stringify(DEFAULT_QUICK_SUMMARY_DESIGN),
    [design],
  );

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
    setDesign(DEFAULT_QUICK_SUMMARY_DESIGN);
    setIsEdited(false);
  }

  function updateDesign(patch: Partial<QuickSummaryDesignConfig>) {
    setDesign((prev) => ({ ...prev, ...patch }));
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      notifyToast({
        title: "Invalid file",
        message: "Please select an image file (PNG, JPG, WebP, SVG).",
        kind: "error",
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        updateDesign({ logoDataUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
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

  function moveProjectItem(index: number, delta: -1 | 1) {
    setIsEdited(true);
    setEditableProjects((prev) => moveArrayItem(prev, index, delta));
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
        highlighted: false,
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

  function moveTaskItem(index: number, delta: -1 | 1) {
    setIsEdited(true);
    setEditableTasks((prev) => moveArrayItem(prev, index, delta));
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
        highlighted: false,
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
      design,
      logoImage: logoImg,
    });
    setCanvasRendered(Boolean(result));
  }, [design, isOpen, layout, logoImg, summaryData, theme]);

  if (!isOpen) return null;

  const todaySlug = manilaDateKey(new Date());

  async function handleDownloadSinglePng() {
    setBusyAction("PNG");
    try {
      const blob = await exportQuickSummaryPngBlob(summaryData, {
        theme,
        layout,
        design,
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
        exportQuickSummaryPngBlob(projectsData, {
          theme,
          layout: "PORTRAIT",
          design,
        }),
        exportQuickSummaryPngBlob(tasksData, {
          theme,
          layout: "PORTRAIT",
          design,
        }),
      ]);
      if (!projBlob || !taskBlob) {
        throw new Error("Could not render images in this browser.");
      }
      downloadBlob(projBlob, `racspeed-projects-summary-${todaySlug}.png`);
      downloadBlob(taskBlob, `racspeed-tasks-summary-${todaySlug}.png`);
      notifyToast({
        title: "2 Summary Images Downloaded",
        message:
          "Saved separate Projects PNG and Tasks PNG with your design & revisions.",
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
        design,
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

  const orderedSections: ("PROJECTS" | "TASKS")[] =
    design.sectionOrder === "TASKS_FIRST"
      ? ["TASKS", "PROJECTS"]
      : ["PROJECTS", "TASKS"];

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
                Customize visual elements, colors, logo, section order, and content before exporting to your GC.
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
        <div className="grid flex-1 gap-5 overflow-hidden p-5 lg:grid-cols-[430px_1fr]">
          {/* Left Column: Configure | Design | Edit Content */}
          <div className="flex max-h-[64vh] flex-col overflow-hidden">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
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
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
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
                  aria-selected={leftTab === "DESIGN"}
                  onClick={() => setLeftTab("DESIGN")}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                    leftTab === "DESIGN"
                      ? "bg-[#0D3594] text-white"
                      : "text-slate-600 hover:text-[#111625] dark:text-slate-300"
                  }`}
                >
                  <Palette className="h-3.5 w-3.5" />
                  Design
                  {isDesignModified && (
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  )}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={leftTab === "EDIT"}
                  onClick={() => setLeftTab("EDIT")}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
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

              {(isEdited || isDesignModified) && (
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
              {leftTab === "CONFIG" && (
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
              )}

              {leftTab === "DESIGN" && (
                <div className="space-y-4">
                  {/* Color Palettes */}
                  <div className="space-y-2 rounded-xl border border-[#EDEDF2] bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/40">
                    <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Brand Colors &amp; Palettes
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_SUMMARY_COLOR_PRESETS.map((preset) => {
                        const active =
                          design.primaryColor.toLowerCase() ===
                            preset.primaryColor.toLowerCase() &&
                          design.accentColor.toLowerCase() ===
                            preset.accentColor.toLowerCase();
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() =>
                              updateDesign({
                                primaryColor: preset.primaryColor,
                                accentColor: preset.accentColor,
                              })
                            }
                            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-semibold transition ${
                              active
                                ? "border-[#0D3594] bg-white ring-1 ring-[#0D3594] dark:bg-slate-800"
                                : "border-[#DDE1EA] bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
                            }`}
                          >
                            <span
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: preset.primaryColor }}
                            />
                            <span className="text-slate-700 dark:text-slate-200">
                              {preset.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <label className="flex items-center justify-between gap-2 rounded-lg border border-[#DDE1EA] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                        <span>Primary</span>
                        <input
                          type="color"
                          aria-label="Primary color"
                          value={design.primaryColor}
                          onChange={(e) =>
                            updateDesign({ primaryColor: e.target.value })
                          }
                          className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
                        />
                      </label>
                      <label className="flex items-center justify-between gap-2 rounded-lg border border-[#DDE1EA] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                        <span>Accent</span>
                        <input
                          type="color"
                          aria-label="Accent color"
                          value={design.accentColor}
                          onChange={(e) =>
                            updateDesign({ accentColor: e.target.value })
                          }
                          className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Club Logo Element */}
                  <div className="space-y-2 rounded-xl border border-[#EDEDF2] bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/40">
                    <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Club Logo / Image Element
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#DDE1EA] bg-white px-3 py-1.5 text-xs font-semibold text-[#0D3594] hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800 dark:text-blue-300">
                        <Upload className="h-3.5 w-3.5" />
                        <span>
                          {design.logoDataUrl ? "Replace logo" : "Upload logo"}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          aria-label="Upload club logo or image"
                          onChange={handleLogoUpload}
                          className="sr-only"
                        />
                      </label>
                      {design.logoDataUrl && (
                        <>
                          <div className="inline-flex rounded-lg border border-[#DDE1EA] bg-white p-0.5 dark:border-slate-700 dark:bg-slate-800">
                            {(["SM", "MD", "LG"] as QuickSummaryLogoSize[]).map(
                              (sz) => (
                                <button
                                  key={sz}
                                  type="button"
                                  onClick={() => updateDesign({ logoSize: sz })}
                                  className={`cursor-pointer rounded px-2 py-0.5 text-[10px] font-bold ${
                                    design.logoSize === sz
                                      ? "bg-[#0D3594] text-white"
                                      : "text-slate-600 dark:text-slate-300"
                                  }`}
                                >
                                  {sz}
                                </button>
                              ),
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => updateDesign({ logoDataUrl: null })}
                            className="cursor-pointer rounded-lg px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400"
                          >
                            Remove
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Style & Layout Structure */}
                  <div className="space-y-3 rounded-xl border border-[#EDEDF2] bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/40">
                    <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Typography, Cards &amp; Order
                    </span>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <span className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                          Card corners
                        </span>
                        <div className="grid grid-cols-3 gap-1">
                          {(
                            [
                              ["SHARP", "Sharp"],
                              ["ROUNDED", "Round"],
                              ["SOFT", "Soft"],
                            ] as [QuickSummaryCardRadius, string][]
                          ).map(([val, label]) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => updateDesign({ cardRadius: val })}
                              className={`cursor-pointer rounded-lg border px-1.5 py-1 text-[11px] font-semibold ${
                                design.cardRadius === val
                                  ? "border-[#0D3594] bg-[#0D3594] text-white"
                                  : "border-[#DDE1EA] bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                          Text scale
                        </span>
                        <div className="grid grid-cols-3 gap-1">
                          {(
                            [
                              ["COMPACT", "Sm"],
                              ["NORMAL", "Md"],
                              ["LARGE", "Lg"],
                            ] as [QuickSummaryFontScale, string][]
                          ).map(([val, label]) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => updateDesign({ fontScale: val })}
                              className={`cursor-pointer rounded-lg border px-1.5 py-1 text-[11px] font-semibold ${
                                design.fontScale === val
                                  ? "border-[#0D3594] bg-[#0D3594] text-white"
                                  : "border-[#DDE1EA] bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                          Header align
                        </span>
                        <div className="grid grid-cols-2 gap-1">
                          {(
                            [
                              ["LEFT", "Left"],
                              ["CENTER", "Center"],
                            ] as [QuickSummaryHeaderAlign, string][]
                          ).map(([val, label]) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => updateDesign({ headerAlign: val })}
                              className={`cursor-pointer rounded-lg border px-2 py-1 text-[11px] font-semibold ${
                                design.headerAlign === val
                                  ? "border-[#0D3594] bg-[#0D3594] text-white"
                                  : "border-[#DDE1EA] bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                          Section order
                        </span>
                        <div className="grid grid-cols-2 gap-1">
                          {(
                            [
                              ["PROJECTS_FIRST", "Projects 1st"],
                              ["TASKS_FIRST", "Tasks 1st"],
                            ] as [QuickSummarySectionOrder, string][]
                          ).map(([val, label]) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => updateDesign({ sectionOrder: val })}
                              className={`cursor-pointer rounded-lg border px-1.5 py-1 text-[11px] font-semibold ${
                                design.sectionOrder === val
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

                    <div className="space-y-1">
                      <span className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        Note banner color
                      </span>
                      <div className="grid grid-cols-4 gap-1">
                        {(
                          [
                            ["AMBER", "Amber"],
                            ["BLUE", "Blue"],
                            ["RED", "Urgent Red"],
                            ["GREEN", "Green"],
                          ] as [QuickSummaryNoteTone, string][]
                        ).map(([val, label]) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => updateDesign({ noteTone: val })}
                            className={`cursor-pointer rounded-lg border px-1.5 py-1 text-[11px] font-semibold ${
                              design.noteTone === val
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

                  {/* Show / Hide Visual Elements */}
                  <div className="space-y-2 rounded-xl border border-[#EDEDF2] bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/40">
                    <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Show / Hide Elements
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-700 dark:text-slate-200">
                      {(
                        [
                          ["showAccentBar", "Header Accent Bar"],
                          ["showClubTag", "Club & District Tag"],
                          ["showKpis", "KPI Stat Cards"],
                          ["showCardStripe", "Card Left Stripe"],
                          ["showBadges", "Status / Priority Pills"],
                          ["showMetaLine", "Venue & Lead Line"],
                          ["showFooter", "Footer Branding"],
                        ] as [keyof QuickSummaryDesignConfig, string][]
                      ).map(([key, label]) => (
                        <label
                          key={key}
                          className="flex cursor-pointer items-center gap-2 font-medium"
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(design[key])}
                            onChange={(e) =>
                              updateDesign({ [key]: e.target.checked })
                            }
                            className="accent-[#0D3594]"
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>

                    {design.showFooter && (
                      <label className="block space-y-1 pt-2 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        <span>Footer call-to-action text</span>
                        <input
                          type="text"
                          aria-label="Footer call-to-action text"
                          value={design.footerText}
                          onChange={(e) =>
                            updateDesign({ footerText: e.target.value })
                          }
                          className={smallInputClass}
                        />
                      </label>
                    )}
                  </div>
                </div>
              )}

              {leftTab === "EDIT" && (
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
                          className={`space-y-2 rounded-xl border p-3 ${
                            proj.highlighted
                              ? "border-amber-400 bg-amber-50/40 dark:border-amber-500/50 dark:bg-amber-950/20"
                              : "border-[#EDEDF2] bg-white dark:border-slate-800 dark:bg-slate-900/60"
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
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
                              aria-label={`Highlight project ${pIdx + 1}`}
                              aria-pressed={Boolean(proj.highlighted)}
                              onClick={() =>
                                updateProjectItem(pIdx, {
                                  highlighted: !proj.highlighted,
                                })
                              }
                              title="Highlight / Feature card"
                              className={`shrink-0 cursor-pointer rounded-lg p-1.5 ${
                                proj.highlighted
                                  ? "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300"
                                  : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                              }`}
                            >
                              <Star className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Move project ${pIdx + 1} up`}
                              disabled={pIdx === 0}
                              onClick={() => moveProjectItem(pIdx, -1)}
                              className="shrink-0 cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Move project ${pIdx + 1} down`}
                              disabled={pIdx === editableProjects.length - 1}
                              onClick={() => moveProjectItem(pIdx, 1)}
                              className="shrink-0 cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
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
                          className={`space-y-2 rounded-xl border p-3 ${
                            task.highlighted
                              ? "border-amber-400 bg-amber-50/40 dark:border-amber-500/50 dark:bg-amber-950/20"
                              : "border-[#EDEDF2] bg-white dark:border-slate-800 dark:bg-slate-900/60"
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
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
                              aria-label={`Highlight task ${tIdx + 1}`}
                              aria-pressed={Boolean(task.highlighted)}
                              onClick={() =>
                                updateTaskItem(tIdx, {
                                  highlighted: !task.highlighted,
                                })
                              }
                              title="Highlight / Feature card"
                              className={`shrink-0 cursor-pointer rounded-lg p-1.5 ${
                                task.highlighted
                                  ? "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300"
                                  : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                              }`}
                            >
                              <Star className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Move task ${tIdx + 1} up`}
                              disabled={tIdx === 0}
                              onClick={() => moveTaskItem(tIdx, -1)}
                              className="shrink-0 cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Move task ${tIdx + 1} down`}
                              disabled={tIdx === editableTasks.length - 1}
                              onClick={() => moveTaskItem(tIdx, 1)}
                              className="shrink-0 cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
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
                {isEdited || isDesignModified ? " · Customized" : ""}
              </span>
              <div className="flex items-center gap-1.5">
                <span>{summaryData.timeframeLabel}</span>
                {leftTab !== "DESIGN" && (
                  <button
                    type="button"
                    onClick={() => setLeftTab("DESIGN")}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-bold text-[#0D3594] hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800 dark:text-blue-300"
                  >
                    <Palette className="h-2.5 w-2.5" />
                    Elements
                  </button>
                )}
                {leftTab !== "EDIT" && (
                  <button
                    type="button"
                    onClick={() => setLeftTab("EDIT")}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-bold text-[#0D3594] hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800 dark:text-blue-300"
                  >
                    <Pencil className="h-2.5 w-2.5" />
                    Text
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

              {/* Accessible HTML preview mirroring all design & element controls */}
              {!canvasRendered && (
                <div
                  className={`space-y-3 rounded-xl p-4 text-xs ${
                    theme === "DARK"
                      ? "bg-[#0B1120] text-white"
                      : "bg-slate-50 text-[#111625]"
                  }`}
                >
                  <div
                    className={`rounded-xl p-4 text-white ${
                      design.headerAlign === "CENTER" ? "text-center" : ""
                    }`}
                    style={{ backgroundColor: design.primaryColor }}
                  >
                    {design.logoDataUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={design.logoDataUrl}
                        alt="Club logo"
                        className={`mb-2 inline-block h-10 w-10 rounded-lg object-cover`}
                      />
                    )}
                    {design.showAccentBar && (
                      <div
                        className={`mb-2 h-1 w-12 ${
                          design.headerAlign === "CENTER" ? "mx-auto" : ""
                        }`}
                        style={{ backgroundColor: design.accentColor }}
                      />
                    )}
                    {design.showClubTag && (
                      <p className="text-[10px] font-bold uppercase tracking-wider text-blue-200">
                        {summaryData.clubName} · District {summaryData.districtCode}
                      </p>
                    )}
                    <h3 className="mt-1 text-base font-bold">
                      {summaryData.headline}
                    </h3>
                    <p className="text-[11px] text-blue-100">
                      {summaryData.timeframeLabel}
                    </p>
                  </div>

                  {design.showKpis && (
                    <div
                      className="grid grid-cols-3 gap-2 text-center text-[11px]"
                      data-testid="quick-summary-kpi-strip"
                    >
                      <div className="rounded-lg border border-slate-200 bg-white p-2 text-[#111625]">
                        <strong>{summaryData.stats.projectsCount}</strong>{" "}
                        Projects
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-2 text-[#111625]">
                        <strong>{summaryData.stats.openTasksCount}</strong>{" "}
                        Tasks
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-2 text-[#111625]">
                        <strong>
                          {summaryData.stats.subtasksDone}/
                          {summaryData.stats.subtasksTotal}
                        </strong>{" "}
                        Subtasks
                      </div>
                    </div>
                  )}

                  {orderedSections.map((sec) => {
                    if (sec === "PROJECTS" && summaryData.mode !== "TASKS_ONLY") {
                      return (
                        <div
                          key="proj"
                          data-testid="quick-summary-projects-section"
                          className="space-y-1.5"
                        >
                          <p
                            className="text-[11px] font-bold uppercase"
                            style={{ color: design.primaryColor }}
                          >
                            Projects &amp; Schedule ({summaryData.projects.length})
                          </p>
                          {summaryData.projects.map((p) => (
                            <div
                              key={p.id}
                              className="rounded-lg border bg-white p-2.5 text-[#111625]"
                              style={{
                                borderColor: p.highlighted
                                  ? design.accentColor
                                  : "#E2E8F0",
                              }}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-bold">{p.title}</p>
                                {design.showBadges && (
                                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold">
                                    {p.highlighted ? "★ " : ""}
                                    {p.statusLabel}
                                  </span>
                                )}
                              </div>
                              {design.showMetaLine && (
                                <p className="text-[11px] text-slate-600">
                                  {p.whenLabel} · {p.location} · Lead:{" "}
                                  {p.chairName}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    }

                    if (sec === "TASKS" && summaryData.mode !== "PROJECTS_ONLY") {
                      return (
                        <div
                          key="tasks"
                          data-testid="quick-summary-tasks-section"
                          className="space-y-1.5"
                        >
                          <p
                            className="text-[11px] font-bold uppercase"
                            style={{ color: design.primaryColor }}
                          >
                            Tasks &amp; Deliverables ({summaryData.tasks.length})
                          </p>
                          {summaryData.tasks.map((t) => (
                            <div
                              key={t.id}
                              className="rounded-lg border bg-white p-2.5 text-[#111625]"
                              style={{
                                borderColor: t.highlighted
                                  ? design.accentColor
                                  : "#E2E8F0",
                              }}
                            >
                              <p className="font-bold">
                                {design.showBadges
                                  ? `[${t.highlighted ? "★ " : ""}${t.priority}] `
                                  : ""}
                                {t.title}
                              </p>
                              {design.showMetaLine && (
                                <p className="text-[11px] text-slate-600">
                                  Due {t.dueDateLabel} ·{" "}
                                  {t.assignees.join(", ") || "Unassigned"}
                                </p>
                              )}
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
                      );
                    }
                    return null;
                  })}

                  {summaryData.customNote && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-900">
                      Note: {summaryData.customNote}
                    </div>
                  )}

                  {design.showFooter && (
                    <div
                      data-testid="quick-summary-footer"
                      className="border-t border-slate-200 pt-2 text-[10px] text-slate-500"
                    >
                      {design.footerText}
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
