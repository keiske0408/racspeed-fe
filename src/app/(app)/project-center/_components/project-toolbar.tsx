"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  LayoutGrid,
  List,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  ACTIVITY_KINDS,
  ACTIVITY_KIND_META,
  ACTIVITY_PRIORITIES,
  ACTIVITY_PRIORITY_META,
  type ActivityPriority,
} from "@/features/activities/types";
import type { ProjectCenterView } from "@/features/activities/project-center-rules";

export function ProjectToolbar({
  searchInput,
  onSearchInputChange,
  kind,
  onKindChange,
  assignedToMe,
  onAssignedToMeToggle,
  priority,
  onPriorityChange,
  sortBy,
  onSortByChange,
  view,
  onViewChange,
}: {
  searchInput: string;
  onSearchInputChange: (val: string) => void;
  kind: string;
  onKindChange: (val: string) => void;
  assignedToMe: boolean;
  onAssignedToMeToggle: () => void;
  priority: "ALL" | ActivityPriority;
  onPriorityChange: (val: "ALL" | ActivityPriority) => void;
  sortBy: "SCHEDULE" | "PRIORITY";
  onSortByChange: (val: "SCHEDULE" | "PRIORITY") => void;
  view: ProjectCenterView;
  onViewChange: (view: ProjectCenterView) => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement | null>(null);
  const extraFilterCount =
    (priority !== "ALL" ? 1 : 0) + (sortBy !== "SCHEDULE" ? 1 : 0);

  useEffect(() => {
    if (!moreOpen) return;
    function handleOutside(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMoreOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [moreOpen]);

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <label className="relative min-w-[200px] flex-1 sm:max-w-[260px]">
          <Search
            className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500 dark:text-slate-400"
            aria-hidden="true"
          />
          <span className="sr-only">Search activities</span>
          <input
            type="search"
            value={searchInput}
            onChange={(e) => onSearchInputChange(e.target.value)}
            placeholder="Search activities"
            className="min-h-[44px] w-full rounded-xl border border-[#DDE1EA] bg-white py-2 pl-9 pr-8 text-xs font-medium text-[#111625] placeholder:text-slate-500 outline-none focus:border-[#0D3594] dark:border-slate-700 dark:bg-[#161B26] dark:text-white dark:placeholder:text-slate-400"
          />
          {searchInput.length > 0 && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => onSearchInputChange("")}
              className="absolute right-1.5 top-1.5 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </label>

        {/* All types */}
        <label htmlFor="pc-kind-filter" className="sr-only">
          Filter by activity type
        </label>
        <select
          id="pc-kind-filter"
          aria-label="Filter by activity type"
          value={kind}
          onChange={(e) => onKindChange(e.target.value)}
          className="min-h-[44px] rounded-xl border border-[#DDE1EA] bg-white px-3 py-2 text-xs font-semibold text-[#111625] outline-none focus:border-[#0D3594] dark:border-slate-700 dark:bg-[#161B26] dark:text-slate-100"
        >
          <option value="ALL">All types</option>
          {ACTIVITY_KINDS.map((k) => (
            <option key={k} value={k}>
              {ACTIVITY_KIND_META[k].label}
            </option>
          ))}
        </select>

        {/* Assigned to me */}
        <button
          type="button"
          aria-pressed={assignedToMe}
          onClick={onAssignedToMeToggle}
          className={`inline-flex min-h-[44px] cursor-pointer items-center rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
            assignedToMe
              ? "border-[#0D3594] bg-[#0D3594] text-white dark:border-blue-500 dark:bg-blue-600"
              : "border-[#DDE1EA] bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-[#161B26] dark:text-slate-200 dark:hover:bg-slate-800"
          }`}
        >
          Assigned to me
        </button>

        {/* More filters popover */}
        <div ref={moreRef} className="relative">
          <button
            type="button"
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
            onClick={() => setMoreOpen((prev) => !prev)}
            className={`inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
              extraFilterCount > 0 || moreOpen
                ? "border-[#0D3594] bg-slate-50 text-[#0D3594] dark:border-blue-400 dark:bg-slate-800 dark:text-blue-300"
                : "border-[#DDE1EA] bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-[#161B26] dark:text-slate-200 dark:hover:bg-slate-800"
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            <span>More filters</span>
            {extraFilterCount > 0 && (
              <span className="rounded-full bg-[#0D3594] px-1.5 py-0.2 text-[10px] font-bold text-white dark:bg-blue-500">
                {extraFilterCount}
              </span>
            )}
          </button>

          {moreOpen && (
            <div
              role="dialog"
              aria-label="More filters and sorting"
              className="absolute left-0 z-30 mt-1.5 w-64 space-y-3 rounded-xl border border-[#EDEDF2] bg-white p-3.5 shadow-lg dark:border-slate-700 dark:bg-[#161B26]"
            >
              <div>
                <label
                  htmlFor="pc-priority-filter"
                  className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400"
                >
                  Priority
                </label>
                <select
                  id="pc-priority-filter"
                  value={priority}
                  onChange={(e) =>
                    onPriorityChange(e.target.value as "ALL" | ActivityPriority)
                  }
                  className="mt-1.5 min-h-[44px] w-full rounded-lg border border-[#DDE1EA] bg-white px-2.5 py-2 text-xs font-semibold text-[#111625] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                >
                  <option value="ALL">All priorities</option>
                  {[...ACTIVITY_PRIORITIES].reverse().map((p) => (
                    <option key={p} value={p}>
                      {ACTIVITY_PRIORITY_META[p].label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="pc-sort-filter"
                  className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400"
                >
                  Sort by
                </label>
                <select
                  id="pc-sort-filter"
                  value={sortBy}
                  onChange={(e) =>
                    onSortByChange(e.target.value as "SCHEDULE" | "PRIORITY")
                  }
                  className="mt-1.5 min-h-[44px] w-full rounded-lg border border-[#DDE1EA] bg-white px-2.5 py-2 text-xs font-semibold text-[#111625] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                >
                  <option value="SCHEDULE">Start date (soonest first)</option>
                  <option value="PRIORITY">Priority (highest first)</option>
                </select>
              </div>

              {extraFilterCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onPriorityChange("ALL");
                    onSortByChange("SCHEDULE");
                  }}
                  className="min-h-[44px] w-full cursor-pointer rounded-lg border border-[#DDE1EA] px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Reset priority &amp; sort
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* View switcher: List | Board | Calendar */}
      <div
        role="group"
        aria-label="Project Center view"
        className="inline-flex self-start rounded-xl border border-[#DDE1EA] bg-white p-1 dark:border-slate-700 dark:bg-[#161B26]"
      >
        {(
          [
            ["LIST", List, "List"],
            ["BOARD", LayoutGrid, "Board"],
            ["CALENDAR", CalendarDays, "Calendar"],
          ] as const
        ).map(([mode, Icon, label]) => {
          const active = view === mode;
          return (
            <button
              key={mode}
              type="button"
              aria-pressed={active}
              onClick={() => onViewChange(mode)}
              className={`inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? "bg-[#0D3594] text-white dark:bg-blue-600"
                  : "text-slate-600 hover:text-[#111625] dark:text-slate-300 dark:hover:text-white"
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

