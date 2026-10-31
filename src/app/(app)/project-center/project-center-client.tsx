"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CalendarDays,
  CheckSquare,
  LayoutGrid,
  List,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { ActivityCalendar } from "./_components/activity-calendar";
import { ActivityCard } from "./_components/activity-card";
import { ActivityStatusBadge, KindBadge } from "./_components/badges";
import {
  ACTIVITY_KINDS,
  ACTIVITY_KIND_META,
  ACTIVITY_STATUSES,
  ACTIVITY_STATUS_LABELS,
  type ActivityStatus,
  type ActivitySummaryDTO,
} from "@/features/activities/types";
import type { GroupTaskDTO } from "@/lib/data/tasks-types";
import { formatActivityWhen } from "./_components/activity-card";

type ViewMode = "LIST" | "BOARD" | "CALENDAR" | "TASKS";

export function ProjectCenterClient({
  initialActivities,
  initialTasks,
  canCreate,
  currentUserId,
  currentUserName,
}: {
  initialActivities: ActivitySummaryDTO[];
  initialTasks: GroupTaskDTO[];
  canCreate: boolean;
  currentUserId: string;
  currentUserName: string;
}) {
  const searchParams = useSearchParams();
  const [view, setView] = useState<ViewMode>(
    searchParams.get("view") === "tasks"
      ? "TASKS"
      : searchParams.get("view") === "calendar"
        ? "CALENDAR"
        : "LIST",
  );
  const [kind, setKind] = useState(searchParams.get("kind") || "ALL");
  const [status, setStatus] = useState(searchParams.get("status") || "ACTIVE");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return initialActivities.filter((activity) => {
      if (kind !== "ALL" && activity.kind !== kind) return false;
      if (
        status === "ACTIVE" &&
        ["CANCELLED", "ACCOMPLISHED"].includes(activity.status)
      )
        return false;
      if (status !== "ALL" && status !== "ACTIVE" && activity.status !== status)
        return false;
      if (!text) return true;
      return [
        activity.title,
        activity.shortDescription,
        activity.location,
      ].some((value) => value?.toLowerCase().includes(text));
    });
  }, [initialActivities, kind, query, status]);

  const projectCount = initialActivities.filter((a) =>
    ["SERVICE_PROJECT", "JOINT_PROJECT"].includes(a.kind),
  ).length;
  const upcomingCount = initialActivities.filter(
    (a) => new Date(a.startAt) >= new Date() && a.status !== "CANCELLED",
  ).length;
  const awaitingReports = initialActivities.filter(
    (a) => a.status === "AWAITING_REPORT",
  ).length;
  const planned = filtered.filter((a) => a.status === "PLANNED");
  const ongoing = filtered.filter((a) => a.status === "ONGOING");
  const reporting = filtered.filter((a) => a.status === "AWAITING_REPORT");
  const accomplished = filtered.filter((a) =>
    ["COMPLETED", "ACCOMPLISHED"].includes(a.status),
  );
  const myTasks = initialTasks.filter(
    (task) =>
      task.assignedMemberIds.includes(currentUserId) ||
      task.assignedMemberNames.some(
        (name) => name.toLowerCase() === currentUserName.toLowerCase(),
      ) ||
      task.createdBy.toLowerCase() === currentUserName.toLowerCase(),
  );

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
            One workspace for meetings, service, tasks and attendance.
          </p>
        </div>
        {canCreate && (
          <Link
            href="/project-center/new"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0D3594] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#092569]"
          >
            <Plus className="h-4 w-4" /> New activity
          </Link>
        )}
      </header>

      <section
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        aria-label="Project Center summary"
      >
        <SummaryMetric
          label="Upcoming"
          value={upcomingCount}
          detail="scheduled activities"
        />
        <SummaryMetric
          label="Projects"
          value={projectCount}
          detail="service initiatives"
        />
        <SummaryMetric
          label="Awaiting report"
          value={awaitingReports}
          detail="chair follow-up"
          tone={awaitingReports ? "amber" : "default"}
        />
        <SummaryMetric
          label="Open tasks"
          value={initialTasks.filter((t) => t.status !== "COMPLETED").length}
          detail="across club activities"
        />
      </section>

      {awaitingReports > 0 && (
        <Link
          href={`/project-center?status=AWAITING_REPORT`}
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

      <section className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 overflow-x-auto">
            <label htmlFor="activity-kind-filter" className="sr-only">
              Filter by activity type
            </label>
            <select
              id="activity-kind-filter"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="min-w-40 rounded-lg border border-[#EDEDF2] bg-white px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-[#161B26] dark:text-slate-200"
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
              className="min-w-36 rounded-lg border border-[#EDEDF2] bg-white px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-[#161B26] dark:text-slate-200"
            >
              <option value="ACTIVE">Active & upcoming</option>
              <option value="ALL">All statuses</option>
              {ACTIVITY_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ACTIVITY_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <span className="sr-only">Search activities</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search activities"
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
                ] as const
              ).map(([mode, Icon, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setView(mode)}
                  aria-pressed={view === mode}
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

        <div className="text-xs text-slate-500">
          Showing {filtered.length} of {initialActivities.length} activities
        </div>

        {view === "TASKS" ? (
          myTasks.length ? (
            <div className="overflow-hidden rounded-xl border border-[#EDEDF2] bg-white dark:border-slate-800 dark:bg-[#161B26]">
              {myTasks.map((task) => (
                <Link
                  key={task.id}
                  href={
                    task.projectId
                      ? `/project-center/${task.projectId}?tab=tasks`
                      : "#"
                  }
                  className="grid gap-2 border-b border-[#EDEDF2] px-4 py-3 last:border-0 hover:bg-slate-50/80 dark:border-slate-800 dark:hover:bg-slate-800/40 sm:grid-cols-[minmax(180px,2fr)_minmax(120px,1fr)_minmax(100px,.8fr)_minmax(120px,1fr)] sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#111625] dark:text-white">
                      {task.title}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {task.projectTitle || "Club task"}
                    </p>
                  </div>
                  <span className="text-xs text-slate-600 dark:text-slate-300">
                    {task.committee.replaceAll("_", " ")}
                  </span>
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {task.status.replaceAll("_", " ")}
                  </span>
                  <span className="text-xs text-slate-500">
                    Due {task.dueDate}
                  </span>
                </Link>
              ))}
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
            <div className="hidden grid-cols-[minmax(220px,2fr)_minmax(120px,1fr)_minmax(140px,1fr)_minmax(100px,.7fr)_minmax(120px,.8fr)] gap-4 border-b border-[#EDEDF2] bg-slate-50 px-4 py-2 text-[10px] font-bold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 md:grid">
              <span>Activity</span>
              <span>Type</span>
              <span>Schedule</span>
              <span>Members</span>
              <span>Status</span>
            </div>
            {filtered.map((activity) => (
              <Link
                key={activity.id}
                href={`/project-center/${activity.id}`}
                className="grid gap-2 border-b border-[#EDEDF2] px-4 py-3 last:border-0 hover:bg-slate-50/80 dark:border-slate-800 dark:hover:bg-slate-800/40 md:grid-cols-[minmax(220px,2fr)_minmax(120px,1fr)_minmax(140px,1fr)_minmax(100px,.7fr)_minmax(120px,.8fr)] md:items-center md:gap-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#111625] dark:text-white">
                    {activity.title}
                  </p>
                  {activity.shortDescription && (
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {activity.shortDescription}
                    </p>
                  )}
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
                <div>
                  <ActivityStatusBadge status={activity.status} />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 px-6 py-14 text-center dark:border-slate-700">
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
