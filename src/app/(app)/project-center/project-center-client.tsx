"use client";

import React, { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  CalendarDays,
  CheckSquare,
  FolderArchive,
  Images,
  LayoutGrid,
  List,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { ActivityCalendar } from "./_components/activity-calendar";
import { ActivityMoments } from "./_components/activity-moments";
import { ActivityCard, formatActivityWhen } from "./_components/activity-card";
import { ActivityStatusBadge, KindBadge } from "./_components/badges";
import {
  ACTIVITY_KINDS,
  ACTIVITY_KIND_META,
  ACTIVITY_STATUSES,
  ACTIVITY_STATUS_LABELS,
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
        if (
          status === "ACTIVE" &&
          ["CANCELLED", "ACCOMPLISHED"].includes(activity.status)
        )
          return false;
        if (
          status !== "ALL" &&
          status !== "ACTIVE" &&
          activity.status !== status
        )
          return false;
      } else {
        if (
          status !== "ALL" &&
          status !== "ACTIVE" &&
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
    (a) => !["CANCELLED", "ACCOMPLISHED"].includes(a.status),
  );
  const serviceProjectCount = activeWorkspaceActivities.filter((a) =>
    ["SERVICE_PROJECT", "JOINT_PROJECT"].includes(a.kind),
  ).length;
  const ongoingActiveCount = activeWorkspaceActivities.filter(
    (a) => a.status === "ONGOING",
  ).length;
  const plannedActiveCount = activeWorkspaceActivities.filter(
    (a) => a.status === "PLANNED",
  ).length;
  const awaitingReports = activeActivities.filter(
    (a) => a.status === "AWAITING_REPORT",
  ).length;
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
            <CalendarDays className="h-3.5 w-3.5" /> Club operations
          </div>
          <h1 className="mt-1 text-2xl font-bold text-[#111625] dark:text-white">
            Project Center
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            One workspace for meetings, service, tasks, attendance and club archives.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {scope === "ACTIVE" && archivableFinishedIds.length > 0 && (
            <button
              type="button"
              disabled={pending}
              onClick={handleBulkArchiveFinished}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-[#161B26] dark:text-slate-200 dark:hover:bg-slate-800 transition"
              title="Move all completed, accomplished, and cancelled activities to the archive"
            >
              <FolderArchive className="h-3.5 w-3.5 text-slate-500" />
              Archive {archivableFinishedIds.length} Finished
            </button>
          )}
          {canCreate && (
            <Link
              href="/project-center/new"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0D3594] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#092569]"
            >
              <Plus className="h-4 w-4" /> New activity
            </Link>
          )}
        </div>
      </header>

      <section
        className="grid grid-cols-2 gap-3 sm:grid-cols-5"
        aria-label="Project Center summary"
      >
        <SummaryMetric
          label="Active Projects"
          value={activeWorkspaceActivities.length}
          detail={`${ongoingActiveCount} ongoing · ${plannedActiveCount} planned`}
        />
        <SummaryMetric
          label="Service & Joint"
          value={serviceProjectCount}
          detail="community & twin club service"
        />
        <SummaryMetric
          label="Awaiting report"
          value={awaitingReports}
          detail="chair follow-up"
          tone={awaitingReports ? "amber" : "default"}
        />
        <SummaryMetric
          label="Open tasks"
          value={tasksList.filter((t) => t.status !== "COMPLETED").length}
          detail="across club activities"
        />
        <SummaryMetric
          label="Archived"
          value={archivedActivities.length}
          detail="historical records"
        />
      </section>

      {awaitingReports > 0 && scope === "ACTIVE" && (
        <Link
          href={`/project-center?status=AWAITING_REPORT`}
          onClick={() => {
            setScope("ACTIVE");
            setStatus("AWAITING_REPORT");
          }}
          className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"
        >
          <span>
            <strong>
              {awaitingReports} project{awaitingReports === 1 ? "" : "s"}
            </strong>{" "}
            need an accomplishment report.
          </span>
          <span className="font-semibold">Review reports</span>
        </Link>
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
                  if (status === "ALL") setStatus("ACTIVE");
                }}
                aria-pressed={scope === "ACTIVE"}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  scope === "ACTIVE"
                    ? "bg-[#0D3594] text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                }`}
              >
                <span>Active</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                    scope === "ACTIVE"
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                >
                  {activeWorkspaceActivities.length}
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
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
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
                ["PLANNED", planned],
                ["ONGOING", ongoing],
                ["AWAITING_REPORT", reporting],
                ["ACCOMPLISHED", accomplished],
              ] as [ActivityStatus, ActivitySummaryDTO[]][]
            ).map(([column, rows]) => (
              <section
                key={column}
                className="min-w-0 rounded-xl bg-slate-50/80 p-2.5 dark:bg-slate-900/50"
              >
                <header className="flex items-center justify-between px-1 pb-2">
                  <div className="flex items-center gap-2">
                    <ActivityStatusBadge status={column} />
                    <span className="text-xs font-semibold text-slate-500">
                      {rows.length}
                    </span>
                  </div>
                </header>
                <div className="space-y-2">
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
                      Nothing here
                    </p>
                  )}
                </div>
              </section>
            ))}
          </div>
        ) : filtered.length ? (
          <div className="overflow-hidden rounded-xl border border-[#EDEDF2] bg-white dark:border-slate-800 dark:bg-[#161B26]">
            <div className="hidden grid-cols-[minmax(220px,2fr)_minmax(120px,1fr)_minmax(140px,1fr)_minmax(90px,.6fr)_minmax(110px,.7fr)_minmax(90px,.5fr)] gap-4 border-b border-[#EDEDF2] bg-slate-50 px-4 py-2 text-[10px] font-bold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 md:grid">
              <span>Activity</span>
              <span>Type</span>
              <span>Schedule</span>
              <span>Members</span>
              <span>Status</span>
              <span className="text-right">Actions</span>
            </div>
            {filtered.map((activity) => {
              const manageable = canManageActivity(activity);
              return (
                <div
                  key={activity.id}
                  className="grid gap-2 border-b border-[#EDEDF2] px-4 py-3 last:border-0 hover:bg-slate-50/80 dark:border-slate-800 dark:hover:bg-slate-800/40 md:grid-cols-[minmax(220px,2fr)_minmax(120px,1fr)_minmax(140px,1fr)_minmax(90px,.6fr)_minmax(110px,.7fr)_minmax(90px,.5fr)] md:items-center md:gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/project-center/${activity.id}`}
                        className="truncate text-sm font-semibold text-[#111625] hover:text-[#0D3594] dark:text-white dark:hover:text-blue-300"
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
                      <p className="mt-0.5 truncate text-xs text-slate-500">
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
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <ActivityStatusBadge status={activity.status} />
                    {activity.isArchived && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        Archived
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-1.5">
                    {manageable ? (
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
                          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                            activity.isArchived
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                          }`}
                        >
                          {activity.isArchived ? (
                            <>
                              <ArchiveRestore className="h-3.5 w-3.5" />
                              <span>Restore</span>
                            </>
                          ) : (
                            <>
                              <Archive className="h-3.5 w-3.5" />
                              <span>Archive</span>
                            </>
                          )}
                        </button>
                        {activity.isArchived && (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => handleHardDelete(activity)}
                            title="Permanently delete this archived project"
                            className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400 transition disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </>
                    ) : (
                      <Link
                        href={`/project-center/${activity.id}`}
                        className="text-xs font-semibold text-[#0D3594] hover:underline dark:text-blue-400"
                      >
                        View
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
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
  tone = "default",
}: {
  label: string;
  value: number;
  detail: string;
  tone?: "default" | "amber";
}) {
  return (
    <div
      className={`rounded-xl border p-3.5 ${tone === "amber" ? "border-amber-200 bg-amber-50/70 dark:border-amber-500/20 dark:bg-amber-500/5" : "border-[#EDEDF2] bg-white dark:border-slate-800 dark:bg-[#161B26]"}`}
    >
      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold ${tone === "amber" ? "text-amber-700 dark:text-amber-300" : "text-[#111625] dark:text-white"}`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[10px] text-slate-500">{detail}</p>
    </div>
  );
}
