"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  Maximize2,
  Minimize2,
  Presentation,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import type {
  DeckCalendarMonth,
  DeckMemberWorkload,
  DeckProject,
  PresentationDeckDTO,
} from "@/features/activities/export-types";
import { ACTIVITY_KIND_META, type ActivitySummaryDTO } from "@/features/activities/types";
import { buildMonthsFromStart } from "@/lib/services/exports/calendar-excel-helpers";
import { formatManila, manilaDateKey } from "@/lib/utils/dates";
import { notifyToast } from "@/components/shared/toast-viewport";

export interface PresentationBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  activities: ActivitySummaryDTO[];
  rotaryYear: string;
  canManageClub: boolean;
}

type SlideDescriptor =
  | { id: string; label: string; kind: "COVER" }
  | { id: string; label: string; kind: "OVERVIEW" }
  | { id: string; label: string; kind: "CALENDAR"; month: DeckCalendarMonth }
  | {
      id: string;
      label: string;
      kind: "PROJECTS";
      projects: DeckProject[];
      pageIndex: number;
      totalPages: number;
    }
  | {
      id: string;
      label: string;
      kind: "WORKLOAD";
      members: DeckMemberWorkload[];
      pageIndex: number;
      totalPages: number;
    }
  | { id: string; label: string; kind: "NEXT_STEPS" };

const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function buildCalendarWeeks(cal: DeckCalendarMonth) {
  const firstUtc = Date.UTC(cal.year, cal.month, 1);
  const daysInMonth = new Date(Date.UTC(cal.year, cal.month + 1, 0)).getUTCDate();
  const lastUtc = Date.UTC(cal.year, cal.month, daysInMonth);
  const startMs = firstUtc - new Date(firstUtc).getUTCDay() * 86_400_000;
  const endMs = lastUtc + (6 - new Date(lastUtc).getUTCDay()) * 86_400_000;
  const weeks: { ymd: string; dayNum: number; inMonth: boolean }[][] = [];

  for (let ms = startMs; ms <= endMs; ms += 7 * 86_400_000) {
    const row: { ymd: string; dayNum: number; inMonth: boolean }[] = [];
    for (let d = 0; d < 7; d++) {
      const cur = new Date(ms + d * 86_400_000);
      row.push({
        ymd: cur.toISOString().slice(0, 10),
        dayNum: cur.getUTCDate(),
        inMonth: cur.getUTCMonth() === cal.month,
      });
    }
    weeks.push(row);
  }
  return weeks;
}

export function PresentationBuilderModal({
  isOpen,
  onClose,
  activities,
  rotaryYear,
  canManageClub,
}: PresentationBuilderModalProps) {
  const todayYm = useMemo(() => manilaDateKey(new Date()).slice(0, 7), []);
  const [stage, setStage] = useState<"CONFIG" | "PREVIEW">("CONFIG");
  const [title, setTitle] = useState("");
  const [startYm, setStartYm] = useState(todayYm);
  const [monthCount, setMonthCount] = useState<1 | 2 | 3>(2);
  const [includeCalendar, setIncludeCalendar] = useState(true);
  const [includeTasks, setIncludeTasks] = useState(true);
  const [includeWorkload, setIncludeWorkload] = useState(true);
  const [includeDrafts, setIncludeDrafts] = useState(canManageClub);
  const [useAi, setUseAi] = useState(true);

  const selectableActivities = useMemo(() => {
    return activities
      .filter((a) => {
        if (a.isArchived) return false;
        if (!(includeDrafts && canManageClub) && a.status === "DRAFT") {
          return false;
        }
        if (rotaryYear !== "ALL" && a.rotaryYear && a.rotaryYear !== rotaryYear) {
          return false;
        }
        return true;
      })
      .sort((a, b) => a.startAt.localeCompare(b.startAt));
  }, [activities, canManageClub, includeDrafts, rotaryYear]);

  const [selectedIds, setSelectedIds] = useState<string[] | null>(null);
  const effectiveSelectedIds = useMemo(() => {
    if (selectedIds === null) return selectableActivities.map((a) => a.id);
    const valid = new Set(selectableActivities.map((a) => a.id));
    return selectedIds.filter((id) => valid.has(id));
  }, [selectableActivities, selectedIds]);

  const [generating, setGenerating] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<"PDF" | "PPTX" | null>(
    null,
  );
  const [deck, setDeck] = useState<PresentationDeckDTO | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  const slides: SlideDescriptor[] = useMemo(() => {
    if (!deck) return [];
    const list: SlideDescriptor[] = [
      { id: "cover", label: "Cover", kind: "COVER" },
      { id: "overview", label: "Overview & KPIs", kind: "OVERVIEW" },
    ];
    for (const cal of deck.calendarMonths.slice(0, 3)) {
      list.push({
        id: `cal-${cal.year}-${cal.month}`,
        label: cal.label,
        kind: "CALENDAR",
        month: cal,
      });
    }
    const projChunks = chunk(deck.projects, 2);
    projChunks.forEach((group, idx) => {
      list.push({
        id: `proj-${idx}`,
        label:
          projChunks.length > 1
            ? `Projects (${idx + 1}/${projChunks.length})`
            : "Projects & Tasks",
        kind: "PROJECTS",
        projects: group,
        pageIndex: idx,
        totalPages: projChunks.length,
      });
    });
    const workChunks = chunk(deck.memberWorkloads, 4);
    workChunks.forEach((group, idx) => {
      list.push({
        id: `work-${idx}`,
        label:
          workChunks.length > 1
            ? `Team Tasks (${idx + 1}/${workChunks.length})`
            : "Team Workload",
        kind: "WORKLOAD",
        members: group,
        pageIndex: idx,
        totalPages: workChunks.length,
      });
    });
    list.push({ id: "next", label: "Next Steps", kind: "NEXT_STEPS" });
    return list;
  }, [deck]);

  const activeSlide = slides[Math.min(slideIndex, Math.max(0, slides.length - 1))];

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (fullscreen) {
          setFullscreen(false);
        } else if (!generating && !exportingFormat) {
          onClose();
        }
        return;
      }
      if (stage === "PREVIEW" && slides.length > 0) {
        if (e.key === "ArrowRight") {
          setSlideIndex((prev) => Math.min(slides.length - 1, prev + 1));
        } else if (e.key === "ArrowLeft") {
          setSlideIndex((prev) => Math.max(0, prev - 1));
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    exportingFormat,
    fullscreen,
    generating,
    isOpen,
    onClose,
    slides.length,
    stage,
  ]);

  if (!isOpen) return null;

  const [yStr, mStr] = startYm.split("-");
  const targetMonths = buildMonthsFromStart(
    Number(yStr) || new Date().getUTCFullYear(),
    Math.max(0, Math.min(11, (Number(mStr) || 1) - 1)),
    monthCount,
  );

  function toggleActivityId(id: string) {
    const current = new Set(effectiveSelectedIds);
    if (current.has(id)) current.delete(id);
    else current.add(id);
    setSelectedIds(Array.from(current));
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const response = await fetch("/api/project-center/presentation/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || undefined,
          months: targetMonths,
          rotaryYear,
          activityIds: effectiveSelectedIds,
          includeDrafts: Boolean(includeDrafts && canManageClub),
          includeCalendar,
          includeTasks,
          includeWorkload,
          useAi,
        }),
      });
      const json = (await response.json().catch(() => null)) as {
        success?: boolean;
        deck?: PresentationDeckDTO;
        error?: string;
      } | null;

      if (!response.ok || !json?.success || !json.deck) {
        throw new Error(json?.error || "Could not build presentation.");
      }

      setDeck(json.deck);
      setSlideIndex(0);
      setStage("PREVIEW");
      notifyToast({
        title: json.deck.aiEnhanced
          ? "AI Presentation Generated"
          : "Presentation Ready",
        message: "Review slides, edit notes, present fullscreen, or download PDF / PPTX.",
        kind: "success",
      });
    } catch (err) {
      notifyToast({
        title: "Generation failed",
        message:
          err instanceof Error
            ? err.message
            : "Could not synthesize presentation.",
        kind: "error",
      });
    } finally {
      setGenerating(false);
    }
  }

  async function handleDownload(format: "PDF" | "PPTX") {
    if (!deck) return;
    setExportingFormat(format);
    try {
      const endpoint =
        format === "PDF"
          ? "/api/project-center/presentation/pdf"
          : "/api/project-center/presentation/pptx";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deck }),
      });

      if (!response.ok) {
        const err = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(err?.error || `Failed to export ${format}.`);
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") || "";
      const filenameMatch = disposition.match(/filename="([^"]+)"/i);
      const filename =
        filenameMatch?.[1] || `racspeed-presentation.${format.toLowerCase()}`;

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      notifyToast({
        title: `${format} Downloaded`,
        message: `Saved ${filename}.`,
        kind: "success",
      });
    } catch (err) {
      notifyToast({
        title: `${format} export failed`,
        message: err instanceof Error ? err.message : `Could not create ${format}.`,
        kind: "error",
      });
    } finally {
      setExportingFormat(null);
    }
  }

  function renderSlideContent(slide: SlideDescriptor, currentDeck: PresentationDeckDTO) {
    if (slide.kind === "COVER") {
      return (
        <div className="flex h-full flex-col justify-between rounded-xl bg-[#0D3594] p-7 text-white sm:p-10">
          <div>
            <div className="mb-4 h-1.5 w-16 bg-amber-400" />
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-200">
              {currentDeck.clubName} · District {currentDeck.districtCode}
            </p>
            <h3 className="mt-3 text-2xl font-bold leading-tight sm:text-4xl">
              {currentDeck.title}
            </h3>
            <p className="mt-3 text-sm text-blue-100 sm:text-base">
              {currentDeck.subtitle}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-blue-700/60 pt-4 text-xs text-blue-200">
            <span>Prepared by {currentDeck.presenterName}</span>
            <span>
              {currentDeck.aiEnhanced
                ? "AI-Enhanced Executive Brief"
                : "Live Database Deck"}{" "}
              · {currentDeck.generatedAtLabel}
            </span>
          </div>
        </div>
      );
    }

    if (slide.kind === "OVERVIEW") {
      return (
        <div className="flex h-full flex-col justify-between rounded-xl bg-slate-50 p-5 text-[#111625] sm:p-7">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#0D3594]">
              Executive Briefing
            </p>
            <h3 className="text-lg font-bold sm:text-xl">
              Schedule Overview &amp; Readiness
            </h3>
          </div>

          <div className="my-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xl font-bold text-[#0D3594]">
                {currentDeck.kpis.totalActivities}
              </p>
              <p className="text-[11px] text-slate-500">
                Projects &amp; Events ({currentDeck.kpis.totalSessions} sessions)
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xl font-bold text-[#0D3594]">
                {currentDeck.kpis.openTasks}
              </p>
              <p className="text-[11px] text-slate-500">
                Open Tasks ({currentDeck.kpis.completedTasks} done)
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xl font-bold text-[#0D3594]">
                {currentDeck.kpis.completedSubtasks}/{currentDeck.kpis.totalSubtasks}
              </p>
              <p className="text-[11px] text-slate-500">Subtasks Completed</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xl font-bold text-rose-600">
                {currentDeck.kpis.urgentCount}
              </p>
              <p className="text-[11px] text-slate-500">Urgent Items</p>
            </div>
          </div>

          <div className="grid flex-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-3.5">
              <p className="text-[10px] font-bold uppercase text-[#0D3594]">
                Summary &amp; Key Highlights
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-700">
                {currentDeck.executiveSummary}
              </p>
              <ul className="mt-2 space-y-1 text-[11px] text-slate-600">
                {currentDeck.highlights.slice(0, 4).map((h, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span className="font-bold text-[#0D3594]">•</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div
              className={`rounded-lg border p-3.5 ${
                currentDeck.attentionItems.length > 0
                  ? "border-amber-200 bg-amber-50/80"
                  : "border-slate-200 bg-white"
              }`}
            >
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5" />
                {currentDeck.attentionItems.length > 0
                  ? "Needs Officer Attention"
                  : "Operational Status"}
              </p>
              {currentDeck.attentionItems.length > 0 ? (
                <ul className="mt-2 space-y-1.5 text-[11px] text-slate-700">
                  {currentDeck.attentionItems.slice(0, 5).map((item, i) => (
                    <li key={i} className="flex gap-1.5">
                      <span className="font-bold text-amber-700">!</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-slate-600">
                  All scheduled sessions and member deliverables are on track.
                </p>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (slide.kind === "CALENDAR") {
      const weeks = buildCalendarWeeks(slide.month);
      return (
        <div className="flex h-full flex-col rounded-xl bg-slate-50 p-5 text-[#111625] sm:p-6">
          <div className="mb-2 flex items-end justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#0D3594]">
                Plotted Club Calendar (Asia/Manila)
              </p>
              <h3 className="text-lg font-bold">{slide.month.label}</h3>
            </div>
            <span className="text-[11px] text-slate-500">
              Blue = Project/Event · Amber = Open Task Due
            </span>
          </div>
          <div className="grid flex-1 grid-cols-7 overflow-hidden rounded-lg border border-slate-300 bg-white text-[10px]">
            {DAY_NAMES.map((day) => (
              <div
                key={day}
                className="border-b border-r border-slate-300 bg-[#1E3A8A] py-1 text-center font-bold text-white last:border-r-0"
              >
                {day}
              </div>
            ))}
            {weeks.flat().map((day) => {
              const entries = day.inMonth
                ? slide.month.entriesByDate[day.ymd] ?? []
                : [];
              const hasAct = entries.some((e) => e.kind === "activity");
              return (
                <div
                  key={day.ymd}
                  className={`min-h-[54px] border-b border-r border-slate-200 p-1 ${
                    !day.inMonth
                      ? "bg-slate-100 text-slate-400"
                      : hasAct
                        ? "bg-blue-50/70"
                        : "bg-white"
                  }`}
                >
                  <p className="font-bold">{day.dayNum}</p>
                  <div className="mt-0.5 space-y-0.5">
                    {entries.slice(0, 2).map((e, idx) => (
                      <p
                        key={idx}
                        className={`truncate rounded px-1 py-0.5 text-[9px] font-semibold ${
                          e.kind === "activity"
                            ? "bg-blue-100 text-blue-900"
                            : "bg-amber-100 text-amber-900"
                        }`}
                      >
                        {e.sessionLabel ? `[${e.sessionLabel}] ` : ""}
                        {e.title}
                      </p>
                    ))}
                    {entries.length > 2 && (
                      <p className="text-[8px] font-semibold text-slate-500">
                        +{entries.length - 2} more
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (slide.kind === "PROJECTS") {
      return (
        <div className="flex h-full flex-col rounded-xl bg-slate-50 p-5 text-[#111625] sm:p-6">
          <div className="mb-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#0D3594]">
              Project &amp; Deliverable Breakdown
            </p>
            <h3 className="text-lg font-bold">{slide.label}</h3>
          </div>
          <div className="grid flex-1 gap-3 sm:grid-cols-2">
            {slide.projects.map((p) => (
              <div
                key={p.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-bold text-[#111625]">{p.title}</h4>
                    <span className="shrink-0 rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-[#0D3594]">
                      {p.statusLabel}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {p.scheduleLabel}
                    {p.recurrenceLabel ? ` · ${p.recurrenceLabel}` : ""}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Lead: {p.chairName} · {p.location} · {p.rsvpGoing} going
                  </p>
                  <p className="mt-2 border-l-2 border-[#0D3594] bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-700">
                    {p.talkingPoint}
                  </p>
                </div>

                <div className="mt-3 border-t border-slate-100 pt-2">
                  <p className="text-[10px] font-bold uppercase text-[#0D3594]">
                    Tasks &amp; Subtasks ({p.tasks.length})
                  </p>
                  {p.tasks.length === 0 ? (
                    <p className="mt-1 text-[11px] text-slate-400">
                      No tasks assigned yet.
                    </p>
                  ) : (
                    <ul className="mt-1 space-y-1 text-[11px]">
                      {p.tasks.slice(0, 3).map((t) => (
                        <li key={t.id}>
                          <span className="font-semibold text-slate-800">
                            [{t.priority}] {t.title}
                          </span>{" "}
                          <span className="text-slate-500">
                            — {t.assignees.join(", ")} (Due {t.dueDate})
                          </span>
                          {t.checklist.slice(0, 2).map((c, idx) => (
                            <p key={idx} className="ml-3 text-[10px] text-slate-500">
                              {c.completed ? "✓" : "☐"} {c.title}
                              {c.assignedMemberName
                                ? ` (${c.assignedMemberName})`
                                : ""}
                            </p>
                          ))}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (slide.kind === "WORKLOAD") {
      return (
        <div className="flex h-full flex-col rounded-xl bg-slate-50 p-5 text-[#111625] sm:p-6">
          <div className="mb-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#0D3594]">
              Member Accountability
            </p>
            <h3 className="text-lg font-bold">{slide.label}</h3>
          </div>
          <div className="grid flex-1 gap-3 sm:grid-cols-2">
            {slide.members.map((m) => (
              <div
                key={m.memberName}
                className="rounded-xl border border-slate-200 bg-white p-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-sm font-bold text-[#0D3594]">
                    <Users className="h-3.5 w-3.5" />
                    {m.memberName}
                  </p>
                  <span className="text-[10px] font-semibold text-slate-500">
                    {m.openTasks} open · {m.completedTasks} done
                  </span>
                </div>
                <ul className="mt-2 space-y-1.5 text-[11px]">
                  {m.items.slice(0, 3).map((item, idx) => (
                    <li key={idx}>
                      <span className="font-semibold text-slate-800">
                        • {item.taskTitle}
                      </span>{" "}
                      <span className="text-slate-500">(Due {item.dueDate})</span>
                      {item.pendingSubtasks.slice(0, 2).map((sub, sIdx) => (
                        <p key={sIdx} className="ml-3 text-[10px] text-slate-500">
                          ☐ {sub}
                        </p>
                      ))}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="flex h-full flex-col rounded-xl bg-slate-50 p-5 text-[#111625] sm:p-7">
        <div className="mb-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#0D3594]">
            Action Plan
          </p>
          <h3 className="text-xl font-bold">
            Next Steps &amp; Coordination Checklist
          </h3>
        </div>
        <div className="flex-1 space-y-3 rounded-xl border border-slate-200 bg-white p-5">
          {currentDeck.nextSteps.map((step, idx) => (
            <div
              key={idx}
              className="flex items-start gap-3 border-b border-slate-100 pb-3 last:border-b-0"
            >
              <span className="text-sm font-bold text-[#0D3594]">
                0{idx + 1}
              </span>
              <p className="text-sm leading-relaxed text-slate-700">{step}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="presentation-builder-modal-title"
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-xs sm:p-5"
        onClick={() => !generating && !exportingFormat && onClose()}
      >
        <div
          className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[#EDEDF2] bg-white shadow-2xl dark:border-slate-800 dark:bg-[#161B26]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EDEDF2] px-5 py-4 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#0D3594]/10 text-[#0D3594] dark:bg-blue-500/15 dark:text-blue-300">
                <Presentation className="h-5 w-5" />
              </span>
              <div>
                <h2
                  id="presentation-builder-modal-title"
                  className="text-base font-bold text-[#111625] dark:text-white"
                >
                  Create Project Presentation &amp; PDF Deck
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Auto-synthesizes your plotted calendar, upcoming projects, and member tasks &amp; subtasks.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={generating || Boolean(exportingFormat)}
              onClick={onClose}
              aria-label="Close presentation builder"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          {stage === "CONFIG" || !deck ? (
            <div className="grid flex-1 gap-5 overflow-y-auto p-5 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-4">
                <label className="block space-y-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  <span>Presentation title (optional)</span>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Monthly General Assembly — Project Roadmap & Tasks"
                    className="w-full rounded-xl border border-[#DDE1EA] bg-white px-3 py-2 text-xs font-medium text-[#111625] outline-none focus:border-[#0D3594] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                    <span>Calendar start month</span>
                    <input
                      type="month"
                      value={startYm}
                      onChange={(e) => setStartYm(e.target.value)}
                      className="w-full rounded-xl border border-[#DDE1EA] bg-white px-3 py-2 text-xs font-medium text-[#111625] outline-none focus:border-[#0D3594] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />
                  </label>
                  <div className="space-y-1.5">
                    <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Timeframe horizon
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {([1, 2, 3] as const).map((cnt) => (
                        <button
                          key={cnt}
                          type="button"
                          onClick={() => setMonthCount(cnt)}
                          className={`cursor-pointer rounded-xl border px-2 py-2 text-xs font-semibold transition ${
                            monthCount === cnt
                              ? "border-[#0D3594] bg-[#0D3594] text-white"
                              : "border-[#DDE1EA] bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          }`}
                        >
                          {cnt} {cnt === 1 ? "Month" : "Months"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5 rounded-xl border border-[#EDEDF2] bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/40">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Deck Sections &amp; AI Enhancement
                  </p>
                  <label className="flex cursor-pointer items-center gap-2.5 text-xs font-medium text-slate-700 dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={includeCalendar}
                      onChange={(e) => setIncludeCalendar(e.target.checked)}
                      className="accent-[#0D3594]"
                    />
                    <CalendarDays className="h-3.5 w-3.5 text-[#0D3594]" />
                    <span>Include plotted calendar grid slides</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2.5 text-xs font-medium text-slate-700 dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={includeTasks}
                      onChange={(e) => setIncludeTasks(e.target.checked)}
                      className="accent-[#0D3594]"
                    />
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Include linked tasks &amp; subtask checklists</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2.5 text-xs font-medium text-slate-700 dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={includeWorkload}
                      onChange={(e) => setIncludeWorkload(e.target.checked)}
                      className="accent-[#0D3594]"
                    />
                    <Users className="h-3.5 w-3.5 text-violet-600" />
                    <span>Include member accountability &amp; workload slides</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2.5 text-xs font-medium text-slate-700 dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={useAi}
                      onChange={(e) => setUseAi(e.target.checked)}
                      className="accent-[#0D3594]"
                    />
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    <span>Generate AI executive summary &amp; talking points</span>
                  </label>
                  {canManageClub && (
                    <label className="flex cursor-pointer items-center gap-2.5 border-t border-slate-200/70 pt-2 text-xs font-medium text-slate-700 dark:border-slate-800 dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={includeDrafts}
                        onChange={(e) => setIncludeDrafts(e.target.checked)}
                        className="accent-[#0D3594]"
                      />
                      <span>Include unpublished draft proposals</span>
                    </label>
                  )}
                </div>
              </div>

              <div className="flex flex-col rounded-xl border border-[#EDEDF2] bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/30">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#111625] dark:text-white">
                    Projects &amp; Activities Included ({effectiveSelectedIds.length}/
                    {selectableActivities.length})
                  </span>
                  <div className="flex gap-2 text-[11px] font-semibold text-[#0D3594] dark:text-blue-300">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedIds(selectableActivities.map((a) => a.id))
                      }
                      className="cursor-pointer hover:underline"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedIds([])}
                      className="cursor-pointer hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="max-h-72 flex-1 space-y-1.5 overflow-y-auto pr-1">
                  {selectableActivities.length === 0 ? (
                    <p className="py-8 text-center text-xs text-slate-500">
                      No matching projects or activities in the current filter.
                    </p>
                  ) : (
                    selectableActivities.map((act) => {
                      const checked = effectiveSelectedIds.includes(act.id);
                      return (
                        <label
                          key={act.id}
                          className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleActivityId(act.id)}
                            className="mt-0.5 accent-[#0D3594]"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold text-[#111625] dark:text-white">
                              {act.title}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {ACTIVITY_KIND_META[act.kind]?.label} ·{" "}
                              {formatManila(act.startAt, "MMM d, yyyy")}
                              {act.tasksTotal > 0
                                ? ` · ${act.tasksTotal} tasks`
                                : ""}
                            </p>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-5">
              {/* Preview Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStage("CONFIG")}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#DDE1EA] px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Reconfigure
                  </button>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      deck.aiEnhanced
                        ? "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    <Sparkles className="h-3 w-3" />
                    {deck.aiEnhanced ? "AI-Enhanced Copy" : "Database Summary"}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFullscreen(true)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#DDE1EA] bg-white px-3 py-1.5 text-xs font-semibold text-[#111625] hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                    Present Fullscreen
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(exportingFormat)}
                    onClick={() => handleDownload("PPTX")}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#DDE1EA] bg-white px-3 py-1.5 text-xs font-semibold text-[#111625] hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {exportingFormat === "PPTX" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    Download PPTX
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(exportingFormat)}
                    onClick={() => handleDownload("PDF")}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#0D3594] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#092569] disabled:opacity-60"
                  >
                    {exportingFormat === "PDF" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileText className="h-3.5 w-3.5" />
                    )}
                    Download PDF (16:9)
                  </button>
                </div>
              </div>

              {/* Slide Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {slides.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSlideIndex(idx)}
                    className={`shrink-0 cursor-pointer rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                      idx === slideIndex
                        ? "bg-[#0D3594] text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {idx + 1}. {s.label}
                  </button>
                ))}
              </div>

              {/* 16:9 Stage */}
              {activeSlide && (
                <div className="aspect-[16/9] w-full overflow-hidden rounded-xl border border-slate-200 shadow-sm dark:border-slate-700">
                  {renderSlideContent(activeSlide, deck)}
                </div>
              )}

              {/* Quick Inline Edit Controls */}
              <div className="grid gap-3 rounded-xl border border-[#EDEDF2] bg-slate-50/70 p-3 sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-900/40">
                <label className="block space-y-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  <span>Quick edit deck title</span>
                  <input
                    type="text"
                    value={deck.title}
                    onChange={(e) =>
                      setDeck({ ...deck, title: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#DDE1EA] bg-white px-2.5 py-1.5 text-xs font-medium text-[#111625] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                </label>
                <label className="block space-y-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  <span>Quick edit executive summary</span>
                  <input
                    type="text"
                    value={deck.executiveSummary}
                    onChange={(e) =>
                      setDeck({ ...deck, executiveSummary: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#DDE1EA] bg-white px-2.5 py-1.5 text-xs font-medium text-[#111625] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 border-t border-[#EDEDF2] px-5 py-3.5 dark:border-slate-800">
            {stage === "PREVIEW" ? (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <button
                  type="button"
                  disabled={slideIndex === 0}
                  onClick={() => setSlideIndex((i) => Math.max(0, i - 1))}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#DDE1EA] px-2.5 py-1 font-semibold text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Prev
                </button>
                <span>
                  Slide {slideIndex + 1} of {slides.length}
                </span>
                <button
                  type="button"
                  disabled={slideIndex >= slides.length - 1}
                  onClick={() =>
                    setSlideIndex((i) => Math.min(slides.length - 1, i + 1))
                  }
                  className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#DDE1EA] px-2.5 py-1 font-semibold text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <span className="text-[11px] text-slate-500">
                Includes live DB records{useAi ? " + Gemini AI narrative" : ""}.
              </span>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                disabled={generating || Boolean(exportingFormat)}
                onClick={onClose}
                className="min-h-[40px] cursor-pointer rounded-xl border border-[#DDE1EA] px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
              >
                Close
              </button>
              {stage === "CONFIG" && (
                <button
                  type="button"
                  disabled={generating}
                  onClick={handleGenerate}
                  className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl bg-[#0D3594] px-4 py-2 text-xs font-bold text-white hover:bg-[#092569] disabled:opacity-60"
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Generating Deck...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      Generate Presentation
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Presentation Theater Overlay */}
      {fullscreen && deck && activeSlide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Fullscreen presentation mode"
          className="fixed inset-0 z-[60] flex flex-col bg-slate-950 p-4 text-white sm:p-8"
        >
          <div className="mb-3 flex items-center justify-between text-xs text-slate-300">
            <span className="font-semibold">
              {deck.title} · Slide {slideIndex + 1} / {slides.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={slideIndex === 0}
                onClick={() => setSlideIndex((i) => Math.max(0, i - 1))}
                className="cursor-pointer rounded-lg border border-slate-700 px-3 py-1 hover:bg-slate-800 disabled:opacity-40"
              >
                ← Prev
              </button>
              <button
                type="button"
                disabled={slideIndex >= slides.length - 1}
                onClick={() =>
                  setSlideIndex((i) => Math.min(slides.length - 1, i + 1))
                }
                className="cursor-pointer rounded-lg border border-slate-700 px-3 py-1 hover:bg-slate-800 disabled:opacity-40"
              >
                Next →
              </button>
              <button
                type="button"
                onClick={() => setFullscreen(false)}
                className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-slate-800 px-3 py-1 font-semibold hover:bg-slate-700"
              >
                <Minimize2 className="h-3.5 w-3.5" />
                Exit (Esc)
              </button>
            </div>
          </div>
          <div className="mx-auto flex aspect-[16/9] w-full max-w-6xl flex-1 items-center justify-center">
            <div className="h-full w-full overflow-hidden rounded-2xl shadow-2xl">
              {renderSlideContent(activeSlide, deck)}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

