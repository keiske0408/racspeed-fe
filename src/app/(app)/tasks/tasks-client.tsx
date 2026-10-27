"use client";

import React, { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import {
  CheckSquare,
  Plus,
  Clock,
  AlertTriangle,
  Users,
  Search,
  CheckCircle2,
  Calendar,
  Trash2,
  ChevronDown,
  ChevronUp,
  Tag,
  Filter,
  Flame,
  ArrowRight,
  ListTodo,
  Edit2,
  UserPlus,
  Check,
  FolderKanban,
  ExternalLink,
  Kanban,
  LayoutGrid,
  MoreHorizontal,
  SlidersHorizontal,
  X,
  RotateCcw,
  Sparkles,
  Star,
  Eye,
  CheckCircle,
  FileText,
  UserCheck,
} from "lucide-react";
import {
  GroupTaskDTO,
  TaskStatus,
  TaskPriority,
  TaskCommittee,
  TaskChecklistItem,
} from "@/lib/data/tasks-types";
import { TaskStatsDTO } from "@/features/tasks/queries";
import { MemberDTO } from "@/features/members/queries";
import { ProjectDTO } from "@/features/projects/queries";
import { CurrentUserContext } from "@/lib/auth/session";
import {
  createGroupTaskAction,
  updateGroupTaskAction,
  assignMembersToTaskAction,
  updateTaskStatusAction,
  toggleChecklistItemAction,
  addChecklistItemAction,
  deleteTaskAction,
} from "@/features/tasks/actions";

interface TasksClientProps {
  initialTasks: GroupTaskDTO[];
  stats: TaskStatsDTO;
  members: MemberDTO[];
  projects?: ProjectDTO[];
  currentUser?: CurrentUserContext;
  isAdmin?: boolean;
}

export function isTaskAssignedToUser(
  task: GroupTaskDTO,
  user?: CurrentUserContext | null
): boolean {
  if (!user) return false;
  const userFull = (user.fullName || "").trim().toLowerCase();
  const userEmail = (user.email || "").trim().toLowerCase();
  const userId = user.id || "";

  if (userId && task.assignedMemberIds?.includes(userId)) return true;

  if (
    task.assignedMemberNames &&
    task.assignedMemberNames.some((name) => {
      const n = name.trim().toLowerCase();
      return (
        n === userFull ||
        n === userEmail ||
        (userFull && (n.includes(userFull) || userFull.includes(n)))
      );
    })
  ) {
    return true;
  }

  if (task.createdBy) {
    const creator = task.createdBy.trim().toLowerCase();
    if (creator === userFull || creator === userEmail) return true;
  }

  return false;
}

// =========================================================================
// Design Tokens & Pastel Taxonomy (Aligned with Reference Design System)
// =========================================================================

const COMMITTEE_LABELS: Record<
  TaskCommittee,
  { label: string; color: string; badge: string; gradient: string }
> = {
  CLUB_SERVICE: {
    label: "Club Service",
    color:
      "bg-[#EFF3FE] text-[#4F6BFF] border-[#DCE4FD] dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60",
    badge: "bg-[#EFF3FE] text-[#4F6BFF]",
    gradient: "from-[#4F6BFF]/15 via-[#6C5CE7]/10 to-transparent",
  },
  COMMUNITY_SERVICE: {
    label: "Community Service",
    color:
      "bg-[#E9F9F0] text-[#10B981] border-[#D1F2DF] dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60",
    badge: "bg-[#E9F9F0] text-[#10B981]",
    gradient: "from-[#10B981]/15 via-[#059669]/10 to-transparent",
  },
  VOCATIONAL: {
    label: "Vocational Service",
    color:
      "bg-[#EFF1FE] text-[#6366F1] border-[#D8DCFC] dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/60",
    badge: "bg-[#EFF1FE] text-[#6366F1]",
    gradient: "from-[#6366F1]/15 via-[#4F46E5]/10 to-transparent",
  },
  INTERNATIONAL: {
    label: "International Service",
    color:
      "bg-[#EAF8FE] text-[#0284C7] border-[#C8EDFD] dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800/60",
    badge: "bg-[#EAF8FE] text-[#0284C7]",
    gradient: "from-[#0284C7]/15 via-[#0284C7]/10 to-transparent",
  },
  PUBLIC_IMAGE: {
    label: "Public Image",
    color:
      "bg-[#F3EFFE] text-[#8B5CF6] border-[#E3D9FD] dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/60",
    badge: "bg-[#F3EFFE] text-[#8B5CF6]",
    gradient: "from-[#8B5CF6]/15 via-[#EC4899]/10 to-transparent",
  },
  FINANCE: {
    label: "Finance & Ways",
    color:
      "bg-[#FEF5E7] text-[#D97706] border-[#FDE6C8] dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60",
    badge: "bg-[#FEF5E7] text-[#D97706]",
    gradient: "from-[#F59E0B]/15 via-[#D97706]/10 to-transparent",
  },
  SECRETARIAT: {
    label: "Secretariat",
    color:
      "bg-[#F1F3F8] text-[#64748B] border-[#E2E6EF] dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700",
    badge: "bg-[#F1F3F8] text-[#64748B]",
    gradient: "from-[#64748B]/15 via-[#475569]/10 to-transparent",
  },
  BOARD: {
    label: "Board of Directors",
    color:
      "bg-[#FEECEC] text-[#E11D48] border-[#FCCECE] dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60",
    badge: "bg-[#FEECEC] text-[#E11D48]",
    gradient: "from-[#E11D48]/15 via-[#BE123C]/10 to-transparent",
  },
};

const PRIORITY_BADGES: Record<
  TaskPriority,
  { label: string; color: string; icon?: React.ReactNode }
> = {
  URGENT: {
    label: "Urgent",
    color:
      "bg-[#FEECEC] text-[#EF4444] border-[#FCD2D2] dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/60",
    icon: <Flame className="w-3 h-3 animate-pulse text-[#EF4444] inline mr-1" />,
  },
  HIGH: {
    label: "High",
    color:
      "bg-[#FEF5E7] text-[#F59E0B] border-[#FDE6C8] dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60",
    icon: <AlertTriangle className="w-3 h-3 inline mr-1 text-[#F59E0B]" />,
  },
  MEDIUM: {
    label: "Medium",
    color:
      "bg-[#EFF3FE] text-[#4F6BFF] border-[#DCE4FD] dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60",
  },
  LOW: {
    label: "Low",
    color:
      "bg-[#F1F3F8] text-[#64748B] border-[#E2E6EF] dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700",
  },
};

const STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; color: string; badge: string; step: number; dot: string }
> = {
  TODO: {
    label: "To Do",
    color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    badge:
      "bg-[#F1F3F8] text-[#58627A] border-[#E2E6EF] dark:bg-slate-800 dark:text-slate-300",
    step: 1,
    dot: "bg-amber-400",
  },
  IN_PROGRESS: {
    label: "In Progress",
    color:
      "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400",
    badge:
      "bg-[#EFF3FE] text-[#4F6BFF] border-[#DCE4FD] dark:bg-blue-950/40 dark:text-blue-300",
    step: 2,
    dot: "bg-[#4F6BFF]",
  },
  IN_REVIEW: {
    label: "In Review",
    color:
      "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400",
    badge:
      "bg-[#F3EFFE] text-[#8B5CF6] border-[#E3D9FD] dark:bg-purple-950/40 dark:text-purple-300",
    step: 3,
    dot: "bg-[#8B5CF6]",
  },
  COMPLETED: {
    label: "Completed",
    color:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
    badge:
      "bg-[#E9F9F0] text-[#10B981] border-[#D1F2DF] dark:bg-emerald-950/40 dark:text-emerald-300",
    step: 4,
    dot: "bg-[#10B981]",
  },
};

const KANBAN_STAGES: {
  status: TaskStatus;
  label: string;
  dot: string;
  bg: string;
  text: string;
}[] = [
  {
    status: "TODO",
    label: "Backlog / To Do",
    dot: "bg-amber-400",
    bg: "bg-[#FEF5E7]",
    text: "text-[#D97706]",
  },
  {
    status: "IN_PROGRESS",
    label: "In Progress",
    dot: "bg-[#4F6BFF]",
    bg: "bg-[#EFF3FE]",
    text: "text-[#4F6BFF]",
  },
  {
    status: "IN_REVIEW",
    label: "In Review",
    dot: "bg-[#8B5CF6]",
    bg: "bg-[#F3EFFE]",
    text: "text-[#8B5CF6]",
  },
  {
    status: "COMPLETED",
    label: "Completed",
    dot: "bg-[#10B981]",
    bg: "bg-[#E9F9F0]",
    text: "text-[#10B981]",
  },
];

export function TasksClient({
  initialTasks,
  stats: initialStats,
  members,
  projects = [],
  currentUser,
  isAdmin = false,
}: TasksClientProps) {
  // Existing state hooks (PRESERVED)
  const [tasks, setTasks] = useState<GroupTaskDTO[]>(initialTasks);
  const [viewScope, setViewScope] = useState<"ALL" | "MINE">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCommittee, setSelectedCommittee] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedPriority, setSelectedPriority] = useState<string>("ALL");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [inlineNewItem, setInlineNewItem] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);

  // New task form state (PRESERVED)
  const [selectedProjectTitle, setSelectedProjectTitle] = useState("");
  const [formChecklist, setFormChecklist] = useState<string[]>([
    "Review task requirements and committee deliverables",
    "Coordinate with assigned committee members",
  ]);
  const [newChecklistInput, setNewChecklistInput] = useState("");
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);

  // Notion / Linear Style Edit & Assignee Management (PRESERVED)
  const [editingTask, setEditingTask] = useState<GroupTaskDTO | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCommittee, setEditCommittee] =
    useState<TaskCommittee>("COMMUNITY_SERVICE");
  const [editPriority, setEditPriority] = useState<TaskPriority>("MEDIUM");
  const [editStatus, setEditStatus] = useState<TaskStatus>("TODO");
  const [editDueDate, setEditDueDate] = useState("");
  const [editProjectTitle, setEditProjectTitle] = useState("");
  const [editAssignees, setEditAssignees] = useState<string[]>([]);
  const [quickAssignTaskId, setQuickAssignTaskId] = useState<string | null>(
    null
  );

  // UI Enhanced States (Matching Reference UI/UX)
  const [viewMode, setViewMode] = useState<"BOARD" | "GRID">("BOARD");
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const [selectedProjectFilter, setSelectedProjectFilter] =
    useState<string>("ALL");
  const [selectedMemberFilter, setSelectedMemberFilter] =
    useState<string>("ALL");

  // Best Practice Enhancement 1: Collapsible Connected Projects Drawer (Hidden by default to save board space)
  const [showProjectsSection, setShowProjectsSection] = useState(false);

  // Best Practice Enhancement 2: Dedicated Task Detail / Inspection View Modal ("View Mark")
  const [viewingTask, setViewingTask] = useState<GroupTaskDTO | null>(null);

  // Star / Bookmark toggle
  const [isStarred, setIsStarred] = useState(false);

  function openEditTask(task: GroupTaskDTO) {
    if (!isAdmin) return;
    setEditingTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description);
    setEditCommittee(task.committee);
    setEditPriority(task.priority);
    setEditStatus(task.status);
    setEditDueDate(task.dueDate);
    setEditProjectTitle(task.projectTitle || "");
    setEditAssignees(task.assignedMemberIds || []);
  }

  async function handleSaveEditTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isAdmin || !editingTask) return;

    const formData = new FormData();
    formData.set("title", editTitle);
    formData.set("description", editDescription);
    formData.set("committee", editCommittee);
    formData.set("priority", editPriority);
    formData.set("status", editStatus);
    formData.set("dueDate", editDueDate);
    if (editProjectTitle) {
      formData.set("projectTitle", editProjectTitle);
    }

    editAssignees.forEach((memId) => {
      const mem = members.find((m) => m.id === memId);
      formData.append("assignedMemberIds", memId);
      if (mem) formData.append("assignedMemberNames", mem.name);
    });

    startTransition(async () => {
      const res = await updateGroupTaskAction(editingTask.id, formData);
      if (res.success && res.task) {
        setTasks((prev) =>
          prev.map((t) => (t.id === editingTask.id ? res.task! : t))
        );
        if (viewingTask?.id === editingTask.id) {
          setViewingTask(res.task);
        }
        setEditingTask(null);
        setNotice(res.message || "Task updated successfully!");
        setTimeout(() => setNotice(null), 4000);
      } else {
        alert(res.error || "Failed to update task.");
      }
    });
  }

  function handleQuickAssignToggle(taskId: string, memberId: string) {
    if (!isAdmin) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const currentIds = task.assignedMemberIds || [];
    const isAssigned = currentIds.includes(memberId);
    const nextIds = isAssigned
      ? currentIds.filter((id) => id !== memberId)
      : [...currentIds, memberId];
    const nextNames = nextIds
      .map((id) => members.find((m) => m.id === id)?.name)
      .filter((n): n is string => !!n);

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              assignedMemberIds: nextIds,
              assignedMemberNames: nextNames,
            }
          : t
      )
    );

    if (viewingTask?.id === taskId) {
      setViewingTask((prev) =>
        prev
          ? {
              ...prev,
              assignedMemberIds: nextIds,
              assignedMemberNames: nextNames,
            }
          : null
      );
    }

    startTransition(async () => {
      const res = await assignMembersToTaskAction(taskId, nextIds, nextNames);
      if (res.success && res.task) {
        setTasks((prev) => prev.map((t) => (t.id === taskId ? res.task! : t)));
        if (viewingTask?.id === taskId) {
          setViewingTask(res.task);
        }
      }
    });
  }

  // Determine active pool of tasks based on RBAC and assignment
  const myAssignedTasks = tasks.filter((t) =>
    isTaskAssignedToUser(t, currentUser)
  );
  const activeScopeTasks = !isAdmin
    ? myAssignedTasks
    : viewScope === "MINE"
    ? myAssignedTasks
    : tasks;

  // Filter tasks with enhanced filters
  const filteredTasks = activeScopeTasks.filter((task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.projectTitle &&
        task.projectTitle.toLowerCase().includes(searchQuery.toLowerCase())) ||
      task.assignedMemberNames.some((n) =>
        n.toLowerCase().includes(searchQuery.toLowerCase())
      );

    const matchesCommittee =
      selectedCommittee === "ALL" || task.committee === selectedCommittee;
    const matchesStatus =
      selectedStatus === "ALL" || task.status === selectedStatus;
    const matchesPriority =
      selectedPriority === "ALL" || task.priority === selectedPriority;
    const matchesProject =
      selectedProjectFilter === "ALL" ||
      task.projectTitle === selectedProjectFilter;
    const matchesMember =
      selectedMemberFilter === "ALL" ||
      task.assignedMemberIds?.includes(selectedMemberFilter) ||
      task.assignedMemberNames.includes(selectedMemberFilter);

    return (
      matchesSearch &&
      matchesCommittee &&
      matchesStatus &&
      matchesPriority &&
      matchesProject &&
      matchesMember
    );
  });

  // Calculate active filter count
  const activeFilterCount =
    (selectedCommittee !== "ALL" ? 1 : 0) +
    (selectedStatus !== "ALL" ? 1 : 0) +
    (selectedPriority !== "ALL" ? 1 : 0) +
    (selectedProjectFilter !== "ALL" ? 1 : 0) +
    (selectedMemberFilter !== "ALL" ? 1 : 0) +
    (searchQuery.trim() !== "" ? 1 : 0);

  function handleClearFilters() {
    setSearchQuery("");
    setSelectedCommittee("ALL");
    setSelectedStatus("ALL");
    setSelectedPriority("ALL");
    setSelectedProjectFilter("ALL");
    setSelectedMemberFilter("ALL");
  }

  // Calculate stats from current visible scope tasks
  const currentStats = {
    total: activeScopeTasks.length,
    todo: activeScopeTasks.filter((t) => t.status === "TODO").length,
    inProgress: activeScopeTasks.filter((t) => t.status === "IN_PROGRESS").length,
    inReview: activeScopeTasks.filter((t) => t.status === "IN_REVIEW").length,
    completed: activeScopeTasks.filter((t) => t.status === "COMPLETED").length,
    urgent: activeScopeTasks.filter(
      (t) => t.priority === "URGENT" && t.status !== "COMPLETED"
    ).length,
  };

  // Toggle checklist item
  function handleToggleItem(taskId: string, itemId: string) {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        const newChecklist = t.checklist.map((item) =>
          item.id === itemId ? { ...item, completed: !item.completed } : item
        );
        const allCompleted = newChecklist.every((i) => i.completed);
        const nextStatus: TaskStatus = allCompleted
          ? "COMPLETED"
          : t.status === "COMPLETED"
          ? "IN_PROGRESS"
          : t.status;
        const updatedTask: GroupTaskDTO = {
          ...t,
          checklist: newChecklist,
          status: nextStatus,
        };
        if (viewingTask?.id === taskId) {
          setViewingTask(updatedTask);
        }
        return updatedTask;
      })
    );

    startTransition(async () => {
      const res = await toggleChecklistItemAction(taskId, itemId);
      if (res.success && res.task) {
        setTasks((prev) => prev.map((t) => (t.id === taskId ? res.task! : t)));
        if (viewingTask?.id === taskId) {
          setViewingTask(res.task);
        }
      }
    });
  }

  // Update task status directly
  function handleStatusChange(taskId: string, newStatus: TaskStatus) {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );

    if (viewingTask?.id === taskId) {
      setViewingTask((prev) =>
        prev ? { ...prev, status: newStatus } : null
      );
    }

    startTransition(async () => {
      const res = await updateTaskStatusAction(taskId, newStatus);
      if (res.success && res.task) {
        setTasks((prev) => prev.map((t) => (t.id === taskId ? res.task! : t)));
        if (viewingTask?.id === taskId) {
          setViewingTask(res.task);
        }
        setNotice(`Task status updated to ${STATUS_CONFIG[newStatus].label}.`);
        setTimeout(() => setNotice(null), 3000);
      }
    });
  }

  // 1-Click Quick Complete Toggle (View Mark / Checkmark action)
  function handleQuickCompleteToggle(e: React.MouseEvent, task: GroupTaskDTO) {
    e.stopPropagation();
    const nextStatus: TaskStatus =
      task.status === "COMPLETED" ? "IN_PROGRESS" : "COMPLETED";
    handleStatusChange(task.id, nextStatus);
  }

  // Add inline checklist item
  function handleAddInlineItem(taskId: string) {
    const title = inlineNewItem[taskId]?.trim();
    if (!title) return;

    setInlineNewItem((prev) => ({ ...prev, [taskId]: "" }));

    startTransition(async () => {
      const res = await addChecklistItemAction(taskId, title);
      if (res.success && res.task) {
        setTasks((prev) => prev.map((t) => (t.id === taskId ? res.task! : t)));
        if (viewingTask?.id === taskId) {
          setViewingTask(res.task);
        }
      }
    });
  }

  // Delete task (Admin only)
  function handleDeleteTask(taskId: string, title: string) {
    if (!isAdmin) return;
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;

    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    if (viewingTask?.id === taskId) {
      setViewingTask(null);
    }

    startTransition(async () => {
      const res = await deleteTaskAction(taskId);
      if (res.success) {
        setNotice("Task deleted successfully.");
        setTimeout(() => setNotice(null), 3000);
      }
    });
  }

  // Handle Add Item to modal checklist
  function handleAddModalChecklistItem() {
    if (!newChecklistInput.trim()) return;
    setFormChecklist([...formChecklist, newChecklistInput.trim()]);
    setNewChecklistInput("");
  }

  function handleRemoveModalChecklistItem(idx: number) {
    setFormChecklist(formChecklist.filter((_, i) => i !== idx));
  }

  // Handle Create Task submit (Admin only)
  async function handleCreateTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isAdmin) return;
    const form = e.currentTarget;
    const formData = new FormData(form);
    if (selectedProjectTitle) {
      formData.set("projectTitle", selectedProjectTitle);
    }

    selectedAssignees.forEach((memId) => {
      const mem = members.find((m) => m.id === memId);
      formData.append("assignedMemberIds", memId);
      if (mem) formData.append("assignedMemberNames", mem.name);
    });

    formChecklist.forEach((chk) => {
      formData.append("checklistItems", chk);
    });

    const res = await createGroupTaskAction(formData);
    if (res.success && res.task) {
      setTasks([res.task, ...tasks]);
      setIsModalOpen(false);
      setFormChecklist([
        "Review task requirements and committee deliverables",
        "Coordinate with assigned committee members",
      ]);
      setSelectedAssignees([]);
      setNotice(res.message || "Group task created!");
      setTimeout(() => setNotice(null), 4000);
    } else {
      alert(res.error || "Failed to create group task.");
    }
  }

  // Helper renderer for a single task card (used in both Board and Grid modes)
  function renderTaskCard(task: GroupTaskDTO) {
    const committeeMeta = COMMITTEE_LABELS[task.committee] || {
      label: task.committee,
      color: "bg-slate-100 text-slate-700",
      badge: "bg-slate-100 text-slate-700",
      gradient: "from-[#4F6BFF]/10 to-transparent",
    };
    const priorityMeta = PRIORITY_BADGES[task.priority];
    const completedCount = task.checklist.filter((i) => i.completed).length;
    const totalCount = task.checklist.length;
    const progressPercent =
      totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    const isDone = task.status === "COMPLETED";

    return (
      <div
        key={task.id}
        onClick={() => setViewingTask(task)}
        className="group relative bg-white dark:bg-[#111622] border border-[#E8EDF5] dark:border-slate-800/80 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xs hover:shadow-md hover:border-[#4F6BFF]/40 transition-all duration-200 flex flex-col justify-between cursor-pointer overflow-hidden"
      >
        {/* Subtle Decorative Visual Header Accent (Matching Reference Illustrative Feel) */}
        {task.projectTitle && (
          <div
            className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${committeeMeta.gradient}`}
          />
        )}

        <div>
          {/* Header Metadata: Due Date & Category Pill & Quick Mark Checkmark */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <span
              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border transition ${committeeMeta.color}`}
            >
              {committeeMeta.label}
            </span>

            <div className="flex items-center gap-1.5">
              {/* Quick 1-Click "Mark as Complete" Checkmark Action */}
              <button
                type="button"
                onClick={(e) => handleQuickCompleteToggle(e, task)}
                title={
                  isDone
                    ? "Completed! Click to mark In Progress"
                    : "Click to mark as Completed"
                }
                className={`p-1 rounded-full transition cursor-pointer flex items-center justify-center ${
                  isDone
                    ? "bg-[#E9F9F0] text-[#10B981] hover:bg-[#D1F2DF]"
                    : "text-slate-300 hover:text-[#10B981] hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <CheckCircle2
                  className={`w-4 h-4 ${isDone ? "fill-[#10B981] text-white" : ""}`}
                />
              </button>

              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${priorityMeta.color}`}
              >
                {priorityMeta.icon}
                {priorityMeta.label}
              </span>

              {isAdmin && (
                <div
                  className="flex items-center opacity-70 group-hover:opacity-100 transition"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => openEditTask(task)}
                    className="p-1 rounded-lg text-slate-400 hover:text-[#4F6BFF] hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
                    title="Edit Task & Assignees"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteTask(task.id, task.title)}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                    title="Delete Task"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Task Title & Description */}
          <h3
            className={`text-sm font-bold tracking-tight line-clamp-2 leading-snug transition ${
              isDone
                ? "line-through text-slate-400 dark:text-slate-500"
                : "text-[#111625] dark:text-slate-100 group-hover:text-[#4F6BFF]"
            }`}
          >
            {task.title}
          </h3>
          {task.description && (
            <p className="text-xs text-[#58627A] dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
              {task.description}
            </p>
          )}

          {/* Linked Service Project Dossier Badge (With View Details cue) */}
          {task.projectTitle && (
            <div
              className="mt-2.5 px-3 py-1.5 rounded-xl bg-[#F8F9FD] dark:bg-slate-800/60 border border-[#E8EDF5] dark:border-slate-800 flex items-center justify-between text-xs"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 min-w-0">
                <FolderKanban className="w-3.5 h-3.5 text-[#4F6BFF] shrink-0" />
                <span className="font-semibold text-[#111625] dark:text-slate-200 truncate block text-[11px]">
                  {task.projectTitle}
                </span>
              </div>
              <Link
                href="/projects"
                className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-[#4F6BFF] dark:text-blue-400 hover:underline shrink-0 ml-1"
              >
                <span>View</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          )}

          {/* Due Date & Member Assignees */}
          <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs">
            <div className="flex items-center gap-1.5 text-[#8E95A5] dark:text-slate-400 text-[11px] font-medium">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{task.dueDate}</span>
            </div>

            {/* Member Avatars Stack */}
            <div
              className="flex items-center gap-1.5 relative"
              onClick={(e) => e.stopPropagation()}
            >
              {task.assignedMemberNames.length > 0 && (
                <div className="flex items-center -space-x-2 overflow-hidden">
                  {task.assignedMemberNames.slice(0, 3).map((name, i) => {
                    const initials = name
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("");
                    return (
                      <div
                        key={i}
                        title={name}
                        className="w-6 h-6 rounded-full bg-[#1C2035] text-white flex items-center justify-center text-[9.5px] font-bold border-2 border-white dark:border-[#111622]"
                      >
                        {initials}
                      </div>
                    );
                  })}
                  {task.assignedMemberNames.length > 3 && (
                    <div className="w-6 h-6 rounded-full bg-[#EFF3FE] text-[#4F6BFF] flex items-center justify-center text-[9px] font-bold border-2 border-white dark:border-[#111622]">
                      +{task.assignedMemberNames.length - 3}
                    </div>
                  )}
                </div>
              )}

              {/* Quick Assign Button (Admin only) */}
              {isAdmin && (
                <div className="relative">
                  <button
                    onClick={() =>
                      setQuickAssignTaskId(
                        quickAssignTaskId === task.id ? null : task.id
                      )
                    }
                    className="w-6 h-6 rounded-full border border-dashed border-slate-300 dark:border-slate-600 hover:border-[#4F6BFF] text-slate-400 hover:text-[#4F6BFF] flex items-center justify-center text-xs transition cursor-pointer"
                    title="Assign members"
                  >
                    <UserPlus className="w-3 h-3" />
                  </button>

                  {quickAssignTaskId === task.id && (
                    <div className="absolute right-0 top-full mt-1.5 w-56 bg-white dark:bg-[#161B26] border border-[#EDEDF2] dark:border-slate-800 rounded-xl shadow-lg p-2 z-30 space-y-1">
                      <p className="px-2 py-1 text-[10px] font-bold text-[#8E95A5] uppercase tracking-wider">
                        Assign Members
                      </p>
                      <div className="max-h-40 overflow-y-auto space-y-0.5">
                        {members.map((member) => {
                          const isAssigned = (
                            task.assignedMemberIds || []
                          ).includes(member.id);
                          return (
                            <button
                              key={member.id}
                              onClick={() =>
                                handleQuickAssignToggle(task.id, member.id)
                              }
                              className={`w-full flex items-center justify-between p-1.5 rounded-lg text-xs transition text-left cursor-pointer ${
                                isAssigned
                                  ? "bg-[#EFF3FE] text-[#4F6BFF] font-semibold"
                                  : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                              }`}
                            >
                              <span className="truncate">{member.name}</span>
                              {isAssigned && (
                                <Check className="w-3 h-3 text-[#10B981] shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Interactive Checklist & Progress Bar */}
          <div
            className="mt-3.5 space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-[#58627A] dark:text-slate-300 flex items-center gap-1">
                <CheckSquare className="w-3.5 h-3.5 text-[#4F6BFF]" />
                Checklist ({completedCount}/{totalCount})
              </span>
              <span className="text-slate-400 font-bold">{progressPercent}%</span>
            </div>

            {/* Smooth Progress Bar */}
            <div className="w-full bg-[#E8EDF5] dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  progressPercent === 100 ? "bg-[#10B981]" : "bg-[#4F6BFF]"
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Checklist Items list */}
            <div className="space-y-1.5 pt-1 max-h-36 overflow-y-auto pr-1">
              {task.checklist.map((item) => (
                <label
                  key={item.id}
                  className="flex items-start gap-2 p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition text-xs"
                >
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={() => handleToggleItem(task.id, item.id)}
                    className="mt-0.5 w-3.5 h-3.5 text-[#4F6BFF] rounded border-slate-300 focus:ring-[#4F6BFF] cursor-pointer"
                  />
                  <span
                    className={`flex-1 text-[11px] leading-tight ${
                      item.completed
                        ? "line-through text-slate-400 dark:text-slate-500"
                        : "text-slate-700 dark:text-slate-300 font-medium"
                    }`}
                  >
                    {item.title}
                  </span>
                </label>
              ))}
            </div>

            {/* Inline Add Checklist Item */}
            <div className="flex items-center gap-1 pt-1">
              <input
                type="text"
                placeholder="Add to-do item..."
                value={inlineNewItem[task.id] || ""}
                onChange={(e) =>
                  setInlineNewItem({
                    ...inlineNewItem,
                    [task.id]: e.target.value,
                  })
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddInlineItem(task.id);
                  }
                }}
                className="flex-1 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#4F6BFF]"
              />
              <button
                onClick={() => handleAddInlineItem(task.id)}
                className="px-2 py-1 bg-[#EFF3FE] hover:bg-[#DCE4FD] text-[#4F6BFF] rounded-lg text-[10px] font-semibold transition cursor-pointer"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Footer: View Details cue & Status Selector */}
        <div
          className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setViewingTask(task)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#8E95A5] hover:text-[#4F6BFF] transition cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>View Mark</span>
          </button>

          <select
            value={task.status}
            onChange={(e) =>
              handleStatusChange(task.id, e.target.value as TaskStatus)
            }
            className={`text-xs font-bold px-2.5 py-1 rounded-lg border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#4F6BFF] transition ${
              STATUS_CONFIG[task.status].badge
            }`}
          >
            <option value="TODO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="IN_REVIEW">In Review</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* =========================================================================
          STEP 2: App Shell Workspace Header & Top Utility Bar
          ========================================================================= */}
      <div className="bg-white dark:bg-[#111622] border border-[#E8EDF5] dark:border-slate-800/80 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xs space-y-4">
        {/* Row 1: Workspace Title, Telemetry Pill, Search & Primary CTA */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#EFF3FE] text-[#4F6BFF] flex items-center justify-center shadow-xs shrink-0">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#111625] dark:text-white">
                  Committee Task Center
                </h1>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EFF3FE] text-[#4F6BFF]">
                  {currentStats.total} Active Milestones
                </span>
              </div>
              <p className="text-xs text-[#8E95A5] mt-0.5">
                Real-time committee deliverables, member assignment rosters & Rotary project linkages
              </p>
            </div>
          </div>

          {/* Header Action Tools */}
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            {/* Search Input Box */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search tasks, committees, assignees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 py-2 rounded-xl bg-[#F8F9FD] dark:bg-slate-800/60 border border-[#E8EDF5] dark:border-slate-700 text-xs text-[#111625] dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4F6BFF]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Scope Switcher: All vs Mine */}
            {isAdmin ? (
              <div className="flex items-center p-1 bg-[#F4F6FA] dark:bg-slate-800 rounded-xl text-xs font-semibold shrink-0">
                <button
                  type="button"
                  onClick={() => setViewScope("ALL")}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    viewScope === "ALL"
                      ? "bg-white dark:bg-slate-900 text-[#111625] dark:text-white shadow-2xs font-bold"
                      : "text-[#8E95A5] hover:text-[#111625] dark:hover:text-white"
                  }`}
                >
                  All ({tasks.length})
                </button>
                <button
                  type="button"
                  onClick={() => setViewScope("MINE")}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    viewScope === "MINE"
                      ? "bg-white dark:bg-slate-900 text-[#111625] dark:text-white shadow-2xs font-bold"
                      : "text-[#8E95A5] hover:text-[#111625] dark:hover:text-white"
                  }`}
                >
                  My Tasks ({myAssignedTasks.length})
                </button>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#EFF3FE] text-[#4F6BFF] text-xs font-semibold shrink-0">
                <Users className="w-3.5 h-3.5" />
                <span>Assigned to You ({myAssignedTasks.length})</span>
              </div>
            )}

            {/* Primary Action Button (Admin Only) */}
            {isAdmin && (
              <button
                onClick={() => {
                  setSelectedStatus("TODO");
                  setIsModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#4F6BFF] hover:bg-[#3D54D8] text-white text-xs font-bold shadow-xs hover:shadow-sm transition cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>New Task</span>
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Sub-Header Workspace Quick Controls (Reference Match: Board Select, Avatars, Filters & View Toggle) */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs">
          {/* Left Controls: Committee Focus Selector, Project Toggle & Member Avatars */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Committee Board Selector (styled like "Design Task v" in reference) */}
            <div className="relative">
              <select
                value={selectedCommittee}
                onChange={(e) => setSelectedCommittee(e.target.value)}
                className="appearance-none pl-3 pr-8 py-1.5 rounded-xl bg-[#F8F9FD] dark:bg-slate-800 border border-[#E8EDF5] dark:border-slate-700 font-bold text-xs text-[#111625] dark:text-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#4F6BFF]"
              >
                <option value="ALL">All Committee Boards</option>
                {Object.entries(COMMITTEE_LABELS).map(([k, meta]) => (
                  <option key={k} value={k}>
                    {meta.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {/* Best Practice: Connected Projects Collapsible Toggle Button */}
            {projects && projects.length > 0 && (
              <button
                type="button"
                onClick={() => setShowProjectsSection(!showProjectsSection)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-semibold text-xs transition cursor-pointer ${
                  showProjectsSection
                    ? "bg-[#EFF3FE] border-[#4F6BFF] text-[#4F6BFF]"
                    : "bg-[#F8F9FD] dark:bg-slate-800 border-[#E8EDF5] dark:border-slate-700 text-[#58627A] dark:text-slate-300 hover:bg-slate-50"
                }`}
                title="Toggle Connected Rotary Service Projects section"
              >
                <FolderKanban className="w-3.5 h-3.5 text-[#4F6BFF]" />
                <span>Projects ({projects.length})</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    showProjectsSection
                      ? "rotate-180 text-[#4F6BFF]"
                      : "text-slate-400"
                  }`}
                />
              </button>
            )}

            {/* Active Members Facepile Stack with Invite/Quick-assign */}
            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-slate-800">
              <div className="flex items-center -space-x-1.5">
                {members.slice(0, 4).map((m, idx) => (
                  <div
                    key={m.id || idx}
                    title={m.name}
                    className="w-6 h-6 rounded-full bg-[#1C2035] text-white flex items-center justify-center text-[9px] font-bold border-2 border-white dark:border-[#111622]"
                  >
                    {m.name.charAt(0)}
                  </div>
                ))}
                {members.length > 4 && (
                  <div className="w-6 h-6 rounded-full bg-[#F1F3F8] text-[#58627A] flex items-center justify-center text-[9px] font-bold border-2 border-white dark:border-[#111622]">
                    +{members.length - 4}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Controls: Star Bookmark, Filters Toggle, View Switcher [Board | Grid], & Reset */}
          <div className="flex items-center gap-2 self-end md:self-auto">
            {/* Star Favorite Button (Reference Match) */}
            <button
              onClick={() => setIsStarred(!isStarred)}
              className={`p-1.5 rounded-xl border transition cursor-pointer ${
                isStarred
                  ? "bg-[#FEF5E7] border-[#FDE6C8] text-[#F59E0B]"
                  : "bg-white dark:bg-slate-800 border-[#E8EDF5] dark:border-slate-700 text-slate-400 hover:text-slate-600"
              }`}
              title={isStarred ? "Favorited board" : "Bookmark this board"}
            >
              <Star
                className={`w-3.5 h-3.5 ${isStarred ? "fill-[#F59E0B]" : ""}`}
              />
            </button>

            {/* Filter Toggle Button */}
            <button
              onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                isFiltersExpanded || activeFilterCount > 0
                  ? "bg-[#EFF3FE] border-[#4F6BFF] text-[#4F6BFF]"
                  : "bg-white dark:bg-slate-800 border-[#E8EDF5] dark:border-slate-700 text-[#58627A] hover:bg-slate-50"
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-[#4F6BFF] text-white text-[10px] flex items-center justify-center font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Reset Filters button */}
            {activeFilterCount > 0 && (
              <button
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-[#8E95A5] hover:text-rose-600 transition cursor-pointer"
                title="Clear all filters"
              >
                <RotateCcw className="w-3 h-3" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            )}

            {/* View Mode Segmented Control: [Board | Grid] */}
            <div className="flex items-center p-0.5 rounded-xl bg-[#F4F6FA] dark:bg-slate-800 border border-[#E8EDF5] dark:border-slate-700">
              <button
                type="button"
                onClick={() => setViewMode("BOARD")}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  viewMode === "BOARD"
                    ? "bg-white dark:bg-[#111622] text-[#4F6BFF] shadow-2xs font-bold"
                    : "text-[#8E95A5] hover:text-[#111625]"
                }`}
              >
                <Kanban className="w-3.5 h-3.5" />
                <span>Board</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("GRID")}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  viewMode === "GRID"
                    ? "bg-white dark:bg-[#111622] text-[#4F6BFF] shadow-2xs font-bold"
                    : "text-[#8E95A5] hover:text-[#111625]"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Grid</span>
              </button>
            </div>
          </div>
        </div>

        {/* Expandable Advanced Filters Bar */}
        {isFiltersExpanded && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              {/* Status Filter */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-[#8E95A5] mb-1">
                  Status
                </label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-[#F8F9FD] dark:bg-slate-800 border border-[#E8EDF5] dark:border-slate-700 text-xs text-[#111625] dark:text-white"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="TODO">To Do</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="IN_REVIEW">In Review</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>

              {/* Priority Filter */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-[#8E95A5] mb-1">
                  Priority
                </label>
                <select
                  value={selectedPriority}
                  onChange={(e) => setSelectedPriority(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-[#F8F9FD] dark:bg-slate-800 border border-[#E8EDF5] dark:border-slate-700 text-xs text-[#111625] dark:text-white"
                >
                  <option value="ALL">All Priorities</option>
                  <option value="URGENT">Urgent</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>

              {/* Committee Filter */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-[#8E95A5] mb-1">
                  Committee
                </label>
                <select
                  value={selectedCommittee}
                  onChange={(e) => setSelectedCommittee(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-[#F8F9FD] dark:bg-slate-800 border border-[#E8EDF5] dark:border-slate-700 text-xs text-[#111625] dark:text-white"
                >
                  <option value="ALL">All Committees</option>
                  {Object.entries(COMMITTEE_LABELS).map(([k, meta]) => (
                    <option key={k} value={k}>
                      {meta.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Member Filter */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-[#8E95A5] mb-1">
                  Assigned Member
                </label>
                <select
                  value={selectedMemberFilter}
                  onChange={(e) => setSelectedMemberFilter(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-[#F8F9FD] dark:bg-slate-800 border border-[#E8EDF5] dark:border-slate-700 text-xs text-[#111625] dark:text-white"
                >
                  <option value="ALL">All Members</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Committee Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <button
                onClick={() => setSelectedCommittee("ALL")}
                className={`px-3 py-1 rounded-full whitespace-nowrap text-[11px] font-semibold transition cursor-pointer ${
                  selectedCommittee === "ALL"
                    ? "bg-[#4F6BFF] text-white"
                    : "bg-[#F1F3F8] dark:bg-slate-800 text-[#58627A] dark:text-slate-300 hover:bg-slate-200"
                }`}
              >
                All
              </button>
              {Object.entries(COMMITTEE_LABELS).map(([key, config]) => (
                <button
                  key={key}
                  onClick={() => setSelectedCommittee(key)}
                  className={`px-3 py-1 rounded-full whitespace-nowrap text-[11px] font-medium transition cursor-pointer ${
                    selectedCommittee === key
                      ? "bg-[#4F6BFF] text-white font-bold"
                      : "bg-[#F1F3F8] dark:bg-slate-800 text-[#58627A] dark:text-slate-300 hover:bg-slate-200"
                  }`}
                >
                  {config.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Notice Banner */}
      {notice && (
        <div className="p-3.5 rounded-2xl bg-[#E9F9F0] border border-[#D1F2DF] text-[#10B981] text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* KPI Telemetry Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total */}
        <div className="bg-white dark:bg-[#111622] border border-[#E8EDF5] dark:border-slate-800/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#8E95A5] text-xs font-semibold">
            <span>Total Tasks</span>
            <ListTodo className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-[#111625] dark:text-white mt-1.5">
            {currentStats.total}
          </div>
          <div className="text-[11px] text-[#8E95A5] mt-0.5">
            Active committee initiatives
          </div>
        </div>

        {/* Card 2: In Progress */}
        <div className="bg-white dark:bg-[#111622] border border-[#E8EDF5] dark:border-slate-800/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#4F6BFF] text-xs font-semibold">
            <span>In Progress</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-[#4F6BFF] mt-1.5">
            {currentStats.inProgress}
          </div>
          <div className="text-[11px] text-[#8E95A5] mt-0.5">
            {currentStats.inReview} in review pipeline
          </div>
        </div>

        {/* Card 3: Completed */}
        <div className="bg-white dark:bg-[#111622] border border-[#E8EDF5] dark:border-slate-800/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#10B981] text-xs font-semibold">
            <span>Completed</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-[#10B981] mt-1.5">
            {currentStats.completed}
          </div>
          <div className="text-[11px] text-[#8E95A5] mt-0.5">
            {currentStats.total > 0
              ? `${Math.round(
                  (currentStats.completed / currentStats.total) * 100
                )}% completion rate`
              : "0%"}
          </div>
        </div>

        {/* Card 4: Urgent */}
        <div className="bg-white dark:bg-[#111622] border border-[#E8EDF5] dark:border-slate-800/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#EF4444] text-xs font-semibold">
            <span>Urgent Attention</span>
            <Flame className="w-4 h-4 text-[#EF4444] animate-pulse" />
          </div>
          <div className="text-2xl font-black text-[#EF4444] mt-1.5">
            {currentStats.urgent}
          </div>
          <div className="text-[11px] text-[#8E95A5] mt-0.5">
            Require immediate action
          </div>
        </div>
      </div>

      {/* =========================================================================
          Best Practice 1: Collapsible Connected Rotary Projects Section (Hidden by Default)
          ========================================================================= */}
      {projects && projects.length > 0 && showProjectsSection && (
        <div className="bg-white dark:bg-[#111622] border border-[#E8EDF5] dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-[#EFF3FE] text-[#4F6BFF]">
                <FolderKanban className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-xs sm:text-sm font-bold text-[#111625] dark:text-white">
                  Connected Rotary Service Projects
                </h2>
                <p className="text-[11px] text-[#8E95A5]">
                  Strategic club projects with associated operational tasks
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/projects"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#DCE4FD] bg-[#EFF3FE] hover:bg-[#DCE4FD] text-[#4F6BFF] font-semibold text-xs transition shrink-0"
              >
                <span>All Projects</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
              <button
                onClick={() => setShowProjectsSection(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                title="Hide projects section"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {projects.slice(0, 3).map((proj) => (
              <div
                key={proj.id}
                className="p-3.5 rounded-xl border border-[#E8EDF5] dark:border-slate-800 bg-[#F8F9FD] dark:bg-slate-800/40 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#EFF3FE] text-[#4F6BFF]">
                      {proj.category}
                    </span>
                    <span className="text-[10px] font-semibold text-[#8E95A5]">
                      {proj.status}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-[#111625] dark:text-white line-clamp-1">
                    {proj.title}
                  </h4>
                  <p className="text-[11px] text-[#8E95A5] mt-0.5">
                    {proj.beneficiaries.toLocaleString()} Beneficiaries ·{" "}
                    {proj.volunteerHours}h logged
                  </p>
                </div>
                <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-800 flex justify-end">
                  <Link
                    href="/projects"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#4F6BFF] hover:underline"
                  >
                    <span>View Dossier</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          STEP 3: Main Task Workspace (Kanban Board vs Grid View)
          ========================================================================= */}
      {filteredTasks.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-[#111622] border border-[#E8EDF5] dark:border-slate-800/80 rounded-3xl shadow-xs">
          <CheckSquare className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-[#111625] dark:text-slate-200">
            No matching tasks found
          </h3>
          <p className="text-xs text-[#8E95A5] mt-1 max-w-sm mx-auto">
            Try adjusting your search criteria, clearing active filters, or creating a new committee task deliverable.
          </p>
          {activeFilterCount > 0 && (
            <button
              onClick={handleClearFilters}
              className="mt-3 px-4 py-1.5 bg-[#EFF3FE] text-[#4F6BFF] rounded-xl text-xs font-bold transition hover:bg-[#DCE4FD] cursor-pointer"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : viewMode === "BOARD" ? (
        /* KANBAN BOARD VIEW (Matching Reference Screenshot) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {KANBAN_STAGES.map((stage) => {
            const stageTasks = filteredTasks.filter(
              (t) => t.status === stage.status
            );
            return (
              <div
                key={stage.status}
                className="bg-[#F4F6FA] dark:bg-[#0E131F] border border-[#E8EDF5] dark:border-slate-800/70 rounded-2xl sm:rounded-3xl p-3 sm:p-4 space-y-3 flex flex-col min-h-[450px]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/70 dark:border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${stage.dot}`}
                    />
                    <h3 className="text-xs sm:text-sm font-bold text-[#111625] dark:text-white">
                      {stage.label}
                    </h3>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${stage.bg} ${stage.text}`}
                    >
                      {stageTasks.length}
                    </span>
                  </div>

                  <div className="text-slate-400">
                    <MoreHorizontal className="w-4 h-4 cursor-pointer hover:text-slate-600" />
                  </div>
                </div>

                {/* Column Cards */}
                <div className="space-y-3 flex-1 overflow-y-auto max-h-[75vh] pr-0.5">
                  {stageTasks.map((task) => renderTaskCard(task))}
                </div>

                {/* Column Footer: + Add New Task with Dotted Reference Pattern */}
                {isAdmin && (
                  <button
                    onClick={() => {
                      setSelectedStatus(stage.status);
                      setIsModalOpen(true);
                    }}
                    className="w-full py-2.5 px-4 rounded-2xl bg-[#EFF3FE] hover:bg-[#DCE4FD] dark:bg-slate-800 dark:hover:bg-slate-700 text-[#4F6BFF] text-xs font-bold flex items-center justify-between transition cursor-pointer shadow-2xs mt-auto group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-lg bg-[#4F6BFF] text-white flex items-center justify-center text-xs font-bold shadow-2xs">
                        +
                      </span>
                      <span>Add New Task</span>
                    </div>
                    <span className="text-[11px] text-[#4F6BFF]/60 font-mono tracking-widest">
                      ···
                    </span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* BENTO GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTasks.map((task) => renderTaskCard(task))}
        </div>
      )}

      {/* =========================================================================
          Best Practice 2: Dedicated Task Detail / Inspection View Modal ("View Mark")
          ========================================================================= */}
      {viewingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl bg-white dark:bg-[#111622] rounded-3xl border border-[#E8EDF5] dark:border-slate-800 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8EDF5] dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-[#EFF3FE] text-[#4F6BFF]">
                  <FileText className="w-5 h-5" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        COMMITTEE_LABELS[viewingTask.committee]?.color
                      }`}
                    >
                      {COMMITTEE_LABELS[viewingTask.committee]?.label}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        PRIORITY_BADGES[viewingTask.priority]?.color
                      }`}
                    >
                      {PRIORITY_BADGES[viewingTask.priority]?.label}
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-[#111625] dark:text-white mt-1">
                    Task Dossier & Verification
                  </h2>
                </div>
              </div>
              <button
                onClick={() => setViewingTask(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
              {/* Quick Status Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3.5 rounded-2xl bg-[#F8F9FD] dark:bg-slate-800/60 border border-[#E8EDF5] dark:border-slate-800 gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-[#8E95A5] uppercase tracking-wider">
                    Current Stage:
                  </span>
                  <select
                    value={viewingTask.status}
                    onChange={(e) =>
                      handleStatusChange(
                        viewingTask.id,
                        e.target.value as TaskStatus
                      )
                    }
                    className={`text-xs font-bold px-3 py-1.5 rounded-xl border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#4F6BFF] transition ${
                      STATUS_CONFIG[viewingTask.status].badge
                    }`}
                  >
                    <option value="TODO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="IN_REVIEW">In Review</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                </div>

                {/* 1-Click Complete Button */}
                <button
                  type="button"
                  onClick={(e) => handleQuickCompleteToggle(e, viewingTask)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    viewingTask.status === "COMPLETED"
                      ? "bg-[#E9F9F0] text-[#10B981] hover:bg-[#D1F2DF]"
                      : "bg-[#4F6BFF] hover:bg-[#3D54D8] text-white"
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>
                    {viewingTask.status === "COMPLETED"
                      ? "Mark In Progress"
                      : "Mark as Complete"}
                  </span>
                </button>
              </div>

              {/* Task Title & Description */}
              <div className="space-y-1.5">
                <h3 className="text-lg font-black text-[#111625] dark:text-white leading-tight">
                  {viewingTask.title}
                </h3>
                <p className="text-xs text-[#58627A] dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {viewingTask.description || "No additional description provided."}
                </p>
              </div>

              {/* Connected Project Dossier */}
              {viewingTask.projectTitle && (
                <div className="p-3.5 rounded-2xl bg-[#EFF3FE]/60 dark:bg-slate-800/80 border border-[#DCE4FD] dark:border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FolderKanban className="w-4 h-4 text-[#4F6BFF] shrink-0" />
                    <div>
                      <span className="text-[10px] font-bold text-[#4F6BFF] uppercase tracking-wider block">
                        Linked Service Project
                      </span>
                      <span className="font-bold text-[#111625] dark:text-white text-xs block truncate">
                        {viewingTask.projectTitle}
                      </span>
                    </div>
                  </div>
                  <Link
                    href="/projects"
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#4F6BFF] hover:underline shrink-0"
                  >
                    <span>View Dossier</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}

              {/* Target Due Date & Assigned Members */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-2xl bg-[#F8F9FD] dark:bg-slate-800/40 border border-[#E8EDF5] dark:border-slate-800">
                  <span className="text-[10px] font-bold text-[#8E95A5] uppercase tracking-wider block mb-1">
                    Target Completion Date
                  </span>
                  <div className="flex items-center gap-2 text-xs font-bold text-[#111625] dark:text-white">
                    <Calendar className="w-4 h-4 text-[#4F6BFF]" />
                    <span>{viewingTask.dueDate}</span>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-[#F8F9FD] dark:bg-slate-800/40 border border-[#E8EDF5] dark:border-slate-800">
                  <span className="text-[10px] font-bold text-[#8E95A5] uppercase tracking-wider block mb-1">
                    Assigned Club Roster
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {viewingTask.assignedMemberNames.length > 0 ? (
                      viewingTask.assignedMemberNames.map((name, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white dark:bg-slate-700 border border-[#E8EDF5] dark:border-slate-600 text-[11px] font-semibold text-[#111625] dark:text-white"
                        >
                          <UserCheck className="w-3 h-3 text-[#4F6BFF]" />
                          <span>{name}</span>
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] text-slate-400">
                        Unassigned
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Deliverable Checklist Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#111625] dark:text-white flex items-center gap-1.5">
                    <CheckSquare className="w-4 h-4 text-[#4F6BFF]" />
                    <span>Deliverable Checklist</span>
                  </span>
                  <span className="text-xs font-bold text-[#4F6BFF]">
                    {viewingTask.checklist.filter((i) => i.completed).length} of{" "}
                    {viewingTask.checklist.length} Completed
                  </span>
                </div>

                <div className="space-y-1.5">
                  {viewingTask.checklist.map((item) => (
                    <label
                      key={item.id}
                      className="flex items-start gap-2.5 p-2 rounded-xl border border-[#E8EDF5] dark:border-slate-800 hover:bg-[#F8F9FD] dark:hover:bg-slate-800/50 cursor-pointer transition text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() =>
                          handleToggleItem(viewingTask.id, item.id)
                        }
                        className="mt-0.5 w-4 h-4 text-[#4F6BFF] rounded border-slate-300 focus:ring-[#4F6BFF] cursor-pointer"
                      />
                      <span
                        className={`flex-1 ${
                          item.completed
                            ? "line-through text-slate-400 dark:text-slate-500"
                            : "text-[#111625] dark:text-white font-medium"
                        }`}
                      >
                        {item.title}
                      </span>
                    </label>
                  ))}
                </div>

                {/* Inline Add Item in View Modal */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Add deliverable checklist item..."
                    value={inlineNewItem[viewingTask.id] || ""}
                    onChange={(e) =>
                      setInlineNewItem({
                        ...inlineNewItem,
                        [viewingTask.id]: e.target.value,
                      })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddInlineItem(viewingTask.id);
                      }
                    }}
                    className="flex-1 px-3 py-1.5 rounded-xl bg-[#F8F9FD] dark:bg-slate-800 border border-[#E8EDF5] dark:border-slate-700 text-xs text-[#111625] dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#4F6BFF]"
                  />
                  <button
                    onClick={() => handleAddInlineItem(viewingTask.id)}
                    className="px-3 py-1.5 bg-[#EFF3FE] hover:bg-[#DCE4FD] text-[#4F6BFF] text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-[#E8EDF5] dark:border-slate-800">
              <button
                type="button"
                onClick={() => setViewingTask(null)}
                className="px-4 py-2 rounded-xl border border-[#E8EDF5] dark:border-slate-700 text-xs font-semibold text-[#58627A] hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Close
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    const taskToEdit = viewingTask;
                    setViewingTask(null);
                    openEditTask(taskToEdit);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#4F6BFF] hover:bg-[#3D54D8] text-white font-bold text-xs shadow-xs transition cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Task & Assignees</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          Create Group Task Modal (Admin Only - Logic PRESERVED)
          ========================================================================= */}
      {isAdmin && isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-xl max-h-[90vh] bg-white dark:bg-[#111622] rounded-3xl shadow-2xl border border-[#E8EDF5] dark:border-slate-800 flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8EDF5] dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-[#EFF3FE] text-[#4F6BFF]">
                  <CheckSquare className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-[#111625] dark:text-white">
                    Create Committee Group Task
                  </h3>
                  <p className="text-[11px] text-[#8E95A5]">
                    Schedule deliverables, due date & assign club members
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form
              onSubmit={handleCreateTask}
              className="flex-1 overflow-y-auto p-6 space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-[#111625] dark:text-slate-300 mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  placeholder="e.g., Blood Letting Drive Logistics & Refreshments"
                  className="w-full px-3 py-2 rounded-xl bg-[#F8F9FD] dark:bg-slate-800 border border-[#E8EDF5] dark:border-slate-700 text-xs text-[#111625] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#4F6BFF]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#111625] dark:text-slate-300 mb-1">
                    Committee / Group *
                  </label>
                  <select
                    name="committee"
                    required
                    className="w-full px-3 py-2 rounded-xl bg-[#F8F9FD] dark:bg-slate-800 border border-[#E8EDF5] dark:border-slate-700 text-xs text-[#111625] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#4F6BFF]"
                  >
                    <option value="COMMUNITY_SERVICE">Community Service</option>
                    <option value="CLUB_SERVICE">Club Service</option>
                    <option value="PUBLIC_IMAGE">Public Image</option>
                    <option value="FINANCE">Finance & Ways</option>
                    <option value="INTERNATIONAL">International Service</option>
                    <option value="VOCATIONAL">Vocational Service</option>
                    <option value="SECRETARIAT">Secretariat</option>
                    <option value="BOARD">Board of Directors</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#111625] dark:text-slate-300 mb-1">
                    Priority *
                  </label>
                  <select
                    name="priority"
                    defaultValue="MEDIUM"
                    className="w-full px-3 py-2 rounded-xl bg-[#F8F9FD] dark:bg-slate-800 border border-[#E8EDF5] dark:border-slate-700 text-xs text-[#111625] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#4F6BFF]"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#111625] dark:text-slate-300 mb-1">
                    Target Due Date *
                  </label>
                  <input
                    type="date"
                    name="dueDate"
                    required
                    defaultValue={
                      new Date(Date.now() + 7 * 86400000)
                        .toISOString()
                        .split("T")[0]
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#F8F9FD] dark:bg-slate-800 border border-[#E8EDF5] dark:border-slate-700 text-xs text-[#111625] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#4F6BFF]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#111625] dark:text-slate-300 mb-1">
                  Description & Deliverables
                </label>
                <textarea
                  name="description"
                  rows={2}
                  placeholder="Outline key objectives, expectations, and deliverables..."
                  className="w-full px-3 py-2 rounded-xl bg-[#F8F9FD] dark:bg-slate-800 border border-[#E8EDF5] dark:border-slate-700 text-xs text-[#111625] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#4F6BFF] resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#111625] dark:text-slate-300 mb-1">
                  Connected Service Project
                </label>
                <select
                  name="projectTitle"
                  value={selectedProjectTitle}
                  onChange={(e) => setSelectedProjectTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#F8F9FD] dark:bg-slate-800 border border-[#E8EDF5] dark:border-slate-700 text-xs text-[#111625] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#4F6BFF] font-medium"
                >
                  <option value="">-- No Linked Project --</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.title}>
                      {p.title} ({p.category})
                    </option>
                  ))}
                </select>
              </div>

              {/* Assign Members Multi-select */}
              <div>
                <label className="block text-xs font-bold text-[#111625] dark:text-slate-300 mb-1">
                  Assign Members from Club Roster ({selectedAssignees.length}{" "}
                  selected)
                </label>
                <div className="max-h-36 overflow-y-auto border border-[#E8EDF5] dark:border-slate-700 rounded-2xl p-2 bg-[#F8F9FD] dark:bg-slate-800/50 space-y-1">
                  {members.map((member) => {
                    const isSelected = selectedAssignees.includes(member.id);
                    return (
                      <label
                        key={member.id}
                        className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 cursor-pointer text-xs transition"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedAssignees([
                                ...selectedAssignees,
                                member.id,
                              ]);
                            } else {
                              setSelectedAssignees(
                                selectedAssignees.filter(
                                  (id) => id !== member.id
                                )
                              );
                            }
                          }}
                          className="w-3.5 h-3.5 text-[#4F6BFF] rounded border-slate-300 focus:ring-[#4F6BFF]"
                        />
                        <div className="flex-1 flex items-center justify-between">
                          <span className="font-medium text-[#111625] dark:text-slate-200">
                            {member.name}
                          </span>
                          <span className="text-[10px] text-[#8E95A5]">
                            {member.role || "Member"}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Checklist Items Builder */}
              <div>
                <label className="block text-xs font-bold text-[#111625] dark:text-slate-300 mb-1">
                  Checklist & To-Do Items ({formChecklist.length})
                </label>
                <div className="space-y-1.5 mb-2">
                  {formChecklist.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[#F8F9FD] dark:bg-slate-800 border border-[#E8EDF5] dark:border-slate-700 text-xs"
                    >
                      <span className="text-[#111625] dark:text-slate-200">
                        • {item}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveModalChecklistItem(idx)}
                        className="text-slate-400 hover:text-rose-500 text-xs font-bold p-1 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Add checklist item..."
                    value={newChecklistInput}
                    onChange={(e) => setNewChecklistInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddModalChecklistItem();
                      }
                    }}
                    className="flex-1 px-3 py-1.5 rounded-xl bg-[#F8F9FD] dark:bg-slate-800 border border-[#E8EDF5] dark:border-slate-700 text-xs text-[#111625] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#4F6BFF]"
                  />
                  <button
                    type="button"
                    onClick={handleAddModalChecklistItem}
                    className="px-3 py-1.5 rounded-xl bg-[#EFF3FE] hover:bg-[#DCE4FD] text-[#4F6BFF] text-xs font-bold transition cursor-pointer"
                  >
                    Add Item
                  </button>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#E8EDF5] dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#E8EDF5] dark:border-slate-700 text-xs font-semibold text-[#58627A] hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#4F6BFF] hover:bg-[#3D54D8] text-white font-bold text-xs transition shadow-xs cursor-pointer"
                >
                  Create Group Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          Edit Task & Assignees Modal (Admin Only - Logic PRESERVED)
          ========================================================================= */}
      {isAdmin && editingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl bg-white dark:bg-[#111622] rounded-3xl border border-[#E8EDF5] dark:border-slate-800 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8EDF5] dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-[#EFF3FE] text-[#4F6BFF]">
                  <Edit2 className="w-4 h-4" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-[#111625] dark:text-white">
                    Edit Task & Deliverables
                  </h2>
                  <p className="text-[11px] text-[#8E95A5]">
                    Update deliverables, due date, committee, and member assignments
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingTask(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form
              onSubmit={handleSaveEditTask}
              className="flex-1 overflow-y-auto p-6 space-y-4 text-xs"
            >
              <div>
                <label className="block font-bold text-[#111625] dark:text-slate-300 mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#F8F9FD] dark:bg-slate-800/60 border border-[#E8EDF5] dark:border-slate-700 text-[#111625] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#4F6BFF]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-bold text-[#111625] dark:text-slate-300 mb-1">
                    Committee *
                  </label>
                  <select
                    value={editCommittee}
                    onChange={(e) =>
                      setEditCommittee(e.target.value as TaskCommittee)
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#F8F9FD] dark:bg-slate-800/60 border border-[#E8EDF5] dark:border-slate-700 text-[#111625] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#4F6BFF]"
                  >
                    <option value="COMMUNITY_SERVICE">Community Service</option>
                    <option value="CLUB_SERVICE">Club Service</option>
                    <option value="PUBLIC_IMAGE">Public Image</option>
                    <option value="FINANCE">Finance & Ways</option>
                    <option value="INTERNATIONAL">International Service</option>
                    <option value="VOCATIONAL">Vocational Service</option>
                    <option value="SECRETARIAT">Secretariat</option>
                    <option value="BOARD">Board of Directors</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#111625] dark:text-slate-300 mb-1">
                    Priority *
                  </label>
                  <select
                    value={editPriority}
                    onChange={(e) =>
                      setEditPriority(e.target.value as TaskPriority)
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#F8F9FD] dark:bg-slate-800/60 border border-[#E8EDF5] dark:border-slate-700 text-[#111625] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#4F6BFF]"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#111625] dark:text-slate-300 mb-1">
                    Status *
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) =>
                      setEditStatus(e.target.value as TaskStatus)
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#F8F9FD] dark:bg-slate-800/60 border border-[#E8EDF5] dark:border-slate-700 text-[#111625] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#4F6BFF]"
                  >
                    <option value="TODO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="IN_REVIEW">In Review</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#111625] dark:text-slate-300 mb-1">
                    Target Due Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#F8F9FD] dark:bg-slate-800/60 border border-[#E8EDF5] dark:border-slate-700 text-[#111625] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#4F6BFF]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#111625] dark:text-slate-300 mb-1">
                  Description & Deliverables
                </label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#F8F9FD] dark:bg-slate-800/60 border border-[#E8EDF5] dark:border-slate-700 text-[#111625] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#4F6BFF] resize-none"
                />
              </div>

              <div>
                <label className="block font-bold text-[#111625] dark:text-slate-300 mb-1">
                  Connected Service Project
                </label>
                <select
                  value={editProjectTitle}
                  onChange={(e) => setEditProjectTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#F8F9FD] dark:bg-slate-800/60 border border-[#E8EDF5] dark:border-slate-700 text-[#111625] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#4F6BFF]"
                >
                  <option value="">-- No Linked Project --</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.title}>
                      {p.title} ({p.category})
                    </option>
                  ))}
                </select>
              </div>

              {/* Assign Members Section */}
              <div>
                <label className="block font-bold text-[#111625] dark:text-slate-300 mb-1">
                  Assigned Members ({editAssignees.length})
                </label>

                {editAssignees.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {editAssignees.map((id) => {
                      const member = members.find((m) => m.id === id);
                      if (!member) return null;
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#EFF3FE] text-[#4F6BFF] border border-[#DCE4FD] text-xs font-semibold"
                        >
                          <span className="w-4 h-4 rounded-full bg-[#4F6BFF] text-white flex items-center justify-center text-[9px] font-bold">
                            {member.name.charAt(0)}
                          </span>
                          <span>{member.name}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setEditAssignees(
                                editAssignees.filter((memId) => memId !== id)
                              )
                            }
                            className="hover:text-red-600 transition cursor-pointer"
                          >
                            ✕
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                <div className="max-h-36 overflow-y-auto border border-[#E8EDF5] dark:border-slate-700 rounded-2xl p-2 bg-[#F8F9FD] dark:bg-slate-800/50 space-y-1">
                  {members.map((member) => {
                    const isSelected = editAssignees.includes(member.id);
                    return (
                      <label
                        key={member.id}
                        className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 cursor-pointer text-xs transition"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditAssignees([...editAssignees, member.id]);
                            } else {
                              setEditAssignees(
                                editAssignees.filter((id) => id !== member.id)
                              );
                            }
                          }}
                          className="w-3.5 h-3.5 text-[#4F6BFF] rounded border-slate-300 focus:ring-[#4F6BFF]"
                        />
                        <div className="flex-1 flex items-center justify-between">
                          <span className="font-medium text-[#111625] dark:text-slate-200">
                            {member.name}
                          </span>
                          <span className="text-[10px] text-[#8E95A5]">
                            {member.role || "Member"}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#E8EDF5] dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingTask(null)}
                  className="px-4 py-2 rounded-xl border border-[#E8EDF5] dark:border-slate-700 text-xs font-semibold text-[#58627A] hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-xl bg-[#4F6BFF] hover:bg-[#3D54D8] text-white font-bold text-xs transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isPending ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
