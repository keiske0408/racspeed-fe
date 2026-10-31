"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { CheckSquare, ChevronLeft, ChevronRight } from "lucide-react";
import { formatManila, manilaDateKey } from "@/lib/utils/dates";
import {
  ACTIVITY_KIND_META,
  type ActivitySummaryDTO,
} from "@/features/activities/types";
import type { GroupTaskDTO } from "@/lib/data/tasks-types";
import { ActivityStatusBadge, KindBadge } from "./badges";
import { formatActivityWhen } from "./activity-card";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_MS = 86_400_000;
type Entry =
  | { type: "activity"; activity: ActivitySummaryDTO }
  | { type: "task"; task: GroupTaskDTO };

function dateKey(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

function datesFor(activity: ActivitySummaryDTO) {
  const start = manilaDateKey(activity.startAt);
  const end = manilaDateKey(activity.endAt);
  let cursor = Date.parse(`${start}T00:00:00Z`);
  const last = Date.parse(`${end}T00:00:00Z`);
  const result: string[] = [];
  while (cursor <= last && result.length < 14) {
    result.push(dateKey(cursor));
    cursor += DAY_MS;
  }
  return result;
}

export function ActivityCalendar({
  activities,
  tasks,
}: {
  activities: ActivitySummaryDTO[];
  tasks: GroupTaskDTO[];
}) {
  const todayKey = manilaDateKey(new Date());
  const [cursor, setCursor] = useState({
    year: Number(todayKey.slice(0, 4)),
    month: Number(todayKey.slice(5, 7)) - 1,
  });
  const [mode, setMode] = useState<"MONTH" | "AGENDA">("MONTH");
  const [showTasks, setShowTasks] = useState(true);

  const entries = useMemo(() => {
    const map = new Map<string, Entry[]>();
    const add = (key: string, entry: Entry) =>
      map.set(key, [...(map.get(key) || []), entry]);
    activities.forEach((activity) =>
      datesFor(activity).forEach((key) =>
        add(key, { type: "activity", activity }),
      ),
    );
    if (showTasks) {
      tasks
        .filter((task) => task.status !== "COMPLETED" && task.dueDate)
        .forEach((task) => {
          add(task.dueDate.slice(0, 10), { type: "task", task });
        });
    }
    return map;
  }, [activities, tasks, showTasks]);

  const gridDays = useMemo(() => {
    const first = Date.UTC(cursor.year, cursor.month, 1);
    const start = first - new Date(first).getUTCDay() * DAY_MS;
    return Array.from({ length: 42 }, (_, index) => {
      const value = new Date(start + index * DAY_MS);
      return {
        key: dateKey(value.getTime()),
        day: value.getUTCDate(),
        inMonth: value.getUTCMonth() === cursor.month,
      };
    });
  }, [cursor]);

  const monthLabel = new Date(
    Date.UTC(cursor.year, cursor.month, 1),
  ).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const monthPrefix = `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}`;
  const agendaDays = Array.from(entries.entries())
    .filter(([key]) => key.startsWith(monthPrefix))
    .sort(([a], [b]) => a.localeCompare(b));

  function shiftMonth(delta: number) {
    setCursor((current) => {
      const month = current.month + delta;
      return {
        year: current.year + Math.floor(month / 12),
        month: ((month % 12) + 12) % 12,
      };
    });
  }

  function setToday() {
    setCursor({
      year: Number(todayKey.slice(0, 4)),
      month: Number(todayKey.slice(5, 7)) - 1,
    });
  }

  return (
    <section className="overflow-hidden rounded-xl border border-[#EDEDF2] bg-white dark:border-slate-800 dark:bg-[#161B26]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EDEDF2] px-4 py-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
            className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h2 className="min-w-36 text-center text-sm font-bold text-[#111625] dark:text-white">
            {monthLabel}
          </h2>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
            className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={setToday}
            className="ml-1 rounded-lg border border-[#EDEDF2] px-2.5 py-1 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Today
          </button>
        </div>
        <div className="flex items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={showTasks}
              onChange={(event) => setShowTasks(event.target.checked)}
              className="accent-[#0D3594]"
            />
            Tasks
          </label>
          <div
            className="inline-flex rounded-lg border border-[#EDEDF2] p-0.5 dark:border-slate-700"
            role="group"
            aria-label="Calendar view"
          >
            {(["MONTH", "AGENDA"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                aria-pressed={mode === value}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold ${mode === value ? "bg-[#0D3594] text-white" : "text-slate-600 dark:text-slate-300"}`}
              >
                {value === "MONTH" ? "Month" : "Agenda"}
              </button>
            ))}
          </div>
        </div>
      </header>

      {mode === "MONTH" ? (
        <div className="grid grid-cols-7 text-xs">
          {DAY_NAMES.map((day) => (
            <div
              key={day}
              className="border-b border-[#EDEDF2] px-2 py-1.5 text-[11px] font-semibold text-slate-500 dark:border-slate-800"
            >
              {day}
            </div>
          ))}
          {gridDays.map((day) => {
            const dayEntries = entries.get(day.key) || [];
            const isToday = day.key === todayKey;
            return (
              <div
                key={day.key}
                className={`min-h-24 border-b border-r border-[#EDEDF2] p-1.5 dark:border-slate-800 ${day.inMonth ? "" : "bg-slate-50/60 text-slate-400 dark:bg-slate-900/40"}`}
              >
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${isToday ? "bg-[#0D3594] text-white" : ""}`}
                >
                  {day.day}
                </span>
                <div className="mt-1 space-y-0.5">
                  {dayEntries.slice(0, 3).map((entry, index) =>
                    entry.type === "activity" ? (
                      <Link
                        key={`${entry.activity.id}-${index}`}
                        href={`/project-center/${entry.activity.id}`}
                        title={entry.activity.title}
                        className="flex items-center gap-1 truncate rounded px-1 py-0.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${ACTIVITY_KIND_META[entry.activity.kind].dotClass}`}
                        />
                        <span className="truncate text-[11px] font-medium text-[#111625] dark:text-slate-100">
                          {entry.activity.title}
                        </span>
                      </Link>
                    ) : (
                      <Link
                        key={`${entry.task.id}-${index}`}
                        href={
                          entry.task.projectId
                            ? `/project-center/${entry.task.projectId}?tab=tasks`
                            : "/project-center?view=tasks"
                        }
                        title={`Task due: ${entry.task.title}`}
                        className="flex items-center gap-1 truncate rounded px-1 py-0.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <CheckSquare className="h-3 w-3 shrink-0 text-slate-400" />
                        <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                          {entry.task.title}
                        </span>
                      </Link>
                    ),
                  )}
                  {dayEntries.length > 3 && (
                    <p className="px-1 text-[10px] font-semibold text-slate-500">
                      +{dayEntries.length - 3} more
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="divide-y divide-[#EDEDF2] dark:divide-slate-800">
          {agendaDays.length === 0 && (
            <p className="p-8 text-center text-sm text-slate-500">
              Nothing scheduled this month.
            </p>
          )}
          {agendaDays.map(([key, dayEntries]) => (
            <div key={key} className="flex gap-4 px-4 py-3">
              <div className="w-16 shrink-0 text-center">
                <p className="text-[11px] font-semibold uppercase text-slate-500">
                  {formatManila(`${key}T04:00:00Z`, "EEE")}
                </p>
                <p
                  className={`text-lg font-bold ${key === todayKey ? "text-[#0D3594]" : "text-[#111625] dark:text-white"}`}
                >
                  {Number(key.slice(8))}
                </p>
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                {dayEntries.map((entry, index) =>
                  entry.type === "activity" ? (
                    <Link
                      key={`${entry.activity.id}-${index}`}
                      href={`/project-center/${entry.activity.id}`}
                      className="flex flex-wrap items-center gap-2 rounded-lg p-2 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    >
                      <KindBadge
                        kind={entry.activity.kind}
                        meetingType={entry.activity.meetingType}
                      />
                      <span className="text-sm font-semibold text-[#111625] dark:text-white">
                        {entry.activity.title}
                      </span>
                      <span className="text-xs text-slate-500">
                        {formatActivityWhen(entry.activity)}
                      </span>
                      <span className="ml-auto">
                        <ActivityStatusBadge status={entry.activity.status} />
                      </span>
                    </Link>
                  ) : (
                    <p
                      key={`${entry.task.id}-${index}`}
                      className="flex items-center gap-2 p-2 text-xs text-slate-500"
                    >
                      <CheckSquare className="h-3.5 w-3.5" /> Task due:{" "}
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {entry.task.title}
                      </span>
                      {entry.task.projectTitle && (
                        <span>· {entry.task.projectTitle}</span>
                      )}
                    </p>
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
