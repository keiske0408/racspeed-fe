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
import { AccomplishedBar } from "./_components/accomplished-bar";
import { StatusPill } from "./_components/status-pill";
import { ProjectRow } from "./_components/project-row";
import {
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

type WorkspaceScope = "ACTIVE" | "ARCHIVED";

function parseStageTab(raw: string | null): ProjectStageTab {
  switch (raw?.toUpperCase()) {
    case "ONGOING":
      return "ONGOING";
    case "REPORT_DUE":
    case "AWAITING_REPORT":
      return "REPORT_DUE";
    case "ACCOMPLISHED":
    case "FINISHED":
      return "ACCOMPLISHED";
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
}: {
  initialActivities: ActivitySummaryDTO[];
  initialTasks: GroupTaskDTO[];
  canCreate: boolean;
  canManageClub?: boolean;
  currentUserId: string;
  currentUserName: string;
  defaultRotaryYear?: string;
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
  const [scope, setScope] = useState<WorkspaceScope>(
    searchParams.get("scope")?.toUpperCase() === "ARCHIVED"
      ? "ARCHIVED"
      : "ACTIVE",
  );
  const [activeTab, setActiveTab] = useState<ProjectStageTab>(
    parseStageTab(searchParams.get("tab") || searchParams.get("status")),
  );
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
    if (scope === "ARCHIVED") params.set("scope", "archived");
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
    scope,
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

  const activeActivities = useMemo(
    () =>
      activities.filter((a) => !a.isArchived && a.status !== "CANCELLED"),
    [activities],
  );
  const archivedActivities = useMemo(
    () => activities.filter((a) => Boolean(a.isArchived)),
    [activities],
  );

  // Apply global RY + toolbar filters (before splitting by StageTab)
  const filteredPool = useMemo(() => {
    const base = scope === "ARCHIVED" ? archivedActivities : activeActivities;
    const text = debouncedQuery.trim().toLowerCase();
    const matched = base.filter((activity) => {
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
    activeActivities,
    archivedActivities,
    assignedTaskProjectIds,
    assignedToMe,
    currentUserId,
    debouncedQuery,
    kind,
    priorityFilter,
    rotaryYear,
    scope,
    sortBy,
  ]);

  // Stage counts across filteredPool (for Active workspace tabs)
  const stageCounts = useMemo(() => {
    const counts: Record<ProjectStageTab, number> = {
      UPCOMING: 0,
      ONGOING: 0,
      REPORT_DUE: 0,
      ACCOMPLISHED: 0,
    };
    const activeMatchingFilters = activeActivities.filter((activity) => {
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
      const text = debouncedQuery.trim().toLowerCase();
      if (!text) return true;
      return [
        activity.title,
        activity.shortDescription,
        activity.location,
        activity.ownerName,
      ].some((value) => value?.toLowerCase().includes(text));
    });

    for (const item of activeMatchingFilters) {
      const stage = getProjectStageTab(item.status);
      if (stage) counts[stage] += 1;
    }
    return counts;
  }, [
    activeActivities,
    assignedTaskProjectIds,
    assignedToMe,
    currentUserId,
    debouncedQuery,
    kind,
    priorityFilter,
    rotaryYear,
  ]);

  const tabItems = useMemo(() => {
    if (scope === "ARCHIVED") return filteredPool;
    return filteredPool.filter(
      (item) => getProjectStageTab(item.status) === activeTab,
    );
  }, [activeTab, filteredPool, scope]);

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
  ) {
    const nowIso = new Date().toISOString();
    setActivities((prev) =>
      prev.map((item) =>
        item.id === activity.id
          ? {
              ...item,
              isArchived: nextArchived,
              archivedAt: nextArchived ? nowIso : null,
            }
          : item,
      ),
    );

    startTransition(async () => {
      const result = await archiveActivityAction(activity.id, nextArchived);
      if (!result.success) {
        setActivities((prev) =>
          prev.map((item) =>
            item.id === activity.id
              ? {
                  ...item,
                  isArchived: Boolean(activity.isArchived),
                  archivedAt: activity.archivedAt ?? null,
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

  function executeBulkArchive() {
    if (archivableFinishedIds.length === 0) return;
    const targetIds = [...archivableFinishedIds];
    const targetSet = new Set(targetIds);
    const nowIso = new Date().toISOString();

    setBulkArchiveOpen(false);
    setActivities((prev) =>
      prev.map((item) =>
        targetSet.has(item.id)
          ? { ...item, isArchived: true, archivedAt: nowIso }
          : item,
      ),
    );

    startTransition(async () => {
      const result = await bulkArchiveActivitiesAction(targetIds);
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
      />

      {scope === "ACTIVE" ? (
        <StageTabs
          activeTab={activeTab}
          counts={stageCounts}
          onTabChange={setActiveTab}
          guideOpen={guideOpen}
          onOpenGuide={() => setGuideOpen(true)}
          onCloseGuide={() => setGuideOpen(false)}
        />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#EDEDF2] bg-slate-50 px-4 py-3 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
          <div className="flex items-center gap-2">
            <Archive className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              <strong>Archive:</strong> Viewing archived activities and past
              reports ({archivedActivities.length} total).
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setScope("ACTIVE");
              setActiveTab("UPCOMING");
            }}
            className="min-h-[44px] cursor-pointer font-semibold text-[#0D3594] hover:underline dark:text-blue-300"
          >
            Back to active workspace
          </button>
        </div>
      )}

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

      {/* Main Content Area: List | Board | Calendar */}
      {scope === "ARCHIVED" ? (
        tabItems.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-[#EDEDF2] bg-white dark:border-slate-800 dark:bg-[#161B26]">
            {tabItems.map((activity) => (
              <ProjectRow
                key={activity.id}
                activity={activity}
                currentUserId={currentUserId}
                assignedTaskProjectIds={assignedTaskProjectIds}
                canManage={canManageActivity(activity)}
                pending={pending}
                onRequestArchive={(item) => setArchiveCandidate(item)}
                onRestore={(item) => executeArchive(item, false, false)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-[#EDEDF2] bg-white px-6 py-12 text-center dark:border-slate-800 dark:bg-[#161B26]">
            <p className="text-sm font-semibold text-[#111625] dark:text-white">
              No archived activities match this view.
            </p>
            <button
              type="button"
              onClick={() => {
                clearFilters();
                setScope("ACTIVE");
              }}
              className="mt-4 inline-flex min-h-[44px] cursor-pointer items-center rounded-xl border border-[#DDE1EA] px-4 py-2 text-xs font-semibold text-[#111625] hover:bg-slate-50 dark:border-slate-700 dark:text-white dark:hover:bg-slate-800"
            >
              Back to active workspace
            </button>
          </div>
        )
      ) : view === "CALENDAR" ? (
        <ActivityCalendar activities={filteredPool} tasks={initialTasks} />
      ) : view === "BOARD" ? (
        <div className="grid gap-4 xl:grid-cols-4">
          {(
            [
              ["UPCOMING", "Upcoming", "Draft & Planned"],
              ["ONGOING", "Ongoing", "Active execution"],
              ["REPORT_DUE", "Report due", "Needs accomplishment report"],
              ["ACCOMPLISHED", "Accomplished", "Verified & completed"],
            ] as [ProjectStageTab, string, string][]
          ).map(([stageKey, stageLabel, subtitle]) => {
            const rows = filteredPool.filter(
              (item) => getProjectStageTab(item.status) === stageKey,
            );
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
          totalInWorkspace={activeActivities.length}
          hasActiveFilters={hasActiveFilters}
          sortBy={sortBy}
          currentUserId={currentUserId}
          assignedTaskProjectIds={assignedTaskProjectIds}
          canCreate={canCreate}
          canManageActivity={canManageActivity}
          pending={pending}
          onClearFilters={clearFilters}
          onSwitchTab={setActiveTab}
          onOpenGuide={() => setGuideOpen(true)}
          onRequestArchive={(item) => setArchiveCandidate(item)}
          onRestore={(item) => executeArchive(item, false, false)}
        />
      )}

      {/* Bottom Collapsed Accomplished Bar */}
      {scope === "ACTIVE" && (
        <AccomplishedBar
          accomplishedCount={stageCounts.ACCOMPLISHED}
          archivableCount={archivableFinishedIds.length}
          archivedCount={archivedActivities.length}
          canManageClub={canManageClub}
          pending={pending}
          onViewAccomplished={() => {
            setView("LIST");
            setActiveTab("ACCOMPLISHED");
          }}
          onRequestBulkArchive={() => setBulkArchiveOpen(true)}
          onViewArchived={() => {
            setView("LIST");
            setScope("ARCHIVED");
          }}
        />
      )}

      {/* Single Archive Confirmation Dialog */}
      {archiveCandidate && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="archive-confirm-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4"
          onClick={() => setArchiveCandidate(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[#EDEDF2] bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-[#161B26]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="archive-confirm-title"
              className="text-base font-bold text-[#111625] dark:text-white"
            >
              Archive this{" "}
              {isProjectKind(archiveCandidate.kind) ? "project" : "activity"}?
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              &ldquo;{archiveCandidate.title}&rdquo; will move out of your active
              Project Center workspace. All records and reports stay preserved
              and can be restored anytime.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setArchiveCandidate(null)}
                className="min-h-[44px] cursor-pointer rounded-xl border border-[#DDE1EA] px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  const target = archiveCandidate;
                  setArchiveCandidate(null);
                  executeArchive(target, true, true);
                }}
                className="min-h-[44px] cursor-pointer rounded-xl bg-[#0D3594] px-4 py-2 text-xs font-semibold text-white hover:bg-[#092569] disabled:opacity-50"
              >
                Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Archive Confirmation Dialog */}
      {bulkArchiveOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-archive-confirm-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4"
          onClick={() => setBulkArchiveOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[#EDEDF2] bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-[#161B26]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="bulk-archive-confirm-title"
              className="text-base font-bold text-[#111625] dark:text-white"
            >
              Archive {archivableFinishedIds.length} finished{" "}
              {archivableFinishedIds.length === 1 ? "item" : "items"}?
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              This will archive{" "}
              <strong>{archivableFinishedIds.length}</strong> finished{" "}
              {archivableFinishedIds.length === 1 ? "activity" : "activities"}{" "}
              (Accomplished, Completed, or Cancelled) in the selected Rotary Year.
              Records remain read-only and restorable.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setBulkArchiveOpen(false)}
                className="min-h-[44px] cursor-pointer rounded-xl border border-[#DDE1EA] px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={executeBulkArchive}
                className="min-h-[44px] cursor-pointer rounded-xl bg-[#0D3594] px-4 py-2 text-xs font-semibold text-white hover:bg-[#092569] disabled:opacity-50"
              >
                Archive {archivableFinishedIds.length} finished
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
