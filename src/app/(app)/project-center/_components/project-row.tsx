"use client";

import React from "react";
import Link from "next/link";
import { MessageSquareText, Repeat, User } from "lucide-react";
import {
  formatCompactWhenManila,
  formatRelativeWhenManila,
  getAssignmentInfo,
  getContextualRowAction,
  getRowVisualStatus,
  needsAttention,
} from "@/features/activities/project-center-rules";
import {
  formatRecurrenceSummary,
  getNextActivityOccurrence,
  isRecurringSchedule,
} from "@/features/activities/recurrence";
import {
  ACTIVITY_KIND_META,
  ACTIVITY_PRIORITY_META,
  type ActivitySummaryDTO,
} from "@/features/activities/types";
import { StatusPill } from "./status-pill";
import { StepProgress } from "./step-progress";
import { RowActionMenu } from "./row-action-menu";

export function ProjectRow({
  activity,
  currentUserId,
  assignedTaskProjectIds,
  canManage,
  pending = false,
  now,
  onRequestArchive,
  onRestore,
}: {
  activity: ActivitySummaryDTO;
  currentUserId: string;
  assignedTaskProjectIds?: Set<string>;
  canManage: boolean;
  pending?: boolean;
  now?: Date;
  onRequestArchive: (activity: ActivitySummaryDTO) => void;
  onRestore: (activity: ActivitySummaryDTO) => void;
}) {
  const referenceNow = now ?? new Date();
  const attention = needsAttention(activity, referenceNow);
  const visualStatus = getRowVisualStatus(activity, referenceNow);
  const action = getContextualRowAction(activity, referenceNow);
  const kindLabel = ACTIVITY_KIND_META[activity.kind]?.label ?? activity.kind;
  const assignment = getAssignmentInfo(
    activity,
    currentUserId,
    assignedTaskProjectIds,
  );
  const showPriority =
    Boolean(activity.priority) && activity.priority !== "MEDIUM";
  const priorityLabel = ACTIVITY_PRIORITY_META[activity.priority]?.label;

  const actionClass =
    action.tone === "attention"
      ? "border-amber-400/70 bg-transparent text-amber-800 hover:bg-amber-50 dark:border-amber-500/50 dark:text-amber-300 dark:hover:bg-amber-950/40"
      : action.tone === "primary"
        ? "border-[#0D3594] bg-[#0D3594] text-white hover:bg-[#092569] dark:border-blue-500 dark:bg-blue-600 dark:hover:bg-blue-500"
        : "border-[#DDE1EA] bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100 dark:hover:bg-slate-800";

  return (
    <div
      className="grid gap-3 border-b border-[#EDEDF2] px-4 py-3.5 last:border-b-0 transition hover:bg-slate-50/70 dark:border-slate-800 dark:hover:bg-slate-800/35 md:grid-cols-[minmax(240px,2.2fr)_minmax(160px,1fr)_minmax(165px,1fr)_auto] md:items-center md:gap-4"
      data-testid={`project-row-${activity.id}`}
    >
      {/* Column 1: Name + plain muted metadata & person mark */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Link
            href={action.href}
            title={activity.title}
            className="min-w-0 truncate text-sm font-semibold text-[#111625] hover:text-[#0D3594] hover:underline dark:text-white dark:hover:text-blue-300"
          >
            {activity.title}
          </Link>
          {showPriority && priorityLabel && (
            <span className="shrink-0 rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {priorityLabel}
            </span>
          )}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
          <span>
            {kindLabel} · {activity.rsvp.going} going
          </span>
          {isRecurringSchedule(activity.recurrence) && (
            <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-[#0D3594] dark:bg-blue-500/15 dark:text-blue-300">
              <Repeat className="h-2.5 w-2.5" />
              {formatRecurrenceSummary(
                activity.recurrence,
                activity.startAt,
                activity.endAt,
              )}
            </span>
          )}
          {Boolean(activity.minMembersRequired) && (
            <span
              title={`Minimum ${activity.minMembersRequired} members required for quorum`}
              className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.2 text-[10px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300"
            >
              Min {activity.minMembersRequired}
            </span>
          )}
          {(assignment.myLabel || assignment.leadName) && (
            <span
              className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.2 text-[10px] font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300"
              title={
                assignment.myLabel && assignment.leadName
                  ? `${assignment.myLabel} · Lead: ${assignment.leadName}`
                  : assignment.myLabel || `Lead: ${assignment.leadName}`
              }
            >
              <User className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
              <span>
                {assignment.myLabel
                  ? assignment.leadName && assignment.myLabel !== "You (Lead)"
                    ? `${assignment.myLabel} · Lead: ${assignment.leadName}`
                    : assignment.myLabel
                  : `Lead: ${assignment.leadName}`}
              </span>
            </span>
          )}
        </div>
        {activity.isArchived && activity.archivedReason && (
          <p className="mt-1.5 flex items-start gap-1.5 rounded-lg border border-slate-200/80 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600 dark:border-slate-700/70 dark:bg-slate-800/60 dark:text-slate-300">
            <MessageSquareText
              className="mt-0.5 h-3 w-3 shrink-0 text-slate-400"
              aria-hidden="true"
            />
            <span>
              <strong className="font-semibold text-slate-700 dark:text-slate-200">
                Archive note:
              </strong>{" "}
              {activity.archivedReason}
            </span>
          </p>
        )}
      </div>

      {/* Column 2: When (Manila date range + relative line underneath) */}
      <div className="min-w-0">
        {(() => {
          const recurring = isRecurringSchedule(activity.recurrence);
          const nextOcc = recurring
            ? getNextActivityOccurrence(activity, referenceNow)
            : null;
          const nextWindowActivity = nextOcc
            ? {
                ...activity,
                startAt: nextOcc.startAt,
                endAt: nextOcc.endAt,
              }
            : activity;
          return (
            <>
              <p className="text-xs font-medium text-[#111625] dark:text-slate-200">
                {nextOcc ? `Next: ` : ""}
                {formatCompactWhenManila(nextWindowActivity)}
              </p>
              <p
                className={`mt-0.5 text-xs ${
                  attention
                    ? "font-medium text-amber-700 dark:text-amber-400"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                {recurring && nextOcc
                  ? `Session ${nextOcc.index}/${nextOcc.total} · ${formatRelativeWhenManila(nextWindowActivity, referenceNow)}`
                  : formatRelativeWhenManila(activity, referenceNow)}
              </p>
            </>
          );
        })()}
      </div>

      {/* Column 3: Status pill + segmented Step X of Y */}
      <div className="flex flex-col gap-1.5">
        <StatusPill
          status={visualStatus}
          isArchived={Boolean(activity.isArchived)}
        />
        <StepProgress kind={activity.kind} status={activity.status} />
      </div>

      {/* Column 4: Contextual button + overflow menu */}
      <div className="flex items-center justify-between gap-1.5 md:justify-end">
        <Link
          href={action.href}
          className={`inline-flex min-h-[44px] items-center justify-center rounded-lg border px-3.5 py-2 text-xs font-semibold transition ${actionClass}`}
        >
          {action.label}
        </Link>
        <RowActionMenu
          activityId={activity.id}
          activityTitle={activity.title}
          isArchived={Boolean(activity.isArchived)}
          canManage={canManage}
          showOpenItem={action.label !== "Open"}
          pending={pending}
          onRequestArchive={() => onRequestArchive(activity)}
          onRestore={() => onRestore(activity)}
        />
      </div>
    </div>
  );
}

