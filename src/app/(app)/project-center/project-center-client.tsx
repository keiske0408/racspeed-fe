"use client";

import React, { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Archive } from "lucide-react";
import { ActivityCalendar } from "./_components/activity-calendar";
import { ActivityCard } from "./_components/activity-card";
import { ProjectCenterHeader } from "./_components/project-center-header";
import { StageTabs } from "./_components/stage-tabs";
import { ProjectToolbar } from "./_components/project-toolbar";
import { ProjectList } from "./_components/project-list";
import { StatusPill } from "./_components/status-pill";
import { ArchiveReasonModal } from "./_components/archive-reason-modal";
import { ExportCalendarModal } from "./_components/export-calendar-modal";
import { PresentationBuilderModal } from "./_components/presentation-builder-modal";
import {
  DRAFT_STARTING_SOON_DAYS,
  getAssignmentInfo,
  getProjectStageTab,
  LAST_VIEW_STORAGE_KEY_PREFIX,
  SEARCH_DEBOUNCE_MS,
  type ProjectCenterView,
  type ProjectStageTab,
} from "@/features/activities/project-center-rules";
import { compareByPriority } from "@/features/activities/rules";
import {
  isProjectKind,
  type ActivityPriority,
  type ActivitySummaryDTO,
} from "@/features/activities/types";
import {
  archiveActivityAction,
  bulkArchiveActivitiesAction,
} from "@/features/activities/actions";
import type { GroupTaskDTO } from "@/lib/data/tasks-types";
import { rotaryYearFor } from "@/lib/utils/rotary-year";
import { notifyToast } from "@/components/shared/toast-viewport";

function parseStageTab(raw: string | null): ProjectStageTab {
  switch (raw?.toUpperCase()) {
    case "MISSED":
    case "PAST_DUE":
      return "MISSED";
    case "ONGOING":
      return "ONGOING";
    case "REPORT_DUE":
    case "AWAITING_REPORT":
      return "REPORT_DUE";
    case "ACCOMPLISHED":
    case "FINISHED":
      return "ACCOMPLISHED";
    case "ARCHIVED":
      return "ARCHIVED";
    default:
      return "UPCOMING";
  }
}

function parseViewMode(raw: string | null): ProjectCenterView | null {
  switch (raw?.toUpperCase()) {
    case "LIST":
      return "LIST";
    case "BOARD":
      return "BOARD";
    case "CALENDAR":
      return "CALENDAR";
    default:
      return null;
  }
}

function parsePriorityFilter(raw: string | null): "ALL" | ActivityPriority {
  switch (raw?.toUpperCase()) {
    case "LOW":
    case "MEDIUM":
    case "HIGH":
    case "URGENT":
      return raw.toUpperCase() as ActivityPriority;
    default:
      return "ALL";
  }
}

export function ProjectCenterClient({
  initialActivities,
  initialTasks,
  canCreate,
  canManageClub = false,
  currentUserId,
  currentUserName,
  defaultRotaryYear,
  draftReadinessDays = DRAFT_STARTING_SOON_DAYS,
}: {
  initialActivities: ActivitySummaryDTO[];
  initialTasks: GroupTaskDTO[];
  canCreate: boolean;
  canManageClub?: boolean;
  currentUserId: string;
  currentUserName: string;
  defaultRotaryYear?: string;
  draftReadinessDays?: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const fallbackRotaryYear = useMemo(
    () => defaultRotaryYear || rotaryYearFor(),
    [defaultRotaryYear],
  );

  const [activities, setActivities] =
    useState<ActivitySummaryDTO[]>(initialActivities);

  useEffect(() => {
    setActivities(initialActivities);
  }, [initialActivities]);

  // URL-backed filters and navigation state
  const urlView = parseViewMode(searchParams.get("view"));
  const [activeTab, setActiveTab] = useState<ProjectStageTab>(() => {
    if (searchParams.get("scope")?.toUpperCase() === "ARCHIVED") {
      return "ARCHIVED";
    }
    return parseStageTab(searchParams.get("tab") || searchParams.get("status"));
  });
  const [view, setView] = useState<ProjectCenterView>(urlView || "LIST");
  const [rotaryYear, setRotaryYear] = useState<string>(
    searchParams.get("ry") || fallbackRotaryYear,
  );
  const [kind, setKind] = useState<string>(searchParams.get("kind") || "ALL");
  const [assignedToMe, setAssignedToMe] = useState<boolean>(
    searchParams.get("assigned") === "1",
  );
  const [priorityFilter, setPriorityFilter] = useState<"ALL" | ActivityPriority>(
    parsePriorityFilter(searchParams.get("priority")),
  );
  const [sortBy, setSortBy] = useState<"SCHEDULE" | "PRIORITY">(
    searchParams.get("sort")?.toUpperCase() === "PRIORITY"
      ? "PRIORITY"
      : "SCHEDULE",
  );

  const initialQuery = searchParams.get("q") || "";
  const [searchInput, setSearchInput] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);

  // Dialog states
  const [guideOpen, setGuideOpen] = useState(false);
  const [archiveCandidate, setArchiveCandidate] =
    useState<ActivitySummaryDTO | null>(null);
  const [bulkArchiveOpen, setBulkArchiveOpen] = useState(false);
  const [exportCalendarOpen, setExportCalendarOpen] = useState(false);
  const [exportInitialMonth, setExportInitialMonth] = useState<
    { year: number; month: number } | undefined
  >(undefined);
  const [presentationOpen, setPresentationOpen] = useState(false);

  // Restore last view per user when URL does not specify ?view=
  const hasRestoredViewRef = useRef(false);
  useEffect(() => {
    if (hasRestoredViewRef.current) return;
    hasRestoredViewRef.current = true;
    if (urlView || typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem(
        `${LAST_VIEW_STORAGE_KEY_PREFIX}${currentUserId}`,
      );
      const parsed = parseViewMode(saved);
      if (parsed) setView(parsed);
    } catch {
      // Ignore storage failures
    }
  }, [currentUserId, urlView]);

  // Persist view choice per user
  function handleViewChange(nextView: ProjectCenterView) {
    setView(nextView);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(
          `${LAST_VIEW_STORAGE_KEY_PREFIX}${currentUserId}`,
          nextView,
        );
      } catch {
        // Ignore storage failures
      }
    }
  }

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchInput);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Keep URL query string synchronized so refresh and sharing preserve state
  const currentSearchString = searchParams.toString();
  useEffect(() => {
    const params = new URLSearchParams();
    if (activeTab !== "UPCOMING") params.set("tab", activeTab.toLowerCase());
    if (view !== "LIST") params.set("view", view.toLowerCase());
    if (rotaryYear !== fallbackRotaryYear) params.set("ry", rotaryYear);
    if (kind !== "ALL") params.set("kind", kind);
    if (assignedToMe) params.set("assigned", "1");
    if (priorityFilter !== "ALL")
      params.set("priority", priorityFilter.toLowerCase());
    if (sortBy !== "SCHEDULE") params.set("sort", sortBy.toLowerCase());
    if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());

    const nextQs = params.toString();
    if (nextQs !== currentSearchString) {
      router.replace(nextQs ? `/project-center?${nextQs}` : "/project-center", {
        scroll: false,
      });
    }
  }, [
    activeTab,
    assignedToMe,
    currentSearchString,
    debouncedQuery,
    fallbackRotaryYear,
    kind,
    priorityFilter,
    rotaryYear,
    router,
    sortBy,
    view,
  ]);

  const availableRotaryYears = useMemo(() => {
    const years = new Set<string>();
    for (const a of activities) {
      if (a.rotaryYear) years.add(a.rotaryYear);
    }
    return Array.from(years).sort().reverse();
  }, [activities]);

  // Pre-index activities where the current user has an assigned task
  const assignedTaskProjectIds = useMemo(() => {
    const set = new Set<string>();
    const normalizedName = currentUserName.trim().toLowerCase();
    for (const task of initialTasks) {
      if (!task.projectId) continue;
      const matched =
        task.assignedMemberIds.includes(currentUserId) ||
        (normalizedName &&
          task.assignedMemberNames.some(
            (name) => name.trim().toLowerCase() === normalizedName,
          ));
      if (matched) set.add(task.projectId);
    }
    return set;
  }, [currentUserId, currentUserName, initialTasks]);

  // Apply global RY + toolbar filters across all non-cancelled activities
  const filteredPool = useMemo(() => {
    const text = debouncedQuery.trim().toLowerCase();
    const matched = activities.filter((activity) => {
      if (!activity.isArchived && activity.status === "CANCELLED") {
        return false;
      }
      if (rotaryYear !== "ALL" && activity.rotaryYear !== rotaryYear) {
        return false;
      }
      if (kind !== "ALL" && activity.kind !== kind) return false;
      if (priorityFilter !== "ALL" && activity.priority !== priorityFilter) {
        return false;
      }
      if (assignedToMe) {
        const assignment = getAssignmentInfo(
          activity,
          currentUserId,
          assignedTaskProjectIds,
        );
        if (!assignment.isAssignedToMe) return false;
      }
      if (!text) return true;
      return [
        activity.title,
        activity.shortDescription,
        activity.location,
        activity.ownerName,
      ].some((value) => value?.toLowerCase().includes(text));
    });

    return [...matched].sort((a, b) =>
      sortBy === "PRIORITY"
        ? compareByPriority(a, b)
        : a.startAt.localeCompare(b.startAt),
    );
  }, [
    activities,
    assignedTaskProjectIds,
    assignedToMe,
    currentUserId,
    debouncedQuery,
    kind,
    priorityFilter,
    rotaryYear,
    sortBy,
  ]);

  // Stage counts across filteredPool
  const stageCounts = useMemo(() => {
    const counts: Record<ProjectStageTab, number> = {
      UPCOMING: 0,
      MISSED: 0,
      ONGOING: 0,
      REPORT_DUE: 0,
      ACCOMPLISHED: 0,
      ARCHIVED: 0,
    };
    for (const item of filteredPool) {
      const stage = getProjectStageTab(item);
      if (stage) counts[stage] += 1;
    }
    return counts;
  }, [filteredPool]);

  const tabItems = useMemo(
    () =>
      filteredPool.filter((item) => getProjectStageTab(item) === activeTab),
    [activeTab, filteredPool],
  );

  // Finished items in active workspace (respecting selected RY) eligible for bulk archive
  const archivableFinishedIds = useMemo(
    () =>
      activities
        .filter(
          (a) =>
            !a.isArchived &&
            (rotaryYear === "ALL" || a.rotaryYear === rotaryYear) &&
            ["COMPLETED", "ACCOMPLISHED", "CANCELLED"].includes(a.status) &&
            (canManageClub || a.ownerId === currentUserId),
        )
        .map((a) => a.id),
    [activities, canManageClub, currentUserId, rotaryYear],
  );

  const hasActiveFilters =
    searchInput.trim().length > 0 ||
    kind !== "ALL" ||
    assignedToMe ||
    priorityFilter !== "ALL";

  function clearFilters() {
    setSearchInput("");
    setDebouncedQuery("");
    setKind("ALL");
    setAssignedToMe(false);
    setPriorityFilter("ALL");
    setSortBy("SCHEDULE");
  }

  function canManageActivity(activity: ActivitySummaryDTO) {
    return canManageClub || activity.ownerId === currentUserId;
  }

  function executeArchive(
    activity: ActivitySummaryDTO,
    nextArchived: boolean,
    allowUndoToast = true,
    reason?: string,
  ) {
    const cleanReason = nextArchived ? reason?.trim() || null : null;
    const nowIso = new Date().toISOString();
    setActivities((prev) =>
      prev.map((item) =>
        item.id === activity.id
          ? {
              ...item,
              isArchived: nextArchived,
              archivedAt: nextArchived ? nowIso : null,
              archivedReason: cleanReason,
            }
          : item,
      ),
    );

    startTransition(async () => {
      const result = cleanReason
        ? await archiveActivityAction(activity.id, nextArchived, cleanReason)
        : await archiveActivityAction(activity.id, nextArchived);
      if (!result.success) {
        setActivities((prev) =>
          prev.map((item) =>
            item.id === activity.id
              ? {
                  ...item,
                  isArchived: Boolean(activity.isArchived),
                  archivedAt: activity.archivedAt ?? null,
                  archivedReason: activity.archivedReason ?? null,
                }
              : item,
          ),
        );
        notifyToast({
          title: nextArchived ? "Archive failed" : "Restore failed",
          message: result.error,
          kind: "error",
        });
        return;
      }

      notifyToast({
        message: nextArchived
          ? `Archived "${activity.title}".`
          : `Restored "${activity.title}".`,
        kind: "success",
        ...(nextArchived && allowUndoToast
          ? {
              actionLabel: "Undo",
              onAction: () => executeArchive(activity, false, false),
            }
          : {}),
      });
      router.refresh();
    });
  }

  function executeBulkArchive(reason?: string) {
    if (archivableFinishedIds.length === 0) return;
    const cleanReason = reason?.trim() || null;
    const targetIds = [...archivableFinishedIds];
    const targetSet = new Set(targetIds);
    const nowIso = new Date().toISOString();

    setBulkArchiveOpen(false);
    setActivities((prev) =>
      prev.map((item) =>
        targetSet.has(item.id)
          ? {
              ...item,
              isArchived: true,
              archivedAt: nowIso,
              archivedReason: cleanReason,
            }
          : item,
      ),
    );

    startTransition(async () => {
      const result = cleanReason
        ? await bulkArchiveActivitiesAction(targetIds, cleanReason)
        : await bulkArchiveActivitiesAction(targetIds);
      if (!result.success) {
        setActivities(initialActivities);
        notifyToast({
          title: "Bulk archive failed",
          message: result.error,
          kind: "error",
        });
        return;
      }
      notifyToast({
        message: `Archived ${result.count} finished ${
          result.count === 1 ? "activity" : "activities"
        }.`,
        kind: "success",
      });
      router.refresh();
    });
  }

  return (
    <main className="space-y-5 pb-12">
      <ProjectCenterHeader
        rotaryYear={rotaryYear}
        availableRotaryYears={availableRotaryYears}
        currentRotaryYear={fallbackRotaryYear}
        onRotaryYearChange={setRotaryYear}
        canCreate={canCreate}
        onOpenExportCalendar={() => {
          setExportInitialMonth(undefined);
          setExportCalendarOpen(true);
        }}
        onOpenPresentation={() => setPresentationOpen(true)}
      />

      <StageTabs
        activeTab={activeTab}
        counts={stageCounts}
        onTabChange={setActiveTab}
        guideOpen={guideOpen}
        onOpenGuide={() => setGuideOpen(true)}
        onCloseGuide={() => setGuideOpen(false)}
      />

      <ProjectToolbar
        searchInput={searchInput}
        onSearchInputChange={setSearchInput}
        kind={kind}
        onKindChange={setKind}
        assignedToMe={assignedToMe}
        onAssignedToMeToggle={() => setAssignedToMe((prev) => !prev)}
        priority={priorityFilter}
        onPriorityChange={setPriorityFilter}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        view={view}
        onViewChange={handleViewChange}
      />

      {/* Contextual Header Bars for Accomplished & Archived Tabs */}
      {activeTab === "ACCOMPLISHED" &&
        canManageClub &&
        archivableFinishedIds.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-300/70 bg-emerald-50/75 px-4 py-3 text-xs dark:border-emerald-500/30 dark:bg-emerald-950/35">
            <span className="font-medium text-emerald-900 dark:text-emerald-200">
              Finished projects with a published report. Ready to clean up past
              items?
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={() => setBulkArchiveOpen(true)}
              className="inline-flex min-h-[44px] cursor-pointer items-center rounded-xl border border-emerald-300 bg-white px-3.5 py-2 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-100/70 disabled:opacity-50 dark:border-emerald-500/40 dark:bg-[#161B26] dark:text-emerald-200 dark:hover:bg-emerald-900/40"
            >
              Archive {archivableFinishedIds.length} finished
            </button>
          </div>
        )}

      {activeTab === "ARCHIVED" && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#EDEDF2] bg-slate-50 px-4 py-3 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
          <Archive className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Archived projects and activities are preserved read-only for
            District reporting and audit trails. Use the{" "}
            <strong>&hellip;</strong> menu on any item to restore it.
          </span>
        </div>
      )}

      {/* Main Content Area: List | Board | Calendar */}
      {view === "CALENDAR" ? (
        <ActivityCalendar
          activities={filteredPool.filter((a) => !a.isArchived)}
          tasks={initialTasks}
          onExportMonth={(year, month) => {
            setExportInitialMonth({ year, month });
            setExportCalendarOpen(true);
          }}
        />
      ) : view === "BOARD" ? (
        <div className="grid gap-4 xl:grid-cols-4">
          {(
            [
              ["UPCOMING", "Upcoming & Missed", "Draft, Planned & Overdue"],
              ["ONGOING", "Ongoing", "Active execution"],
              ["REPORT_DUE", "Report due", "Needs accomplishment report"],
              ["ACCOMPLISHED", "Accomplished", "Verified & completed"],
            ] as [ProjectStageTab, string, string][]
          ).map(([stageKey, stageLabel, subtitle]) => {
            const rows = filteredPool.filter((item) => {
              if (item.isArchived) return false;
              const stage = getProjectStageTab(item);
              if (stageKey === "UPCOMING") {
                return stage === "UPCOMING" || stage === "MISSED";
              }
              return stage === stageKey;
            });
            const sampleStatus =
              stageKey === "UPCOMING"
                ? "PLANNED"
                : stageKey === "ONGOING"
                  ? "ONGOING"
                  : stageKey === "REPORT_DUE"
                    ? "AWAITING_REPORT"
                    : "ACCOMPLISHED";
            return (
              <section
                key={stageKey}
                aria-label={stageLabel}
                className="min-w-0 rounded-xl border border-[#EDEDF2] bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/50"
              >
                <header className="mb-2.5 border-b border-slate-200/70 px-1 pb-2 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-2">
                    <StatusPill status={sampleStatus} />
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {rows.length}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
                    {subtitle}
                  </p>
                </header>
                <div className="space-y-2.5">
                  {rows.map((activity) => (
                    <ActivityCard
                      key={activity.id}
                      activity={activity}
                      layout="board"
                      canManage={canManageActivity(activity)}
                      onToggleArchive={(item) => setArchiveCandidate(item)}
                    />
                  ))}
                  {rows.length === 0 && (
                    <p className="px-2 py-6 text-center text-xs text-slate-600 dark:text-slate-400">
                      No items in {stageLabel}
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <ProjectList
          activeTab={activeTab}
          items={tabItems}
          totalInWorkspace={activities.filter((a) => !a.isArchived).length}
          hasActiveFilters={hasActiveFilters}
          sortBy={sortBy}
          currentUserId={currentUserId}
          assignedTaskProjectIds={assignedTaskProjectIds}
          canCreate={canCreate}
          canManageActivity={canManageActivity}
          pending={pending}
          draftReadinessDays={draftReadinessDays}
          onClearFilters={clearFilters}
          onSwitchTab={setActiveTab}
          onOpenGuide={() => setGuideOpen(true)}
          onRequestArchive={(item) => setArchiveCandidate(item)}
          onRestore={(item) => executeArchive(item, false, false)}
        />
      )}

      {/* Single Archive Confirmation Dialog */}
      <ArchiveReasonModal
        key={archiveCandidate?.id ?? "single-closed"}
        isOpen={Boolean(archiveCandidate)}
        onClose={() => setArchiveCandidate(null)}
        pending={pending}
        title={
          archiveCandidate
            ? `Archive this ${isProjectKind(archiveCandidate.kind) ? "project" : "activity"}?`
            : "Archive activity?"
        }
        description={
          archiveCandidate ? (
            <>
              &ldquo;{archiveCandidate.title}&rdquo; will move out of your active
              Project Center workspace. All records and reports stay preserved
              and can be restored anytime.
            </>
          ) : null
        }
        confirmLabel="Archive"
        onConfirm={(reason) => {
          if (!archiveCandidate) return;
          const target = archiveCandidate;
          setArchiveCandidate(null);
          executeArchive(target, true, true, reason);
        }}
      />

      {/* Bulk Archive Confirmation Dialog */}
      <ArchiveReasonModal
        key={bulkArchiveOpen ? "bulk-open" : "bulk-closed"}
        isOpen={bulkArchiveOpen}
        onClose={() => setBulkArchiveOpen(false)}
        pending={pending}
        title={`Archive ${archivableFinishedIds.length} finished ${
          archivableFinishedIds.length === 1 ? "item" : "items"
        }?`}
        description={
          <>
            This will archive{" "}
            <strong>{archivableFinishedIds.length}</strong> finished{" "}
            {archivableFinishedIds.length === 1 ? "activity" : "activities"}{" "}
            (Accomplished, Completed, or Cancelled) in the selected Rotary Year.
            Records remain read-only and restorable.
          </>
        }
        confirmLabel={`Archive ${archivableFinishedIds.length} finished`}
        presets={[
          "Completed & reported",
          "End of term cleanup",
          "Postponed / rescheduled",
        ]}
        onConfirm={(reason) => executeBulkArchive(reason)}
      />

      <ExportCalendarModal
        isOpen={exportCalendarOpen}
        onClose={() => setExportCalendarOpen(false)}
        activities={activities}
        tasks={initialTasks}
        rotaryYear={rotaryYear}
        kindFilter={kind}
        canManageClub={canManageClub}
        initialYear={exportInitialMonth?.year}
        initialMonth={exportInitialMonth?.month}
      />

      <PresentationBuilderModal
        isOpen={presentationOpen}
        onClose={() => setPresentationOpen(false)}
        activities={activities}
        rotaryYear={rotaryYear}
        canManageClub={canManageClub}
      />
    </main>
  );
}
