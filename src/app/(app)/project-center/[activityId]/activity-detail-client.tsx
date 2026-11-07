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
  CalendarDays,
  Check,
  CheckSquare,
  Clock,
  Heart,
  ImagePlus,
  MapPin,
  MessageSquare,
  QrCode,
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
import type { GroupTaskDTO, TaskStatus } from "@/lib/data/tasks-types";
import {
  addCommentAction,
  createActivityTaskAction,
  deleteActivityMediaAction,
  deleteActivityTaskAction,
  deleteCommentAction,
  publishProjectReportAction,
  revokeAttendanceAction,
  selfCheckInAction,
  setRsvpAction,
  setCoverMediaAction,
  startActivityQrSessionAction,
  toggleActivityQrCheckInAction,
  toggleFollowAction,
  toggleReactionAction,
  updateActivityStatusAction,
  updateActivityTaskAction,
  uploadActivityMediaAction,
} from "@/features/activities/actions";
import { updateTaskStatusAction } from "@/features/tasks/actions";
import { archiveActivityAction, hardDeleteActivityAction, updateActivityAction } from "@/features/activities/actions";
import type { MemberDTO } from "@/features/members/queries";
import {
  isProjectKind,
  ACTIVITY_KIND_META,
  ACTIVITY_STATUSES,
  ACTIVITY_STATUS_LABELS,
  COMMITTEES,
} from "@/features/activities/types";
import { minMembersStatus } from "@/features/activities/rules";
import { formatManila, isoToManilaLocal } from "@/lib/utils/dates";
import { notifyToast } from "@/components/shared/toast-viewport";
import { uploadActivityPhotos } from "@/features/activities/media-upload";
import {
  ActivityStatusBadge,
  Avatar,
  KindBadge,
  ProgressBar,
} from "../_components/badges";
import { RsvpButtons } from "../_components/rsvp-buttons";
import { formatActivityWhen, isRsvpOpen } from "../_components/activity-card";

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

export function ActivityDetailClient({
  initialActivity,
  initialTasks,
  initialTab,
  currentUserId,
  canCreateTasks,
  canManageClub,
  isPlatformAdmin = false,
  members = [],
}: {
  initialActivity: ActivityDetailDTO;
  initialTasks: GroupTaskDTO[];
  initialTab?: string;
  currentUserId: string;
  canCreateTasks: boolean;
  canManageClub: boolean;
  isPlatformAdmin?: boolean;
  members?: MemberDTO[];
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
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
          <div className="flex items-center gap-2">
            <Archive className="h-4 w-4 text-slate-500 shrink-0" />
            <span>
              <strong>Archived record:</strong> This {isProject ? "project" : "activity"} has been moved to the archive. RSVPs and live check-ins are closed while historical data, attendance, and reports remain preserved.
            </span>
          </div>
          {canEdit && (
            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
              <button
                type="button"
                disabled={pending || isDeleting}
                onClick={() =>
                  run(async () => {
                    const res = await archiveActivityAction(activity.id, false);
                    if (res.success) setActivity({ isArchived: false, archivedAt: null });
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
      <section className="overflow-hidden rounded-2xl border border-[#EDEDF2] bg-white dark:border-slate-800 dark:bg-[#161B26]">
        {activity.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={activity.coverUrl}
            alt=""
            className="h-44 w-full object-cover sm:h-56"
          />
        ) : (
          <div
            className={`h-1.5 w-full ${ACTIVITY_KIND_META[activity.kind].dotClass}`}
          />
        )}
        <div className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <KindBadge
              kind={activity.kind}
              meetingType={activity.meetingType}
            />
            <ActivityStatusBadge status={activity.status} />
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
                    onClick={() => setIsEditOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition"
                  >
                    <Pencil className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    Edit {isProject ? "Project" : "Activity"}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      const nextArchived = !activity.isArchived;
                      run(
                        async () => {
                          const res = await archiveActivityAction(
                            activity.id,
                            nextArchived,
                          );
                          if (res.success) {
                            setActivity({
                              isArchived: nextArchived,
                              archivedAt: nextArchived
                                ? new Date().toISOString()
                                : null,
                            });
                          }
                          return res;
                        },
                        nextArchived
                          ? "Moved to archive."
                          : "Restored to active workspace.",
                      );
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold shadow-2xs transition disabled:opacity-60 ${
                      activity.isArchived
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    {activity.isArchived ? (
                      <>
                        <ArchiveRestore className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        Restore {isProject ? "Project" : "Activity"}
                      </>
                    ) : (
                      <>
                        <Archive className="h-3.5 w-3.5 text-slate-500" />
                        Archive {isProject ? "Project" : "Activity"}
                      </>
                    )}
                  </button>
                  {activity.isArchived && (
                    <button
                      type="button"
                      disabled={pending || isDeleting}
                      onClick={() => setIsDeleteModalOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 shadow-2xs transition disabled:opacity-60"
                      title="Permanently remove project and media files"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                      Hard Delete
                    </button>
                  )}
                </>
              )}
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
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            aria-current={tab === id ? "page" : undefined}
            className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition ${tab === id ? "border-[#0D3594] text-[#0D3594] dark:text-blue-300" : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}
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
                    : ""}
              </>
            )}
          </button>
        ))}
      </nav>

      {tab === "OVERVIEW" && (
        <OverviewPanel
          activity={activity}
          isProject={isProject}
          isUnlocked={isUnlocked}
          onUnlock={handleUnlockGoing}
          pending={pending}
        />
      )}
      {tab === "TASKS" &&
        (isUnlocked ? (
          <TasksPanel
            activity={activity}
            tasks={tasks}
            canCreate={canCreateTasks}
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
            canManage={canManageClub}
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
            canManage={canManageClub}
            onPublished={() => router.refresh()}
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
          canReassignOwner={canReassignOwner}
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          onSaved={() => router.refresh()}
        />
      )}

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
  isProject,
  isUnlocked = true,
  onUnlock,
  pending = false,
}: {
  activity: ActivityDetailDTO;
  isProject: boolean;
  isUnlocked?: boolean;
  onUnlock?: () => void;
  pending?: boolean;
}) {
  const details = activity.projectDetails;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,.8fr)]">
      <section className="rounded-xl border border-[#EDEDF2] bg-white p-5 dark:border-slate-800 dark:bg-[#161B26]">
        <h2 className="text-sm font-bold text-[#111625] dark:text-white">
          About this activity
        </h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {activity.description ||
            activity.shortDescription ||
            "No description has been added."}
        </p>

        {activity.team && activity.team.length > 0 && (
          <div className="mt-6 border-t border-[#EDEDF2] pt-5 dark:border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              Project Committee & Leads ({activity.team.length})
            </h3>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {activity.team.map((member) => (
                <div
                  key={member.profileId}
                  className="flex items-center gap-2.5 rounded-lg border border-[#EDEDF2] bg-slate-50/60 p-2.5 dark:border-slate-800 dark:bg-slate-900/40"
                >
                  <Avatar name={member.fullName} url={member.avatarUrl} size={30} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[#111625] dark:text-white truncate">
                      {member.fullName}
                    </p>
                    <span className="inline-block text-[10px] font-medium text-[#0D3594] dark:text-blue-300">
                      {member.role.replace("_", " ")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
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
              RSVP as <strong>Going</strong> to unlock task workflows, private discussion group, participant roster, and real-time project notifications.
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
          <>
            <h3 className="mt-6 text-xs font-bold uppercase text-slate-500">
              Project objective
            </h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
              {details.objective || "Not added yet."}
            </p>
            {details.areasOfFocus.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {details.areasOfFocus.map((item) => (
                  <span
                    key={item}
                    className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
                  >
                    {item}
                  </span>
                ))}
              </div>
            )}
            {details.sdgs.length > 0 && (
              <p className="mt-3 text-xs text-slate-500">
                UN SDGs: {details.sdgs.join(", ")}
              </p>
            )}
            {details.partners.length > 0 && (
              <div className="mt-5">
                <h3 className="text-xs font-bold uppercase text-slate-500">
                  Partners
                </h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {details.partners.map((partner) => (
                    <span
                      key={partner.id}
                      className="rounded-lg border border-[#EDEDF2] px-2.5 py-1.5 text-xs dark:border-slate-700"
                    >
                      {partner.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>
      <aside className="space-y-4">
        <section className="rounded-xl border border-[#EDEDF2] bg-white p-5 dark:border-slate-800 dark:bg-[#161B26]">
          <h2 className="text-sm font-bold text-[#111625] dark:text-white">
            People
          </h2>
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-slate-500">Chair</span>
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {activity.ownerName || "Unassigned"}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-slate-500">Going</span>
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {activity.rsvp.going}
              {activity.capacity ? ` / ${activity.capacity}` : ""}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-slate-500">Checked in</span>
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {activity.attendees.length}
            </span>
          </div>
          {isProject && details && (
            <>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-slate-500">Beneficiaries</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {details.beneficiaryCount.toLocaleString()}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-slate-500">Volunteer hours</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {details.totalVolunteerHours.toLocaleString()}
                </span>
              </div>
            </>
          )}
        </section>
        <ActivityTimeline activity={activity} />
      </aside>
    </div>
  );
}

function ActivityTimeline({ activity }: { activity: ActivityDetailDTO }) {
  const [status, setStatus] = useState(activity.status);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <section className="rounded-xl border border-[#EDEDF2] bg-white p-5 dark:border-slate-800 dark:bg-[#161B26]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-[#111625] dark:text-white">
          Activity history
        </h2>
        {activity.canManage && (
          <select
            aria-label="Update activity status"
            value={status}
            disabled={pending || status === "ACCOMPLISHED"}
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
              });
            }}
            className="max-w-40 rounded-md border border-[#EDEDF2] bg-white px-2 py-1 text-[10px] dark:border-slate-700 dark:bg-slate-900"
          >
            {ACTIVITY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {ACTIVITY_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        )}
      </div>
      {error && <p className="mt-2 text-[11px] text-rose-600">{error}</p>}
      <ol className="mt-4 space-y-3">
        {activity.log.slice(0, 8).map((entry) => (
          <li key={entry.id} className="flex gap-2.5">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#0D3594]" />
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                {entry.action.replaceAll("_", " ")}
              </span>
              <span className="block text-[10px] text-slate-500">
                {entry.actorName} · {formatManila(entry.createdAt)}
              </span>
            </span>
          </li>
        ))}
        {activity.log.length === 0 && (
          <li className="text-xs text-slate-500">
            Created {formatManila(activity.startAt, "MMM d, yyyy")}
          </li>
        )}
      </ol>
    </section>
  );
}

function TasksPanel({
  activity,
  tasks,
  canCreate,
  members = [],
  onTaskCreated,
}: {
  activity: ActivityDetailDTO;
  tasks: GroupTaskDTO[];
  canCreate: boolean;
  members?: MemberDTO[];
  onTaskCreated: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);
  const [editingTask, setEditingTask] = useState<GroupTaskDTO | null>(null);
  const [editAssigneeIds, setEditAssigneeIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const lanes: { status: TaskStatus; label: string }[] = [
    { status: "TODO", label: "To do" },
    { status: "IN_PROGRESS", label: "In progress" },
    { status: "IN_REVIEW", label: "In review" },
    { status: "COMPLETED", label: "Done" },
  ];

  // Build unified candidate list prioritizing project committee members
  const teamIds = new Set((activity.team || []).map((t) => t.profileId));
  const otherMembers = members.filter((m) => !teamIds.has(m.id));

  function toggleAssignee(
    id: string,
    current: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
  ) {
    setter(
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function openEditModal(task: GroupTaskDTO) {
    setEditingTask(task);
    setEditAssigneeIds(task.assignedMemberIds || []);
    setEditError(null);
  }

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-[#111625] dark:text-white">
            Project tasks
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Assign one or more committee or club members to tasks. Admins and authorized officers can edit tasks at any time.
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => {
              setShowForm(!showForm);
              setError(null);
            }}
            className="rounded-lg bg-[#0D3594] px-3 py-2 text-xs font-semibold text-white cursor-pointer"
          >
            {showForm ? "Close" : "Add task"}
          </button>
        )}
      </header>
      {showForm && (
        <form
          className="grid gap-3 rounded-xl border border-[#EDEDF2] bg-white p-4 sm:grid-cols-2 dark:border-slate-800 dark:bg-[#161B26]"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            setError(null);
            startTransition(async () => {
              const result = await createActivityTaskAction({
                activityId: activity.id,
                title: String(data.get("title") || ""),
                description: String(data.get("description") || ""),
                committee: String(
                  data.get("committee") || "CLUB_SERVICE",
                ) as (typeof COMMITTEES)[number],
                priority: String(data.get("priority") || "MEDIUM") as
                  | "LOW"
                  | "MEDIUM"
                  | "HIGH"
                  | "URGENT",
                dueDate: String(data.get("dueDate") || ""),
                assigneeIds: selectedAssigneeIds,
              });
              if (!result.success) {
                setError(result.error);
                return;
              }
              setSelectedAssigneeIds([]);
              setShowForm(false);
              onTaskCreated();
            });
          }}
        >
          <label className="text-xs font-semibold">
            Task title <span className="text-rose-500">*</span>
            <input name="title" required minLength={3} className={fieldClass} />
          </label>
          <label className="text-xs font-semibold">
            Due date <span className="text-rose-500">*</span>
            <input name="dueDate" type="date" required className={fieldClass} />
          </label>
          <label className="text-xs font-semibold">
            Committee
            <select name="committee" className={fieldClass}>
              {COMMITTEES.map((c) => (
                <option key={c} value={c}>
                  {c.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold">
            Priority
            <select name="priority" className={fieldClass}>
              <option>MEDIUM</option>
              <option>LOW</option>
              <option>HIGH</option>
              <option>URGENT</option>
            </select>
          </label>

          {/* Multi-member Assignee Selector */}
          <div className="sm:col-span-2 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#111625] dark:text-white">
                Assign Members (Select one or more)
              </span>
              <div className="flex items-center gap-2">
                {activity.team && activity.team.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const allTeam = activity.team.map((t) => t.profileId);
                      setSelectedAssigneeIds((prev) =>
                        Array.from(new Set([...prev, ...allTeam])),
                      );
                    }}
                    className="text-[11px] font-semibold text-[#0D3594] hover:underline dark:text-blue-300 cursor-pointer"
                  >
                    + Assign all committee ({activity.team.length})
                  </button>
                )}
                {selectedAssigneeIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedAssigneeIds([])}
                    className="text-[11px] font-semibold text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    Clear ({selectedAssigneeIds.length})
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-44 overflow-y-auto rounded-xl border border-[#EDEDF2] bg-slate-50/60 p-2.5 space-y-2.5 dark:border-slate-800 dark:bg-slate-900/50">
              {activity.team && activity.team.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1.5">
                    Project Committee & Team
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {activity.team.map((m) => {
                      const active = selectedAssigneeIds.includes(m.profileId);
                      return (
                        <button
                          key={m.profileId}
                          type="button"
                          onClick={() =>
                            toggleAssignee(
                              m.profileId,
                              selectedAssigneeIds,
                              setSelectedAssigneeIds,
                            )
                          }
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                            active
                              ? "border-[#0D3594] bg-[#0D3594] text-white shadow-2xs"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          }`}
                        >
                          {active && <Check className="h-3 w-3" />}
                          <span>{m.fullName}</span>
                          <span
                            className={`text-[10px] ${
                              active
                                ? "text-blue-100"
                                : "text-slate-400 dark:text-slate-400"
                            }`}
                          >
                            ({m.role.replace("_", " ")})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {otherMembers.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Club Members & Officers
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {otherMembers.map((m) => {
                      const active = selectedAssigneeIds.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() =>
                            toggleAssignee(
                              m.id,
                              selectedAssigneeIds,
                              setSelectedAssigneeIds,
                            )
                          }
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                            active
                              ? "border-[#0D3594] bg-[#0D3594] text-white shadow-2xs"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          }`}
                        >
                          {active && <Check className="h-3 w-3" />}
                          <span>{m.name || m.email}</span>
                          {m.role && (
                            <span
                              className={`text-[10px] ${
                                active ? "text-blue-100" : "text-slate-400"
                              }`}
                            >
                              ({m.role})
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <label className="text-xs font-semibold sm:col-span-2">
            Description
            <textarea name="description" rows={2} className={fieldClass} />
          </label>
          {error && (
            <p role="alert" className="text-xs text-rose-600 sm:col-span-2">
              {error}
            </p>
          )}
          <div className="sm:col-span-2">
            <button
              disabled={pending}
              className="rounded-lg bg-[#0D3594] px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-60 cursor-pointer"
            >
              {pending ? "Adding..." : "Create task"}
            </button>
          </div>
        </form>
      )}
      <div className="grid gap-3 xl:grid-cols-4">
        {lanes.map((lane) => (
          <div
            key={lane.status}
            className="min-h-36 rounded-xl bg-slate-50 p-2.5 dark:bg-slate-900/50"
          >
            <div className="flex items-center justify-between px-1 pb-2">
              <h3 className="text-xs font-bold text-slate-600 dark:text-slate-300">
                {lane.label}
              </h3>
              <span className="text-[10px] text-slate-400">
                {tasks.filter((task) => task.status === lane.status).length}
              </span>
            </div>
            <div className="space-y-2">
              {tasks
                .filter((task) => task.status === lane.status)
                .map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    canManage={canCreate}
                    onEdit={() => openEditModal(task)}
                    onChanged={onTaskCreated}
                  />
                ))}
            </div>
          </div>
        ))}
      </div>
      {tasks.length === 0 && !showForm && (
        <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-xs text-slate-500 dark:border-slate-700">
          No tasks linked to this activity yet.
        </div>
      )}

      {/* Edit Task Modal for Admin / Officers / Project Chair */}
      {editingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#EDEDF2] bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-[#161B26]">
            <div className="flex items-center justify-between border-b border-[#EDEDF2] pb-3 dark:border-slate-800">
              <h3 className="text-sm font-bold text-[#111625] dark:text-white">
                Edit Task & Member Assignments
              </h3>
              <button
                type="button"
                onClick={() => setEditingTask(null)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              className="mt-4 grid gap-3 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                setEditError(null);
                startTransition(async () => {
                  const res = await updateActivityTaskAction({
                    activityId: activity.id,
                    taskId: editingTask.id,
                    title: String(data.get("title") || ""),
                    description: String(data.get("description") || ""),
                    committee: String(
                      data.get("committee") || editingTask.committee,
                    ) as (typeof COMMITTEES)[number],
                    priority: String(
                      data.get("priority") || editingTask.priority,
                    ) as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
                    status: String(
                      data.get("status") || editingTask.status,
                    ) as TaskStatus,
                    dueDate: String(data.get("dueDate") || editingTask.dueDate),
                    assigneeIds: editAssigneeIds,
                  });
                  if (!res.success) {
                    setEditError(res.error);
                    return;
                  }
                  notifyToast({
                    message: res.message || "Task updated.",
                    kind: "success",
                  });
                  setEditingTask(null);
                  onTaskCreated();
                });
              }}
            >
              <label className="text-xs font-semibold sm:col-span-2">
                Task title <span className="text-rose-500">*</span>
                <input
                  name="title"
                  defaultValue={editingTask.title}
                  required
                  minLength={3}
                  className={fieldClass}
                />
              </label>
              <label className="text-xs font-semibold">
                Due date <span className="text-rose-500">*</span>
                <input
                  name="dueDate"
                  type="date"
                  defaultValue={editingTask.dueDate}
                  required
                  className={fieldClass}
                />
              </label>
              <label className="text-xs font-semibold">
                Status
                <select
                  name="status"
                  defaultValue={editingTask.status}
                  className={fieldClass}
                >
                  <option value="TODO">To do</option>
                  <option value="IN_PROGRESS">In progress</option>
                  <option value="IN_REVIEW">In review</option>
                  <option value="COMPLETED">Done</option>
                </select>
              </label>
              <label className="text-xs font-semibold">
                Committee
                <select
                  name="committee"
                  defaultValue={editingTask.committee}
                  className={fieldClass}
                >
                  {COMMITTEES.map((c) => (
                    <option key={c} value={c}>
                      {c.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold">
                Priority
                <select
                  name="priority"
                  defaultValue={editingTask.priority}
                  className={fieldClass}
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="URGENT">URGENT</option>
                </select>
              </label>

              {/* Multi-Member Selector inside Edit Modal */}
              <div className="sm:col-span-2 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#111625] dark:text-white">
                    Assigned Members (One or more)
                  </span>
                  <div className="flex items-center gap-2">
                    {activity.team && activity.team.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const allTeam = activity.team.map((t) => t.profileId);
                          setEditAssigneeIds((prev) =>
                            Array.from(new Set([...prev, ...allTeam])),
                          );
                        }}
                        className="text-[11px] font-semibold text-[#0D3594] hover:underline dark:text-blue-300 cursor-pointer"
                      >
                        + Assign all committee
                      </button>
                    )}
                    {editAssigneeIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setEditAssigneeIds([])}
                        className="text-[11px] font-semibold text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        Clear ({editAssigneeIds.length})
                      </button>
                    )}
                  </div>
                </div>

                <div className="max-h-40 overflow-y-auto rounded-xl border border-[#EDEDF2] bg-slate-50/60 p-2.5 space-y-2.5 dark:border-slate-800 dark:bg-slate-900/50">
                  {activity.team && activity.team.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1.5">
                        Project Committee & Team
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {activity.team.map((m) => {
                          const active = editAssigneeIds.includes(m.profileId);
                          return (
                            <button
                              key={m.profileId}
                              type="button"
                              onClick={() =>
                                toggleAssignee(
                                  m.profileId,
                                  editAssigneeIds,
                                  setEditAssigneeIds,
                                )
                              }
                              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                                active
                                  ? "border-[#0D3594] bg-[#0D3594] text-white shadow-2xs"
                                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                              }`}
                            >
                              {active && <Check className="h-3 w-3" />}
                              <span>{m.fullName}</span>
                              <span
                                className={`text-[10px] ${
                                  active ? "text-blue-100" : "text-slate-400"
                                }`}
                              >
                                ({m.role.replace("_", " ")})
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {otherMembers.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        Club Members & Officers
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {otherMembers.map((m) => {
                          const active = editAssigneeIds.includes(m.id);
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() =>
                                toggleAssignee(
                                  m.id,
                                  editAssigneeIds,
                                  setEditAssigneeIds,
                                )
                              }
                              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                                active
                                  ? "border-[#0D3594] bg-[#0D3594] text-white shadow-2xs"
                                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                              }`}
                            >
                              {active && <Check className="h-3 w-3" />}
                              <span>{m.name || m.email}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <label className="text-xs font-semibold sm:col-span-2">
                Description
                <textarea
                  name="description"
                  rows={2}
                  defaultValue={editingTask.description}
                  className={fieldClass}
                />
              </label>

              {editError && (
                <p role="alert" className="text-xs text-rose-600 sm:col-span-2">
                  {editError}
                </p>
              )}

              <div className="flex items-center justify-between gap-2 pt-2 sm:col-span-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      const res = await deleteActivityTaskAction(
                        activity.id,
                        editingTask.id,
                      );
                      if (!res.success) {
                        setEditError(res.error);
                        return;
                      }
                      notifyToast({
                        message: "Task deleted.",
                        kind: "success",
                      });
                      setEditingTask(null);
                      onTaskCreated();
                    });
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingTask(null)}
                    className="rounded-lg border border-[#EDEDF2] px-3 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={pending}
                    className="rounded-lg bg-[#0D3594] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60 cursor-pointer"
                  >
                    {pending ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

function TaskCard({
  task,
  canManage,
  onEdit,
  onChanged,
}: {
  task: GroupTaskDTO;
  canManage: boolean;
  onEdit?: () => void;
  onChanged?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const nextStatus: TaskStatus =
    task.status === "TODO"
      ? "IN_PROGRESS"
      : task.status === "IN_PROGRESS"
        ? "IN_REVIEW"
        : task.status === "IN_REVIEW"
          ? "COMPLETED"
          : "TODO";
  return (
    <article className="rounded-lg border border-[#EDEDF2] bg-white p-3 dark:border-slate-800 dark:bg-[#161B26]">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-xs font-semibold text-[#111625] dark:text-white">
          {task.title}
        </h4>
        {canManage && (
          <div className="flex items-center gap-1 shrink-0">
            {onEdit && (
              <button
                type="button"
                disabled={pending}
                title="Edit task & assignees"
                onClick={onEdit}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-[#0D3594] dark:hover:bg-slate-800 cursor-pointer"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
            <button
              type="button"
              disabled={pending}
              title={`Move to ${nextStatus.replaceAll("_", " ")}`}
              onClick={() =>
                startTransition(async () => {
                  await updateTaskStatusAction(task.id, nextStatus);
                  onChanged?.();
                })
              }
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-emerald-600 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
      {task.description && (
        <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">
          {task.description}
        </p>
      )}
      {task.assignedMemberNames && task.assignedMemberNames.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1 text-[10px] font-medium text-slate-600 dark:text-slate-300">
          <Users className="h-3 w-3 text-slate-400 shrink-0 mr-0.5" />
          {task.assignedMemberNames.map((name, idx) => (
            <span
              key={idx}
              className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-[#0D3594] dark:bg-blue-500/10 dark:text-blue-300"
            >
              {name}
            </span>
          ))}
        </div>
      )}
      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
        <span className="font-semibold text-slate-600 dark:text-slate-400">
          {task.priority}
        </span>
        <span>Due {formatManila(`${task.dueDate}T04:00:00Z`, "MMM d")}</span>
      </div>
    </article>
  );
}

function AttendancePanel({
  activity,
  canManage,
  onSelfCheckIn,
  onRevoke,
  onToggleQrCheckIn,
}: {
  activity: ActivityDetailDTO;
  canManage: boolean;
  onSelfCheckIn: () => void;
  onRevoke: (id: string) => void;
  onToggleQrCheckIn?: (enabled: boolean) => void;
}) {
  const [qr, setQr] = useState<{
    token: string;
    url: string;
    image: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  async function createQr() {
    setError(null);
    const result = await startActivityQrSessionAction(activity.id);
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
    setQr({ token: result.sessionToken, url, image });
  }
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(260px,.7fr)]">
      <section className="overflow-hidden rounded-xl border border-[#EDEDF2] bg-white dark:border-slate-800 dark:bg-[#161B26]">
        <header className="flex items-center justify-between border-b border-[#EDEDF2] px-4 py-3 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-bold text-[#111625] dark:text-white">
              Attendance roster
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {activity.attendees.length} checked in
            </p>
          </div>
          {canManage && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5" /> Manager view
            </span>
          )}
        </header>
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
                  className="rounded p-1 text-slate-400 hover:text-rose-600"
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
        {canManage && (
          activity.qrCheckInEnabled === false ? (
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
                <h2 className="text-sm font-bold text-[#111625] dark:text-white">
                  QR check-in
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Create a time-limited code for members to scan.
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
            <button
              type="button"
              disabled={pending}
              onClick={() => startTransition(createQr)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#EDEDF2] px-3 py-2 text-xs font-semibold hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <QrCode className="h-4 w-4" />
              {qr ? "Refresh QR code" : "Start QR session"}
            </button>
            {error && <p className="text-xs text-rose-600">{error}</p>}
            {qr && (
              <div className="space-y-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-900">
                <div className="flex justify-center">
                  <Image
                    unoptimized
                    src={qr.image}
                    alt="QR code for activity check-in"
                    width={224}
                    height={224}
                    className="h-56 w-56"
                  />
                </div>
                <p className="break-all text-center text-[10px] text-slate-500">
                  Session token active for up to 3 hours
                </p>
                <a
                  href={qr.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-center text-xs font-semibold text-[#0D3594] dark:text-blue-300"
                >
                  Open check-in link
                </a>
              </div>
            )}
          </section>
          )
        
        )}
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
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <form
        className="rounded-xl border border-[#EDEDF2] bg-white p-4 dark:border-slate-800 dark:bg-[#161B26]"
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
          placeholder="Share an update or ask the team a question..."
          className={fieldClass}
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[10px] text-slate-500">
            Comments are visible to club members.
          </span>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D3594] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            <Send className="h-3.5 w-3.5" /> Post
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      </form>
      <div className="space-y-3">
        {activity.comments.map((comment) => (
          <article
            key={comment.id}
            className="rounded-xl border border-[#EDEDF2] bg-white p-4 dark:border-slate-800 dark:bg-[#161B26]"
          >
            <header className="flex items-center gap-2.5">
              <Avatar
                name={comment.author.fullName}
                url={comment.author.avatarUrl}
                size={30}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-[#111625] dark:text-white">
                  {comment.author.fullName}
                </p>
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
                    className="rounded p-1 text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
            </header>
            <p
              className={`mt-3 whitespace-pre-wrap text-sm leading-relaxed ${comment.isDeleted ? "italic text-slate-400" : "text-slate-700 dark:text-slate-200"}`}
            >
              {comment.isDeleted ? "This comment was deleted." : comment.body}
            </p>
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
            <p className="mt-2 text-xs text-slate-500">No discussion yet.</p>
          </div>
        )}
      </div>
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
}: {
  activity: ActivityDetailDTO;
  canManage: boolean;
  onPublished: () => void;
}) {
  const details = activity.projectDetails;
  const [pending, startTransition] = useTransition();
  const isAccomplished = activity.status === "ACCOMPLISHED";
  const [checklist, setChecklist] = useState(() => ({
    description: (activity.description || "").trim().length >= 30,
    inspiration: (details?.inspiration || "").trim().length >= 20,
    objective: (details?.objective || "").trim().length >= 10,
    outcomes: (details?.outcomesSummary || "").trim().length >= 20,
    beneficiaries: (details?.beneficiaryType || "").trim().length >= 2,
    photo: activity.media.length > 0,
  }));
  const checklistItems = [
    {
      key: "description",
      label: "Detailed description",
      done: checklist.description,
    },
    {
      key: "inspiration",
      label: "Project inspiration",
      done: checklist.inspiration,
    },
    { key: "objective", label: "Objective", done: checklist.objective },
    {
      key: "outcomes",
      label: "Outcomes and measurement",
      done: checklist.outcomes,
    },
    {
      key: "beneficiaries",
      label: "Beneficiary group",
      done: checklist.beneficiaries,
    },
    { key: "photo", label: "At least one photo", done: checklist.photo },
  ];
  const completedCount = checklistItems.filter((item) => item.done).length;
  const ready = completedCount === checklistItems.length;

  function updateChecklist(form: HTMLFormElement) {
    const formData = new FormData(form);
    setChecklist({
      description:
        String(formData.get("detailedDescription") || "").trim().length >= 30,
      inspiration:
        String(formData.get("inspiration") || "").trim().length >= 20,
      objective: String(formData.get("objective") || "").trim().length >= 10,
      outcomes:
        String(formData.get("outcomesSummary") || "").trim().length >= 20,
      beneficiaries:
        String(formData.get("beneficiaryType") || "").trim().length >= 2,
      photo: activity.media.length > 0,
    });
  }

  if (isAccomplished) {
    return (
      <section className="mx-auto max-w-3xl rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-500/20 dark:bg-emerald-500/5">
        <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
          <Check className="h-5 w-5" />
          <h2 className="text-sm font-bold">
            Project published as accomplished
          </h2>
        </div>
        <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
          The completion snapshot is saved. You can now copy its sections into
          Rotary Showcase.
        </p>
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
      <div className="rounded-xl border border-[#EDEDF2] bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-[#161B26]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300">
              Completion report
            </p>
            <h2 className="mt-1 text-base font-bold text-[#111625] dark:text-white">
              Publish this service project
            </h2>
            <p className="mt-1 max-w-2xl text-xs text-slate-500">
              Complete the Rotary Showcase sections below. Attendance totals are
              taken from verified check-ins.
            </p>
          </div>
          <span className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {completedCount}/{checklistItems.length} complete
          </span>
        </div>
        <div
          className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
          role="progressbar"
          aria-label="Report completion"
          aria-valuenow={completedCount}
          aria-valuemin={0}
          aria-valuemax={checklistItems.length}
        >
          <div
            className="h-full rounded-full bg-emerald-600 transition-all"
            style={{
              width: `${(completedCount / checklistItems.length) * 100}%`,
            }}
          />
        </div>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {checklistItems.map((item) => (
            <li key={item.key}>
              <Requirement met={item.done} label={item.label} />
            </li>
          ))}
        </ul>
        <form
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
                title: "Project accomplished",
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
              Detailed description <Required />
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
                What inspired the project? <Required />
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
                Project objective <Required />
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
              Outcomes and measurement <Required />
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
                Who benefited? <Required />
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

          <section className="sticky bottom-2 z-10 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between dark:border-slate-700 dark:bg-[#161B26]/95">
            <p className="text-[11px] text-slate-500">
              {ready
                ? "All required sections are complete."
                : `${checklistItems.length - completedCount} required item${checklistItems.length - completedCount === 1 ? "" : "s"} still needed before publishing.`}
            </p>
            <button
              type="submit"
              disabled={pending || !ready}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              <Check className="h-4 w-4" />{" "}
              {pending ? "Publishing..." : "Publish as accomplished"}
            </button>
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

function Requirement({ met, label }: { met: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 ${met ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300" : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300"}`}
    >
      <span aria-hidden="true">{met ? "✓" : "•"}</span>
      {label}
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


interface EditActivityModalProps {
  activity: ActivityDetailDTO;
  members: MemberDTO[];
  canReassignOwner: boolean;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function EditActivityModal({
  activity,
  members,
  canReassignOwner,
  isOpen,
  onClose,
  onSaved,
}: EditActivityModalProps) {
  const isProject = isProjectKind(activity.kind);
  const [title, setTitle] = useState(activity.title);
  const [ownerId, setOwnerId] = useState(activity.ownerId || "");
  const [shortDescription, setShortDescription] = useState(activity.shortDescription || "");
  const [description, setDescription] = useState(activity.description || "");
  const [location, setLocation] = useState(activity.location || "");
  const [startAt, setStartAt] = useState(() => isoToManilaLocal(activity.startAt));
  const [endAt, setEndAt] = useState(() => isoToManilaLocal(activity.endAt));
  const [allDay, setAllDay] = useState(Boolean(activity.allDay));
  const [committee, setCommittee] = useState<string>(activity.committee || "");
  const [capacity, setCapacity] = useState(activity.capacity ? String(activity.capacity) : "");
  const [minMembersEnabled, setMinMembersEnabled] = useState(Boolean(activity.minMembersRequired));
  const [minMembersRequired, setMinMembersRequired] = useState(
    activity.minMembersRequired ? String(activity.minMembersRequired) : ""
  );
  const [rsvpEnabled, setRsvpEnabled] = useState(Boolean(activity.rsvpEnabled));
  const [rsvpDeadline, setRsvpDeadline] = useState(() =>
    activity.rsvpDeadline ? isoToManilaLocal(activity.rsvpDeadline) : ""
  );
  const [volunteerHoursDefault, setVolunteerHoursDefault] = useState(
    String(activity.volunteerHoursDefault ?? 0)
  );
  const [qrCheckInEnabled, setQrCheckInEnabled] = useState(activity.qrCheckInEnabled ?? true);
  const [selfCheckInEnabled, setSelfCheckInEnabled] = useState(Boolean(activity.selfCheckInEnabled));

  // Project details
  const [objective, setObjective] = useState(activity.projectDetails?.objective || "");
  const [beneficiaryType, setBeneficiaryType] = useState(activity.projectDetails?.beneficiaryType || "");
  const [beneficiaryTarget, setBeneficiaryTarget] = useState(
    String(activity.projectDetails?.beneficiaryCount ?? 0)
  );
  const [fundingTarget, setFundingTarget] = useState(
    String(activity.projectDetails?.fundingTotal ?? 0)
  );
  const [fundingSource, setFundingSource] = useState(activity.projectDetails?.fundingSource || "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim() || title.trim().length < 3) {
      setError("Title must be at least 3 characters.");
      return;
    }
    if (!startAt || !endAt) {
      setError("Please specify valid start and end dates.");
      return;
    }
    if (endAt < startAt) {
      setError("End date and time must be after the start date and time.");
      return;
    }

    setSaving(true);
    try {
      const basePayload = {
        clubId: activity.clubId,
        ownerId: ownerId || undefined,
        title: title.trim(),
        shortDescription: shortDescription.trim(),
        description: description.trim(),
        location: location.trim(),
        startAt,
        endAt,
        allDay,
        committee: committee ? (committee as any) : undefined,
        status: activity.status,
        minMembersEnabled,
        minMembersRequired: minMembersEnabled && minMembersRequired ? Number(minMembersRequired) : undefined,
        capacity: capacity ? Number(capacity) : undefined,
        rsvpEnabled,
        rsvpDeadline: rsvpEnabled && rsvpDeadline ? rsvpDeadline : undefined,
        selfCheckInEnabled,
        qrCheckInEnabled,
        checkInWindowMinutes: activity.checkInWindowMinutes || 180,
        volunteerHoursDefault: Number(volunteerHoursDefault) || 0,
      };

      let inputPayload: any;
      if (activity.kind === "MEETING") {
        inputPayload = {
          ...basePayload,
          kind: "MEETING",
          meetingType: activity.meetingType || "GENERAL_ASSEMBLY",
        };
      } else if (isProject) {
        inputPayload = {
          ...basePayload,
          kind: activity.kind,
          objective: objective.trim(),
          beneficiaryType: beneficiaryType.trim(),
          beneficiaryTarget: Number(beneficiaryTarget) || 0,
          fundingTarget: Number(fundingTarget) || 0,
          fundingSource: fundingSource.trim(),
          areasOfFocus: activity.projectDetails?.areasOfFocus || [],
          sdgs: activity.projectDetails?.sdgs || [],
          partners: (activity.projectDetails?.partners || []).map((p) => ({
            name: p.name,
            role: p.role,
          })),
        };
        if (activity.kind === "JOINT_PROJECT" && inputPayload.partners.length === 0) {
          inputPayload.partners = [
            { name: "Joint Project Partner", role: "IMPLEMENTING_PARTNER" },
          ];
        }
      } else {
        inputPayload = {
          ...basePayload,
          kind: activity.kind,
        };
      }

      const res = await updateActivityAction(activity.id, inputPayload);
      if (!res.success) {
        setError(res.error || "Failed to update activity.");
        setSaving(false);
        return;
      }
      notifyToast({
        message: isProject ? "Project updated successfully." : "Activity updated successfully.",
        kind: "success",
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs">
      <div className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Edit {isProject ? "Project" : "Activity"}
            </h2>
            <p className="text-xs text-slate-500">
              Update project details, assign project owner leadership, and configure attendance rules.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="overflow-y-auto p-6 space-y-6 flex-1">
            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
                {error}
              </div>
            )}

            {/* Section 1: Leadership & Basic Info */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <UserCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Project Leadership & Ownership
              </h3>

              {canReassignOwner ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Bond Project Owner
                  </label>
                  <select
                    value={ownerId}
                    onChange={(e) => setOwnerId(e.target.value)}
                    className={fieldClass}
                  >
                    <option value="">Select Project Owner...</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} {m.role ? `(${m.role})` : ""} - {m.email}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-slate-500">
                    As an administrator, you can bond this project to a member. The project owner will gain full management and editing permissions over this project.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/40">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Assigned Project Owner:</span>
                    <span className="font-semibold text-slate-800 dark:text-white">
                      {activity.ownerName || "Current Lead"}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Only club administrators have permission to reassign project ownership to another member.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Literacy Drive or Coastal Clean-Up"
                  className={fieldClass}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Committee
                  </label>
                  <select
                    value={committee}
                    onChange={(e) => setCommittee(e.target.value)}
                    className={fieldClass}
                  >
                    <option value="">None / Unassigned</option>
                    {COMMITTEES.map((c) => (
                      <option key={c} value={c}>
                        {c.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Location / Venue
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. San Pedro City Hall or Google Meet"
                    className={fieldClass}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Short Description
                </label>
                <input
                  type="text"
                  maxLength={280}
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  placeholder="Brief one-line summary (max 280 characters)"
                  className={fieldClass}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Full Description
                </label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Comprehensive activity overview, agenda, reminders, and directions..."
                  className={fieldClass}
                />
              </div>
            </div>

            {/* Section 2: Dates & Schedule */}
            <div className="space-y-4 border-t border-slate-100 dark:border-slate-800 pt-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Schedule & Timeframe
              </h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Start Date & Time (Asia/Manila) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={startAt}
                    onChange={(e) => setStartAt(e.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                    End Date & Time (Asia/Manila) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={endAt}
                    onChange={(e) => setEndAt(e.target.value)}
                    className={fieldClass}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="edit-allday"
                  type="checkbox"
                  checked={allDay}
                  onChange={(e) => setAllDay(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="edit-allday" className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  All-day event
                </label>
              </div>
            </div>

            {/* Section 3: Project Goals & Budget (if project) */}
            {isProject && (
              <div className="space-y-4 border-t border-slate-100 dark:border-slate-800 pt-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  Project Goals & Impact Details
                </h3>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Objective
                  </label>
                  <textarea
                    rows={3}
                    value={objective}
                    onChange={(e) => setObjective(e.target.value)}
                    placeholder="What does this project aim to achieve in the community?"
                    className={fieldClass}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Beneficiary Type
                    </label>
                    <input
                      type="text"
                      value={beneficiaryType}
                      onChange={(e) => setBeneficiaryType(e.target.value)}
                      placeholder="e.g. Out of school youth, Barangay 3 residents"
                      className={fieldClass}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Beneficiary Target Count
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={beneficiaryTarget}
                      onChange={(e) => setBeneficiaryTarget(e.target.value)}
                      className={fieldClass}
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Funding Target (PHP)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={fundingTarget}
                      onChange={(e) => setFundingTarget(e.target.value)}
                      className={fieldClass}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Funding Source
                    </label>
                    <input
                      type="text"
                      value={fundingSource}
                      onChange={(e) => setFundingSource(e.target.value)}
                      placeholder="e.g. Club Treasury, Corporate Sponsor, District Grant"
                      className={fieldClass}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Section 4: Attendance & Check-In Configuration */}
            <div className="space-y-4 border-t border-slate-100 dark:border-slate-800 pt-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <QrCode className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Attendance & QR Verification Settings
              </h3>

              {/* QR Check-In Toggle */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label htmlFor="edit-qr-check-in" className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <QrCode className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      Enable QR Attendance Check-In
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Generate rolling time-limited QR codes for members to scan on-site.
                    </p>
                  </div>
                  <input
                    id="edit-qr-check-in"
                    type="checkbox"
                    checked={qrCheckInEnabled}
                    onChange={(e) => setQrCheckInEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </div>
                {!qrCheckInEnabled ? (
                  <p className="text-[11px] font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-md p-2">
                    QR check-in is disabled. Perfect for promotional campaigns, recruitments, or digital initiatives that do not require physical attendance check-in.
                  </p>
                ) : (
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-md p-2">
                    QR check-in is enabled. Dynamic rolling-code sessions will be available on the Events & Attendance dashboard.
                  </p>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Default Volunteer Hours
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="24"
                    value={volunteerHoursDefault}
                    onChange={(e) => setVolunteerHoursDefault(e.target.value)}
                    className={fieldClass}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Capacity (Optional)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    placeholder="No limit"
                    className={fieldClass}
                  />
                </div>
              </div>

              {/* RSVP Setting */}
              <div className="space-y-2 rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <label htmlFor="edit-rsvp-toggle" className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Enable Member RSVPs
                    </label>
                    <p className="text-[11px] text-slate-500">Allow members to indicate Going, Maybe, or Can&apos;t Go.</p>
                  </div>
                  <input
                    id="edit-rsvp-toggle"
                    type="checkbox"
                    checked={rsvpEnabled}
                    onChange={(e) => setRsvpEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </div>
                {rsvpEnabled && (
                  <div className="pt-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                      RSVP Deadline (Optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={rsvpDeadline}
                      onChange={(e) => setRsvpDeadline(e.target.value)}
                      className={fieldClass}
                    />
                  </div>
                )}
              </div>

              {/* Self Check-in Setting */}
              <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
                <div>
                  <label htmlFor="edit-self-check-in" className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Allow Self Check-In
                  </label>
                  <p className="text-[11px] text-slate-500">Allow members to check in themselves from the web interface.</p>
                </div>
                <input
                  id="edit-self-check-in"
                  type="checkbox"
                  checked={selfCheckInEnabled}
                  onChange={(e) => setSelfCheckInEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </div>

              {/* Min Members Setting */}
              <div className="space-y-2 rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <label htmlFor="edit-min-members-toggle" className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Minimum Members Required
                    </label>
                    <p className="text-[11px] text-slate-500">Set quorum or volunteer commitment target.</p>
                  </div>
                  <input
                    id="edit-min-members-toggle"
                    type="checkbox"
                    checked={minMembersEnabled}
                    onChange={(e) => setMinMembersEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </div>
                {minMembersEnabled && (
                  <div className="pt-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Required Count
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={minMembersRequired}
                      onChange={(e) => setMinMembersRequired(e.target.value)}
                      placeholder="e.g. 10"
                      className={fieldClass}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800 px-6 py-4 bg-slate-50/50 dark:bg-slate-900/50">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D3594] px-5 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-[#0b2c7a] disabled:opacity-60 transition"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
