"use client";

import React from "react";
import Link from "next/link";
import {
  DRAFT_STARTING_SOON_DAYS,
  needsAttention,
  type ProjectStageTab,
} from "@/features/activities/project-center-rules";
import type { ActivitySummaryDTO } from "@/features/activities/types";
import { ProjectGroup } from "./project-group";
import { ProjectRow } from "./project-row";

export function ProjectList({
  activeTab,
  items,
  totalInWorkspace,
  hasActiveFilters,
  sortBy,
  currentUserId,
  assignedTaskProjectIds,
  canCreate,
  canManageActivity,
  pending = false,
  now,
  draftReadinessDays = DRAFT_STARTING_SOON_DAYS,
  onClearFilters,
  onSwitchTab,
  onOpenGuide,
  onRequestArchive,
  onRestore,
}: {
  activeTab: ProjectStageTab;
  items: ActivitySummaryDTO[];
  totalInWorkspace: number;
  hasActiveFilters: boolean;
  sortBy: "SCHEDULE" | "PRIORITY";
  currentUserId: string;
  assignedTaskProjectIds?: Set<string>;
  canCreate: boolean;
  canManageActivity: (activity: ActivitySummaryDTO) => boolean;
  pending?: boolean;
  now?: Date;
  draftReadinessDays?: number;
  onClearFilters: () => void;
  onSwitchTab: (tab: ProjectStageTab) => void;
  onOpenGuide: () => void;
  onRequestArchive: (activity: ActivitySummaryDTO) => void;
  onRestore: (activity: ActivitySummaryDTO) => void;
}) {
  const referenceNow = now ?? new Date();

  if (items.length === 0) {
    if (hasActiveFilters || totalInWorkspace > 0) {
      if (hasActiveFilters) {
        return (
          <div className="rounded-xl border border-[#EDEDF2] bg-white px-6 py-12 text-center dark:border-slate-800 dark:bg-[#161B26]">
            <p className="text-sm font-semibold text-[#111625] dark:text-white">
              No activities match your current search or filters.
            </p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Try adjusting your keywords, activity type, priority, or assignment toggle.
            </p>
            <button
              type="button"
              onClick={onClearFilters}
              className="mt-4 inline-flex min-h-[44px] cursor-pointer items-center rounded-xl border border-[#DDE1EA] bg-white px-4 py-2 text-xs font-semibold text-[#111625] transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
            >
              Clear filters
            </button>
          </div>
        );
      }
    }

    if (activeTab === "MISSED") {
      return (
        <div className="rounded-xl border border-[#EDEDF2] bg-white px-6 py-12 text-center dark:border-slate-800 dark:bg-[#161B26]">
          <p className="text-sm font-semibold text-[#111625] dark:text-white">
            No missed or overdue activities.
          </p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Every draft and planned schedule is currently up to date.
          </p>
          <button
            type="button"
            onClick={() => onSwitchTab("UPCOMING")}
            className="mt-4 inline-flex min-h-[44px] cursor-pointer items-center rounded-xl border border-[#DDE1EA] bg-white px-4 py-2 text-xs font-semibold text-[#111625] transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
          >
            View upcoming
          </button>
        </div>
      );
    }

    if (activeTab === "ARCHIVED") {
      return (
        <div className="rounded-xl border border-[#EDEDF2] bg-white px-6 py-12 text-center dark:border-slate-800 dark:bg-[#161B26]">
          <p className="text-sm font-semibold text-[#111625] dark:text-white">
            No archived activities yet.
          </p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Archived projects and activities are preserved read-only for District reporting and audit trails.
          </p>
          <button
            type="button"
            onClick={() => onSwitchTab("UPCOMING")}
            className="mt-4 inline-flex min-h-[44px] cursor-pointer items-center rounded-xl border border-[#DDE1EA] bg-white px-4 py-2 text-xs font-semibold text-[#111625] transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
          >
            View upcoming
          </button>
        </div>
      );
    }

    if (activeTab === "ONGOING") {
      return (
        <div className="rounded-xl border border-[#EDEDF2] bg-white px-6 py-12 text-center dark:border-slate-800 dark:bg-[#161B26]">
          <p className="text-sm font-semibold text-[#111625] dark:text-white">
            No activities are currently ongoing.
          </p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Open an upcoming activity and mark it Ongoing once event execution or attendance check-in starts.
          </p>
          <button
            type="button"
            onClick={() => onSwitchTab("UPCOMING")}
            className="mt-4 inline-flex min-h-[44px] cursor-pointer items-center rounded-xl border border-[#DDE1EA] bg-white px-4 py-2 text-xs font-semibold text-[#111625] transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
          >
            View upcoming
          </button>
        </div>
      );
    }

    if (activeTab === "REPORT_DUE") {
      return (
        <div className="rounded-xl border border-[#EDEDF2] bg-white px-6 py-12 text-center dark:border-slate-800 dark:bg-[#161B26]">
          <p className="text-sm font-semibold text-[#111625] dark:text-white">
            No projects are waiting for a report.
          </p>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-600 dark:text-slate-400">
            When a Service or Joint project finishes live execution, mark it Awaiting Report so officers can complete the 6 Rotary Showcase fields and attach a photo.
          </p>
          <button
            type="button"
            onClick={onOpenGuide}
            className="mt-4 inline-flex min-h-[44px] cursor-pointer items-center rounded-xl border border-[#DDE1EA] bg-white px-4 py-2 text-xs font-semibold text-[#111625] transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
          >
            How publishing a project works
          </button>
        </div>
      );
    }

    if (activeTab === "ACCOMPLISHED") {
      return (
        <div className="rounded-xl border border-[#EDEDF2] bg-white px-6 py-12 text-center dark:border-slate-800 dark:bg-[#161B26]">
          <p className="text-sm font-semibold text-[#111625] dark:text-white">
            No accomplished projects yet.
          </p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Completed activities and published service project reports will appear here.
          </p>
          <button
            type="button"
            onClick={() => onSwitchTab("UPCOMING")}
            className="mt-4 inline-flex min-h-[44px] cursor-pointer items-center rounded-xl border border-[#DDE1EA] bg-white px-4 py-2 text-xs font-semibold text-[#111625] transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
          >
            View upcoming
          </button>
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-[#EDEDF2] bg-white px-6 py-12 text-center dark:border-slate-800 dark:bg-[#161B26]">
        <p className="text-sm font-semibold text-[#111625] dark:text-white">
          No upcoming activities in this view.
        </p>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          Create a new club activity, meeting, or service project to get started.
        </p>
        {canCreate && (
          <Link
            href="/project-center/new"
            className="mt-4 inline-flex min-h-[44px] items-center rounded-xl bg-[#0D3594] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#092569]"
          >
            New activity
          </Link>
        )}
      </div>
    );
  }

  if (activeTab === "UPCOMING") {
    const attentionItems = items.filter((item) =>
      needsAttention(item, referenceNow, draftReadinessDays),
    );
    const comingUpItems = items
      .filter((item) => !needsAttention(item, referenceNow, draftReadinessDays))
      .sort((a, b) =>
        sortBy === "PRIORITY" ? 0 : a.startAt.localeCompare(b.startAt),
      );

    return (
      <div className="space-y-4">
        {attentionItems.length > 0 && (
          <ProjectGroup
            title="Needs attention"
            count={attentionItems.length}
            subtitle={`Drafts starting within ${draftReadinessDays} ${draftReadinessDays === 1 ? "day" : "days"}`}
            tone="attention"
          >
            {attentionItems.map((activity) => (
              <ProjectRow
                key={activity.id}
                activity={activity}
                currentUserId={currentUserId}
                assignedTaskProjectIds={assignedTaskProjectIds}
                canManage={canManageActivity(activity)}
                pending={pending}
                now={referenceNow}
                onRequestArchive={onRequestArchive}
                onRestore={onRestore}
              />
            ))}
          </ProjectGroup>
        )}

        {comingUpItems.length > 0 && (
          <ProjectGroup
            title="Coming up"
            count={comingUpItems.length}
            subtitle={
              sortBy === "PRIORITY"
                ? "Sorted by priority"
                : "Sorted by start date"
            }
          >
            {comingUpItems.map((activity) => (
              <ProjectRow
                key={activity.id}
                activity={activity}
                currentUserId={currentUserId}
                assignedTaskProjectIds={assignedTaskProjectIds}
                canManage={canManageActivity(activity)}
                pending={pending}
                now={referenceNow}
                onRequestArchive={onRequestArchive}
                onRestore={onRestore}
              />
            ))}
          </ProjectGroup>
        )}
      </div>
    );
  }

  if (activeTab === "MISSED") {
    const missedSorted =
      sortBy === "PRIORITY"
        ? items
        : [...items].sort((a, b) => b.endAt.localeCompare(a.endAt));

    return (
      <ProjectGroup
        title="Missed"
        count={missedSorted.length}
        subtitle="Scheduled end date has passed — update status or reschedule"
        tone="attention"
      >
        {missedSorted.map((activity) => (
          <ProjectRow
            key={activity.id}
            activity={activity}
            currentUserId={currentUserId}
            assignedTaskProjectIds={assignedTaskProjectIds}
            canManage={canManageActivity(activity)}
            pending={pending}
            now={referenceNow}
            onRequestArchive={onRequestArchive}
            onRestore={onRestore}
          />
        ))}
      </ProjectGroup>
    );
  }

  return (
    <div className="rounded-xl border border-[#EDEDF2] bg-white dark:border-slate-800 dark:bg-[#161B26]">
      {items.map((activity) => (
        <ProjectRow
          key={activity.id}
          activity={activity}
          currentUserId={currentUserId}
          assignedTaskProjectIds={assignedTaskProjectIds}
          canManage={canManageActivity(activity)}
          pending={pending}
          now={referenceNow}
          onRequestArchive={onRequestArchive}
          onRestore={onRestore}
        />
      ))}
    </div>
  );
}

