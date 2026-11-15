"use client";

import React, { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  ClipboardCheck,
  FileCheck2,
  FolderArchive,
  Images,
  LayoutGrid,
  List,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from "lucide-react";
import { ActivityCalendar } from "./_components/activity-calendar";
import { ActivityMoments } from "./_components/activity-moments";
import { ActivityCard, formatActivityWhen } from "./_components/activity-card";
import { ActivityStatusBadge, KindBadge } from "./_components/badges";
import { CompactLifecycleIndicator } from "./_components/project-lifecycle-guide";
import {
  ACTIVITY_KINDS,
  ACTIVITY_KIND_META,
  ACTIVITY_STATUSES,
  ACTIVITY_STATUS_LABELS,
  isProjectKind,
  type ActivityStatus,
  type ActivitySummaryDTO,
} from "@/features/activities/types";
import {
  archiveActivityAction,
  bulkArchiveActivitiesAction,
  hardDeleteActivityAction,
} from "@/features/activities/actions";
import { updateTaskStatusAction } from "@/features/tasks/actions";
import type { GroupTaskDTO, TaskStatus } from "@/lib/data/tasks-types";
import { formatManilaDate } from "@/lib/utils/dates";
import { notifyToast } from "@/components/shared/toast-viewport";

type ViewMode = "LIST" | "BOARD" | "CALENDAR" | "TASKS" | "MOMENTS";
type WorkspaceScope = "ACTIVE" | "ARCHIVED";

export function ProjectCenterClient({
  initialActivities,
  initialTasks,
  canCreate,
  canManageClub = false,
  currentUserId,
  currentUserName,
}: {
  initialActivities: ActivitySummaryDTO[];
  initialTasks: GroupTaskDTO[];
  canCreate: boolean;
  canManageClub?: boolean;
  currentUserId: string;
  currentUserName: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  // Optimistic / local state for immediate archive/restore feedback
  const [activities, setActivities] =
    useState<ActivitySummaryDTO[]>(initialActivities);
  const [tasksList, setTasksList] = useState<GroupTaskDTO[]>(initialTasks);

  React.useEffect(() => {
    setActivities(initialActivities);
  }, [initialActivities]);

  React.useEffect(() => {
    setTasksList(initialTasks);
  }, [initialTasks]);

  const initialScopeParam = searchParams.get("scope")?.toUpperCase();
  const [scope, setScope] = useState<WorkspaceScope>(
    initialScopeParam === "ARCHIVED" ||
      searchParams.get("status") === "ARCHIVED"
      ? "ARCHIVED"
      : "ACTIVE",
  );

  const [view, setView] = useState<ViewMode>(
    searchParams.get("view") === "moments"
      ? "MOMENTS"
      : searchParams.get("view") === "tasks"
        ? "TASKS"
        : searchParams.get("view") === "calendar"
          ? "CALENDAR"
          : "LIST",
  );
  const [kind, setKind] = useState(searchParams.get("kind") || "ALL");
  const [status, setStatus] = useState(
    searchParams.get("status") && searchParams.get("status") !== "ARCHIVED"
      ? searchParams.get("status")!
      : searchParams.get("view") === "moments"
        ? "ALL"
        : "ACTIVE",
  );
  const [rotaryYear, setRotaryYear] = useState("ALL");
  const [query, setQuery] = useState("");

  const availableRotaryYears = useMemo(() => {
    const years = new Set<string>();
    for (const a of activities) {
      if (a.rotaryYear) years.add(a.rotaryYear);
    }
    return Array.from(years).sort().reverse();
  }, [activities]);

  const activeActivities = useMemo(
    () => activities.filter((a) => !a.isArchived),
    [activities],
  );
  const archivedActivities = useMemo(
    () => activities.filter((a) => Boolean(a.isArchived)),
    [activities],
  );

  // Past finished activities that are still in Active workspace and can be bulk-archived
  const archivableFinishedIds = useMemo(
    () =>
      activeActivities
        .filter(
          (a) =>
            ["COMPLETED", "ACCOMPLISHED", "CANCELLED"].includes(a.status) &&
            (canManageClub || a.ownerId === currentUserId),
        )
        .map((a) => a.id),
    [activeActivities, canManageClub, currentUserId],
  );

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    const pool = scope === "ARCHIVED" ? archivedActivities : activeActivities;
    return pool.filter((activity) => {
      if (kind !== "ALL" && activity.kind !== kind) return false;
      if (rotaryYear !== "ALL" && activity.rotaryYear !== rotaryYear)
        return false;
      if (scope === "ACTIVE") {
        if (status === "ACTIVE" && activity.status === "CANCELLED") {
          return false;
        }
        if (
          status === "FINISHED" &&
          !["COMPLETED", "ACCOMPLISHED"].includes(activity.status)
        ) {
          return false;
        }
        if (
          status !== "ALL" &&
          status !== "ACTIVE" &&
          status !== "FINISHED" &&
          activity.status !== status
        )
          return false;
      } else {
        if (
          status === "FINISHED" &&
          !["COMPLETED", "ACCOMPLISHED"].includes(activity.status)
        ) {
          return false;
        }
        if (
          status !== "ALL" &&
          status !== "ACTIVE" &&
          status !== "FINISHED" &&
          activity.status !== status
        )
          return false;
      }
      if (!text) return true;
      return [
        activity.title,
        activity.shortDescription,
        activity.location,
        activity.ownerName,
      ].some((value) => value?.toLowerCase().includes(text));
    });
  }, [
    activeActivities,
    archivedActivities,
    kind,
    query,
    rotaryYear,
    scope,
    status,
  ]);

  function canManageActivity(activity: ActivitySummaryDTO) {
    return canManageClub || activity.ownerId === currentUserId;
  }

  function handleToggleArchive(activity: ActivitySummaryDTO) {
    const nextArchived = !activity.isArchived;
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
        // Revert optimistic update
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
          title: "Archive failed",
          message: result.error,
          kind: "error",
        });
        return;
      }
      notifyToast({
        message:
          result.message ||
          (nextArchived ? "Moved to archive." : "Restored to active workspace."),
        kind: "success",
      });
      router.refresh();
    });
  }

  function handleBulkArchiveFinished() {
    if (archivableFinishedIds.length === 0) return;
    const nowIso = new Date().toISOString();
    const targetSet = new Set(archivableFinishedIds);

    setActivities((prev) =>
      prev.map((item) =>
        targetSet.has(item.id)
          ? { ...item, isArchived: true, archivedAt: nowIso }
          : item,
      ),
    );

    startTransition(async () => {
      const result = await bulkArchiveActivitiesAction(archivableFinishedIds);
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
        message:
          result.message ||
          `Archived ${result.count} finished ${result.count === 1 ? "activity" : "activities"}.`,
        kind: "success",
      });
      router.refresh();
    });
  }

  function handleHardDelete(activity: ActivitySummaryDTO) {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Permanently delete "${activity.title}"? This cannot be undone and will remove all linked records and media.`,
      )
    ) {
      return;
    }

    const previousActivities = activities;
    setActivities((prev) => prev.filter((item) => item.id !== activity.id));

    startTransition(async () => {
      const result = await hardDeleteActivityAction(activity.id);
      if (!result.success) {
        setActivities(previousActivities);
        notifyToast({
          title: "Delete failed",
          message: result.error,
          kind: "error",
        });
        return;
      }
      notifyToast({
        message: result.message || `"${activity.title}" permanently deleted.`,
        kind: "success",
      });
      router.refresh();
    });
  }

  const activeWorkspaceActivities = activeActivities.filter(
    (a) => a.status !== "CANCELLED",
  );
  const serviceProjectCount = activeWorkspaceActivities.filter((a) =>
    ["SERVICE_PROJECT", "JOINT_PROJECT"].includes(a.kind),
  ).length;
  const ongoingActiveCount = activeActivities.filter(
    (a) => a.status === "ONGOING",
  ).length;
  const plannedActiveCount = activeActivities.filter(
    (a) => a.status === "PLANNED",
  ).length;
  const awaitingReports = activeActivities.filter(
    (a) => a.status === "AWAITING_REPORT",
  ).length;
  const finishedActiveCount = activeActivities.filter((a) =>
    ["COMPLETED", "ACCOMPLISHED"].includes(a.status),
  ).length;
  const projectsNeedingReport = activeActivities.filter(
    (a) =>
      isProjectKind(a.kind) &&
      ["ONGOING", "AWAITING_REPORT"].includes(a.status),
  );
  const planned = filtered.filter((a) => a.status === "PLANNED");
  const ongoing = filtered.filter((a) => a.status === "ONGOING");
  const reporting = filtered.filter((a) => a.status === "AWAITING_REPORT");
  const accomplished = filtered.filter((a) =>
    ["COMPLETED", "ACCOMPLISHED"].includes(a.status),
  );
  const myTasks = tasksList.filter(
    (task) =>
      task.assignedMemberIds.includes(currentUserId) ||
      task.assignedMemberNames.some(
        (name) => name.toLowerCase() === currentUserName.toLowerCase(),
      ) ||
      task.createdBy.toLowerCase() === currentUserName.toLowerCase(),
  );

  function handleAdvanceMyTask(task: GroupTaskDTO, nextStatus: TaskStatus) {
    setTasksList((prev) =>
      prev.map((item) =>
        item.id === task.id ? { ...item, status: nextStatus } : item,
      ),
    );
    startTransition(async () => {
      const res = await updateTaskStatusAction(task.id, nextStatus);
      if (!res.success) {
        setTasksList(initialTasks);
        notifyToast({
          title: "Could not update task",
          message: res.error || "Failed to update task status.",
          kind: "error",
        });
        return;
      }
      notifyToast({
        message: res.message || "Task updated.",
        kind: "success",
      });
      router.refresh();
    });
  }

  return (
    <main className="space-y-5 pb-10">
      <header className="flex flex-col gap-4 border-b border-[#EDEDF2] dark:border-slate-800 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <CalendarDays className="h-3.5 w-3.5" /> Club operations &amp; project lifecycle
          </div>
          <h1 className="mt-1 text-2xl font-bold text-[#111625] dark:text-white">
            Project Center
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Plan club activities, track live execution, and publish service projects as accomplished.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {scope === "ACTIVE" && archivableFinishedIds.length > 0 && (
            <button
              type="button"
              disabled={pending}
              onClick={handleBulkArchiveFinished}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-[#161B26] dark:text-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Move all completed, accomplished, and cancelled activities to the archive"
            >
              <FolderArchive className="h-3.5 w-3.5 text-slate-500" />
              Archive {archivableFinishedIds.length} Finished
            </button>
          )}
          {canCreate && (
            <Link
              href="/project-center/new"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0D3594] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#092569] shadow-xs transition"
            >
              <Plus className="h-4 w-4" /> New activity
            </Link>
          )}
        </div>
      </header>

      {/* Interactive 5-Stage Lifecycle Pipeline Filter Cards */}
      <section
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
        aria-label="Project Center lifecycle pipeline"
      >
        <SummaryMetric
          label="All Active"
          stepBadge={`${serviceProjectCount} projects`}
          value={activeWorkspaceActivities.length}
          detail={`${tasksList.filter((t) => t.status !== "COMPLETED").length} open tasks`}
          active={scope === "ACTIVE" && status === "ACTIVE"}
          onClick={() => {
            setScope("ACTIVE");
            setStatus("ACTIVE");
          }}
        />
        <SummaryMetric
          label="1. Planned"
          stepBadge="Step 1"
          value={plannedActiveCount}
          detail="Schedule & RSVPs"
          tone="blue"
          active={scope === "ACTIVE" && status === "PLANNED"}
          onClick={() => {
            setScope("ACTIVE");
            setStatus("PLANNED");
          }}
        />
        <SummaryMetric
          label="2. Ongoing"
          stepBadge="Step 2"
          value={ongoingActiveCount}
          detail="Live execution & photos"
          tone="amber"
          active={scope === "ACTIVE" && status === "ONGOING"}
          onClick={() => {
            setScope("ACTIVE");
            setStatus("ONGOING");
          }}
        />
        <SummaryMetric
          label="3. Awaiting Report"
          stepBadge="Step 3"
          value={awaitingReports}
          detail="Ready to publish report"
          tone={awaitingReports > 0 ? "orange" : "default"}
          active={scope === "ACTIVE" && status === "AWAITING_REPORT"}
          onClick={() => {
            setScope("ACTIVE");
            setStatus("AWAITING_REPORT");
          }}
        />
        <SummaryMetric
          label="4. Accomplished"
          stepBadge="Step 4"
          value={finishedActiveCount}
          detail={`${archivedActivities.length} in archive`}
          tone="emerald"
          active={scope === "ACTIVE" && status === "FINISHED"}
          onClick={() => {
            setScope("ACTIVE");
            setStatus("FINISHED");
          }}
        />
      </section>

      {/* Guided Completion Flow & Action Spotlight */}
      {scope === "ACTIVE" && (
        <section
          aria-label="How to complete a service project"
          className="rounded-2xl border border-[#E4E7EF] bg-gradient-to-r from-slate-50/90 via-white to-emerald-50/40 p-4 dark:border-slate-800 dark:from-[#161B26] dark:via-[#161B26] dark:to-emerald-950/15"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-[#0D3594]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#0D3594] dark:bg-blue-500/15 dark:text-blue-300">
                  <Sparkles className="h-3 w-3" /> Project Completion Guide
                </span>
                <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  <span>1. Planned</span>
                  <ArrowRight className="h-3 w-3 text-slate-400" />
                  <span>2. Ongoing</span>
                  <ArrowRight className="h-3 w-3 text-slate-400" />
                  <span>3. Awaiting Report</span>
                  <ArrowRight className="h-3 w-3 text-slate-400" />
                  <span className="text-emerald-700 dark:text-emerald-300 font-bold">
                    4. Accomplished (Publish Report)
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                To mark a service project as finished, open its{" "}
                <strong>Report</strong> tab, attach at least 1 photo, complete
                the 6 Rotary Showcase fields, and click{" "}
                <strong>Publish as accomplished</strong>.
              </p>
            </div>
            {projectsNeedingReport.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {projectsNeedingReport.slice(0, 2).map((proj) => (
                  <Link
                    key={proj.id}
                    href={`/project-center/${proj.id}?tab=REPORT`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#0D3594] px-3 py-2 text-xs font-bold text-white shadow-2xs hover:bg-[#092569] transition"
                  >
                    <FileCheck2 className="h-3.5 w-3.5" />
                    <span className="max-w-[180px] truncate">
                      Complete: {proj.title}
                    </span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                ))}
                {awaitingReports > 0 && status !== "AWAITING_REPORT" && (
                  <button
                    type="button"
                    onClick={() => setStatus("AWAITING_REPORT")}
                    className="inline-flex items-center gap-1 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200 cursor-pointer"
                  >
                    <ClipboardCheck className="h-3.5 w-3.5" />
                    {awaitingReports} Awaiting Report
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {scope === "ARCHIVED" && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-200 bg-slate-50/90 px-4 py-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
          <div className="flex items-center gap-2.5">
            <Archive className="h-4 w-4 text-slate-500 shrink-0" />
            <span>
              <strong className="text-slate-900 dark:text-white">
                Project Center Archive:
              </strong>{" "}
              Archived projects and activities are preserved read-only for District 3820 reporting, Rotary Showcase reference, and historical audit trails. You can restore any item back to the active workspace at any time.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setScope("ACTIVE");
              setStatus("ACTIVE");
            }}
            className="shrink-0 font-semibold text-[#0D3594] hover:underline dark:text-blue-400"
          >
            Back to Active Workspace
          </button>
        </div>
      )}

      <section className="space-y-4">
        <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {/* Active vs Archived Scope Switcher */}
            <div
              className="inline-flex rounded-lg border border-[#EDEDF2] bg-white p-0.5 dark:border-slate-700 dark:bg-[#161B26]"
              role="group"
              aria-label="Workspace scope"
            >
              <button
                type="button"
                onClick={() => {
                  setScope("ACTIVE");
                  setStatus("ACTIVE");
                }}
                aria-pressed={scope === "ACTIVE" && status !== "FINISHED"}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  scope === "ACTIVE" && status !== "FINISHED"
                    ? "bg-[#0D3594] text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                }`}
              >
                <span>Active</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                    scope === "ACTIVE" && status !== "FINISHED"
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                >
                  {
                    activeWorkspaceActivities.filter(
                      (a) =>
                        a.status !== "ACCOMPLISHED" && a.status !== "COMPLETED",
                    ).length
                  }
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setScope("ACTIVE");
                  setStatus("FINISHED");
                  if (view === "TASKS") setView("LIST");
                }}
                aria-pressed={scope === "ACTIVE" && status === "FINISHED"}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  scope === "ACTIVE" && status === "FINISHED"
                    ? "bg-emerald-600 text-white shadow-2xs"
                    : "text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Accomplished</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                    scope === "ACTIVE" && status === "FINISHED"
                      ? "bg-white/25 text-white"
                      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300"
                  }`}
                >
                  {accomplished.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setScope("ARCHIVED");
                  setStatus("ALL");
                  if (view === "TASKS") setView("LIST");
                }}
                aria-pressed={scope === "ARCHIVED"}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  scope === "ARCHIVED"
                    ? "bg-[#0D3594] text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                }`}
              >
                <Archive className="h-3.5 w-3.5" />
                <span>Archived</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                    scope === "ARCHIVED"
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                >
                  {archivedActivities.length}
                </span>
              </button>
            </div>

            <label htmlFor="activity-kind-filter" className="sr-only">
              Filter by activity type
            </label>
            <select
              id="activity-kind-filter"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="rounded-lg border border-[#EDEDF2] bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-[#161B26] dark:text-slate-200"
            >
              <option value="ALL">All activity types</option>
              {ACTIVITY_KINDS.map((k) => (
                <option key={k} value={k}>
                  {ACTIVITY_KIND_META[k].label}
                </option>
              ))}
            </select>

            <label htmlFor="activity-status-filter" className="sr-only">
              Filter by status
            </label>
            <select
              id="activity-status-filter"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-lg border border-[#EDEDF2] bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-[#161B26] dark:text-slate-200"
            >
              {scope === "ACTIVE" && (
                <option value="ACTIVE">Active & upcoming</option>
              )}
              <option value="ALL">
                {scope === "ARCHIVED" ? "All archived statuses" : "All statuses"}
              </option>
              <option value="FINISHED">Accomplished &amp; Completed</option>
              {ACTIVITY_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ACTIVITY_STATUS_LABELS[s]}
                </option>
              ))}
            </select>

            {availableRotaryYears.length > 0 && (
              <>
                <label htmlFor="activity-ry-filter" className="sr-only">
                  Filter by Rotary Year
                </label>
                <select
                  id="activity-ry-filter"
                  value={rotaryYear}
                  onChange={(e) => setRotaryYear(e.target.value)}
                  className="rounded-lg border border-[#EDEDF2] bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-[#161B26] dark:text-slate-200"
                >
                  <option value="ALL">All Rotary Years</option>
                  {availableRotaryYears.map((ry) => (
                    <option key={ry} value={ry}>
                      RY {ry}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="relative flex-1 sm:w-60">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <span className="sr-only">Search activities</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  scope === "ARCHIVED"
                    ? "Search archived projects..."
                    : "Search activities..."
                }
                className="w-full rounded-lg border border-[#EDEDF2] bg-white py-2 pl-9 pr-3 text-xs dark:border-slate-700 dark:bg-[#161B26] dark:text-white"
              />
            </label>
            <div
              className="inline-flex self-start rounded-lg border border-[#EDEDF2] bg-white p-0.5 dark:border-slate-700 dark:bg-[#161B26]"
              role="group"
              aria-label="Project Center view"
            >
              {(
                [
                  ["TASKS", CheckSquare, "My Work"],
                  ["LIST", List, "List"],
                  ["BOARD", LayoutGrid, "Board"],
                  ["CALENDAR", CalendarDays, "Calendar"],
                  ["MOMENTS", Images, "Moments"],
                ] as const
              ).map(([mode, Icon, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setView(mode);
                    if (mode === "MOMENTS" && status === "ACTIVE")
                      setStatus("ALL");
                  }}
                  aria-pressed={view === mode}
                  aria-label={label}
                  title={label}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold ${view === mode ? "bg-[#0D3594] text-white" : "text-slate-600 dark:text-slate-300"}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing {filtered.length} of{" "}
            {scope === "ARCHIVED"
              ? archivedActivities.length
              : activeActivities.length}{" "}
            {scope === "ARCHIVED" ? "archived" : "active"} activities
          </span>
        </div>

        {view === "MOMENTS" ? (
          <ActivityMoments activities={filtered} />
        ) : view === "TASKS" ? (
          myTasks.length ? (
            <div className="overflow-hidden rounded-xl border border-[#EDEDF2] bg-white dark:border-slate-800 dark:bg-[#161B26]">
              {myTasks.map((task) => {
                const effectiveStatus: TaskStatus =
                  task.status === "IN_REVIEW" ? "IN_PROGRESS" : task.status;
                const statusLabel =
                  effectiveStatus === "TODO"
                    ? "To Do"
                    : effectiveStatus === "IN_PROGRESS"
                      ? "In Progress"
                      : "Done";
                return (
                  <div
                    key={task.id}
                    className="grid gap-2 border-b border-[#EDEDF2] px-4 py-3 last:border-0 hover:bg-slate-50/80 dark:border-slate-800 dark:hover:bg-slate-800/40 sm:grid-cols-[minmax(180px,2fr)_minmax(110px,.9fr)_minmax(100px,.8fr)_minmax(90px,.7fr)_minmax(130px,1fr)] sm:items-center"
                  >
                    <div className="min-w-0">
                      <Link
                        href={
                          task.projectId
                            ? `/project-center/${task.projectId}?tab=tasks`
                            : "#"
                        }
                        className="truncate block text-sm font-semibold text-[#111625] hover:text-[#0D3594] dark:text-white dark:hover:text-blue-300"
                      >
                        {task.title}
                      </Link>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {task.projectTitle || "Club task"}
                      </p>
                    </div>
                    <span className="text-xs text-slate-600 dark:text-slate-300">
                      {task.committee.replaceAll("_", " ")}
                    </span>
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {statusLabel}
                    </span>
                    <span className="text-xs text-slate-500">
                      Due {task.dueDate}
                    </span>
                    <div className="flex items-center justify-end gap-1.5">
                      {effectiveStatus === "TODO" && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            handleAdvanceMyTask(task, "IN_PROGRESS")
                          }
                          className="rounded-lg bg-[#0D3594] px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-[#092569] disabled:opacity-60 transition cursor-pointer"
                        >
                          Mark In Progress
                        </button>
                      )}
                      {effectiveStatus === "IN_PROGRESS" && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => handleAdvanceMyTask(task, "COMPLETED")}
                          className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:opacity-60 transition cursor-pointer"
                        >
                          Mark as Done
                        </button>
                      )}
                      {effectiveStatus === "COMPLETED" && (
                        <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                          ✓ Done
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-xs text-slate-500 dark:border-slate-700">
              No tasks are assigned or linked to activities.
            </div>
          )
        ) : view === "CALENDAR" ? (
          <ActivityCalendar activities={filtered} tasks={initialTasks} />
        ) : view === "BOARD" ? (
          <div className="grid gap-4 xl:grid-cols-4">
            {(
              [
                ["PLANNED", planned, "Step 1", "Scheduled & preparing"],
                ["ONGOING", ongoing, "Step 2", "Active execution"],
                ["AWAITING_REPORT", reporting, "Step 3", "Needs report to finish"],
                ["ACCOMPLISHED", accomplished, "Step 4", "Verified & completed"],
              ] as [ActivityStatus, ActivitySummaryDTO[], string, string][]
            ).map(([column, rows, stepLabel, subtitle]) => {
              const isAccomplishedCol = column === "ACCOMPLISHED";
              return (
                <section
                  key={column}
                  className={`min-w-0 rounded-xl border p-3 ${
                    isAccomplishedCol
                      ? "border-emerald-300/90 bg-emerald-50/50 ring-1 ring-emerald-500/15 dark:border-emerald-500/35 dark:bg-emerald-950/20"
                      : "border-[#EDEDF2] bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/50"
                  }`}
                >
                  <header
                    className={`mb-2.5 border-b px-1 pb-2 ${
                      isAccomplishedCol
                        ? "border-emerald-200 dark:border-emerald-500/25"
                        : "border-slate-200/70 dark:border-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                            isAccomplishedCol
                              ? "bg-emerald-200/80 text-emerald-900 dark:bg-emerald-500/25 dark:text-emerald-200"
                              : "bg-slate-200/80 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                          }`}
                        >
                          {stepLabel}
                        </span>
                        <ActivityStatusBadge status={column} />
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold shadow-2xs ${
                          isAccomplishedCol
                            ? "bg-emerald-600 text-white dark:bg-emerald-500"
                            : "bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {rows.length}
                      </span>
                    </div>
                    <p
                      className={`mt-1 text-[10px] ${
                        isAccomplishedCol
                          ? "font-medium text-emerald-700 dark:text-emerald-300"
                          : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
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
                        onToggleArchive={handleToggleArchive}
                      />
                    ))}
                    {rows.length === 0 && (
                      <p className="px-2 py-6 text-center text-xs text-slate-400">
                        No items in this stage
                      </p>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        ) : filtered.length ? (
          (() => {
            const activeFiltered = filtered.filter(
              (a) => a.status !== "ACCOMPLISHED" && a.status !== "COMPLETED",
            );
            const finishedFiltered = filtered.filter(
              (a) => a.status === "ACCOMPLISHED" || a.status === "COMPLETED",
            );
            const showSplitSections =
              scope === "ACTIVE" &&
              (status === "ACTIVE" || status === "ALL") &&
              finishedFiltered.length > 0;

            const renderRow = (activity: ActivitySummaryDTO) => {
              const manageable = canManageActivity(activity);
              const isProjectItem = isProjectKind(activity.kind);
              const isFinished =
                activity.status === "ACCOMPLISHED" ||
                activity.status === "COMPLETED";
              const needsReportCompletion =
                isProjectItem &&
                (activity.status === "ONGOING" ||
                  activity.status === "AWAITING_REPORT" ||
                  activity.status === "COMPLETED");

              return (
                <div
                  key={activity.id}
                  className={`grid gap-2.5 border-b px-4 py-3.5 last:border-0 transition md:grid-cols-[minmax(220px,2fr)_minmax(115px,.9fr)_minmax(130px,.9fr)_minmax(85px,.55fr)_minmax(150px,1.05fr)_minmax(155px,1fr)] md:items-center md:gap-4 ${
                    isFinished && !activity.isArchived
                      ? "border-emerald-200/80 border-l-4 border-l-emerald-500 bg-emerald-50/45 hover:bg-emerald-50/80 dark:border-emerald-500/20 dark:border-l-emerald-500 dark:bg-emerald-950/15 dark:hover:bg-emerald-950/30"
                      : "border-[#EDEDF2] hover:bg-slate-50/80 dark:border-slate-800 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {isFinished && !activity.isArchived && (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      )}
                      <Link
                        href={`/project-center/${activity.id}`}
                        className={`truncate text-sm font-semibold ${
                          isFinished && !activity.isArchived
                            ? "text-emerald-950 hover:text-emerald-700 dark:text-emerald-100 dark:hover:text-emerald-300"
                            : "text-[#111625] hover:text-[#0D3594] dark:text-white dark:hover:text-blue-300"
                        }`}
                      >
                        {activity.title}
                      </Link>
                      {activity.rotaryYear && (
                        <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                          RY {activity.rotaryYear}
                        </span>
                      )}
                    </div>
                    {activity.shortDescription ? (
                      <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                        {activity.shortDescription}
                      </p>
                    ) : activity.archivedAt ? (
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        Archived on {formatManilaDate(activity.archivedAt)}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <KindBadge
                      kind={activity.kind}
                      meetingType={activity.meetingType}
                    />
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {formatActivityWhen(activity)}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {activity.rsvp.going} going
                    {activity.minMembersRequired
                      ? ` / ${activity.minMembersRequired} min`
                      : ""}
                  </p>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <ActivityStatusBadge status={activity.status} />
                      {activity.isArchived && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          Archived
                        </span>
                      )}
                    </div>
                    <CompactLifecycleIndicator
                      kind={activity.kind}
                      status={activity.status}
                    />
                  </div>
                  <div className="flex items-center justify-end gap-1.5 flex-wrap">
                    {needsReportCompletion && !activity.isArchived && (
                      <Link
                        href={`/project-center/${activity.id}?tab=REPORT`}
                        title="Open Accomplishment Report to complete this project"
                        className="inline-flex items-center gap-1 rounded-lg bg-[#0D3594] px-2.5 py-1.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-[#092569]"
                      >
                        <FileCheck2 className="h-3.5 w-3.5" />
                        <span>Complete Report</span>
                      </Link>
                    )}
                    {isProjectItem &&
                      activity.status === "ACCOMPLISHED" &&
                      !activity.isArchived && (
                        <Link
                          href={`/project-center/${activity.id}?tab=REPORT`}
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white shadow-2xs transition hover:bg-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-600"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>View Report ✓</span>
                        </Link>
                      )}
                    {!needsReportCompletion &&
                      !(isProjectItem && activity.status === "ACCOMPLISHED") && (
                        <Link
                          href={`/project-center/${activity.id}`}
                          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                            isFinished
                              ? "border-emerald-300 bg-emerald-100/80 text-emerald-800 hover:bg-emerald-200/80 dark:border-emerald-500/40 dark:bg-emerald-500/20 dark:text-emerald-200"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                          }`}
                        >
                          <span>{isFinished ? "Completed ✓" : "Open"}</span>
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      )}
                    {manageable && (
                      <>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => handleToggleArchive(activity)}
                          title={
                            activity.isArchived
                              ? "Restore project to active workspace"
                              : "Archive this project"
                          }
                          className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-semibold transition disabled:opacity-50 cursor-pointer ${
                            activity.isArchived
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                              : "border-slate-200 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                          }`}
                        >
                          {activity.isArchived ? (
                            <>
                              <ArchiveRestore className="h-3.5 w-3.5" />
                              <span>Restore</span>
                            </>
                          ) : (
                            <Archive className="h-3.5 w-3.5" />
                          )}
                        </button>
                        {activity.isArchived && (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => handleHardDelete(activity)}
                            title="Permanently delete this archived project"
                            className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400 transition disabled:opacity-50 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            };

            if (!showSplitSections) {
              return (
                <div
                  className={`overflow-hidden rounded-xl border shadow-2xs ${
                    status === "FINISHED" || status === "ACCOMPLISHED" || status === "COMPLETED"
                      ? "border-emerald-300 bg-white ring-1 ring-emerald-500/15 dark:border-emerald-500/35 dark:bg-[#161B26]"
                      : "border-[#EDEDF2] bg-white dark:border-slate-800 dark:bg-[#161B26]"
                  }`}
                >
                  {(status === "FINISHED" ||
                    status === "ACCOMPLISHED" ||
                    status === "COMPLETED") && (
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200 bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-white">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        <span className="text-xs font-bold">
                          Accomplished Projects &amp; Completed Activities
                        </span>
                        <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold">
                          {filtered.length} completed
                        </span>
                      </div>
                      <span className="text-[11px] text-emerald-100">
                        Verified club &amp; District 3820 impact records
                      </span>
                    </div>
                  )}
                  <div className="hidden grid-cols-[minmax(220px,2fr)_minmax(115px,.9fr)_minmax(130px,.9fr)_minmax(85px,.55fr)_minmax(150px,1.05fr)_minmax(155px,1fr)] gap-4 border-b border-[#EDEDF2] bg-slate-50 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 md:grid">
                    <span>Activity / Project</span>
                    <span>Type</span>
                    <span>Schedule</span>
                    <span>Members</span>
                    <span>Stage &amp; Progress</span>
                    <span className="text-right">Next Action</span>
                  </div>
                  {filtered.map(renderRow)}
                </div>
              );
            }

            return (
              <div className="space-y-6">
                {/* Section 1: Active & Upcoming Activities */}
                <div className="overflow-hidden rounded-xl border border-[#EDEDF2] bg-white shadow-2xs dark:border-slate-800 dark:bg-[#161B26]">
                  <div className="flex items-center justify-between border-b border-[#EDEDF2] bg-slate-50/90 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900/60">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#0D3594] dark:bg-blue-400" />
                      <h2 className="text-xs font-bold text-[#111625] dark:text-white">
                        Active &amp; Upcoming Pipeline (Planned, Ongoing &amp; Awaiting Report)
                      </h2>
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-[#0D3594] dark:bg-blue-500/20 dark:text-blue-300">
                        {activeFiltered.length}
                      </span>
                    </div>
                  </div>
                  {activeFiltered.length > 0 ? (
                    <>
                      <div className="hidden grid-cols-[minmax(220px,2fr)_minmax(115px,.9fr)_minmax(130px,.9fr)_minmax(85px,.55fr)_minmax(150px,1.05fr)_minmax(155px,1fr)] gap-4 border-b border-[#EDEDF2] bg-slate-50/50 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/30 md:grid">
                        <span>Activity / Project</span>
                        <span>Type</span>
                        <span>Schedule</span>
                        <span>Members</span>
                        <span>Stage &amp; Progress</span>
                        <span className="text-right">Next Action</span>
                      </div>
                      {activeFiltered.map(renderRow)}
                    </>
                  ) : (
                    <p className="px-4 py-8 text-center text-xs text-slate-500">
                      All active projects and activities are completed! Check the Accomplished section below.
                    </p>
                  )}
                </div>

                {/* Section 2: Dedicated Accomplished & Completed Section (Highlighted Green) */}
                <div className="overflow-hidden rounded-xl border-2 border-emerald-300/90 bg-white shadow-sm ring-1 ring-emerald-500/10 dark:border-emerald-500/40 dark:bg-[#161B26]">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200 bg-gradient-to-r from-emerald-600 via-emerald-600 to-teal-600 px-4 py-3 text-white dark:border-emerald-500/30">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <h2 className="text-xs sm:text-sm font-bold">
                        Accomplished Projects &amp; Completed Activities
                      </h2>
                      <span className="rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-bold text-white">
                        {finishedFiltered.length} accomplished
                      </span>
                    </div>
                    <span className="text-[11px] font-medium text-emerald-50">
                      ✓ Verified &amp; logged in club impact records
                    </span>
                  </div>
                  <div className="hidden grid-cols-[minmax(220px,2fr)_minmax(115px,.9fr)_minmax(130px,.9fr)_minmax(85px,.55fr)_minmax(150px,1.05fr)_minmax(155px,1fr)] gap-4 border-b border-emerald-100 bg-emerald-50/70 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-950/30 dark:text-emerald-300 md:grid">
                    <span>Accomplished Project / Activity</span>
                    <span>Type</span>
                    <span>Date Completed</span>
                    <span>Turnout</span>
                    <span>Status</span>
                    <span className="text-right">Report / Action</span>
                  </div>
                  {finishedFiltered.map(renderRow)}
                </div>
              </div>
            );
          })()
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 px-6 py-14 text-center dark:border-slate-700">
            {scope === "ARCHIVED" ? (
              <>
                <Archive className="mx-auto h-6 w-6 text-slate-400" />
                <h2 className="mt-3 text-sm font-semibold text-[#111625] dark:text-white">
                  No archived projects or activities
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  When old or completed projects are archived, they will appear here for safe historical reference.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setScope("ACTIVE");
                    setStatus("ACTIVE");
                  }}
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#0D3594] dark:text-blue-300"
                >
                  View active activities
                </button>
              </>
            ) : (
              <>
                <SlidersHorizontal className="mx-auto h-6 w-6 text-slate-400" />
                <h2 className="mt-3 text-sm font-semibold text-[#111625] dark:text-white">
                  No activities match these filters
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Adjust your filters or create a new activity.
                </p>
                {canCreate && (
                  <Link
                    href="/project-center/new"
                    className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#0D3594] dark:text-blue-300"
                  >
                    <Plus className="h-3.5 w-3.5" /> Create activity
                  </Link>
                )}
              </>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

function SummaryMetric({
  label,
  value,
  detail,
  stepBadge,
  tone = "default",
  active = false,
  onClick,
}: {
  label: string;
  value: number;
  detail: string;
  stepBadge?: string;
  tone?: "default" | "blue" | "amber" | "orange" | "emerald";
  active?: boolean;
  onClick?: () => void;
}) {
  const toneStyles: Record<
    NonNullable<typeof tone>,
    { card: string; activeRing: string; value: string; badge: string }
  > = {
    default: {
      card: "border-[#EDEDF2] bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-[#161B26] dark:hover:border-slate-700",
      activeRing: "ring-2 ring-[#0D3594] border-[#0D3594] dark:ring-blue-400",
      value: "text-[#111625] dark:text-white",
      badge: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    },
    blue: {
      card: "border-blue-200/80 bg-blue-50/40 hover:border-blue-300 dark:border-blue-500/20 dark:bg-blue-500/5",
      activeRing: "ring-2 ring-blue-600 border-blue-600 dark:ring-blue-400",
      value: "text-blue-700 dark:text-blue-300",
      badge: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
    },
    amber: {
      card: "border-amber-200/80 bg-amber-50/50 hover:border-amber-300 dark:border-amber-500/20 dark:bg-amber-500/5",
      activeRing: "ring-2 ring-amber-500 border-amber-500 dark:ring-amber-400",
      value: "text-amber-700 dark:text-amber-300",
      badge: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
    },
    orange: {
      card: "border-orange-200/80 bg-orange-50/50 hover:border-orange-300 dark:border-orange-500/20 dark:bg-orange-500/5",
      activeRing: "ring-2 ring-orange-500 border-orange-500 dark:ring-orange-400",
      value: "text-orange-700 dark:text-orange-300",
      badge: "bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300",
    },
    emerald: {
      card: "border-emerald-200/80 bg-emerald-50/50 hover:border-emerald-300 dark:border-emerald-500/20 dark:bg-emerald-500/5",
      activeRing: "ring-2 ring-emerald-600 border-emerald-600 dark:ring-emerald-400",
      value: "text-emerald-700 dark:text-emerald-300",
      badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300",
    },
  };

  const s = toneStyles[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`group rounded-xl border p-3.5 text-left transition cursor-pointer ${s.card} ${active ? s.activeRing : ""}`}
    >
      <div className="flex items-center justify-between gap-1.5">
        <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
          {label}
        </p>
        {stepBadge && (
          <span
            className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${s.badge}`}
          >
            {stepBadge}
          </span>
        )}
      </div>
      <p className={`mt-1 text-2xl font-bold ${s.value}`}>{value}</p>
      <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
        {detail}
      </p>
    </button>
  );
}
