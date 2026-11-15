"use client";

import React from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  FileCheck2,
  ImagePlus,
  Play,
  RotateCcw,
  Sparkles,
  Flag,
} from "lucide-react";
import {
  isProjectKind,
  type ActivityDetailDTO,
  type ActivityKind,
  type ActivityStatus,
} from "@/features/activities/types";
import {
  evaluateReportReadiness,
  getLifecycleStages,
  type ReportReadinessResult,
} from "@/features/activities/rules";
import { formatManila } from "@/lib/utils/dates";

export interface ProjectLifecycleBannerProps {
  activity: ActivityDetailDTO;
  canManage: boolean;
  pending: boolean;
  activeTab: string;
  onStatusChange: (nextStatus: ActivityStatus, openReportAfter?: boolean) => void;
  onNavigateTab: (tab: "OVERVIEW" | "TASKS" | "ATTENDANCE" | "DISCUSSION" | "MEDIA" | "REPORT") => void;
}

export function computeActivityReportReadiness(
  activity: Pick<
    ActivityDetailDTO,
    "description" | "projectDetails" | "media"
  >,
): ReportReadinessResult {
  const details = activity.projectDetails;
  return evaluateReportReadiness({
    detailedDescription: activity.description,
    inspiration: details?.inspiration,
    objective: details?.objective,
    outcomesSummary: details?.outcomesSummary,
    beneficiaryType: details?.beneficiaryType,
    mediaCount: activity.media?.length || 0,
  });
}

export function ProjectLifecycleBanner({
  activity,
  canManage,
  pending,
  activeTab,
  onStatusChange,
  onNavigateTab,
}: ProjectLifecycleBannerProps) {
  const isProject = isProjectKind(activity.kind);
  const stages = getLifecycleStages(activity.status, isProject);
  const readiness = isProject ? computeActivityReportReadiness(activity) : null;

  if (activity.status === "CANCELLED") {
    return (
      <section
        aria-label="Activity lifecycle status"
        className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 sm:p-5 dark:border-rose-900/50 dark:bg-rose-950/20"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-bold text-rose-800 dark:bg-rose-900/50 dark:text-rose-200">
              Cancelled
            </span>
            <h2 className="mt-1.5 text-sm font-bold text-slate-900 dark:text-white">
              This {isProject ? "project" : "activity"} was cancelled
            </h2>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
              You can restore it to Planned if the club reschedules it.
            </p>
          </div>
          {canManage && !activity.isArchived && (
            <button
              type="button"
              disabled={pending}
              onClick={() => onStatusChange("PLANNED")}
              className="inline-flex items-center gap-1.5 self-start rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-900 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reopen as Planned
            </button>
          )}
        </div>
      </section>
    );
  }

  const isFinished =
    activity.status === "ACCOMPLISHED" ||
    (!isProject && activity.status === "COMPLETED");

  return (
    <section
      aria-label="Project completion workflow"
      className={`overflow-hidden rounded-2xl border transition-all ${
        isFinished
          ? "border-emerald-200/90 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/50 dark:border-emerald-500/30 dark:from-emerald-950/30 dark:via-[#161B26] dark:to-emerald-950/10"
          : activity.status === "AWAITING_REPORT"
            ? "border-amber-200/90 bg-gradient-to-br from-amber-50/70 via-white to-orange-50/40 dark:border-amber-500/30 dark:from-amber-950/25 dark:via-[#161B26] dark:to-amber-950/10"
            : "border-[#E4E7EF] bg-white shadow-2xs dark:border-slate-800 dark:bg-[#161B26]"
      }`}
    >
      {/* Top Header & Visual Stepper */}
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-[#0D3594]/10 text-[#0D3594] dark:bg-blue-500/15 dark:text-blue-300">
              <Flag className="h-3.5 w-3.5" />
            </span>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                {isProject
                  ? "Service Project Lifecycle & Accomplishment Flow"
                  : "Activity Lifecycle"}
              </h2>
            </div>
          </div>

          {isProject && readiness && !isFinished && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Report Readiness:
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  readiness.ready
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300"
                    : "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
                }`}
              >
                {readiness.ready ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <ClipboardCheck className="h-3 w-3" />
                )}
                {readiness.completedCount}/{readiness.totalCount} Ready (
                {readiness.percent}%)
              </span>
            </div>
          )}
        </div>

        {/* Stepper Track */}
        <ol
          className={`mt-4 grid gap-3 ${
            stages.length === 4
              ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
              : "grid-cols-1 sm:grid-cols-3"
          }`}
        >
          {stages.map((stage) => {
            const isCompleted = stage.state === "completed";
            const isCurrent = stage.state === "current";
            return (
              <li
                key={stage.status}
                className={`relative flex items-start gap-3 rounded-xl border p-3 transition ${
                  isCompleted
                    ? "border-emerald-200/80 bg-emerald-50/50 dark:border-emerald-500/25 dark:bg-emerald-500/10"
                    : isCurrent
                      ? "border-[#0D3594] bg-[#0D3594]/[0.04] ring-2 ring-[#0D3594]/15 dark:border-blue-400 dark:bg-blue-500/10 dark:ring-blue-400/20"
                      : "border-slate-200/70 bg-slate-50/50 opacity-75 dark:border-slate-800 dark:bg-slate-900/40"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    isCompleted
                      ? "bg-emerald-600 text-white"
                      : isCurrent
                        ? "bg-[#0D3594] text-white dark:bg-blue-500"
                        : "border border-slate-300 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                >
                  {isCompleted ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    stage.stepNumber
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p
                      className={`text-xs font-bold leading-snug ${
                        isCompleted
                          ? "text-emerald-900 dark:text-emerald-200"
                          : isCurrent
                            ? "text-[#0D3594] dark:text-blue-300"
                            : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {stage.label}
                    </p>
                    {isCurrent && (
                      <span className="inline-flex items-center rounded bg-[#0D3594]/10 px-1.5 py-0.2 text-[9px] font-extrabold uppercase tracking-wide text-[#0D3594] dark:bg-blue-400/20 dark:text-blue-200">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                    {stage.description}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Contextual Action & Guidance Footer */}
      {!activity.isArchived && (
        <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-3.5 sm:px-5 dark:border-slate-800/80 dark:bg-slate-900/50">
          {/* Case 1: Service Project in DRAFT or PLANNED */}
          {isProject && ["DRAFT", "PLANNED"].includes(activity.status) && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  {activity.status === "DRAFT"
                    ? "Step 1: Publish this draft when your schedule and details are ready"
                    : "Next Step: Start execution when the project begins"}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {activity.status === "DRAFT"
                    ? "Publishing makes the project visible to club members for RSVPs and task assignments."
                    : "Move to Ongoing during project execution, or jump ahead to pre-fill the Accomplishment Report."}
                </p>
              </div>
              {canManage && (
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {activity.status === "DRAFT" ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => onStatusChange("PLANNED")}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#0D3594] px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#092569] disabled:opacity-60 transition cursor-pointer"
                    >
                      <Play className="h-3.5 w-3.5" />
                      Publish as Planned
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => onStatusChange("ONGOING")}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#0D3594] px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#092569] disabled:opacity-60 transition cursor-pointer"
                      >
                        <Play className="h-3.5 w-3.5" />
                        Start Project (Mark Ongoing)
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => onNavigateTab("REPORT")}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
                      >
                        <ClipboardCheck className="h-3.5 w-3.5 text-emerald-600" />
                        Preview Report Checklist
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Case 2: Service Project in ONGOING or AWAITING_REPORT */}
          {isProject &&
            ["ONGOING", "AWAITING_REPORT", "COMPLETED"].includes(
              activity.status,
            ) &&
            readiness && (
              <div className="space-y-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-900 dark:text-white">
                        <CircleDot className="h-3.5 w-3.5 text-[#0D3594] dark:text-blue-400" />
                        {activity.status === "ONGOING"
                          ? "How to mark this project as Accomplished:"
                          : "Ready for Final Step — Publish Accomplishment Report:"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      {readiness.ready
                        ? "All 6 Rotary Showcase requirements are met! Open the Report tab and click 'Publish as Accomplished'."
                        : `Service projects finish by publishing their Accomplishment Report. Complete the remaining ${
                            readiness.totalCount - readiness.completedCount
                          } requirement${
                            readiness.totalCount - readiness.completedCount === 1
                              ? ""
                              : "s"
                          } below:`}
                    </p>
                  </div>

                  {canManage && (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {activity.status === "ONGOING" && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => onStatusChange("AWAITING_REPORT", true)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200 transition cursor-pointer"
                        >
                          <ClipboardCheck className="h-3.5 w-3.5" />
                          Wrap Up Execution → Awaiting Report
                        </button>
                      )}
                      {activity.status === "AWAITING_REPORT" && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => onStatusChange("ONGOING")}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition cursor-pointer"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Back to Ongoing
                        </button>
                      )}
                      {activeTab !== "REPORT" && (
                        <button
                          type="button"
                          onClick={() => onNavigateTab("REPORT")}
                          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-xs transition cursor-pointer ${
                            readiness.ready
                              ? "bg-emerald-600 hover:bg-emerald-700"
                              : "bg-[#0D3594] hover:bg-[#092569]"
                          }`}
                        >
                          <FileCheck2 className="h-3.5 w-3.5" />
                          {readiness.ready
                            ? "Review & Publish as Accomplished"
                            : `Complete Report (${readiness.completedCount}/${readiness.totalCount})`}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Interactive Checklist Pills */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {readiness.items.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => onNavigateTab(item.targetTab)}
                      title={`${item.hint} — Click to open ${item.targetTab === "MEDIA" ? "Media" : "Report"} tab`}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer ${
                        item.done
                          ? "border-emerald-200 bg-emerald-50/90 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300"
                          : "border-amber-200 bg-white text-slate-700 hover:border-[#0D3594] hover:text-[#0D3594] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      }`}
                    >
                      {item.done ? (
                        <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                      ) : item.key === "photo" ? (
                        <ImagePlus className="h-3 w-3 text-amber-600" />
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      )}
                      <span>{item.label}</span>
                      {!item.done && item.minChars && (
                        <span className="text-[10px] font-normal text-slate-400">
                          ({item.currentChars || 0}/{item.minChars})
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

          {/* Case 3: Service Project ACCOMPLISHED */}
          {isProject && activity.status === "ACCOMPLISHED" && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                    Project Officially Accomplished & Logged
                    {activity.projectDetails?.completedAt
                      ? ` · ${formatManila(activity.projectDetails.completedAt, "MMM d, yyyy")}`
                      : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                    Impact snapshot saved ({activity.projectDetails?.beneficiaryCount || 0}{" "}
                    beneficiaries · {activity.attendees.length} checked-in volunteers).
                  </p>
                </div>
              </div>
              {activeTab !== "REPORT" && (
                <button
                  type="button"
                  onClick={() => onNavigateTab("REPORT")}
                  className="inline-flex items-center gap-1.5 self-start rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition cursor-pointer shrink-0"
                >
                  <FileCheck2 className="h-3.5 w-3.5" />
                  View Accomplishment Report & Showcase Copy
                </button>
              )}
            </div>
          )}

          {/* Case 4: Non-Project Activity (Meeting, Fellowship, etc.) */}
          {!isProject && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  {activity.status === "DRAFT"
                    ? "Step 1: Publish this activity as Planned"
                    : activity.status === "PLANNED"
                      ? "Next Step: Mark as Ongoing when the activity starts, or Mark Completed when done"
                      : activity.status === "ONGOING"
                        ? "Activity is currently Ongoing — click 'Mark as Completed' once finished"
                        : "This activity is marked as Completed"}
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {activity.attendees.length} member
                  {activity.attendees.length === 1 ? "" : "s"} checked in ·{" "}
                  {activity.rsvp.going} RSVP&apos;d Going
                </p>
              </div>
              {canManage && (
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {activity.status === "DRAFT" && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => onStatusChange("PLANNED")}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#0D3594] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#092569] disabled:opacity-60 cursor-pointer"
                    >
                      <Play className="h-3.5 w-3.5" />
                      Publish as Planned
                    </button>
                  )}
                  {activity.status === "PLANNED" && (
                    <>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => onStatusChange("ONGOING")}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#0D3594] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#092569] disabled:opacity-60 cursor-pointer"
                      >
                        <Play className="h-3.5 w-3.5" />
                        Start Activity (Ongoing)
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => onStatusChange("COMPLETED")}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 cursor-pointer"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Mark as Completed
                      </button>
                    </>
                  )}
                  {activity.status === "ONGOING" && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => onStatusChange("COMPLETED")}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-60 cursor-pointer"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Mark Activity as Completed
                    </button>
                  )}
                  {activity.status === "COMPLETED" && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => onStatusChange("ONGOING")}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reopen to Ongoing
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * Compact stage progress indicator for Project Center list rows and cards.
 */
export function CompactLifecycleIndicator({
  kind,
  status,
}: {
  kind: ActivityKind;
  status: ActivityStatus;
}) {
  const isProject = isProjectKind(kind);
  if (status === "CANCELLED") {
    return (
      <span className="text-[10px] font-medium text-rose-500">
        Cancelled
      </span>
    );
  }
  const stages = getLifecycleStages(status, isProject);
  const currentIdx = stages.findIndex((s) => s.state === "current");
  const completedCount = stages.filter((s) => s.state === "completed").length;
  const stepDisplay =
    completedCount === stages.length
      ? `${stages.length}/${stages.length}`
      : `${Math.max(1, currentIdx + 1)}/${stages.length}`;

  return (
    <div
      className="inline-flex items-center gap-1.5"
      title={
        isProject
          ? `Project Flow: Step ${stepDisplay} (${stages.map((s) => s.shortLabel).join(" → ")})`
          : `Activity Flow: Step ${stepDisplay}`
      }
    >
      <div className="flex items-center gap-0.5">
        {stages.map((s) => (
          <span
            key={s.status}
            className={`h-1.5 w-3 rounded-full ${
              s.state === "completed"
                ? "bg-emerald-500"
                : s.state === "current"
                  ? s.status === "AWAITING_REPORT"
                    ? "bg-amber-500"
                    : "bg-[#0D3594] dark:bg-blue-400"
                  : "bg-slate-200 dark:bg-slate-700"
            }`}
          />
        ))}
      </div>
      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
        Step {stepDisplay}
      </span>
    </div>
  );
}

