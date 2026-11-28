"use client";

import React, { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Archive,
  Lock,
  ArchiveRestore,
  ArrowLeft,
  Ban,
  CalendarDays,
  Check,
  CheckSquare,
  Clock,
  Copy,
  Download,
  Heart,
  HeartHandshake,
  ImagePlus,
  MapPin,
  MessageSquare,
  Paintbrush,
  PauseCircle,
  PlayCircle,
  Plus,
  QrCode,
  RefreshCw,
  Repeat,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
  Pencil,
  Shield,
  Sliders,
  Sparkles,
  UserCheck,
  X,
} from "lucide-react";
import type { ActivityDetailDTO } from "@/features/activities/types";
import {
  expandActivityOccurrences,
  formatRecurrenceSummary,
  getNextActivityOccurrence,
  isRecurringSchedule,
} from "@/features/activities/recurrence";
import type { GroupTaskDTO } from "@/lib/data/tasks-types";
import {
  addCommentAction,
  deleteActivityMediaAction,
  deleteCommentAction,
  manualCheckInMemberAction,
  publishProjectReportAction,
  saveProjectReportDraftAction,
  revokeActivityQrSessionAction,
  revokeAttendanceAction,
  selfCheckInAction,
  setRsvpAction,
  setCoverMediaAction,
  startActivityQrSessionAction,
  toggleActivityQrCheckInAction,
  toggleFollowAction,
  toggleReactionAction,
  updateActivityQrSessionStatusAction,
  updateActivityPriorityAction,
  updateActivityStatusAction,
  uploadActivityMediaAction,
} from "@/features/activities/actions";
import { archiveActivityAction, hardDeleteActivityAction } from "@/features/activities/actions";
import type { MemberDTO } from "@/features/members/queries";
import {
  isProjectKind,
  ACTIVITY_KIND_META,
  ACTIVITY_PRIORITIES,
  ACTIVITY_PRIORITY_META,
  ACTIVITY_STATUSES,
  ACTIVITY_STATUS_LABELS,
  type ActivityPriority,
  type ActivityStatus,
} from "@/features/activities/types";
import {
  allowedTransitions,
  deduplicateActivityLog,
  DEFAULT_QR_EXPIRATION_MINUTES,
  evaluateReportReadiness,
  formatActivityLogEntry,
  minMembersStatus,
  QR_EXPIRATION_OPTIONS,
  type QrSessionStatus,
} from "@/features/activities/rules";
import { formatManila } from "@/lib/utils/dates";
import { EditActivityModal, type EditModalSection } from "./edit-activity-modal";
import { ArchiveReasonModal } from "../_components/archive-reason-modal";
import { ProjectTasksBoard } from "./project-tasks-board";
import { notifyToast } from "@/components/shared/toast-viewport";
import { uploadActivityPhotos } from "@/features/activities/media-upload";
import {
  ActivityStatusBadge,
  Avatar,
  KindBadge,
  PriorityBadge,
  ProgressBar,
} from "../_components/badges";
import { DiscussionPaintCanvas } from "../_components/discussion-paint-canvas";
import { RsvpButtons } from "../_components/rsvp-buttons";
import { formatActivityWhen, isRsvpOpen } from "../_components/activity-card";
import {
  computeActivityReportReadiness,
  ProjectLifecycleBanner,
} from "../_components/project-lifecycle-guide";

type Tab =
  "OVERVIEW" | "TASKS" | "ATTENDANCE" | "DISCUSSION" | "MEDIA" | "REPORT";
const TABS: {
  id: Tab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "OVERVIEW", label: "Overview", icon: CalendarDays },
  { id: "TASKS", label: "Tasks", icon: CheckSquare },
  { id: "ATTENDANCE", label: "Attendance", icon: Users },
  { id: "DISCUSSION", label: "Discussion", icon: MessageSquare },
  { id: "MEDIA", label: "Media", icon: ImagePlus },
  { id: "REPORT", label: "Report", icon: ShieldCheck },
];

export interface PartnerClubOption {
  id: string;
  name: string;
  district: string;
  country: string;
}

export function ActivityDetailClient({
  initialActivity,
  initialTasks,
  initialTab,
  currentUserId,
  canCreateTasks,
  canManageClub,
  isPlatformAdmin = false,
  members = [],
  partnerClubs = [],
}: {
  initialActivity: ActivityDetailDTO;
  initialTasks: GroupTaskDTO[];
  initialTab?: string;
  currentUserId: string;
  canCreateTasks: boolean;
  canManageClub: boolean;
  isPlatformAdmin?: boolean;
  members?: MemberDTO[];
  partnerClubs?: PartnerClubOption[];
}) {
  const router = useRouter();
  const [activity, setActivity] = useOptimistic(
    initialActivity,
    (current, update: Partial<ActivityDetailDTO>) => ({
      ...current,
      ...update,
    }),
  );
  const tasks = initialTasks;
  const [tab, setTab] = useState<Tab>(() =>
    TABS.some((item) => item.id.toLowerCase() === initialTab?.toLowerCase())
      ? (initialTab!.toUpperCase() as Tab)
      : "OVERVIEW",
  );
  const [pending, startTransition] = useTransition();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editModalSection, setEditModalSection] =
    useState<EditModalSection>("BASICS");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  function openEditModal(section: EditModalSection = "BASICS") {
    setEditModalSection(section);
    setIsEditOpen(true);
  }

  async function handleHardDelete() {
    setIsDeleting(true);
    try {
      const res = await hardDeleteActivityAction(activity.id);
      if (!res.success) {
        notifyToast({
          title: "Delete failed",
          message: res.error || "Could not delete activity.",
          kind: "error",
        });
        setIsDeleting(false);
        return;
      }
      notifyToast({
        title: "Project permanently deleted",
        message:
          res.message || `'${activity.title}' has been permanently deleted.`,
        kind: "success",
      });
      setIsDeleteModalOpen(false);
      router.push("/project-center");
    } catch (err) {
      notifyToast({
        title: "Error",
        message: err instanceof Error ? err.message : "Something went wrong.",
        kind: "error",
      });
      setIsDeleting(false);
    }
  }
  const canEdit =
    canManageClub || activity.canManage || activity.ownerId === currentUserId;
  const canReassignOwner = isPlatformAdmin || canManageClub;
  const isOwnerOrOfficer =
    canManageClub || isPlatformAdmin || activity.canManage || activity.ownerId === currentUserId;
  const isCommitteeMember = (activity.team || []).some(
    (t) => t.profileId === currentUserId,
  );
  const isGoing = activity.myRsvp === "GOING" || Boolean(activity.checkedIn);
  const isUnlocked = isOwnerOrOfficer || isCommitteeMember || isGoing;

  function handleUnlockGoing() {
    startTransition(async () => {
      setActivity({ myRsvp: "GOING" });
      const res = await setRsvpAction({ activityId: activity.id, response: "GOING" });
      if (!res.success) {
        notifyToast({
          title: "RSVP failed",
          message: res.error || "Could not update RSVP status.",
          kind: "error",
        });
        return;
      }
      notifyToast({
        title: "Project Unlocked! 🎉",
        message: "You are marked as Going. Inside information, tasks, and discussions are now accessible.",
        kind: "success",
      });
      router.refresh();
    });
  }

  const isProject = isProjectKind(activity.kind);
  const canRsvp = isRsvpOpen(activity);
  const minStatus = minMembersStatus(
    activity.rsvp.going,
    activity.minMembersRequired,
  );

  function run(
    action: () => Promise<{
      success: boolean;
      message?: string;
      error?: string;
    }>,
    fallback: string,
  ) {
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        notifyToast({
          title: "Action failed",
          message: result.error || fallback,
          kind: "error",
        });
        return;
      }
      notifyToast({ message: result.message || fallback, kind: "success" });
      router.refresh();
    });
  }

  const tabs = TABS.filter((item) => item.id !== "REPORT" || isProject);

  return (
    <main className="space-y-5 pb-10">
      <Link
        href="/project-center"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#0D3594]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Project Center
      </Link>
      {activity.isArchived && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-300 bg-slate-100/90 px-4 py-3 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200">
          <div className="flex items-start gap-2.5">
            <Archive className="mt-0.5 h-4 w-4 text-slate-500 shrink-0" />
            <div className="space-y-1">
              <p>
                <strong>Archived record:</strong> This {isProject ? "project" : "activity"} has been moved to the archive. RSVPs and live check-ins are closed while historical data, attendance, and reports remain preserved.
              </p>
              {activity.archivedReason && (
                <p className="rounded-lg border border-slate-200 bg-white/80 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-200">
                  <strong>Reason:</strong> {activity.archivedReason}
                </p>
              )}
            </div>
          </div>
          {canEdit && (
            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
              <button
                type="button"
                disabled={pending || isDeleting}
                onClick={() =>
                  run(async () => {
                    const res = await archiveActivityAction(activity.id, false);
                    if (res.success)
                      setActivity({
                        isArchived: false,
                        archivedAt: null,
                        archivedReason: null,
                      });
                    return res;
                  }, "Restored to active workspace.")
                }
                className="inline-flex items-center gap-1.5 shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 transition"
              >
                <ArchiveRestore className="h-3.5 w-3.5" />
                Restore to Active
              </button>
              <button
                type="button"
                disabled={pending || isDeleting}
                onClick={() => setIsDeleteModalOpen(true)}
                className="inline-flex items-center gap-1.5 shrink-0 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60 transition shadow-2xs"
                title="Permanently remove project and media files"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Hard Delete
              </button>
            </div>
          )}
        </div>
      )}
      <section
        className={`overflow-hidden rounded-2xl border transition ${
          activity.status === "ACCOMPLISHED" || activity.status === "COMPLETED"
            ? "border-2 border-emerald-400/90 bg-gradient-to-br from-emerald-50/45 via-white to-white shadow-sm ring-1 ring-emerald-500/15 dark:border-emerald-500/50 dark:from-emerald-950/20 dark:via-[#161B26] dark:to-[#161B26]"
            : "border-[#EDEDF2] bg-white dark:border-slate-800 dark:bg-[#161B26]"
        }`}
      >
        {(activity.status === "ACCOMPLISHED" ||
          activity.status === "COMPLETED") && (
          <div className="flex flex-wrap items-center justify-between gap-2 bg-gradient-to-r from-emerald-600 via-emerald-600 to-teal-600 px-4 py-2.5 text-white">
            <div className="flex items-center gap-2 text-xs font-bold">
              <Check className="h-4 w-4 shrink-0 rounded-full bg-white/20 p-0.5" />
              <span>
                {activity.status === "ACCOMPLISHED"
                  ? "Project Accomplished & Verified — Official Impact Report Published"
                  : "Activity Completed & Logged in Club Records"}
              </span>
            </div>
            {isProject && (
              <button
                type="button"
                onClick={() => setTab("REPORT")}
                className="inline-flex items-center gap-1 rounded-lg bg-white/20 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-white/30 transition cursor-pointer"
              >
                <Sparkles className="h-3 w-3" />
                View Accomplishment Report →
              </button>
            )}
          </div>
        )}
        {activity.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={activity.coverUrl}
            alt=""
            className="h-44 w-full object-cover sm:h-56"
          />
        ) : activity.status !== "ACCOMPLISHED" &&
          activity.status !== "COMPLETED" ? (
          <div
            className={`h-1.5 w-full ${ACTIVITY_KIND_META[activity.kind].dotClass}`}
          />
        ) : null}
        <div className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <KindBadge
              kind={activity.kind}
              meetingType={activity.meetingType}
            />
            <ActivityStatusBadge status={activity.status} />
            <PriorityBadge priority={activity.priority} />
            {canEdit && !activity.isArchived && (
              <label className="inline-flex items-center gap-1 rounded-full border border-[#DDE1EA] bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <span className="sr-only">Change priority</span>
                <select
                  aria-label="Priority level"
                  disabled={pending}
                  value={activity.priority ?? "MEDIUM"}
                  onChange={(e) => {
                    const nextPriority = e.target.value as ActivityPriority;
                    run(async () => {
                      setActivity({ priority: nextPriority });
                      return updateActivityPriorityAction(
                        activity.id,
                        nextPriority,
                      );
                    }, `Priority updated to ${ACTIVITY_PRIORITY_META[nextPriority].label}.`);
                  }}
                  className="bg-transparent text-[11px] font-semibold outline-none cursor-pointer"
                >
                  {ACTIVITY_PRIORITIES.map((p) => (
                    <option key={p} value={p} className="dark:bg-slate-900">
                      Set: {ACTIVITY_PRIORITY_META[p].label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {activity.isArchived && (
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <Archive className="h-3 w-3" />
                Archived
              </span>
            )}
            {activity.qrCheckInEnabled === false && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                <Sparkles className="h-3 w-3 text-amber-500" />
                No QR Check-In Required
              </span>
            )}
            <span className="ml-auto text-xs font-medium text-slate-500">
              RY {activity.rotaryYear}
            </span>
          </div>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <h1 className="text-2xl font-bold leading-tight text-[#111625] dark:text-white">
                {activity.title}
              </h1>
              {activity.shortDescription && (
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  {activity.shortDescription}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {formatActivityWhen(activity)}
                </span>
                {activity.location && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {activity.location}
                  </span>
                )}
                {activity.ownerName && (
                  <span className="inline-flex items-center gap-1.5">
                    <Avatar name={activity.ownerName} size={20} />
                    {activity.ownerName}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {canEdit && (
                <>
                  <button
                    type="button"
                    onClick={() => openEditModal("BASICS")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                  >
                    <Pencil className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    Edit {isProject ? "Project" : "Activity"}
                  </button>
                  {!activity.isArchived && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setIsArchiveModalOpen(true)}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition disabled:opacity-60"
                    >
                      <Archive className="h-3.5 w-3.5 text-slate-500" />
                      Archive {isProject ? "Project" : "Activity"}
                    </button>
                  )}
                </>
              )}
              {!activity.isArchived && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(async () => {
                      const result = await toggleFollowAction(activity.id);
                      if (result.success)
                        setActivity({ isFollowing: result.following });
                      return result;
                    }, "Follow preference updated.")
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#EDEDF2] px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Heart
                    className={`h-3.5 w-3.5 ${activity.isFollowing ? "fill-rose-500 text-rose-500" : ""}`}
                  />{" "}
                  {activity.isFollowing ? "Following" : "Follow"}
                </button>
              )}
              {activity.selfCheckInEnabled &&
                !activity.checkedIn &&
                (!activity.rsvpEnabled || activity.myRsvp === "GOING") && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => selfCheckInAction(activity.id),
                        "Check-in recorded.",
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 cursor-pointer"
                  >
                    <Check className="h-3.5 w-3.5" /> Check in as me
                  </button>
                )}
              {activity.checkedIn && (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <Check className="h-3.5 w-3.5" /> Checked in
                </span>
              )}
            </div>
          </div>
          {canRsvp && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EDEDF2] pt-4 dark:border-slate-800">
              <div>
                <p className="text-xs font-semibold text-[#111625] dark:text-white">
                  Your response
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {activity.rsvp.going} going · {activity.rsvp.maybe} maybe ·{" "}
                  {activity.rsvp.notGoing} can&apos;t go
                </p>
              </div>
              <RsvpButtons
                activityId={activity.id}
                current={activity.myRsvp}
                onResponseChange={(next) =>
                  startTransition(() => setActivity({ myRsvp: next }))
                }
              />
            </div>
          )}
        </div>
      </section>

      <ProjectLifecycleBanner
        activity={activity}
        canManage={canEdit}
        pending={pending}
        activeTab={tab}
        onStatusChange={(nextStatus, openReportAfter) => {
          startTransition(async () => {
            setActivity({ status: nextStatus });
            const res = await updateActivityStatusAction(activity.id, nextStatus);
            if (!res.success) {
              setActivity({ status: activity.status });
              notifyToast({
                title: "Status update failed",
                message: res.error,
                kind: "error",
              });
              return;
            }
            notifyToast({
              title: "Lifecycle updated",
              message: `Moved to ${ACTIVITY_STATUS_LABELS[nextStatus]}.`,
              kind: "success",
            });
            if (openReportAfter) {
              setTab("REPORT");
            }
            router.refresh();
          });
        }}
        onNavigateTab={(nextTab) => setTab(nextTab)}
      />

      {minStatus.required && (
        <section className="rounded-xl border border-[#EDEDF2] bg-white p-4 dark:border-slate-800 dark:bg-[#161B26]">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="font-semibold text-[#111625] dark:text-white">
              Member commitment
            </span>
            <span className="text-slate-500">
              {minStatus.confirmed} of {minStatus.required} confirmed
            </span>
          </div>
          <div className="mt-2">
            <ProgressBar
              value={minStatus.confirmed}
              max={minStatus.required}
              tone={minStatus.met ? "emerald" : "amber"}
            />
          </div>
          {!minStatus.met && (
            <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">
              {minStatus.shortfall} more{" "}
              {minStatus.shortfall === 1 ? "member" : "members"} needed.
            </p>
          )}
        </section>
      )}

      {!isUnlocked && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50/80 p-4 dark:border-amber-900/60 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200">
          <div className="flex items-start sm:items-center gap-3">
            <div className="rounded-lg bg-amber-200/80 p-2 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 shrink-0">
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold">Project inside info is locked</p>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                RSVP as <strong>Going</strong> to unlock tasks, team discussions, full attendance roster, media updates, and receive project notifications.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={handleUnlockGoing}
            className="inline-flex items-center justify-center gap-1.5 shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-60 transition"
          >
            <Check className="h-3.5 w-3.5" />
            RSVP Going to Unlock
          </button>
        </div>
      )}

      <nav
        className="flex gap-1 overflow-x-auto border-b border-[#EDEDF2] dark:border-slate-800"
        aria-label="Activity sections"
      >
        {tabs.map(({ id, label, icon: Icon }) => {
          const reportReadiness =
            id === "REPORT" && isProject
              ? computeActivityReportReadiness(activity)
              : null;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-current={tab === id ? "page" : undefined}
              className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition cursor-pointer ${tab === id ? "border-[#0D3594] text-[#0D3594] dark:text-blue-300" : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              {!isUnlocked && id !== "OVERVIEW" ? (
                <Lock className="h-3 w-3 text-amber-500 ml-0.5" />
              ) : (
                <>
                  {id === "TASKS" && tasks.length > 0
                    ? ` ${tasks.length}`
                    : id === "DISCUSSION" && activity.comments.length > 0
                      ? ` ${activity.comments.length}`
                      : id === "MEDIA" && activity.media.length > 0
                        ? ` ${activity.media.length}`
                        : ""}
                  {id === "REPORT" && reportReadiness && (
                    <span
                      className={`ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                        activity.status === "ACCOMPLISHED" ||
                        reportReadiness.ready
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
                      }`}
                    >
                      {activity.status === "ACCOMPLISHED"
                        ? "✓"
                        : `${reportReadiness.completedCount}/${reportReadiness.totalCount}`}
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </nav>

      {tab === "OVERVIEW" && (
        <OverviewPanel
          activity={activity}
          tasks={tasks}
          isProject={isProject}
          isUnlocked={isUnlocked}
          canEdit={canEdit}
          onManageCommittee={() => openEditModal("TEAM")}
          onUnlock={handleUnlockGoing}
          onNavigateTab={setTab}
          pending={pending}
        />
      )}
      {tab === "TASKS" &&
        (isUnlocked ? (
          <ProjectTasksBoard
            activity={activity}
            tasks={tasks}
            canCreate={canCreateTasks}
            currentUserId={currentUserId}
            members={members}
            onTaskCreated={() => router.refresh()}
          />
        ) : (
          <LockedTabPanel
            tabName="Project Tasks"
            description="Task assignments, committee deliverables, and workflows are unlocked for confirmed participants and committee members."
            onUnlock={handleUnlockGoing}
            pending={pending}
          />
        ))}
      {tab === "ATTENDANCE" &&
        (isUnlocked ? (
          <AttendancePanel
            activity={activity}
            canManage={activity.canManageAttendance}
            members={members}
            onRefresh={() => router.refresh()}
            onSelfCheckIn={() =>
              run(() => selfCheckInAction(activity.id), "Check-in recorded.")
            }
            onRevoke={(id) =>
              run(
                () => revokeAttendanceAction(activity.id, id),
                "Attendance record removed.",
              )
            }
            onToggleQrCheckIn={(enabled) =>
              run(
                () => toggleActivityQrCheckInAction(activity.id, enabled),
                enabled ? "QR check-in enabled." : "QR check-in disabled.",
              )
            }
          />
        ) : (
          <LockedTabPanel
            tabName="Attendance & Check-in"
            description="The full attendee roster, QR scanner, and check-in records are unlocked for confirmed participants."
            onUnlock={handleUnlockGoing}
            pending={pending}
          />
        ))}
      {tab === "DISCUSSION" &&
        (isUnlocked ? (
          <DiscussionPanel
            activity={activity}
            currentUserId={currentUserId}
            onRefresh={() => router.refresh()}
          />
        ) : (
          <LockedTabPanel
            tabName="Discussion Group"
            description="Internal comments, team threads, and reaction updates are restricted to confirmed attendees and committee members."
            onUnlock={handleUnlockGoing}
            pending={pending}
          />
        ))}
      {tab === "MEDIA" &&
        (isUnlocked ? (
          <MediaPanel
            activity={activity}
            canManage={canEdit}
            onRefresh={() => router.refresh()}
          />
        ) : (
          <LockedTabPanel
            tabName="Project Media"
            description="Project photo documentation, cover galleries, and uploaded media assets are unlocked for participants."
            onUnlock={handleUnlockGoing}
            pending={pending}
          />
        ))}
      {tab === "REPORT" &&
        isProject &&
        (isUnlocked ? (
          <ReportPanel
            activity={activity}
            canManage={canEdit}
            onPublished={() => router.refresh()}
            onOpenMediaTab={() => setTab("MEDIA")}
          />
        ) : (
          <LockedTabPanel
            tabName="Accomplishment Report"
            description="Detailed reporting metrics, volunteer hours, and project impacts are unlocked for participants."
            onUnlock={handleUnlockGoing}
            pending={pending}
          />
        ))}

      {isEditOpen && (
        <EditActivityModal
          activity={activity}
          members={members}
          partnerClubs={partnerClubs}
          canReassignOwner={canReassignOwner}
          isOpen={isEditOpen}
          initialSection={editModalSection}
          onClose={() => setIsEditOpen(false)}
          onSaved={() => router.refresh()}
        />
      )}

      <ArchiveReasonModal
        key={isArchiveModalOpen ? "detail-archive-open" : "detail-archive-closed"}
        isOpen={isArchiveModalOpen}
        onClose={() => setIsArchiveModalOpen(false)}
        pending={pending}
        title={`Archive this ${isProject ? "project" : "activity"}?`}
        description={`"${activity.title}" will move to the archive. RSVPs and live check-ins will close while historical data stays preserved.`}
        confirmLabel="Archive"
        onConfirm={(reason) => {
          setIsArchiveModalOpen(false);
          const cleanReason = reason.trim();
          run(async () => {
            const res = cleanReason
              ? await archiveActivityAction(activity.id, true, cleanReason)
              : await archiveActivityAction(activity.id, true);
            if (res.success) {
              setActivity({
                isArchived: true,
                archivedAt: new Date().toISOString(),
                archivedReason: cleanReason || null,
              });
            }
            return res;
          }, "Moved to archive.");
        }}
      />

      {isDeleteModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="hard-delete-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-6 shadow-2xl dark:border-rose-900/50 dark:bg-[#161B26]">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3
                  id="hard-delete-dialog-title"
                  className="text-base font-bold text-slate-900 dark:text-white"
                >
                  Permanently delete this {isProject ? "project" : "activity"}?
                </h3>
                <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  This is a <strong>permanent hard delete</strong> and cannot be undone.
                  All associated project details, tasks, check-in records,
                  uploaded photos in storage, and reports for{" "}
                  <strong>&ldquo;{activity.title}&rdquo;</strong> will be
                  completely wiped.
                </p>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setIsDeleteModalOpen(false)}
                className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleHardDelete}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60 shadow-xs transition"
              >
                {isDeleting ? (
                  <>Deleting...</>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    Permanently Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function LockedTabPanel({
  tabName,
  description,
  onUnlock,
  pending,
}: {
  tabName: string;
  description: string;
  onUnlock: () => void;
  pending: boolean;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-8 sm:p-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400 mb-3 shadow-xs">
        <Lock className="h-6 w-6" />
      </div>
      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
        {tabName} is locked
      </h3>
      <p className="mx-auto mt-2 max-w-md text-xs sm:text-sm text-slate-600 dark:text-slate-400">
        {description}
      </p>
      <div className="mt-5 flex justify-center">
        <button
          type="button"
          disabled={pending}
          onClick={onUnlock}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-700 disabled:opacity-60 transition cursor-pointer"
        >
          <Check className="h-4 w-4" /> RSVP Going to Unlock
        </button>
      </div>
    </div>
  );
}

function OverviewPanel({
  activity,
  tasks = [],
  isProject,
  isUnlocked = true,
  canEdit = false,
  onManageCommittee,
  onUnlock,
  onNavigateTab,
  pending = false,
}: {
  activity: ActivityDetailDTO;
  tasks?: GroupTaskDTO[];
  isProject: boolean;
  isUnlocked?: boolean;
  canEdit?: boolean;
  onManageCommittee?: () => void;
  onUnlock?: () => void;
  onNavigateTab?: (tab: Tab) => void;
  pending?: boolean;
}) {
  const details = activity.projectDetails;
  const completedTasks = tasks.filter((t) => t.status === "COMPLETED").length;
  const isFinished =
    activity.status === "ACCOMPLISHED" || activity.status === "COMPLETED";

  return (
    <div className="space-y-4">
      {/* Visual At-a-Glance Summary Cards for Project Managers */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => isUnlocked && onNavigateTab?.("ATTENDANCE")}
          className="group rounded-xl border border-[#EDEDF2] bg-white p-4 text-left transition hover:border-blue-300 dark:border-slate-800 dark:bg-[#161B26] dark:hover:border-blue-500/40 cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Attendance &amp; RSVPs
            </span>
            <Users className="h-4 w-4 text-[#0D3594] dark:text-blue-400" />
          </div>
          <p className="mt-1.5 text-xl font-bold text-[#111625] dark:text-white">
            {activity.attendees.length} Checked In
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {activity.rsvp.going} going
            {activity.capacity ? ` of ${activity.capacity} spots` : ""} ·{" "}
            <span className="font-semibold text-[#0D3594] group-hover:underline dark:text-blue-300">
              Open Attendance →
            </span>
          </p>
        </button>

        <button
          type="button"
          onClick={() => isUnlocked && onNavigateTab?.("TASKS")}
          className="group rounded-xl border border-[#EDEDF2] bg-white p-4 text-left transition hover:border-blue-300 dark:border-slate-800 dark:bg-[#161B26] dark:hover:border-blue-500/40 cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Tasks &amp; Action Items
            </span>
            <CheckSquare className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-1.5 text-xl font-bold text-[#111625] dark:text-white">
            {completedTasks} / {tasks.length} Done
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {tasks.length === 0
              ? "No tasks assigned yet · "
              : `${tasks.length - completedTasks} remaining · `}
            <span className="font-semibold text-[#0D3594] group-hover:underline dark:text-blue-300">
              Manage Tasks →
            </span>
          </p>
        </button>

        {isProject && details ? (
          <button
            type="button"
            onClick={() => isUnlocked && onNavigateTab?.("REPORT")}
            className={`group rounded-xl border p-4 text-left transition cursor-pointer ${
              isFinished
                ? "border-emerald-300 bg-emerald-50/50 hover:border-emerald-400 dark:border-emerald-500/40 dark:bg-emerald-950/20"
                : "border-[#EDEDF2] bg-white hover:border-blue-300 dark:border-slate-800 dark:bg-[#161B26] dark:hover:border-blue-500/40"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Community Impact
              </span>
              <HeartHandshake className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="mt-1.5 text-xl font-bold text-[#111625] dark:text-white">
              {details.beneficiaryCount.toLocaleString()} Beneficiaries
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {details.totalVolunteerHours.toLocaleString()} vol. hrs ·{" "}
              <span className="font-semibold text-[#0D3594] group-hover:underline dark:text-blue-300">
                {isFinished ? "View Report →" : "Update Report →"}
              </span>
            </p>
          </button>
        ) : (
          <div className="rounded-xl border border-[#EDEDF2] bg-white p-4 dark:border-slate-800 dark:bg-[#161B26]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Activity Mode
              </span>
              <Sparkles className="h-4 w-4 text-violet-500" />
            </div>
            <p className="mt-1.5 text-base font-bold text-[#111625] dark:text-white">
              Club / Internal Activity
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              No beneficiary report needed · {activity.volunteerHoursDefault || 1}{" "}
              hr credit per member
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={() => isUnlocked && onNavigateTab?.("MEDIA")}
          className="group rounded-xl border border-[#EDEDF2] bg-white p-4 text-left transition hover:border-blue-300 dark:border-slate-800 dark:bg-[#161B26] dark:hover:border-blue-500/40 cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Photos &amp; Documentation
            </span>
            <ImagePlus className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-1.5 text-xl font-bold text-[#111625] dark:text-white">
            {activity.media.length}{" "}
            {activity.media.length === 1 ? "Photo" : "Photos"}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {activity.media.length === 0
              ? "Upload event photos · "
              : "Gallery documented · "}
            <span className="font-semibold text-[#0D3594] group-hover:underline dark:text-blue-300">
              Open Gallery →
            </span>
          </p>
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,.85fr)]">
        <section className="rounded-xl border border-[#EDEDF2] bg-white p-5 dark:border-slate-800 dark:bg-[#161B26]">
          <h2 className="text-sm font-bold text-[#111625] dark:text-white">
            {isProject
              ? "Project Summary & Purpose"
              : "Activity Purpose & Agenda"}
          </h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {activity.description ||
              activity.shortDescription ||
              "No detailed description or agenda has been added yet."}
          </p>

          {((activity.team && activity.team.length > 0) || canEdit) && (
            <div className="mt-6 border-t border-[#EDEDF2] pt-5 dark:border-slate-800">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <Users className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  Organizing Committee &amp; Leads ({activity.team?.length || 0})
                </h3>
                {canEdit && onManageCommittee && (
                  <button
                    type="button"
                    onClick={onManageCommittee}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#DDE1EA] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0D3594] transition hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800 dark:text-blue-300 dark:hover:bg-slate-700"
                  >
                    <Pencil className="h-3 w-3" />
                    Manage Committee
                  </button>
                )}
              </div>
              {activity.team && activity.team.length > 0 ? (
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {activity.team.map((member) => (
                    <div
                      key={member.profileId}
                      className="flex items-center gap-2.5 rounded-lg border border-[#EDEDF2] bg-slate-50/60 p-2.5 dark:border-slate-800 dark:bg-slate-900/40"
                    >
                      <Avatar
                        name={member.fullName}
                        url={member.avatarUrl}
                        size={30}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-[#111625] dark:text-white">
                          {member.fullName}
                        </p>
                        <span className="inline-block text-[10px] font-medium text-[#0D3594] dark:text-blue-300">
                          {member.role.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-xs text-slate-500 dark:border-slate-700">
                  No organizing committee members appointed yet. Click Manage Committee to assign leads and collaborators.
                </p>
              )}
            </div>
          )}

          {!isUnlocked && (
            <div className="mt-6 rounded-xl border border-dashed border-amber-300 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/20 p-5 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 mb-2">
                <Lock className="h-5 w-5" />
              </div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                Inside Project Information is Restricted
              </h4>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 max-w-sm mx-auto">
                RSVP as <strong>Going</strong> to unlock task workflows, private
                discussion group, participant roster, and real-time project
                notifications.
              </p>
              {onUnlock && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={onUnlock}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-60 transition cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5" /> RSVP Going to Unlock
                </button>
              )}
            </div>
          )}
          {isProject && details && (
            <div className="mt-6 space-y-4 border-t border-[#EDEDF2] pt-5 dark:border-slate-800">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Intended Community Goal (Objective)
                </h3>
                <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
                  {details.objective ||
                    "Not added yet. You can fill this out in the Accomplishment Report tab."}
                </p>
              </div>
              {details.outcomesSummary && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 dark:border-emerald-500/25 dark:bg-emerald-950/20">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    ✓ Achieved Outcomes &amp; Impact
                  </h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-emerald-950 dark:text-emerald-100">
                    {details.outcomesSummary}
                  </p>
                </div>
              )}
              {details.areasOfFocus.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Rotary Areas of Focus
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {details.areasOfFocus.map((item) => (
                      <span
                        key={item}
                        className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
                      >
                        {item.replaceAll("_", " ")}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {details.sdgs.length > 0 && (
                <p className="text-xs text-slate-500">
                  <strong>UN Sustainable Development Goals:</strong> SDG{" "}
                  {details.sdgs.join(", SDG ")}
                </p>
              )}
              {details.partners.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Partner Clubs &amp; Organizations
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {details.partners.map((partner) => (
                      <span
                        key={partner.id}
                        className="rounded-lg border border-[#EDEDF2] bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        {partner.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <aside className="space-y-4">
          {isUnlocked && onNavigateTab && (
            <section className="rounded-xl border border-[#EDEDF2] bg-white p-5 dark:border-slate-800 dark:bg-[#161B26]">
              <h2 className="text-sm font-bold text-[#111625] dark:text-white">
                Manager Quick Shortcuts
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Common actions to run and wrap up this{" "}
                {isProject ? "project" : "activity"}:
              </p>
              <div className="mt-3 grid gap-2">
                <button
                  type="button"
                  onClick={() => onNavigateTab("TASKS")}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:bg-blue-50/50 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:border-blue-500/40 transition cursor-pointer"
                >
                  <span className="inline-flex items-center gap-2">
                    <CheckSquare className="h-3.5 w-3.5 text-[#0D3594] dark:text-blue-400" />
                    Assign or Update Tasks ({tasks.length})
                  </span>
                  <span className="text-slate-400">→</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateTab("ATTENDANCE")}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:bg-blue-50/50 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:border-blue-500/40 transition cursor-pointer"
                >
                  <span className="inline-flex items-center gap-2">
                    <QrCode className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                    Take Attendance / Show QR
                  </span>
                  <span className="text-slate-400">→</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateTab("MEDIA")}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:bg-blue-50/50 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:border-blue-500/40 transition cursor-pointer"
                >
                  <span className="inline-flex items-center gap-2">
                    <ImagePlus className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    Upload Activity Photos ({activity.media.length})
                  </span>
                  <span className="text-slate-400">→</span>
                </button>
                {isProject && (
                  <button
                    type="button"
                    onClick={() => onNavigateTab("REPORT")}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs font-bold transition cursor-pointer ${
                      activity.status === "ACCOMPLISHED"
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200"
                        : "border-blue-200 bg-[#0D3594] text-white hover:bg-[#092569]"
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {activity.status === "ACCOMPLISHED"
                        ? "View Accomplishment Report ✓"
                        : "Complete Accomplishment Report"}
                    </span>
                    <span>→</span>
                  </button>
                )}
              </div>
            </section>
          )}

          {isRecurringSchedule(activity.recurrence) && (() => {
            const occurrences = expandActivityOccurrences(activity);
            const nextOcc = getNextActivityOccurrence(activity);
            const summary = formatRecurrenceSummary(
              activity.recurrence,
              activity.startAt,
              activity.endAt,
            );
            return (
              <section className="rounded-xl border border-blue-200/80 bg-white p-5 dark:border-blue-500/25 dark:bg-[#161B26]">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="flex items-center gap-1.5 text-sm font-bold text-[#111625] dark:text-white">
                      <Repeat className="h-4 w-4 text-[#0D3594] dark:text-blue-400" />
                      Recurring Schedule
                    </h2>
                    {summary && (
                      <p className="mt-0.5 text-xs font-medium text-[#0D3594] dark:text-blue-300">
                        {summary}
                      </p>
                    )}
                  </div>
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-[#0D3594] dark:bg-blue-500/15 dark:text-blue-300">
                    {occurrences.length} sessions
                  </span>
                </div>
                <div className="mt-3 space-y-1.5">
                  {occurrences.slice(0, 12).map((occ) => {
                    const isNext = nextOcc?.dateKey === occ.dateKey;
                    const isPast = Date.parse(occ.endAt) < Date.now();
                    return (
                      <div
                        key={occ.dateKey}
                        className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-xs ${
                          isNext
                            ? "border-[#0D3594]/40 bg-blue-50/70 font-semibold text-[#0D3594] dark:border-blue-500/40 dark:bg-blue-950/30 dark:text-blue-200"
                            : isPast
                              ? "border-slate-100 bg-slate-50/50 text-slate-400 dark:border-slate-800 dark:bg-slate-900/30"
                              : "border-[#EDEDF2] bg-slate-50/60 text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-200"
                        }`}
                      >
                        <span>
                          #{occ.index} ·{" "}
                          {formatManila(occ.startAt, "EEE, MMM d, yyyy")}
                        </span>
                        <span className="text-[11px]">
                          {activity.allDay
                            ? "All day"
                            : `${formatManila(occ.startAt, "h:mm a")} – ${formatManila(occ.endAt, "h:mm a")}`}
                        </span>
                      </div>
                    );
                  })}
                  {occurrences.length > 12 && (
                    <p className="pt-1 text-center text-[11px] font-semibold text-slate-500">
                      +{occurrences.length - 12} more scheduled sessions
                    </p>
                  )}
                </div>
              </section>
            );
          })()}

          <section className="rounded-xl border border-[#EDEDF2] bg-white p-5 dark:border-slate-800 dark:bg-[#161B26]">
            <h2 className="text-sm font-bold text-[#111625] dark:text-white">
              Lead &amp; Turnout Summary
            </h2>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-slate-500">Project Chair / Lead</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {activity.ownerName || "Unassigned"}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-slate-500">Confirmed Going (RSVP)</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {activity.rsvp.going}
                {activity.capacity ? ` / ${activity.capacity}` : ""}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-slate-500">Verified Attendees</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {activity.attendees.length}
              </span>
            </div>
            {isProject && details && (
              <>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Beneficiaries Reached</span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                    {details.beneficiaryCount.toLocaleString()}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Total Volunteer Hours</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {details.totalVolunteerHours.toLocaleString()} hrs
                  </span>
                </div>
              </>
            )}
          </section>

          <ActivityTimeline activity={activity} onNavigateTab={onNavigateTab} />
        </aside>
      </div>
    </div>
  );
}

function ActivityTimeline({
  activity,
  onNavigateTab,
}: {
  activity: ActivityDetailDTO;
  onNavigateTab?: (tab: Tab) => void;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(activity.status);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isProject = isProjectKind(activity.kind);
  const isFinished = status === "ACCOMPLISHED" || status === "COMPLETED";

  React.useEffect(() => {
    setStatus(activity.status);
  }, [activity.status]);

  const selectableStatuses = Array.from(
    new Set([status, ...allowedTransitions(status, isProject)]),
  );

  const cleanLogs = deduplicateActivityLog(activity.log).slice(0, 8);

  const dotColors: Record<string, string> = {
    emerald:
      "bg-emerald-500 ring-4 ring-emerald-500/20 dark:ring-emerald-400/20",
    blue: "bg-[#0D3594] dark:bg-blue-400",
    amber: "bg-amber-500",
    violet: "bg-violet-500",
    rose: "bg-rose-500",
    slate: "bg-slate-400",
  };

  return (
    <section
      className={`rounded-xl border p-5 transition ${
        isFinished
          ? "border-emerald-300/90 bg-emerald-50/25 dark:border-emerald-500/35 dark:bg-[#161B26]"
          : "border-[#EDEDF2] bg-white dark:border-slate-800 dark:bg-[#161B26]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-[#111625] dark:text-white">
            {isProject ? "Project Milestones" : "Activity Updates"}
          </h2>
          <p className="text-[11px] text-slate-500">
            Recent progress &amp; stage updates
          </p>
        </div>
        {status === "ACCOMPLISHED" ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500 bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white shadow-xs">
            <Check className="h-3.5 w-3.5 stroke-[2.5]" />
            Accomplished
          </span>
        ) : activity.canManage ? (
          <select
            aria-label="Update activity status"
            value={status}
            disabled={pending}
            onChange={(event) => {
              const next = event.target.value as typeof status;
              setError(null);
              startTransition(async () => {
                const result = await updateActivityStatusAction(
                  activity.id,
                  next,
                );
                if (!result.success) {
                  setError(result.error);
                  setStatus(activity.status);
                  return;
                }
                setStatus(next);
                router.refresh();
              });
            }}
            className={`max-w-44 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition cursor-pointer ${
              status === "COMPLETED"
                ? "border-emerald-400 bg-emerald-500/15 text-emerald-800 dark:border-emerald-500/50 dark:bg-emerald-500/20 dark:text-emerald-200"
                : "border-[#EDEDF2] bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            }`}
          >
            {selectableStatuses.map((s) => (
              <option key={s} value={s}>
                {s === "ACCOMPLISHED" || s === "COMPLETED"
                  ? `✓ ${ACTIVITY_STATUS_LABELS[s]}`
                  : ACTIVITY_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        ) : (
          <ActivityStatusBadge status={status} />
        )}
      </div>

      {isProject && status !== "ACCOMPLISHED" && onNavigateTab && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-[11px] text-slate-600 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-slate-300">
          <span>To mark as Accomplished, publish the report:</span>
          <button
            type="button"
            onClick={() => onNavigateTab("REPORT")}
            className="font-bold text-[#0D3594] hover:underline dark:text-blue-300 cursor-pointer shrink-0"
          >
            Open Report →
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-[11px] text-rose-600">{error}</p>}

      <ol className="mt-4 space-y-2.5">
        {cleanLogs.map((entry) => {
          const formatted = formatActivityLogEntry(entry.action, entry.details);
          const isGreenMilestone = formatted.tone === "emerald" && formatted.isMilestone;
          return (
            <li
              key={entry.id}
              className={`flex items-start gap-2.5 rounded-lg p-2 transition ${
                isGreenMilestone
                  ? "border border-emerald-300/80 bg-emerald-50/80 dark:border-emerald-500/35 dark:bg-emerald-500/10"
                  : ""
              }`}
            >
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                  dotColors[formatted.tone] || dotColors.slate
                }`}
              />
              <span className="min-w-0 flex-1">
                <span
                  className={`block text-xs font-semibold leading-snug ${
                    isGreenMilestone
                      ? "text-emerald-900 dark:text-emerald-200 font-bold"
                      : "text-slate-700 dark:text-slate-200"
                  }`}
                >
                  {isGreenMilestone && "✓ "}
                  {formatted.title}
                </span>
                {formatted.subtitle && (
                  <span
                    className={`mt-0.5 block text-[11px] ${
                      isGreenMilestone
                        ? "text-emerald-700 dark:text-emerald-300/90"
                        : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {formatted.subtitle}
                  </span>
                )}
                <span className="mt-0.5 block text-[10px] text-slate-500 dark:text-slate-400">
                  By {entry.actorName} · {formatManila(entry.createdAt)}
                </span>
              </span>
            </li>
          );
        })}
        {cleanLogs.length === 0 && (
          <li className="text-xs text-slate-500">
            Scheduled for {formatManila(activity.startAt, "MMM d, yyyy")}
          </li>
        )}
      </ol>
    </section>
  );
}

function AttendancePanel({
  activity,
  canManage,
  members = [],
  onRefresh,
  onSelfCheckIn,
  onRevoke,
  onToggleQrCheckIn,
}: {
  activity: ActivityDetailDTO;
  canManage: boolean;
  members?: MemberDTO[];
  onRefresh?: () => void;
  onSelfCheckIn: () => void;
  onRevoke: (id: string) => void;
  onToggleQrCheckIn?: (enabled: boolean) => void;
}) {
  const [qrDurationMinutes, setQrDurationMinutes] = useState<number>(
    DEFAULT_QR_EXPIRATION_MINUTES,
  );
  const [qr, setQr] = useState<{
    token: string;
    url: string;
    image: string;
    createdAt: string;
    expiresAt: string;
    status: QrSessionStatus;
  } | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualProfileId, setManualProfileId] = useState("");
  const [pending, startTransition] = useTransition();

  React.useEffect(() => {
    if (!qr || qr.status !== "ACTIVE") return;
    const tick = () => {
      const diffSec = Math.max(
        0,
        Math.floor((new Date(qr.expiresAt).getTime() - Date.now()) / 1000),
      );
      setSecondsRemaining(diffSec);
      if (diffSec === 0) {
        setQr((prev) => (prev ? { ...prev, status: "EXPIRED" } : prev));
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [qr]);

  function formatCountdown(totalSec: number) {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  async function createQr(options?: {
    durationMinutes?: number;
    forceRegenerate?: boolean;
  }) {
    setError(null);
    const duration = options?.durationMinutes ?? qrDurationMinutes;
    const result = await startActivityQrSessionAction(activity.id, {
      durationMinutes: duration,
      forceRegenerate: options?.forceRegenerate ?? false,
    });
    if (!result.success) {
      setError(result.error);
      return;
    }
    const url = `${window.location.origin}/events?token=${encodeURIComponent(result.sessionToken)}`;
    const QRCode = await import("qrcode");
    const image = await QRCode.toDataURL(url, {
      width: 280,
      margin: 2,
      color: { dark: "#111625", light: "#ffffff" },
    });
    setQrDurationMinutes(result.durationMinutes);
    setQr({
      token: result.sessionToken,
      url,
      image,
      createdAt: result.createdAt,
      expiresAt: result.expiresAt,
      status: result.status,
    });
    const diffSec = Math.max(
      0,
      Math.floor((new Date(result.expiresAt).getTime() - Date.now()) / 1000),
    );
    setSecondsRemaining(diffSec);
  }

  function handleQrStatusChange(nextStatus: "ACTIVE" | "PAUSED" | "CLOSED") {
    if (!qr) return;
    startTransition(async () => {
      const res = await updateActivityQrSessionStatusAction(
        activity.id,
        nextStatus,
      );
      if (!res.success) {
        setError(res.error);
        return;
      }
      setQr((prev) => (prev ? { ...prev, status: nextStatus } : prev));
      notifyToast({
        message: res.message || `QR session ${nextStatus.toLowerCase()}.`,
        kind: "success",
      });
    });
  }

  function handleRevokeQr() {
    if (!qr) return;
    startTransition(async () => {
      const res = await revokeActivityQrSessionAction(activity.id, qr.token);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setQr((prev) => (prev ? { ...prev, status: "REVOKED" } : prev));
      setSecondsRemaining(0);
      notifyToast({
        message: "QR code revoked immediately.",
        kind: "success",
      });
    });
  }

  function handleManualMemberCheckIn(e: React.FormEvent) {
    e.preventDefault();
    if (!manualProfileId) return;
    startTransition(async () => {
      const res = await manualCheckInMemberAction(
        activity.id,
        manualProfileId,
      );
      if (!res.success) {
        notifyToast({
          title: "Manual check-in failed",
          message: res.error,
          kind: "error",
        });
        return;
      }
      setManualProfileId("");
      notifyToast({
        message: res.message || "Member manually checked in.",
        kind: "success",
      });
      onRefresh?.();
    });
  }

  function exportCsv() {
    const header = [
      "Participant Name",
      "Check-In Method",
      "Check-In Time (Manila)",
      "Volunteer Hours",
    ];
    const rows = activity.attendees.map((a) => [
      `"${(a.fullName || "").replace(/"/g, '""')}"`,
      `"${a.checkInMethod || "QR"}"`,
      `"${formatManila(a.checkInTime, "yyyy-MM-dd hh:mm:ss a")}"`,
      String(a.volunteerHours ?? 0),
    ]);
    const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance-${activity.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const checkedInIds = new Set(activity.attendees.map((a) => a.profileId));
  const availableMembersForManual = members.filter(
    (m) => !checkedInIds.has(m.id),
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,.75fr)]">
      <section className="overflow-hidden rounded-xl border border-[#EDEDF2] bg-white dark:border-slate-800 dark:bg-[#161B26]">
        <header className="flex items-center justify-between border-b border-[#EDEDF2] px-4 py-3 dark:border-slate-800 flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-bold text-[#111625] dark:text-white">
              Attendance roster
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {activity.attendees.length} checked in
            </p>
          </div>
          <div className="flex items-center gap-2">
            {activity.attendees.length > 0 && (
              <button
                type="button"
                onClick={exportCsv}
                className="inline-flex items-center gap-1 rounded-lg border border-[#EDEDF2] px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-slate-700 dark:text-emerald-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" /> Export CSV
              </button>
            )}
            {canManage && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                <ShieldCheck className="h-3.5 w-3.5" /> Manager view
              </span>
            )}
          </div>
        </header>

        {canManage && availableMembersForManual.length > 0 && (
          <form
            onSubmit={handleManualMemberCheckIn}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 border-b border-[#EDEDF2] bg-slate-50/70 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900/40"
          >
            <select
              value={manualProfileId}
              onChange={(e) => setManualProfileId(e.target.value)}
              className="flex-1 rounded-lg border border-[#DDE1EA] bg-white px-2.5 py-1.5 text-xs text-[#111625] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              aria-label="Manually check in club member"
            >
              <option value="">
                + Manual check-in for a club member ({availableMembersForManual.length} remaining)...
              </option>
              {availableMembersForManual.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} {m.role ? `(${m.role})` : ""}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={!manualProfileId || pending}
              className="inline-flex items-center justify-center gap-1 rounded-lg bg-[#0D3594] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#092569] disabled:opacity-50 cursor-pointer shrink-0"
            >
              <UserCheck className="h-3.5 w-3.5" /> Check In Member
            </button>
          </form>
        )}

        <div className="divide-y divide-[#EDEDF2] dark:divide-slate-800">
          {activity.attendees.map((attendee) => (
            <div
              key={attendee.id}
              className="flex items-center gap-3 px-4 py-3"
            >
              <Avatar name={attendee.fullName} url={attendee.avatarUrl} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-[#111625] dark:text-white">
                  {attendee.fullName}
                </p>
                <p className="text-[10px] text-slate-500">
                  {formatManila(attendee.checkInTime)} ·{" "}
                  {attendee.checkInMethod} · {attendee.volunteerHours}h
                </p>
              </div>
              {canManage && (
                <button
                  type="button"
                  onClick={() => onRevoke(attendee.id)}
                  className="rounded p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                  aria-label={`Remove check-in for ${attendee.fullName}`}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          {activity.attendees.length === 0 && (
            <p className="px-4 py-8 text-center text-xs text-slate-500">
              No one has checked in yet.
            </p>
          )}
        </div>
      </section>
      <aside className="space-y-4">
        {activity.selfCheckInEnabled &&
          !activity.checkedIn &&
          (!activity.rsvpEnabled || activity.myRsvp === "GOING") && (
            <button
              type="button"
              onClick={onSelfCheckIn}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white cursor-pointer"
            >
              <Check className="h-4 w-4" /> Check in as me
            </button>
          )}
        {canManage &&
          (activity.qrCheckInEnabled === false ? (
            <section className="space-y-3 rounded-xl border border-dashed border-amber-300 bg-amber-50/60 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
                  <QrCode className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <h2 className="text-sm font-bold">QR Check-In Disabled</h2>
                </div>
                {canManage && onToggleQrCheckIn && (
                  <button
                    type="button"
                    onClick={() => onToggleQrCheckIn(true)}
                    className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-50 dark:border-amber-800 dark:bg-slate-900 dark:text-amber-200 cursor-pointer shadow-2xs transition"
                  >
                    Enable QR Check-In
                  </button>
                )}
              </div>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
                This project does not require on-site QR attendance (e.g. promotional campaign, recruitment drive, or asynchronous initiative).
              </p>
            </section>
          ) : (
            <section className="space-y-3 rounded-xl border border-[#EDEDF2] bg-white p-4 dark:border-slate-800 dark:bg-[#161B26]">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-[#111625] dark:text-white">
                      QR Attendance Session
                    </h2>
                    {qr && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          qr.status === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300"
                            : qr.status === "PAUSED"
                              ? "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300"
                              : "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300"
                        }`}
                      >
                        {qr.status}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Cryptographic time-limited QR code for participant check-in.
                  </p>
                </div>
                {canManage && onToggleQrCheckIn && (
                  <button
                    type="button"
                    onClick={() => onToggleQrCheckIn(false)}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] font-semibold text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition shadow-2xs"
                    title="Turn off QR check-in for promotional or online campaigns"
                  >
                    Turn off QR
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900">
                <label
                  htmlFor="activity-qr-duration"
                  className="text-xs font-semibold text-slate-600 dark:text-slate-300"
                >
                  Expiration Window:
                </label>
                <select
                  id="activity-qr-duration"
                  value={qrDurationMinutes}
                  onChange={(e) => {
                    const nextMins = Number(e.target.value);
                    setQrDurationMinutes(nextMins);
                    if (qr) {
                      startTransition(() =>
                        createQr({
                          durationMinutes: nextMins,
                          forceRegenerate: true,
                        }),
                      );
                    }
                  }}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  {QR_EXPIRATION_OPTIONS.map((mins) => (
                    <option key={mins} value={mins}>
                      {mins} min{mins === 20 ? " (Default)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(() =>
                      createQr({
                        durationMinutes: qrDurationMinutes,
                        forceRegenerate: Boolean(qr),
                      }),
                    )
                  }
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#0D3594] px-3 py-2 text-xs font-semibold text-white hover:bg-[#092569] disabled:opacity-60 cursor-pointer"
                >
                  <QrCode className="h-4 w-4" />
                  {qr ? "Regenerate QR" : "Generate QR Code"}
                </button>
                {qr && (
                  <>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        handleQrStatusChange(
                          qr.status === "PAUSED" ? "ACTIVE" : "PAUSED",
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 cursor-pointer disabled:opacity-50"
                    >
                      {qr.status === "PAUSED" ? (
                        <>
                          <PlayCircle className="h-3.5 w-3.5" /> Resume
                        </>
                      ) : (
                        <>
                          <PauseCircle className="h-3.5 w-3.5" /> Pause
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={pending || qr.status === "REVOKED"}
                      onClick={handleRevokeQr}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300 cursor-pointer disabled:opacity-50"
                    >
                      <Ban className="h-3.5 w-3.5" /> Revoke
                    </button>
                  </>
                )}
              </div>

              {error && <p className="text-xs text-rose-600">{error}</p>}
              {qr && (
                <div className="space-y-2.5 rounded-lg bg-slate-50 p-3 dark:bg-slate-900">
                  <div className="flex justify-center relative">
                    <Image
                      unoptimized
                      src={qr.image}
                      alt="QR code for activity check-in"
                      width={224}
                      height={224}
                      className={`h-56 w-56 rounded-lg ${
                        qr.status !== "ACTIVE" ? "opacity-20 blur-[2px]" : ""
                      }`}
                    />
                    {qr.status !== "ACTIVE" && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                        <Ban className="h-7 w-7 text-rose-600 mb-1" />
                        <span className="text-xs font-bold uppercase text-slate-900 dark:text-white">
                          QR {qr.status}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 text-[10px] border-t border-slate-200/80 pt-2 dark:border-slate-800">
                    <div>
                      <span className="text-slate-400 block">Generated</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {formatManila(qr.createdAt, "h:mm:ss a")}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Expires</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {formatManila(qr.expiresAt, "h:mm:ss a")}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 block">Countdown</span>
                      <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                        {qr.status === "ACTIVE"
                          ? formatCountdown(secondsRemaining)
                          : qr.status}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(qr.url);
                        setCopiedUrl(true);
                        setTimeout(() => setCopiedUrl(false), 2500);
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
                    >
                      {copiedUrl ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      {copiedUrl ? "Copied!" : "Copy Check-In Link"}
                    </button>
                    <a
                      href={qr.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white dark:bg-white dark:text-slate-900"
                    >
                      Open Link
                    </a>
                  </div>
                </div>
              )}
            </section>
          ))}
      </aside>
    </div>
  );
}

function DiscussionPanel({
  activity,
  currentUserId,
  onRefresh,
}: {
  activity: ActivityDetailDTO;
  currentUserId: string;
  onRefresh: () => void;
}) {
  const [composerMode, setComposerMode] = useState<"COMMENT" | "PAINT">(
    "COMMENT",
  );
  const [lightboxSketchId, setLightboxSketchId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const sketches = activity.comments.filter(
    (c) => !c.isDeleted && Boolean(c.sketch?.imageUrl),
  );
  const activeLightbox =
    sketches.find((c) => c.id === lightboxSketchId) ?? null;

  return (
    <section className="mx-auto max-w-4xl space-y-5">
      {/* Pinned Visual Summaries & Sketches Strip */}
      {sketches.length > 0 && (
        <div className="rounded-xl border border-[#EDEDF2] bg-white p-4 dark:border-slate-800 dark:bg-[#161B26]">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-[#EEF2FF] text-[#0D3594] dark:bg-blue-950/60 dark:text-blue-300">
                <Paintbrush className="h-3.5 w-3.5" />
              </span>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-[#111625] dark:text-white">
                  Visual Summaries & Sketches ({sketches.length})
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Whiteboard diagrams and meeting takeaways shared by the team. Click any sketch to expand.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setComposerMode("PAINT")}
              className="inline-flex items-center gap-1 rounded-lg border border-[#DDE1EA] bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-[#0D3594] hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800 dark:text-blue-300 transition cursor-pointer"
            >
              <Plus className="h-3 w-3" /> Add Drawing
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sketches.map((item) => (
              <button
                key={`strip-${item.id}`}
                type="button"
                onClick={() => setLightboxSketchId(item.id)}
                className="group overflow-hidden rounded-xl border border-[#EDEDF2] bg-[#FAFBFD] text-left transition hover:border-[#0D3594]/50 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900/70 cursor-pointer"
              >
                <div className="aspect-[16/9] w-full overflow-hidden border-b border-[#EDEDF2] bg-white dark:border-slate-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.sketch!.imageUrl!}
                    alt={item.sketch!.title}
                    className="h-full w-full object-contain transition duration-200 group-hover:scale-[1.02]"
                  />
                </div>
                <div className="p-2.5">
                  <p className="truncate text-xs font-bold text-[#111625] dark:text-white">
                    {item.sketch!.title}
                  </p>
                  {item.body && (
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500 dark:text-slate-400">
                      {item.body}
                    </p>
                  )}
                  <p className="mt-1.5 text-[10px] text-slate-400">
                    {item.author.fullName} · {formatManila(item.createdAt)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Composer Mode Switcher */}
      <div className="rounded-xl border border-[#EDEDF2] bg-white p-4 dark:border-slate-800 dark:bg-[#161B26]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[#EDEDF2] pb-3 dark:border-slate-800">
          <div className="inline-flex rounded-lg border border-[#DDE1EA] bg-[#F5F7FA] p-1 dark:border-slate-700 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setComposerMode("COMMENT")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                composerMode === "COMMENT"
                  ? "bg-white text-[#111625] shadow-xs dark:bg-slate-800 dark:text-white"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Write Comment
            </button>
            <button
              type="button"
              onClick={() => setComposerMode("PAINT")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                composerMode === "PAINT"
                  ? "bg-white text-[#0D3594] shadow-xs dark:bg-slate-800 dark:text-blue-300"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
              }`}
            >
              <Paintbrush className="h-3.5 w-3.5" />
              Paint & Visual Summary
            </button>
          </div>
          <span className="text-[11px] text-slate-500">
            {composerMode === "PAINT"
              ? "Sketch floor plans, flowcharts, or idea boards with a summary note"
              : "Share a quick update or discussion question"}
          </span>
        </div>

        {composerMode === "COMMENT" ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const data = new FormData(form);
              setError(null);
              startTransition(async () => {
                const result = await addCommentAction({
                  activityId: activity.id,
                  body: String(data.get("body") || ""),
                });
                if (!result.success) {
                  setError(result.error);
                  return;
                }
                form.reset();
                onRefresh();
              });
            }}
          >
            <label htmlFor="activity-comment" className="sr-only">
              Write a comment
            </label>
            <textarea
              id="activity-comment"
              name="body"
              required
              maxLength={5000}
              rows={3}
              placeholder="Share an update, brainstorming note, or ask the team a question..."
              className={fieldClass}
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-[10px] text-slate-500">
                Comments are visible to club members.
              </span>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D3594] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60 cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" /> Post
              </button>
            </div>
            {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
          </form>
        ) : (
          <DiscussionPaintCanvas
            activityId={activity.id}
            onPosted={() => {
              setComposerMode("COMMENT");
              onRefresh();
            }}
          />
        )}
      </div>

      {/* Discussion Feed */}
      <div className="space-y-3">
        {activity.comments.map((comment) => (
          <article
            key={comment.id}
            className={`rounded-xl border p-4 ${
              !comment.isDeleted && comment.sketch?.imageUrl
                ? "border-blue-200/80 bg-white dark:border-blue-900/50 dark:bg-[#161B26]"
                : "border-[#EDEDF2] bg-white dark:border-slate-800 dark:bg-[#161B26]"
            }`}
          >
            <header className="flex items-center gap-2.5">
              <Avatar
                name={comment.author.fullName}
                url={comment.author.avatarUrl}
                size={30}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-xs font-bold text-[#111625] dark:text-white">
                    {comment.author.fullName}
                  </p>
                  {!comment.isDeleted && comment.sketch?.imageUrl && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[10px] font-bold text-[#0D3594] dark:bg-blue-950/60 dark:text-blue-300">
                      <Paintbrush className="h-2.5 w-2.5" />
                      Visual Summary
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-500">
                  {formatManila(comment.createdAt)}
                  {comment.editedAt ? " · edited" : ""}
                </p>
              </div>
              {comment.author.profileId === currentUserId &&
                !comment.isDeleted && (
                  <button
                    type="button"
                    title="Delete comment"
                    onClick={() =>
                      startTransition(async () => {
                        await deleteCommentAction(activity.id, comment.id);
                        onRefresh();
                      })
                    }
                    className="rounded p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
            </header>

            {comment.isDeleted ? (
              <p className="mt-3 text-sm italic text-slate-400">
                This comment was deleted.
              </p>
            ) : comment.sketch?.imageUrl ? (
              <div className="mt-3 space-y-2.5 rounded-xl border border-[#EDEDF2] bg-[#FAFBFD] p-3 dark:border-slate-800 dark:bg-slate-900/60">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-[#111625] dark:text-white">
                    {comment.sketch.title}
                  </h4>
                  <a
                    href={comment.sketch.imageUrl}
                    download={`${comment.sketch.title.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase() || "sketch"}.png`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-[#DDE1EA] bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <Download className="h-3 w-3" /> Download PNG
                  </a>
                </div>
                <button
                  type="button"
                  onClick={() => setLightboxSketchId(comment.id)}
                  className="block w-full overflow-hidden rounded-lg border border-[#DDE1EA] bg-white dark:border-slate-700 cursor-zoom-in"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={comment.sketch.imageUrl}
                    alt={comment.sketch.title}
                    className="max-h-96 w-full object-contain"
                  />
                </button>
                {comment.body && (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                    {comment.body}
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                {comment.body}
              </p>
            )}

            {!comment.isDeleted && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {comment.reactions.map((reaction) => (
                  <button
                    key={reaction.emoji}
                    type="button"
                    aria-pressed={reaction.mine}
                    onClick={() =>
                      startTransition(async () => {
                        await toggleReactionAction(
                          activity.id,
                          comment.id,
                          reaction.emoji,
                        );
                        onRefresh();
                      })
                    }
                    className={`rounded-full border px-2 py-1 text-[11px] ${reaction.mine ? "border-blue-300 bg-blue-50 text-blue-700" : "border-[#EDEDF2] text-slate-500 dark:border-slate-700"}`}
                  >
                    {reaction.emoji} {reaction.count}
                  </button>
                ))}
                {["👍", "❤️", "🎉", "🔥", "👏", "🙌"].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    aria-label={`React ${emoji}`}
                    onClick={() =>
                      startTransition(async () => {
                        await toggleReactionAction(
                          activity.id,
                          comment.id,
                          emoji,
                        );
                        onRefresh();
                      })
                    }
                    className="rounded-full border border-dashed border-slate-300 px-2 py-1 text-[11px] text-slate-500 dark:border-slate-700"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </article>
        ))}
        {activity.comments.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center dark:border-slate-700">
            <MessageSquare className="mx-auto h-5 w-5 text-slate-400" />
            <p className="mt-2 text-xs text-slate-500">
              No discussion yet. Write a comment or switch to{" "}
              <button
                type="button"
                onClick={() => setComposerMode("PAINT")}
                className="font-semibold text-[#0D3594] underline cursor-pointer dark:text-blue-400"
              >
                Paint & Visual Summary
              </button>{" "}
              to share a sketch.
            </p>
          </div>
        )}
      </div>

      {/* Lightbox Modal for Sketches */}
      {activeLightbox?.sketch?.imageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label={activeLightbox.sketch.title}
          onClick={() => setLightboxSketchId(null)}
        >
          <div
            className="w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-700 bg-white shadow-2xl dark:bg-[#161B26]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-[#EDEDF2] px-5 py-3 dark:border-slate-800">
              <div>
                <h4 className="text-sm font-bold text-[#111625] dark:text-white">
                  {activeLightbox.sketch.title}
                </h4>
                <p className="text-[11px] text-slate-500">
                  Shared by {activeLightbox.author.fullName} ·{" "}
                  {formatManila(activeLightbox.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={activeLightbox.sketch.imageUrl}
                  download={`${activeLightbox.sketch.title.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase() || "sketch"}.png`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#DDE1EA] px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Download className="h-3.5 w-3.5" /> Download PNG
                </a>
                <button
                  type="button"
                  onClick={() => setLightboxSketchId(null)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="bg-[#F5F7FA] p-4 dark:bg-slate-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activeLightbox.sketch.imageUrl}
                alt={activeLightbox.sketch.title}
                className="mx-auto max-h-[70vh] rounded-lg border border-[#DDE1EA] bg-white object-contain"
              />
            </div>
            {activeLightbox.body && (
              <div className="border-t border-[#EDEDF2] px-5 py-3 text-sm text-slate-700 dark:border-slate-800 dark:text-slate-200">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Summary Notes
                </p>
                <p className="mt-1 whitespace-pre-wrap">{activeLightbox.body}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function MediaPanel({
  activity,
  canManage,
  onRefresh,
}: {
  activity: ActivityDetailDTO;
  canManage: boolean;
  onRefresh: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [isDragging, setIsDragging] = useState(false);
  const [caption, setCaption] = useState("");
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleFilesAdded = (files: FileList | File[]) => {
    setError(null);
    const validFiles = Array.from(files).filter((file) =>
      file.type.startsWith("image/"),
    );
    if (validFiles.length === 0) {
      setError("Please select valid image files (JPG, PNG, WebP, GIF).");
      return;
    }
    setSelectedFiles((prev) => {
      const existingSignatures = new Set(prev.map((f) => `${f.name}_${f.size}`));
      const newUnique = validFiles.filter(
        (f) => !existingSignatures.has(`${f.name}_${f.size}`),
      );
      return [...prev, ...newUnique];
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmitUpload = () => {
    if (selectedFiles.length === 0) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await uploadActivityPhotos({
          files: selectedFiles,
          activityId: activity.id,
          caption,
          upload: uploadActivityMediaAction,
          onProgress: setUploadProgress,
        });
        setSelectedFiles(
          result.failures.map((failure) => failure.file),
        );
        if (result.failures.length === 0) {
          setCaption("");
          if (fileInputRef.current) fileInputRef.current.value = "";
        } else {
          setError(
            result.failures
              .map((failure) => `${failure.file.name}: ${failure.error}`)
              .join(" "),
          );
        }
        if (result.uploaded > 0) {
          const saved = Math.max(
            0,
            Math.round(
              (1 - result.uploadedBytes / result.originalBytes) * 100,
            ),
          );
          notifyToast({
            message: `${result.uploaded} photo(s) uploaded${saved ? `, ${saved}% smaller` : ""}.`,
            kind: "success",
          });
          onRefresh();
        }
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Upload failed. Please retry.",
        );
      } finally {
        setUploadProgress(null);
      }
    });
  };

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-[#111625] dark:text-white">
            Project media & moments
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Photos are stored privately and served as signed links to club members.
          </p>
        </div>
      </header>

      {canManage && (
        <div
          onDragEnter={handleDragOver}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative rounded-2xl border-2 border-dashed p-6 transition-all duration-200 text-center ${
            isDragging
              ? "border-blue-500 bg-blue-50/80 dark:border-blue-400 dark:bg-blue-950/40 ring-4 ring-blue-500/10 scale-[1.005]"
              : "border-slate-300 hover:border-slate-400 bg-slate-50/50 dark:border-slate-700 dark:hover:border-slate-600 dark:bg-[#161B26]/60"
          }`}
        >
          <input
            ref={fileInputRef}
            id="activity-media-dropzone"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            disabled={pending}
            className="sr-only"
            onChange={(e) => {
              if (e.target.files) handleFilesAdded(e.target.files);
            }}
          />

          <div className="flex flex-col items-center justify-center space-y-2">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
                isDragging
                  ? "bg-blue-600 text-white"
                  : "bg-blue-100 text-[#0D3594] dark:bg-blue-900/40 dark:text-blue-300"
              }`}
            >
              <Upload className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="text-xs sm:text-sm font-semibold text-[#111625] dark:text-white">
                Drag &amp; drop event photos here, or{" "}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[#0D3594] font-bold underline hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 focus:outline-hidden cursor-pointer"
                >
                  browse files
                </button>
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Supports JPG, PNG, WebP, GIF (up to 5MB each)
              </p>
            </div>
          </div>

          {selectedFiles.length > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-700/80 text-left space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {selectedFiles.length} photo{selectedFiles.length > 1 ? "s" : ""} selected for upload
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setSelectedFiles([]);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="text-[11px] text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400"
                >
                  Clear all
                </button>
              </div>

              {/* Preview thumbnails / file chips */}
              <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1">
                {selectedFiles.map((file, idx) => (
                  <div
                    key={`${file.name}-${idx}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <ImagePlus className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                    <span className="max-w-[120px] sm:max-w-[180px] truncate">
                      {file.name}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      ({(file.size / 1024 / 1024).toFixed(1)}MB)
                    </span>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => removeFile(idx)}
                      className="text-slate-400 hover:text-rose-600 p-0.5 rounded cursor-pointer"
                      aria-label={`Remove ${file.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Caption and Submit */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                <input
                  type="text"
                  value={caption}
                  disabled={pending}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Caption for these photos (optional)"
                  maxLength={280}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-[#0D3594] focus:outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500"
                />
                <button
                  type="button"
                  disabled={pending || selectedFiles.length === 0}
                  onClick={handleSubmitUpload}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0D3594] px-4 py-2 text-xs font-semibold text-white hover:bg-blue-900 disabled:opacity-60 transition shadow-2xs cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {pending
                    ? "Uploading..."
                    : `Upload ${selectedFiles.length} photo${selectedFiles.length > 1 ? "s" : ""}`}
                </button>
              </div>
            </div>
          )}

          {uploadProgress && (
            <div className="mt-3 text-xs font-medium text-blue-600 dark:text-blue-400 animate-pulse">
              {uploadProgress}
            </div>
          )}

          {error && (
            <div className="mt-3 text-xs text-rose-600 dark:text-rose-400" role="alert">
              {error}
            </div>
          )}
        </div>
      )}

      {activity.media.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {activity.media.map((photo) => (
            <figure
              key={photo.id}
              className="overflow-hidden rounded-xl border border-[#EDEDF2] bg-white dark:border-slate-800 dark:bg-[#161B26]"
            >
              {photo.url ? (
                <a href={photo.url} target="_blank" rel="noreferrer">
                  <Image
                    unoptimized
                    src={photo.url}
                    alt={photo.caption || "Activity photo"}
                    width={800}
                    height={600}
                    loading="lazy"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="aspect-[4/3] w-full object-cover"
                  />
                </a>
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center bg-slate-100 text-xs text-slate-500">
                  Preview unavailable
                </div>
              )}
              <figcaption className="flex items-center justify-between gap-2 p-3">
                <span className="line-clamp-2 text-xs text-slate-600 dark:text-slate-300">
                  {photo.caption || "Activity photo"}
                </span>
                {canManage && (
                  <span className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      title="Set as cover photo"
                      onClick={() =>
                        startTransition(async () => {
                          await setCoverMediaAction(activity.id, photo.id);
                          onRefresh();
                        })
                      }
                      className="rounded p-1 text-slate-400 hover:text-[#0D3594]"
                    >
                      {photo.isFeatured ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <ImagePlus className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      title="Remove photo"
                      onClick={() =>
                        startTransition(async () => {
                          await deleteActivityMediaAction(
                            activity.id,
                            photo.id,
                          );
                          onRefresh();
                        })
                      }
                      className="rounded p-1 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </span>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center dark:border-slate-700">
          <ImagePlus className="mx-auto h-6 w-6 text-slate-400" />
          <p className="mt-2 text-xs text-slate-500">No photos uploaded.</p>
        </div>
      )}
    </section>
  );
}

function ReportPanel({
  activity,
  canManage,
  onPublished,
  onOpenMediaTab,
}: {
  activity: ActivityDetailDTO;
  canManage: boolean;
  onPublished: () => void;
  onOpenMediaTab?: () => void;
}) {
  const details = activity.projectDetails;
  const formRef = React.useRef<HTMLFormElement>(null);
  const quickPhotoInputRef = React.useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [localMediaCount, setLocalMediaCount] = useState(
    activity.media.length,
  );
  React.useEffect(() => {
    setLocalMediaCount(activity.media.length);
  }, [activity.media.length]);

  const isAccomplished = activity.status === "ACCOMPLISHED";

  const [formValues, setFormValues] = useState(() => ({
    detailedDescription: activity.description || "",
    inspiration: details?.inspiration || "",
    objective: details?.objective || "",
    outcomesSummary: details?.outcomesSummary || "",
    beneficiaryType: details?.beneficiaryType || "",
  }));

  const readiness = evaluateReportReadiness({
    detailedDescription: formValues.detailedDescription,
    inspiration: formValues.inspiration,
    objective: formValues.objective,
    outcomesSummary: formValues.outcomesSummary,
    beneficiaryType: formValues.beneficiaryType,
    mediaCount: localMediaCount,
  });

  const checklistItems = readiness.items;
  const completedCount = readiness.completedCount;
  const ready = readiness.ready;

  function updateChecklist(form: HTMLFormElement) {
    const formData = new FormData(form);
    setFormValues({
      detailedDescription: String(formData.get("detailedDescription") || ""),
      inspiration: String(formData.get("inspiration") || ""),
      objective: String(formData.get("objective") || ""),
      outcomesSummary: String(formData.get("outcomesSummary") || ""),
      beneficiaryType: String(formData.get("beneficiaryType") || ""),
    });
  }

  async function handleQuickPhotoUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadingPhoto(true);
    try {
      const result = await uploadActivityPhotos({
        files: Array.from(files),
        activityId: activity.id,
        caption: `${activity.title} documentation`,
        upload: uploadActivityMediaAction,
        onProgress: () => {},
      });
      if (result.uploaded > 0) {
        setLocalMediaCount((prev) => prev + result.uploaded);
        notifyToast({
          title: "Photo uploaded",
          message: `${result.uploaded} project photo${result.uploaded > 1 ? "s" : ""} attached to report.`,
          kind: "success",
        });
        onPublished();
      } else if (result.failures.length > 0) {
        notifyToast({
          title: "Photo upload failed",
          message: result.failures[0].error,
          kind: "error",
        });
      }
    } catch (err) {
      notifyToast({
        title: "Photo upload error",
        message: err instanceof Error ? err.message : "Could not upload photo.",
        kind: "error",
      });
    } finally {
      setUploadingPhoto(false);
      if (quickPhotoInputRef.current) quickPhotoInputRef.current.value = "";
    }
  }

  function handleSaveDraft(markAwaitingReport = false) {
    if (!formRef.current) return;
    const data = new FormData(formRef.current);
    const payload = {
      activityId: activity.id,
      objective: String(data.get("objective") || ""),
      inspiration: String(data.get("inspiration") || ""),
      detailedDescription: String(data.get("detailedDescription") || ""),
      outcomesSummary: String(data.get("outcomesSummary") || ""),
      beneficiaryType: String(data.get("beneficiaryType") || ""),
      beneficiaryCount: Number(data.get("beneficiaryCount") || 0),
      volunteerNonmemberCount: Number(
        data.get("volunteerNonmemberCount") || 0,
      ),
      fundingTotal: Number(data.get("fundingTotal") || 0),
      totalExpenses: Number(data.get("totalExpenses") || 0),
      fundingCurrency: String(data.get("fundingCurrency") || "PHP"),
      fundingSource: String(data.get("fundingSource") || ""),
      supportsPolio: data.has("supportsPolio"),
      markAwaitingReport,
    };
    startTransition(async () => {
      const result = await saveProjectReportDraftAction(payload);
      if (!result.success) {
        notifyToast({
          title: "Could not save draft",
          message: result.error,
          kind: "error",
        });
        return;
      }
      notifyToast({
        title: "Draft saved",
        message: result.message || "Report progress saved.",
        kind: "success",
      });
      onPublished();
    });
  }

  if (isAccomplished) {
    return (
      <section className="mx-auto max-w-3xl space-y-4">
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/50 p-5 sm:p-6 dark:border-emerald-500/25 dark:from-emerald-950/30 dark:via-[#161B26] dark:to-emerald-950/10">
          <div className="flex items-center gap-2.5 text-emerald-800 dark:text-emerald-300">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white">
              <Check className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-bold">
                Project published as accomplished
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                The completion snapshot is officially logged in District 3820 records. Copy the formatted sections below for Rotary Showcase.
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-emerald-200/70 bg-white/80 p-3 dark:border-slate-700 dark:bg-slate-900/60">
              <p className="text-[10px] font-semibold uppercase text-slate-500">
                Beneficiaries
              </p>
              <p className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                {(details?.beneficiaryCount || 0).toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-200/70 bg-white/80 p-3 dark:border-slate-700 dark:bg-slate-900/60">
              <p className="text-[10px] font-semibold uppercase text-slate-500">
                Volunteers
              </p>
              <p className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                {activity.attendees.length +
                  (details?.volunteerNonmemberCount || 0)}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-200/70 bg-white/80 p-3 dark:border-slate-700 dark:bg-slate-900/60">
              <p className="text-[10px] font-semibold uppercase text-slate-500">
                Volunteer Hours
              </p>
              <p className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                {(details?.totalVolunteerHours || 0).toLocaleString()} hrs
              </p>
            </div>
            <div className="rounded-xl border border-emerald-200/70 bg-white/80 p-3 dark:border-slate-700 dark:bg-slate-900/60">
              <p className="text-[10px] font-semibold uppercase text-slate-500">
                Photos Logged
              </p>
              <p className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                {activity.media.length}
              </p>
            </div>
          </div>
        </div>
        <ShowcaseCopy activity={activity} />
      </section>
    );
  }

  if (!canManage)
    return (
      <div className="rounded-xl border border-[#EDEDF2] bg-white p-5 text-sm text-slate-500 dark:border-slate-800 dark:bg-[#161B26]">
        The project chair or an officer can complete the accomplishment report.
      </div>
    );

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <div className="rounded-2xl border border-[#EDEDF2] bg-white p-4 sm:p-6 shadow-2xs dark:border-slate-800 dark:bg-[#161B26]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              Guided Accomplishment Report
            </p>
            <h2 className="mt-1 text-base font-bold text-[#111625] dark:text-white">
              Publish this service project as Accomplished
            </h2>
            <p className="mt-1 max-w-2xl text-xs text-slate-500">
              Complete the 6 Rotary Showcase requirements below. You can save your draft anytime or publish once all 6 items turn green.
            </p>
          </div>
          <span
            className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold ${
              ready
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300"
                : "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200"
            }`}
          >
            {completedCount}/{checklistItems.length} complete
          </span>
        </div>
        <div
          className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
          role="progressbar"
          aria-label="Report completion"
          aria-valuenow={completedCount}
          aria-valuemin={0}
          aria-valuemax={checklistItems.length}
        >
          <div
            className="h-full rounded-full bg-emerald-600 transition-all duration-300"
            style={{
              width: `${(completedCount / checklistItems.length) * 100}%`,
            }}
          />
        </div>
        <ul className="mt-3.5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {checklistItems.map((item) => (
            <li key={item.key}>
              <Requirement
                met={item.done}
                label={item.label}
                detail={
                  item.minChars
                    ? `${Math.min(item.currentChars || 0, item.minChars)}/${item.minChars} chars`
                    : item.done
                      ? `${localMediaCount} uploaded`
                      : "Required"
                }
              />
            </li>
          ))}
        </ul>

        {/* Inline Photo Upload Helper when photo is needed or to add more */}
        <div
          className={`mt-4 flex flex-col gap-3 rounded-xl border p-3.5 sm:flex-row sm:items-center sm:justify-between ${
            localMediaCount > 0
              ? "border-emerald-200/80 bg-emerald-50/50 dark:border-emerald-500/20 dark:bg-emerald-500/5"
              : "border-amber-300 bg-amber-50/70 dark:border-amber-500/30 dark:bg-amber-950/20"
          }`}
        >
          <div className="flex items-start gap-2.5">
            <ImagePlus
              className={`mt-0.5 h-4 w-4 shrink-0 ${
                localMediaCount > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-amber-600 dark:text-amber-400"
              }`}
            />
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">
                {localMediaCount > 0
                  ? `${localMediaCount} project photo${localMediaCount === 1 ? "" : "s"} attached`
                  : "Action Needed: Upload at least 1 project documentation photo"}
              </p>
              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                {localMediaCount > 0
                  ? "Photo requirement is satisfied. You can upload additional photos anytime."
                  : "Rotary Showcase requires at least one photo before a service project can be marked Accomplished."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <input
              ref={quickPhotoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="sr-only"
              onChange={(e) => handleQuickPhotoUpload(e.target.files)}
            />
            <button
              type="button"
              disabled={uploadingPhoto || pending}
              onClick={() => quickPhotoInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D3594] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#092569] disabled:opacity-60 transition cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5" />
              {uploadingPhoto ? "Uploading..." : "Upload Photo Here"}
            </button>
            {onOpenMediaTab && (
              <button
                type="button"
                onClick={onOpenMediaTab}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
              >
                Media Tab
              </button>
            )}
          </div>
        </div>

        <form
          ref={formRef}
          className="mt-5 space-y-5"
          onChange={(event) => updateChecklist(event.currentTarget)}
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const payload = {
              activityId: activity.id,
              objective: String(data.get("objective") || ""),
              inspiration: String(data.get("inspiration") || ""),
              detailedDescription: String(
                data.get("detailedDescription") || "",
              ),
              outcomesSummary: String(data.get("outcomesSummary") || ""),
              beneficiaryType: String(data.get("beneficiaryType") || ""),
              beneficiaryCount: Number(data.get("beneficiaryCount") || 0),
              volunteerNonmemberCount: Number(
                data.get("volunteerNonmemberCount") || 0,
              ),
              fundingTotal: Number(data.get("fundingTotal") || 0),
              totalExpenses: Number(data.get("totalExpenses") || 0),
              fundingCurrency: String(data.get("fundingCurrency") || "PHP"),
              fundingSource: String(data.get("fundingSource") || ""),
              supportsPolio: data.has("supportsPolio"),
            };
            startTransition(async () => {
              const result = await publishProjectReportAction(payload);
              if (!result.success) {
                notifyToast({
                  title: "Report not published",
                  message: result.error,
                  kind: "error",
                });
                return;
              }
              notifyToast({
                title: "Project accomplished! 🎉",
                message:
                  result.message || "The accomplishment report was published.",
                kind: "success",
              });
              onPublished();
            });
          }}
        >
          <ReportSection title="Overview and project development" step="01">
            <label className="block text-xs font-semibold">
              <span className="flex items-center justify-between">
                <span>
                  Detailed description <Required />
                </span>
                <CharCounter
                  current={formValues.detailedDescription.trim().length}
                  min={30}
                />
              </span>
              <textarea
                name="detailedDescription"
                rows={4}
                required
                minLength={30}
                defaultValue={activity.description}
                className={fieldClass}
                placeholder="What happened during the service activity? Include the work delivered and who took part."
              />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-xs font-semibold">
                <span className="flex items-center justify-between">
                  <span>
                    What inspired the project? <Required />
                  </span>
                  <CharCounter
                    current={formValues.inspiration.trim().length}
                    min={20}
                  />
                </span>
                <textarea
                  name="inspiration"
                  rows={4}
                  required
                  minLength={20}
                  defaultValue={details?.inspiration}
                  className={fieldClass}
                  placeholder="Describe the community need or opportunity that led to this project."
                />
              </label>
              <label className="block text-xs font-semibold">
                <span className="flex items-center justify-between">
                  <span>
                    Project objective <Required />
                  </span>
                  <CharCounter
                    current={formValues.objective.trim().length}
                    min={10}
                  />
                </span>
                <textarea
                  name="objective"
                  rows={4}
                  required
                  minLength={10}
                  defaultValue={details?.objective}
                  className={fieldClass}
                  placeholder="What change did the project intend to make?"
                />
              </label>
            </div>
            <label className="block text-xs font-semibold">
              <span className="flex items-center justify-between">
                <span>
                  Outcomes and measurement <Required />
                </span>
                <CharCounter
                  current={formValues.outcomesSummary.trim().length}
                  min={20}
                />
              </span>
              <textarea
                name="outcomesSummary"
                rows={3}
                required
                minLength={20}
                defaultValue={details?.outcomesSummary}
                className={fieldClass}
                placeholder="Describe results and how the club measured them."
              />
            </label>
          </ReportSection>

          <ReportSection title="Beneficiaries and participation" step="02">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-semibold">
                <span className="flex items-center justify-between">
                  <span>
                    Who benefited? <Required />
                  </span>
                  <CharCounter
                    current={formValues.beneficiaryType.trim().length}
                    min={2}
                  />
                </span>
                <input
                  name="beneficiaryType"
                  required
                  minLength={2}
                  defaultValue={details?.beneficiaryType}
                  className={fieldClass}
                  placeholder="e.g. flood-prone households"
                />
              </label>
              <label className="text-xs font-semibold">
                Number of beneficiaries
                <input
                  name="beneficiaryCount"
                  type="number"
                  min="0"
                  defaultValue={details?.beneficiaryCount || 0}
                  className={fieldClass}
                />
              </label>
              <label className="text-xs font-semibold">
                Non-member volunteers
                <input
                  name="volunteerNonmemberCount"
                  type="number"
                  min="0"
                  defaultValue={details?.volunteerNonmemberCount || 0}
                  className={fieldClass}
                />
              </label>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
                <p className="text-[11px] font-semibold text-slate-500">
                  Verified member participation
                </p>
                <p className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100">
                  {activity.attendees.length} volunteers ·{" "}
                  {activity.attendees
                    .reduce((sum, attendee) => sum + attendee.volunteerHours, 0)
                    .toFixed(1)}{" "}
                  hours
                </p>
                <p className="mt-1 text-[10px] text-slate-500">
                  Calculated from attendance records after check-in.
                </p>
              </div>
            </div>
          </ReportSection>

          <ReportSection title="Funding and Rotary reporting" step="03">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-semibold">
                Funding amount
                <input
                  name="fundingTotal"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={details?.fundingTotal || 0}
                  className={fieldClass}
                />
              </label>
              <label className="text-xs font-semibold">
                Total expenses
                <input
                  name="totalExpenses"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={details?.totalExpenses || 0}
                  className={fieldClass}
                />
              </label>
              <label className="text-xs font-semibold">
                Currency
                <input
                  name="fundingCurrency"
                  required
                  minLength={3}
                  maxLength={3}
                  defaultValue={details?.fundingCurrency || "PHP"}
                  className={fieldClass}
                />
              </label>
              <label className="text-xs font-semibold">
                Funding source
                <input
                  name="fundingSource"
                  defaultValue={details?.fundingSource}
                  className={fieldClass}
                  placeholder="Club, grant, or partner"
                />
              </label>
            </div>
            <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                name="supportsPolio"
                defaultChecked={details?.supportsPolio}
                className="accent-[#0D3594]"
              />
              This activity supports polio eradication efforts
            </label>
          </ReportSection>

          <section className="sticky bottom-2 z-10 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white/95 p-3.5 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between dark:border-slate-700 dark:bg-[#161B26]/95">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                {ready
                  ? "✓ All 6 requirements met — ready to publish as Accomplished!"
                  : `${checklistItems.length - completedCount} required item${checklistItems.length - completedCount === 1 ? "" : "s"} still needed before publishing.`}
              </p>
              {!ready && readiness.missingLabels.length > 0 && (
                <p className="text-[11px] text-amber-700 dark:text-amber-300">
                  Missing: {readiness.missingLabels.join(", ")}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={pending || uploadingPhoto}
                onClick={() =>
                  handleSaveDraft(activity.status === "ONGOING")
                }
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
              >
                {activity.status === "ONGOING"
                  ? "Save Draft & Mark Awaiting Report"
                  : "Save Draft"}
              </button>
              <button
                type="submit"
                disabled={pending || uploadingPhoto || !ready}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto cursor-pointer shadow-xs"
              >
                <Check className="h-4 w-4" />{" "}
                {pending ? "Publishing..." : "Publish as accomplished"}
              </button>
            </div>
          </section>
        </form>
      </div>
      <ShowcaseCopy activity={activity} />
    </section>
  );
}

function ReportSection({
  title,
  step,
  children,
}: {
  title: string;
  step: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-[#EDEDF2] p-4 sm:p-5 dark:border-slate-800">
      <header className="flex items-center gap-2 border-b border-[#EDEDF2] pb-2 dark:border-slate-800">
        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
          {step}
        </span>
        <h3 className="text-xs font-bold text-[#111625] dark:text-white">
          {title}
        </h3>
      </header>
      {children}
    </section>
  );
}

function Requirement({
  met,
  label,
  detail,
}: {
  met: boolean;
  label: string;
  detail?: string;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${
        met
          ? "border-emerald-200 bg-emerald-50/80 text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300"
          : "border-amber-200 bg-amber-50/70 text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300"
      }`}
    >
      <span className="inline-flex items-center gap-1.5 truncate">
        <span aria-hidden="true" className="font-bold">
          {met ? "✓" : "•"}
        </span>
        <span className="truncate">{label}</span>
      </span>
      {detail && (
        <span className="shrink-0 text-[10px] font-medium opacity-80">
          {detail}
        </span>
      )}
    </div>
  );
}

function CharCounter({ current, min }: { current: number; min: number }) {
  const met = current >= min;
  return (
    <span
      className={`text-[10px] font-semibold ${
        met
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-amber-600 dark:text-amber-400"
      }`}
    >
      {met ? `✓ ${current} chars` : `${current}/${min} min chars`}
    </span>
  );
}

function Required() {
  return <span className="ml-1 text-rose-600">*</span>;
}

function ShowcaseCopy({ activity }: { activity: ActivityDetailDTO }) {
  const details = activity.projectDetails;
  const text = [
    `OVERVIEW\n${activity.title}\n${activity.description}`,
    `ACTIVITY DEVELOPMENT\nWhat inspired us: ${details?.inspiration || ""}\nObjective: ${details?.objective || ""}\nOutcomes: ${details?.outcomesSummary || ""}`,
    `TIMELINE AND FUNDING\n${formatManila(activity.startAt, "d MMMM yyyy")} – ${formatManila(activity.endAt, "d MMMM yyyy")}\nFunding: ${details?.fundingCurrency || "PHP"} ${details?.fundingTotal || 0}\nSource: ${details?.fundingSource || "—"}`,
    `MEASUREMENT\nBeneficiaries: ${details?.beneficiaryCount || 0} (${details?.beneficiaryType || "—"})\nVolunteers: ${activity.attendees.length + (details?.volunteerNonmemberCount || 0)}\nVolunteer hours: ${details?.totalVolunteerHours || 0}`,
  ].join("\n\n");
  const [copied, setCopied] = useState(false);
  return (
    <details className="rounded-xl border border-[#EDEDF2] bg-white p-4 dark:border-slate-800 dark:bg-[#161B26]">
      <summary className="cursor-pointer text-xs font-bold text-[#111625] dark:text-white">
        Copy for Rotary Showcase
      </summary>
      <p className="mt-2 text-xs text-slate-500">
        Rotary Showcase has no public integration API. Copy the completed
        sections into the official form.
      </p>
      <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-[11px] text-slate-700 dark:bg-slate-900 dark:text-slate-300">
        {text}
      </pre>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setCopied(true);
        }}
        className="mt-3 rounded-lg border border-[#EDEDF2] px-3 py-2 text-xs font-semibold dark:border-slate-700"
      >
        {copied ? "Copied" : "Copy project details"}
      </button>
    </details>
  );
}

const fieldClass =
  "mt-1.5 block w-full rounded-lg border border-[#DDE1EA] bg-white px-3 py-2 text-sm font-normal text-[#111625] outline-none focus:border-[#0D3594] focus:ring-2 focus:ring-[#0D3594]/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white";
