"use client";

import React, { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
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
  X,
} from "lucide-react";
import type { ActivityDetailDTO } from "@/features/activities/types";
import type { GroupTaskDTO, TaskStatus } from "@/lib/data/tasks-types";
import {
  addCommentAction,
  createActivityTaskAction,
  deleteActivityMediaAction,
  deleteCommentAction,
  publishProjectReportAction,
  revokeAttendanceAction,
  selfCheckInAction,
  setCoverMediaAction,
  startActivityQrSessionAction,
  toggleFollowAction,
  toggleReactionAction,
  updateActivityStatusAction,
  uploadActivityMediaAction,
} from "@/features/activities/actions";
import { updateTaskStatusAction } from "@/features/tasks/actions";
import {
  isProjectKind,
  ACTIVITY_KIND_META,
  ACTIVITY_STATUSES,
  ACTIVITY_STATUS_LABELS,
  COMMITTEES,
} from "@/features/activities/types";
import { minMembersStatus } from "@/features/activities/rules";
import { formatManila } from "@/lib/utils/dates";
import { notifyToast } from "@/components/shared/toast-viewport";
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
}: {
  initialActivity: ActivityDetailDTO;
  initialTasks: GroupTaskDTO[];
  initialTab?: string;
  currentUserId: string;
  canCreateTasks: boolean;
  canManageClub: boolean;
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
              {activity.selfCheckInEnabled && !activity.checkedIn && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => selfCheckInAction(activity.id),
                      "Check-in recorded.",
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
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
              <RsvpButtons activityId={activity.id} current={activity.myRsvp} />
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
            {id === "TASKS" && tasks.length > 0
              ? ` ${tasks.length}`
              : id === "DISCUSSION" && activity.comments.length > 0
                ? ` ${activity.comments.length}`
                : ""}
          </button>
        ))}
      </nav>

      {tab === "OVERVIEW" && (
        <OverviewPanel activity={activity} isProject={isProject} />
      )}
      {tab === "TASKS" && (
        <TasksPanel
          activity={activity}
          tasks={tasks}
          canCreate={canCreateTasks}
          onTaskCreated={() => router.refresh()}
        />
      )}
      {tab === "ATTENDANCE" && (
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
        />
      )}
      {tab === "DISCUSSION" && (
        <DiscussionPanel
          activity={activity}
          currentUserId={currentUserId}
          onRefresh={() => router.refresh()}
        />
      )}
      {tab === "MEDIA" && (
        <MediaPanel
          activity={activity}
          canManage={canManageClub}
          onRefresh={() => router.refresh()}
        />
      )}
      {tab === "REPORT" && isProject && (
        <ReportPanel
          activity={activity}
          canManage={canManageClub}
          onPublished={() => router.refresh()}
        />
      )}
    </main>
  );
}

function OverviewPanel({
  activity,
  isProject,
}: {
  activity: ActivityDetailDTO;
  isProject: boolean;
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
  onTaskCreated,
}: {
  activity: ActivityDetailDTO;
  tasks: GroupTaskDTO[];
  canCreate: boolean;
  onTaskCreated: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const lanes: { status: TaskStatus; label: string }[] = [
    { status: "TODO", label: "To do" },
    { status: "IN_PROGRESS", label: "In progress" },
    { status: "IN_REVIEW", label: "In review" },
    { status: "COMPLETED", label: "Done" },
  ];
  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-[#111625] dark:text-white">
            Project tasks
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Tasks are linked to this activity and appear in My Work.
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="rounded-lg bg-[#0D3594] px-3 py-2 text-xs font-semibold text-white"
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
                  "LOW" | "MEDIUM" | "HIGH" | "URGENT",
                dueDate: String(data.get("dueDate") || ""),
                assigneeIds: [],
              });
              if (!result.success) {
                setError(result.error);
                return;
              }
              setShowForm(false);
              onTaskCreated();
            });
          }}
        >
          <label className="text-xs font-semibold">
            Task title
            <input name="title" required minLength={3} className={fieldClass} />
          </label>
          <label className="text-xs font-semibold">
            Due date
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
              className="rounded-lg bg-[#0D3594] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
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
                  <TaskCard key={task.id} task={task} canManage={canCreate} />
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
    </section>
  );
}

function TaskCard({
  task,
  canManage,
}: {
  task: GroupTaskDTO;
  canManage: boolean;
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
          <button
            type="button"
            disabled={pending}
            title={`Move to ${nextStatus.replaceAll("_", " ")}`}
            onClick={() =>
              startTransition(async () => {
                await updateTaskStatusAction(task.id, nextStatus);
              })
            }
            className="rounded p-0.5 text-slate-400 hover:text-[#0D3594]"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {task.description && (
        <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">
          {task.description}
        </p>
      )}
      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
        <span>{task.priority}</span>
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
}: {
  activity: ActivityDetailDTO;
  canManage: boolean;
  onSelfCheckIn: () => void;
  onRevoke: (id: string) => void;
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
        {activity.selfCheckInEnabled && !activity.checkedIn && (
          <button
            type="button"
            onClick={onSelfCheckIn}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white"
          >
            <Check className="h-4 w-4" /> Check in as me
          </button>
        )}
        {canManage && (
          <section className="space-y-3 rounded-xl border border-[#EDEDF2] bg-white p-4 dark:border-slate-800 dark:bg-[#161B26]">
            <div>
              <h2 className="text-sm font-bold text-[#111625] dark:text-white">
                QR check-in
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Create a time-limited code for members to scan.
              </p>
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
                {["👍", "❤️", "🎉"].map((emoji) => (
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
  const [pending, startTransition] = useTransition();
  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-[#111625] dark:text-white">
            Project media
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Photos are stored privately and served as signed links to club
            members.
          </p>
        </div>
        {canManage && (
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              data.set("activityId", activity.id);
              setError(null);
              startTransition(async () => {
                const result = await uploadActivityMediaAction(data);
                if (!result.success) {
                  setError(result.error);
                  return;
                }
                event.currentTarget.reset();
                onRefresh();
              });
            }}
          >
            <label className="sr-only" htmlFor="activity-media">
              Choose photos
            </label>
            <input
              id="activity-media"
              name="files"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              required
              className="max-w-52 text-[11px] file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1.5 file:text-[11px] file:font-semibold dark:file:bg-slate-800"
            />
            <input
              name="caption"
              placeholder="Caption (optional)"
              maxLength={280}
              className="w-40 rounded-lg border border-[#EDEDF2] bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
            />
            <button
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D3594] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
            >
              <Upload className="h-3.5 w-3.5" /> Upload
            </button>
          </form>
        )}
      </header>
      {error && (
        <p role="alert" className="text-xs text-rose-600">
          {error}
        </p>
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
