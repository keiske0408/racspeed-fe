"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CheckSquare,
  ChevronRight,
  Clock,
  Flag,
  ListChecks,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import type { ActivityDetailDTO } from "@/features/activities/types";
import { COMMITTEES } from "@/features/activities/types";
import {
  deduplicateActivityLog,
  formatActivityLogEntry,
} from "@/features/activities/rules";
import {
  createActivityTaskAction,
  deleteActivityTaskAction,
  updateActivityTaskAction,
} from "@/features/activities/actions";
import {
  toggleChecklistItemAction,
  updateTaskStatusAction,
} from "@/features/tasks/actions";
import type { MemberDTO } from "@/features/members/queries";
import type {
  GroupTaskDTO,
  TaskCommittee,
  TaskPriority,
  TaskStatus,
} from "@/lib/data/tasks-types";
import { formatManila, manilaDateKey } from "@/lib/utils/dates";
import { notifyToast } from "@/components/shared/toast-viewport";

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-[#E4E7EE] bg-white px-3 py-2 text-xs text-[#111625] outline-none transition placeholder:text-slate-400 focus:border-[#0D3594] focus:ring-2 focus:ring-[#0D3594]/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-blue-400";

interface LaneConfig {
  status: TaskStatus;
  label: string;
  dotClass: string;
  badgeClass: string;
  nextStatus?: TaskStatus;
  nextLabel?: string;
}

const LANES: LaneConfig[] = [
  {
    status: "TODO",
    label: "Task Ready",
    dotClass: "bg-slate-400 dark:bg-slate-400",
    badgeClass:
      "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    nextStatus: "IN_PROGRESS",
    nextLabel: "Start",
  },
  {
    status: "IN_PROGRESS",
    label: "In Progress",
    dotClass: "bg-blue-500",
    badgeClass:
      "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
    nextStatus: "IN_REVIEW",
    nextLabel: "Review",
  },
  {
    status: "IN_REVIEW",
    label: "Needs Review",
    dotClass: "bg-amber-500",
    badgeClass:
      "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
    nextStatus: "COMPLETED",
    nextLabel: "Approve",
  },
  {
    status: "COMPLETED",
    label: "Done",
    dotClass: "bg-emerald-500",
    badgeClass:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
];

const COMMITTEE_META: Record<
  TaskCommittee,
  { label: string; pillClass: string; barClass: string }
> = {
  CLUB_SERVICE: {
    label: "Club Service",
    pillClass:
      "bg-sky-50 text-sky-700 border-sky-200/80 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30",
    barClass: "bg-sky-500",
  },
  COMMUNITY_SERVICE: {
    label: "Community Service",
    pillClass:
      "bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
    barClass: "bg-emerald-500",
  },
  VOCATIONAL: {
    label: "Vocational",
    pillClass:
      "bg-indigo-50 text-indigo-700 border-indigo-200/80 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/30",
    barClass: "bg-indigo-500",
  },
  INTERNATIONAL: {
    label: "International",
    pillClass:
      "bg-cyan-50 text-cyan-700 border-cyan-200/80 dark:bg-cyan-500/15 dark:text-cyan-300 dark:border-cyan-500/30",
    barClass: "bg-cyan-500",
  },
  PUBLIC_IMAGE: {
    label: "Public Image",
    pillClass:
      "bg-violet-50 text-violet-700 border-violet-200/80 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30",
    barClass: "bg-violet-500",
  },
  FINANCE: {
    label: "Finance",
    pillClass:
      "bg-amber-50 text-amber-800 border-amber-200/80 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
    barClass: "bg-amber-500",
  },
  SECRETARIAT: {
    label: "Secretariat",
    pillClass:
      "bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30",
    barClass: "bg-rose-500",
  },
  BOARD: {
    label: "Board",
    pillClass:
      "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    barClass: "bg-slate-500",
  },
};

function getCommitteeMeta(committee: TaskCommittee) {
  return (
    COMMITTEE_META[committee] ?? {
      label: String(committee).replaceAll("_", " "),
      pillClass:
        "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
      barClass: "bg-slate-500",
    }
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function defaultDueDateKey(activityStartAt?: string): string {
  const todayKey = manilaDateKey(new Date());
  if (activityStartAt) {
    const startKey = manilaDateKey(activityStartAt);
    if (/^\d{4}-\d{2}-\d{2}$/.test(startKey) && startKey >= todayKey) {
      return startKey;
    }
  }
  const tomorrow = new Date(Date.now() + 24 * 60 * 60_000);
  return manilaDateKey(tomorrow);
}

function getDueUrgency(
  dueDate: string,
  status: TaskStatus,
): "OVERDUE" | "SOON" | "NORMAL" {
  if (status === "COMPLETED" || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return "NORMAL";
  }
  const dueEndMs = Date.parse(`${dueDate}T23:59:59+08:00`);
  if (Number.isNaN(dueEndMs)) return "NORMAL";
  const hoursLeft = (dueEndMs - Date.now()) / 3_600_000;
  if (hoursLeft < 0) return "OVERDUE";
  if (hoursLeft <= 48) return "SOON";
  return "NORMAL";
}

function AvatarChip({
  name,
  avatarUrl,
  sizeClass = "h-6 w-6 text-[9.5px]",
}: {
  name: string;
  avatarUrl?: string | null;
  sizeClass?: string;
}) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        title={name}
        className={`${sizeClass} rounded-full object-cover ring-2 ring-white dark:ring-[#161B26]`}
      />
    );
  }
  return (
    <span
      title={name}
      className={`${sizeClass} inline-flex shrink-0 items-center justify-center rounded-full bg-[#0D3594]/12 font-bold text-[#0D3594] ring-2 ring-white dark:bg-blue-500/20 dark:text-blue-200 dark:ring-[#161B26]`}
    >
      {getInitials(name)}
    </span>
  );
}

export function ProjectTasksBoard({
  activity,
  tasks,
  canCreate,
  currentUserId,
  members = [],
  onTaskCreated,
}: {
  activity: ActivityDetailDTO;
  tasks: GroupTaskDTO[];
  canCreate: boolean;
  currentUserId?: string;
  members?: MemberDTO[];
  onTaskCreated: () => void;
}) {
  const [localTasks, setLocalTasks] = useState<GroupTaskDTO[]>(tasks);
  useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  const [searchQuery, setSearchQuery] = useState("");
  const [assignedToMeOnly, setAssignedToMeOnly] = useState(false);
  const [committeeFilter, setCommitteeFilter] = useState<string>("ALL");

  // Drag & drop state
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragOverLane, setDragOverLane] = useState<TaskStatus | null>(null);

  // Inline card composer state (reference-style "Create New Card")
  const [inlineAddLane, setInlineAddLane] = useState<TaskStatus | null>(null);
  const [inlineTitle, setInlineTitle] = useState("");
  const [inlineCommittee, setInlineCommittee] = useState<TaskCommittee>(
    (activity.committee as TaskCommittee) || "CLUB_SERVICE",
  );
  const [inlineDueDate, setInlineDueDate] = useState(() =>
    defaultDueDateKey(activity.startAt),
  );
  const [inlinePriority, setInlinePriority] = useState<TaskPriority>("MEDIUM");
  const [inlineAssigneeId, setInlineAssigneeId] = useState<string>("");
  const [inlineError, setInlineError] = useState<string | null>(null);
  const inlineTitleRef = useRef<HTMLTextAreaElement | null>(null);

  // Full Create Modal & Edit Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createAssigneeIds, setCreateAssigneeIds] = useState<string[]>([]);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editingTask, setEditingTask] = useState<GroupTaskDTO | null>(null);
  const [editAssigneeIds, setEditAssigneeIds] = useState<string[]>([]);
  const [editError, setEditError] = useState<string | null>(null);

  // Menu & checklist expansion
  const [openMenuTaskId, setOpenMenuTaskId] = useState<string | null>(null);
  const [expandedChecklistTaskId, setExpandedChecklistTaskId] = useState<
    string | null
  >(null);

  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [formPending, setFormPending] = useState(false);

  useEffect(() => {
    if (inlineAddLane && inlineTitleRef.current) {
      inlineTitleRef.current.focus();
    }
  }, [inlineAddLane]);

  // Close open card menu when clicking outside or pressing Escape
  useEffect(() => {
    if (!openMenuTaskId) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenMenuTaskId(null);
    }
    function onPointerDown(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target?.closest("[data-task-menu-root]")) {
        setOpenMenuTaskId(null);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [openMenuTaskId]);

  const memberAvatarMap = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const tm of activity.team || []) {
      map.set(tm.profileId, tm.avatarUrl ?? null);
    }
    for (const m of members) {
      if (!map.has(m.id)) {
        map.set(m.id, m.avatarUrl ?? null);
      }
    }
    return map;
  }, [activity.team, members]);

  const headerAvatars = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; avatarUrl?: string | null }>();
    for (const tm of activity.team || []) {
      seen.set(tm.profileId, {
        id: tm.profileId,
        name: tm.fullName,
        avatarUrl: tm.avatarUrl,
      });
    }
    for (const t of localTasks) {
      (t.assignedMemberIds || []).forEach((id, idx) => {
        if (!seen.has(id)) {
          seen.set(id, {
            id,
            name: t.assignedMemberNames?.[idx] || "Member",
            avatarUrl: memberAvatarMap.get(id) ?? null,
          });
        }
      });
    }
    return Array.from(seen.values());
  }, [activity.team, localTasks, memberAvatarMap]);

  const teamIds = useMemo(
    () => new Set((activity.team || []).map((t) => t.profileId)),
    [activity.team],
  );
  const otherMembers = useMemo(
    () => members.filter((m) => !teamIds.has(m.id)),
    [members, teamIds],
  );

  const assignableOptions = useMemo(() => {
    const list: { id: string; label: string }[] = [];
    const seen = new Set<string>();
    for (const tm of activity.team || []) {
      seen.add(tm.profileId);
      list.push({
        id: tm.profileId,
        label: `${tm.fullName} (${tm.role.replace("_", " ")})`,
      });
    }
    for (const m of members) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        list.push({
          id: m.id,
          label: m.name || m.email,
        });
      }
    }
    return list;
  }, [activity.team, members]);

  const filteredTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return localTasks.filter((task) => {
      if (
        assignedToMeOnly &&
        (!currentUserId || !task.assignedMemberIds?.includes(currentUserId))
      ) {
        return false;
      }
      if (committeeFilter !== "ALL" && task.committee !== committeeFilter) {
        return false;
      }
      if (!q) return true;
      return (
        task.title.toLowerCase().includes(q) ||
        task.description.toLowerCase().includes(q) ||
        task.assignedMemberNames.some((n) => n.toLowerCase().includes(q))
      );
    });
  }, [
    assignedToMeOnly,
    committeeFilter,
    currentUserId,
    localTasks,
    searchQuery,
  ]);

  // Committee breakdown for Task Progress sidebar
  const committeeProgress = useMemo(() => {
    const map = new Map<
      TaskCommittee,
      { committee: TaskCommittee; total: number; done: number }
    >();
    for (const task of localTasks) {
      const entry = map.get(task.committee) ?? {
        committee: task.committee,
        total: 0,
        done: 0,
      };
      entry.total += 1;
      if (task.status === "COMPLETED") entry.done += 1;
      map.set(task.committee, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [localTasks]);

  const overallDone = localTasks.filter((t) => t.status === "COMPLETED").length;
  const overallPct =
    localTasks.length > 0
      ? Math.round((overallDone / localTasks.length) * 100)
      : 0;
  const overdueCount = localTasks.filter(
    (t) => getDueUrgency(t.dueDate, t.status) === "OVERDUE",
  ).length;
  const dueSoonCount = localTasks.filter(
    (t) => getDueUrgency(t.dueDate, t.status) === "SOON",
  ).length;

  const recentLogs = useMemo(
    () => deduplicateActivityLog(activity.log || []).slice(0, 7),
    [activity.log],
  );

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
    setOpenMenuTaskId(null);
    setEditingTask(task);
    setEditAssigneeIds(task.assignedMemberIds || []);
    setEditError(null);
  }

  async function handleMoveTask(task: GroupTaskDTO, nextStatus: TaskStatus) {
    setOpenMenuTaskId(null);
    if (task.status === nextStatus) return;

    const snapshot = localTasks;
    setLocalTasks((prev) =>
      prev.map((t) =>
        t.id === task.id ? { ...t, status: nextStatus } : t,
      ),
    );
    setPendingTaskId(task.id);

    try {
      const res = await updateTaskStatusAction(task.id, nextStatus);
      if (!res.success) {
        setLocalTasks(snapshot);
        notifyToast({
          title: "Could not move task",
          message: res.error || "Failed to update task status.",
          kind: "error",
        });
        return;
      }
      notifyToast({
        message: res.message || "Task updated.",
        kind: "success",
      });
      onTaskCreated();
    } finally {
      setPendingTaskId((curr) => (curr === task.id ? null : curr));
    }
  }

  async function handleToggleChecklist(task: GroupTaskDTO, itemId: string) {
    const snapshot = localTasks;
    setLocalTasks((prev) =>
      prev.map((t) => {
        if (t.id !== task.id) return t;
        const nextChecklist = t.checklist.map((c) =>
          c.id === itemId ? { ...c, completed: !c.completed } : c,
        );
        const allDone =
          nextChecklist.length > 0 && nextChecklist.every((c) => c.completed);
        return {
          ...t,
          checklist: nextChecklist,
          status: allDone
            ? "COMPLETED"
            : t.status === "COMPLETED"
              ? "IN_PROGRESS"
              : t.status,
        };
      }),
    );
    setPendingTaskId(task.id);

    try {
      const res = await toggleChecklistItemAction(task.id, itemId);
      if (!res.success) {
        setLocalTasks(snapshot);
        notifyToast({
          title: "Checklist update failed",
          message: res.error || "Could not update checklist item.",
          kind: "error",
        });
        return;
      }
      onTaskCreated();
    } finally {
      setPendingTaskId((curr) => (curr === task.id ? null : curr));
    }
  }

  async function handleDeleteTask(task: GroupTaskDTO) {
    setOpenMenuTaskId(null);
    const snapshot = localTasks;
    setLocalTasks((prev) => prev.filter((t) => t.id !== task.id));
    setPendingTaskId(task.id);

    try {
      const res = await deleteActivityTaskAction(activity.id, task.id);
      if (!res.success) {
        setLocalTasks(snapshot);
        notifyToast({
          title: "Could not delete task",
          message: res.error || "Failed to delete task.",
          kind: "error",
        });
        return;
      }
      notifyToast({ message: "Task deleted.", kind: "success" });
      onTaskCreated();
    } finally {
      setPendingTaskId((curr) => (curr === task.id ? null : curr));
    }
  }

  function openInlineComposer(status: TaskStatus) {
    setInlineAddLane(status);
    setInlineTitle("");
    setInlineCommittee((activity.committee as TaskCommittee) || "CLUB_SERVICE");
    setInlineDueDate(defaultDueDateKey(activity.startAt));
    setInlinePriority("MEDIUM");
    setInlineAssigneeId("");
    setInlineError(null);
  }

  async function handleInlineSubmit(e: React.FormEvent, status: TaskStatus) {
    e.preventDefault();
    const title = inlineTitle.trim();
    if (title.length < 3) {
      setInlineError("Task title must be at least 3 characters.");
      return;
    }
    setInlineError(null);
    setFormPending(true);

    try {
      const res = await createActivityTaskAction({
        activityId: activity.id,
        title,
        description: "",
        committee: inlineCommittee,
        priority: inlinePriority,
        status,
        dueDate: inlineDueDate,
        assigneeIds: inlineAssigneeId ? [inlineAssigneeId] : [],
      });
      if (!res.success) {
        setInlineError(res.error || "Failed to create task.");
        return;
      }
      notifyToast({ message: "Task card created.", kind: "success" });
      setInlineAddLane(null);
      setInlineTitle("");
      onTaskCreated();
    } finally {
      setFormPending(false);
    }
  }

  const hasFilters =
    Boolean(searchQuery.trim()) ||
    assignedToMeOnly ||
    committeeFilter !== "ALL";

  return (
    <section className="space-y-4">
      {/* Header Row with Stacked Team Avatars + Primary Add Task */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-base font-bold tracking-tight text-[#111625] dark:text-white">
              Project tasks
            </h2>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {overallDone} of {localTasks.length} done
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Drag cards across stages, use quick actions, or add deliverables per committee.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {headerAvatars.length > 0 && (
            <div
              className="hidden sm:flex items-center -space-x-2"
              aria-label="Project participants"
            >
              {headerAvatars.slice(0, 4).map((person) => (
                <AvatarChip
                  key={person.id}
                  name={person.name}
                  avatarUrl={person.avatarUrl}
                  sizeClass="h-8 w-8 text-[11px]"
                />
              ))}
              {headerAvatars.length > 4 && (
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 ring-2 ring-white dark:bg-slate-800 dark:text-slate-300 dark:ring-[#161B26]">
                  +{headerAvatars.length - 4}
                </span>
              )}
            </div>
          )}

          {canCreate && (
            <button
              type="button"
              onClick={() => {
                setCreateError(null);
                setCreateAssigneeIds([]);
                setShowCreateModal(true);
              }}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[#0D3594] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#092569] cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Add task
            </button>
          )}
        </div>
      </header>

      {/* Compact Board Filter Strip */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#EDEDF2] bg-white px-3 py-2 dark:border-slate-800 dark:bg-[#161B26]">
        <div className="relative flex-1 min-w-[180px]">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks or assignees..."
            aria-label="Search project tasks"
            className="w-full rounded-lg bg-slate-50 py-1.5 pl-8 pr-2.5 text-xs text-[#111625] outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-[#0D3594]/20 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>

        <select
          value={committeeFilter}
          onChange={(e) => setCommitteeFilter(e.target.value)}
          aria-label="Filter by committee"
          className="rounded-lg border border-[#E4E7EE] bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-[#0D3594] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          <option value="ALL">All committees</option>
          {COMMITTEES.map((c) => (
            <option key={c} value={c}>
              {getCommitteeMeta(c).label}
            </option>
          ))}
        </select>

        {currentUserId && (
          <button
            type="button"
            onClick={() => setAssignedToMeOnly((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
              assignedToMeOnly
                ? "border-[#0D3594] bg-[#0D3594]/10 text-[#0D3594] dark:border-blue-400/50 dark:bg-blue-500/15 dark:text-blue-300"
                : "border-[#E4E7EE] bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            }`}
          >
            <UserCheck className="h-3.5 w-3.5" />
            Assigned to me
          </button>
        )}

        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setAssignedToMeOnly(false);
              setCommitteeFilter("ALL");
            }}
            className="text-xs font-semibold text-[#0D3594] hover:underline dark:text-blue-300 cursor-pointer px-1"
          >
            Clear
          </button>
        )}
      </div>

      {/* Main Content: 4-Column Kanban Board + Right Progress & Activity Sidebar */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-start">
        {/* 4-Column Kanban Board */}
        <div className="grid gap-3.5 md:grid-cols-2 2xl:grid-cols-4">
          {LANES.map((lane) => {
            const laneTasks = filteredTasks.filter(
              (task) => task.status === lane.status,
            );
            const isDropTarget = dragOverLane === lane.status;

            return (
              <div
                key={lane.status}
                data-testid={`task-lane-${lane.status}`}
                onDragOver={(e) => {
                  if (!draggingTaskId) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (dragOverLane !== lane.status) {
                    setDragOverLane(lane.status);
                  }
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                    setDragOverLane((prev) =>
                      prev === lane.status ? null : prev,
                    );
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const droppedId =
                    e.dataTransfer.getData("text/plain") || draggingTaskId;
                  setDragOverLane(null);
                  setDraggingTaskId(null);
                  if (!droppedId) return;
                  const targetTask = localTasks.find((t) => t.id === droppedId);
                  if (targetTask && targetTask.status !== lane.status) {
                    handleMoveTask(targetTask, lane.status);
                  }
                }}
                className={`flex min-h-[340px] flex-col rounded-2xl border p-3 transition ${
                  isDropTarget
                    ? "border-[#0D3594] bg-blue-50/50 ring-2 ring-[#0D3594]/15 dark:border-blue-400/70 dark:bg-blue-950/25"
                    : "border-[#EDEDF2] bg-slate-50/75 dark:border-slate-800/90 dark:bg-slate-900/45"
                }`}
              >
                {/* Column Header */}
                <div className="mb-3 flex items-center justify-between gap-2 px-0.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${lane.dotClass}`}
                    />
                    <h3 className="truncate text-xs font-bold text-[#111625] dark:text-slate-100">
                      {lane.label}
                    </h3>
                    <span
                      className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${lane.badgeClass}`}
                    >
                      {laneTasks.length}
                    </span>
                  </div>
                  {canCreate && (
                    <button
                      type="button"
                      onClick={() => openInlineComposer(lane.status)}
                      aria-label={`Add card to ${lane.label}`}
                      title={`Add card to ${lane.label}`}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-[#111625] dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Cards Stack */}
                <div className="flex flex-1 flex-col gap-2.5">
                  {laneTasks.map((task) => {
                    const committeeMeta = getCommitteeMeta(task.committee);
                    const isAssignedToMe = Boolean(
                      currentUserId &&
                        task.assignedMemberIds?.includes(currentUserId),
                    );
                    const canAdvance = canCreate || isAssignedToMe;
                    const urgency = getDueUrgency(task.dueDate, task.status);
                    const checklistTotal = task.checklist?.length || 0;
                    const checklistDone =
                      task.checklist?.filter((c) => c.completed).length || 0;
                    const isChecklistOpen = expandedChecklistTaskId === task.id;
                    const isMenuOpen = openMenuTaskId === task.id;
                    const isDragging = draggingTaskId === task.id;

                    return (
                      <article
                        key={task.id}
                        draggable={canAdvance}
                        onDragStart={(e) => {
                          if (!canAdvance) return;
                          e.dataTransfer.setData("text/plain", task.id);
                          e.dataTransfer.effectAllowed = "move";
                          setDraggingTaskId(task.id);
                          setOpenMenuTaskId(null);
                        }}
                        onDragEnd={() => {
                          setDraggingTaskId(null);
                          setDragOverLane(null);
                        }}
                        className={`group relative rounded-xl border bg-white p-3.5 transition dark:bg-[#161B26] ${
                          isDragging
                            ? "opacity-45 border-dashed border-[#0D3594] dark:border-blue-400"
                            : isAssignedToMe
                              ? "border-blue-300/80 ring-1 ring-blue-500/15 hover:border-blue-400 dark:border-blue-500/40 dark:hover:border-blue-400/70"
                              : "border-[#E6E9F0] hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700"
                        } ${canAdvance ? "cursor-grab active:cursor-grabbing" : ""}`}
                      >
                        {/* Top Tag + Overflow Row */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${committeeMeta.pillClass}`}
                            >
                              {committeeMeta.label}
                            </span>
                            {(task.priority === "HIGH" ||
                              task.priority === "URGENT") && (
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-bold ${
                                  task.priority === "URGENT"
                                    ? "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                                    : "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
                                }`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${
                                    task.priority === "URGENT"
                                      ? "bg-rose-500"
                                      : "bg-amber-500"
                                  }`}
                                />
                                {task.priority === "URGENT" ? "Urgent" : "High"}
                              </span>
                            )}
                            {isAssignedToMe && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-50 px-1.5 py-0.5 text-[9.5px] font-bold text-[#0D3594] dark:bg-blue-500/15 dark:text-blue-300">
                                You
                              </span>
                            )}
                          </div>

                          {canAdvance && (
                            <div className="relative shrink-0" data-task-menu-root>
                              <button
                                type="button"
                                aria-label={`Task actions for ${task.title}`}
                                aria-expanded={isMenuOpen}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuTaskId(
                                    isMenuOpen ? null : task.id,
                                  );
                                }}
                                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-[#111625] dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer"
                              >
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </button>

                              {isMenuOpen && (
                                <div
                                  role="menu"
                                  className="absolute right-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-xl border border-[#EDEDF2] bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-[#1B2230]"
                                >
                                  {LANES.filter(
                                    (targetLane) =>
                                      targetLane.status !== task.status,
                                  ).map((targetLane) => (
                                    <button
                                      key={targetLane.status}
                                      type="button"
                                      role="menuitem"
                                      disabled={pendingTaskId === task.id}
                                      onClick={() =>
                                        handleMoveTask(task, targetLane.status)
                                      }
                                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                                    >
                                      <span
                                        className={`h-2 w-2 rounded-full ${targetLane.dotClass}`}
                                      />
                                      Move to {targetLane.label}
                                    </button>
                                  ))}
                                  {canCreate && (
                                    <>
                                      <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                                      <button
                                        type="button"
                                        role="menuitem"
                                        onClick={() => openEditModal(task)}
                                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                                      >
                                        <Pencil className="h-3 w-3" />
                                        Edit details &amp; assignees
                                      </button>
                                      <button
                                        type="button"
                                        role="menuitem"
                                        disabled={pendingTaskId === task.id}
                                        onClick={() => handleDeleteTask(task)}
                                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 cursor-pointer"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                        Delete task
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Title & Description */}
                        <h4
                          className={`mt-2.5 text-[13px] font-semibold leading-snug ${
                            task.status === "COMPLETED"
                              ? "line-through text-slate-400 dark:text-slate-500"
                              : "text-[#111625] dark:text-white"
                          }`}
                        >
                          {task.title}
                        </h4>
                        {task.description && (
                          <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                            {task.description}
                          </p>
                        )}

                        {/* Expandable Checklist Items */}
                        {checklistTotal > 0 && isChecklistOpen && (
                          <div className="mt-2.5 space-y-1 rounded-lg border border-slate-100 bg-slate-50/70 p-2 dark:border-slate-800 dark:bg-slate-900/50">
                            {task.checklist.map((item) => (
                              <label
                                key={item.id}
                                className="flex items-start gap-2 text-[11px] text-slate-700 dark:text-slate-300 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={item.completed}
                                  disabled={pendingTaskId === task.id}
                                  onChange={() =>
                                    handleToggleChecklist(task, item.id)
                                  }
                                  className="mt-0.5 h-3.5 w-3.5 accent-[#0D3594] rounded cursor-pointer"
                                />
                                <span
                                  className={
                                    item.completed
                                      ? "line-through text-slate-400"
                                      : ""
                                  }
                                >
                                  {item.title}
                                </span>
                              </label>
                            ))}
                          </div>
                        )}

                        {/* Footer Meta: Due Date Flag, Checklist Count, Subtle Step Pill, Avatar Stack */}
                        <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-slate-100/80 dark:border-slate-800/80">
                          <div className="flex items-center gap-2.5 text-[11px]">
                            <span
                              className={`inline-flex items-center gap-1 font-medium ${
                                urgency === "OVERDUE"
                                  ? "text-rose-600 dark:text-rose-400"
                                  : urgency === "SOON"
                                    ? "text-amber-700 dark:text-amber-400"
                                    : "text-slate-500 dark:text-slate-400"
                              }`}
                            >
                              <Flag className="h-3 w-3 shrink-0" />
                              {formatManila(
                                `${task.dueDate}T04:00:00Z`,
                                "MMM d",
                              )}
                            </span>

                            {checklistTotal > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedChecklistTaskId(
                                    isChecklistOpen ? null : task.id,
                                  )
                                }
                                title="Toggle checklist"
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-[#0D3594] dark:text-slate-400 dark:hover:text-blue-300 cursor-pointer"
                              >
                                <ListChecks className="h-3 w-3" />
                                {checklistDone}/{checklistTotal}
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            {canAdvance &&
                              lane.nextStatus &&
                              lane.nextLabel && (
                                <button
                                  type="button"
                                  disabled={pendingTaskId === task.id}
                                  onClick={() =>
                                    handleMoveTask(task, lane.nextStatus!)
                                  }
                                  className="inline-flex items-center gap-0.5 rounded-lg border border-slate-200/90 bg-slate-50 px-2 py-0.5 text-[10.5px] font-semibold text-slate-700 transition hover:border-[#0D3594]/40 hover:bg-blue-50/70 hover:text-[#0D3594] disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200 dark:hover:border-blue-400/50 dark:hover:bg-blue-500/15 dark:hover:text-blue-300 cursor-pointer"
                                >
                                  {lane.nextLabel}
                                  <ChevronRight className="h-3 w-3" />
                                </button>
                              )}

                            {task.assignedMemberNames &&
                              task.assignedMemberNames.length > 0 && (
                                <div className="flex items-center -space-x-1.5">
                                  {task.assignedMemberNames
                                    .slice(0, 2)
                                    .map((name, idx) => (
                                      <AvatarChip
                                        key={`${task.id}-assignee-${idx}`}
                                        name={name}
                                        avatarUrl={
                                          memberAvatarMap.get(
                                            task.assignedMemberIds?.[idx] || "",
                                          ) ?? null
                                        }
                                      />
                                    ))}
                                  {task.assignedMemberNames.length > 2 && (
                                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[9.5px] font-bold text-slate-600 ring-2 ring-white dark:bg-slate-800 dark:text-slate-300 dark:ring-[#161B26]">
                                      +{task.assignedMemberNames.length - 2}
                                    </span>
                                  )}
                                </div>
                              )}
                          </div>
                        </div>
                      </article>
                    );
                  })}

                  {/* Empty Drop Placeholder */}
                  {laneTasks.length === 0 && inlineAddLane !== lane.status && (
                    <div
                      className={`flex flex-1 min-h-[110px] items-center justify-center rounded-xl border border-dashed px-3 text-center text-[11px] ${
                        isDropTarget
                          ? "border-[#0D3594] bg-blue-50/40 text-[#0D3594] dark:border-blue-400 dark:text-blue-300"
                          : "border-slate-200 text-slate-400 dark:border-slate-800 dark:text-slate-500"
                      }`}
                    >
                      {isDropTarget ? "Drop task here" : "No tasks in this stage"}
                    </div>
                  )}

                  {/* Inline "Create New Card" Composer (matches reference) */}
                  {inlineAddLane === lane.status && canCreate && (
                    <form
                      onSubmit={(e) => handleInlineSubmit(e, lane.status)}
                      className="rounded-xl border border-[#0D3594]/35 bg-white p-3.5 shadow-sm space-y-2.5 dark:border-blue-500/40 dark:bg-[#161B26]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#111625] dark:text-white">
                          Create New Card
                        </span>
                        <button
                          type="button"
                          aria-label="Close card composer"
                          onClick={() => setInlineAddLane(null)}
                          className="rounded p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <textarea
                        ref={inlineTitleRef}
                        rows={2}
                        required
                        minLength={3}
                        value={inlineTitle}
                        onChange={(e) => setInlineTitle(e.target.value)}
                        placeholder="What is the task?"
                        className="w-full resize-none rounded-lg border border-[#E4E7EE] bg-slate-50/70 px-2.5 py-2 text-xs text-[#111625] outline-none placeholder:text-slate-400 focus:border-[#0D3594] focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />

                      <div className="grid grid-cols-2 gap-1.5">
                        <select
                          value={inlineCommittee}
                          onChange={(e) =>
                            setInlineCommittee(e.target.value as TaskCommittee)
                          }
                          aria-label="Task committee"
                          className="rounded-lg border border-[#E4E7EE] bg-white px-2 py-1.5 text-[11px] font-medium text-slate-700 outline-none focus:border-[#0D3594] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        >
                          {COMMITTEES.map((c) => (
                            <option key={c} value={c}>
                              {getCommitteeMeta(c).label}
                            </option>
                          ))}
                        </select>

                        <input
                          type="date"
                          required
                          value={inlineDueDate}
                          onChange={(e) => setInlineDueDate(e.target.value)}
                          aria-label="Task due date"
                          className="rounded-lg border border-[#E4E7EE] bg-white px-2 py-1.5 text-[11px] text-slate-700 outline-none focus:border-[#0D3594] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        <select
                          value={inlineAssigneeId}
                          onChange={(e) => setInlineAssigneeId(e.target.value)}
                          aria-label="Assign member"
                          className="rounded-lg border border-[#E4E7EE] bg-white px-2 py-1.5 text-[11px] text-slate-700 outline-none focus:border-[#0D3594] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        >
                          <option value="">Unassigned</option>
                          {assignableOptions.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.label}
                            </option>
                          ))}
                        </select>

                        <select
                          value={inlinePriority}
                          onChange={(e) =>
                            setInlinePriority(e.target.value as TaskPriority)
                          }
                          aria-label="Task priority"
                          className="rounded-lg border border-[#E4E7EE] bg-white px-2 py-1.5 text-[11px] text-slate-700 outline-none focus:border-[#0D3594] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        >
                          <option value="MEDIUM">Medium priority</option>
                          <option value="LOW">Low priority</option>
                          <option value="HIGH">High priority</option>
                          <option value="URGENT">Urgent priority</option>
                        </select>
                      </div>

                      {inlineError && (
                        <p role="alert" className="text-[11px] text-rose-600">
                          {inlineError}
                        </p>
                      )}

                      <button
                        type="submit"
                        disabled={formPending}
                        className="w-full rounded-lg bg-[#0D3594] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#092569] disabled:opacity-60 cursor-pointer"
                      >
                        {formPending ? "Creating..." : "Add card"}
                      </button>
                    </form>
                  )}
                </div>

                {/* Bottom "+ Add Card" Footer Trigger */}
                {canCreate && inlineAddLane !== lane.status && (
                  <button
                    type="button"
                    onClick={() => openInlineComposer(lane.status)}
                    className="mt-2.5 flex w-full items-center justify-center gap-1 rounded-xl py-2 text-xs font-semibold text-slate-500 transition hover:bg-white hover:text-[#111625] dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-white cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Card
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Right Insights Sidebar: Task Progress + Recent Activity */}
        <aside className="space-y-4">
          {/* Task Progress Card */}
          <section className="rounded-2xl border border-[#EDEDF2] bg-white p-4 dark:border-slate-800 dark:bg-[#161B26]">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-[#111625] dark:text-white">
                Task Progress
              </h3>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                {overallPct}%
              </span>
            </div>

            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-[#0D3594] transition-all dark:bg-blue-500"
                style={{ width: `${overallPct}%` }}
              />
            </div>

            <div className="mt-4 space-y-3">
              {committeeProgress.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Add tasks to track completion by committee.
                </p>
              ) : (
                committeeProgress.map((item) => {
                  const meta = getCommitteeMeta(item.committee);
                  const pct =
                    item.total > 0
                      ? Math.round((item.done / item.total) * 100)
                      : 0;
                  return (
                    <div key={item.committee} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-700 dark:text-slate-200">
                          {meta.label}
                        </span>
                        <span className="font-semibold text-slate-500 dark:text-slate-400">
                          {item.done}/{item.total}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className={`h-full rounded-full transition-all ${meta.barClass}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {(overdueCount > 0 || dueSoonCount > 0) && (
              <div className="mt-4 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3 dark:border-slate-800">
                {overdueCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10.5px] font-semibold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                    <Clock className="h-3 w-3" />
                    {overdueCount} overdue
                  </span>
                )}
                {dueSoonCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                    <Clock className="h-3 w-3" />
                    {dueSoonCount} due within 48h
                  </span>
                )}
              </div>
            )}
          </section>

          {/* Recent Activity Feed */}
          <section className="rounded-2xl border border-[#EDEDF2] bg-white p-4 dark:border-slate-800 dark:bg-[#161B26]">
            <h3 className="text-xs font-bold text-[#111625] dark:text-white">
              Recent Activity
            </h3>

            {recentLogs.length === 0 ? (
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                Task creation, status updates, and committee changes appear here.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {recentLogs.map((entry) => {
                  const formatted = formatActivityLogEntry(
                    entry.action,
                    entry.details || {},
                  );
                  const iconBg =
                    formatted.tone === "emerald"
                      ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
                      : formatted.tone === "amber"
                        ? "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300"
                        : formatted.tone === "violet"
                          ? "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300"
                          : formatted.tone === "rose"
                            ? "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300"
                            : "bg-blue-50 text-[#0D3594] dark:bg-blue-500/15 dark:text-blue-300";

                  const Icon = entry.action.includes("TASK")
                    ? CheckSquare
                    : entry.action.includes("TEAM")
                      ? Users
                      : entry.action.includes("COMMENT")
                        ? MessageSquare
                        : Sparkles;

                  return (
                    <li key={entry.id} className="flex items-start gap-2.5">
                      <span
                        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${iconBg}`}
                      >
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs leading-snug text-slate-600 dark:text-slate-300">
                          <span className="font-semibold text-[#111625] dark:text-white">
                            {entry.actorName || "Member"}
                          </span>{" "}
                          {formatted.title.charAt(0).toLowerCase() +
                            formatted.title.slice(1)}
                        </p>
                        <p className="mt-0.5 text-[10.5px] text-slate-400">
                          {formatManila(entry.createdAt, "MMM d, h:mm a")}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </aside>
      </div>

      {/* Full Create Task Modal */}
      {showCreateModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Create task"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#EDEDF2] bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-[#161B26]">
            <div className="flex items-center justify-between border-b border-[#EDEDF2] pb-3 dark:border-slate-800">
              <h3 className="text-sm font-bold text-[#111625] dark:text-white">
                Add Project Task
              </h3>
              <button
                type="button"
                aria-label="Close modal"
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              className="mt-4 grid gap-3 sm:grid-cols-2"
              onSubmit={async (event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                setCreateError(null);
                setFormPending(true);
                try {
                  const res = await createActivityTaskAction({
                    activityId: activity.id,
                    title: String(data.get("title") || ""),
                    description: String(data.get("description") || ""),
                    committee: String(
                      data.get("committee") || "CLUB_SERVICE",
                    ) as TaskCommittee,
                    priority: String(
                      data.get("priority") || "MEDIUM",
                    ) as TaskPriority,
                    status: String(
                      data.get("status") || "TODO",
                    ) as TaskStatus,
                    dueDate: String(data.get("dueDate") || ""),
                    assigneeIds: createAssigneeIds,
                  });
                  if (!res.success) {
                    setCreateError(res.error);
                    return;
                  }
                  notifyToast({ message: "Task added.", kind: "success" });
                  setShowCreateModal(false);
                  setCreateAssigneeIds([]);
                  onTaskCreated();
                } finally {
                  setFormPending(false);
                }
              }}
            >
              <label className="text-xs font-semibold sm:col-span-2">
                Task title <span className="text-rose-500">*</span>
                <input
                  name="title"
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
                  required
                  defaultValue={defaultDueDateKey(activity.startAt)}
                  className={fieldClass}
                />
              </label>

              <label className="text-xs font-semibold">
                Column / Stage
                <select name="status" defaultValue="TODO" className={fieldClass}>
                  {LANES.map((l) => (
                    <option key={l.status} value={l.status}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs font-semibold">
                Committee
                <select
                  name="committee"
                  defaultValue={activity.committee || "CLUB_SERVICE"}
                  className={fieldClass}
                >
                  {COMMITTEES.map((c) => (
                    <option key={c} value={c}>
                      {getCommitteeMeta(c).label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs font-semibold">
                Priority
                <select
                  name="priority"
                  defaultValue="MEDIUM"
                  className={fieldClass}
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </label>

              <div className="sm:col-span-2 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#111625] dark:text-white">
                    Assign Members (One or more)
                  </span>
                  <div className="flex items-center gap-2">
                    {activity.team && activity.team.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const allTeam = activity.team.map((t) => t.profileId);
                          setCreateAssigneeIds((prev) =>
                            Array.from(new Set([...prev, ...allTeam])),
                          );
                        }}
                        className="text-[11px] font-semibold text-[#0D3594] hover:underline dark:text-blue-300 cursor-pointer"
                      >
                        + Assign all committee ({activity.team.length})
                      </button>
                    )}
                    {createAssigneeIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setCreateAssigneeIds([])}
                        className="text-[11px] font-semibold text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        Clear ({createAssigneeIds.length})
                      </button>
                    )}
                  </div>
                </div>

                <div className="max-h-40 overflow-y-auto rounded-xl border border-[#EDEDF2] bg-slate-50/60 p-2.5 space-y-2.5 dark:border-slate-800 dark:bg-slate-900/50">
                  {activity.team && activity.team.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                        Project Committee &amp; Team
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {activity.team.map((m) => {
                          const active = createAssigneeIds.includes(m.profileId);
                          return (
                            <button
                              key={m.profileId}
                              type="button"
                              onClick={() =>
                                toggleAssignee(
                                  m.profileId,
                                  createAssigneeIds,
                                  setCreateAssigneeIds,
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
                      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Club Members &amp; Officers
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {otherMembers.map((m) => {
                          const active = createAssigneeIds.includes(m.id);
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() =>
                                toggleAssignee(
                                  m.id,
                                  createAssigneeIds,
                                  setCreateAssigneeIds,
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
                <textarea name="description" rows={2} className={fieldClass} />
              </label>

              {createError && (
                <p role="alert" className="text-xs text-rose-600 sm:col-span-2">
                  {createError}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 sm:col-span-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg border border-[#EDEDF2] px-3 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formPending}
                  className="rounded-lg bg-[#0D3594] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60 cursor-pointer"
                >
                  {formPending ? "Creating..." : "Create task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Task & Member Assignments Modal */}
      {editingTask && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Edit task"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#EDEDF2] bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-[#161B26]">
            <div className="flex items-center justify-between border-b border-[#EDEDF2] pb-3 dark:border-slate-800">
              <h3 className="text-sm font-bold text-[#111625] dark:text-white">
                Edit Task &amp; Member Assignments
              </h3>
              <button
                type="button"
                aria-label="Close modal"
                onClick={() => setEditingTask(null)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              className="mt-4 grid gap-3 sm:grid-cols-2"
              onSubmit={async (event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                setEditError(null);
                setFormPending(true);
                try {
                  const res = await updateActivityTaskAction({
                    activityId: activity.id,
                    taskId: editingTask.id,
                    title: String(data.get("title") || ""),
                    description: String(data.get("description") || ""),
                    committee: String(
                      data.get("committee") || editingTask.committee,
                    ) as TaskCommittee,
                    priority: String(
                      data.get("priority") || editingTask.priority,
                    ) as TaskPriority,
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
                } finally {
                  setFormPending(false);
                }
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
                Stage
                <select
                  name="status"
                  defaultValue={editingTask.status}
                  className={fieldClass}
                >
                  {LANES.map((l) => (
                    <option key={l.status} value={l.status}>
                      {l.label}
                    </option>
                  ))}
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
                      {getCommitteeMeta(c).label}
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
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </label>

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
                      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                        Project Committee &amp; Team
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
                      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Club Members &amp; Officers
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
                  disabled={formPending || pendingTaskId === editingTask.id}
                  onClick={() => {
                    const target = editingTask;
                    setEditingTask(null);
                    handleDeleteTask(target);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingTask(null)}
                    className="rounded-lg border border-[#EDEDF2] px-3 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formPending}
                    className="rounded-lg bg-[#0D3594] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60 cursor-pointer"
                  >
                    {formPending ? "Saving..." : "Save changes"}
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

