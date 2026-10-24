"use client";

import React, { useState, useTransition } from "react";
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
}

const COMMITTEE_LABELS: Record<TaskCommittee, { label: string; color: string }> = {
  CLUB_SERVICE: { label: "Club Service", color: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-900" },
  COMMUNITY_SERVICE: { label: "Community Service", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900" },
  VOCATIONAL: { label: "Vocational Service", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900" },
  INTERNATIONAL: { label: "International Service", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300 border-cyan-200 dark:border-cyan-900" },
  PUBLIC_IMAGE: { label: "Public Image", color: "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200 dark:border-purple-900" },
  FINANCE: { label: "Finance & Ways", color: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-900" },
  SECRETARIAT: { label: "Secretariat", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700" },
  BOARD: { label: "Board of Directors", color: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-900" },
};

const PRIORITY_BADGES: Record<TaskPriority, { label: string; color: string; icon?: React.ReactNode }> = {
  URGENT: { label: "Urgent", color: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20", icon: <Flame className="w-3 h-3 animate-pulse text-red-500 inline mr-1" /> },
  HIGH: { label: "High", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20", icon: <AlertTriangle className="w-3 h-3 inline mr-1" /> },
  MEDIUM: { label: "Medium", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  LOW: { label: "Low", color: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20" },
};

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; step: number }> = {
  TODO: { label: "To Do", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300", step: 1 },
  IN_PROGRESS: { label: "In Progress", color: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400", step: 2 },
  IN_REVIEW: { label: "In Review", color: "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400", step: 3 },
  COMPLETED: { label: "Completed", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400", step: 4 },
};

export function TasksClient({ initialTasks, stats: initialStats, members }: TasksClientProps) {
  const [tasks, setTasks] = useState<GroupTaskDTO[]>(initialTasks);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCommittee, setSelectedCommittee] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedPriority, setSelectedPriority] = useState<string>("ALL");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [inlineNewItem, setInlineNewItem] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);

  // New task form state
  const [formChecklist, setFormChecklist] = useState<string[]>([
    "Review task requirements and committee deliverables",
    "Coordinate with assigned committee members",
  ]);
  const [newChecklistInput, setNewChecklistInput] = useState("");
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);

  // Notion / Linear Style Edit & Assignee Management
  const [editingTask, setEditingTask] = useState<GroupTaskDTO | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCommittee, setEditCommittee] = useState<TaskCommittee>("COMMUNITY_SERVICE");
  const [editPriority, setEditPriority] = useState<TaskPriority>("MEDIUM");
  const [editStatus, setEditStatus] = useState<TaskStatus>("TODO");
  const [editDueDate, setEditDueDate] = useState("");
  const [editAssignees, setEditAssignees] = useState<string[]>([]);
  const [quickAssignTaskId, setQuickAssignTaskId] = useState<string | null>(null);

  function openEditTask(task: GroupTaskDTO) {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description);
    setEditCommittee(task.committee);
    setEditPriority(task.priority);
    setEditStatus(task.status);
    setEditDueDate(task.dueDate);
    setEditAssignees(task.assignedMemberIds || []);
  }

  async function handleSaveEditTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingTask) return;

    const formData = new FormData();
    formData.set("title", editTitle);
    formData.set("description", editDescription);
    formData.set("committee", editCommittee);
    formData.set("priority", editPriority);
    formData.set("status", editStatus);
    formData.set("dueDate", editDueDate);

    editAssignees.forEach((memId) => {
      const mem = members.find((m) => m.id === memId);
      formData.append("assignedMemberIds", memId);
      if (mem) formData.append("assignedMemberNames", mem.name);
    });

    startTransition(async () => {
      const res = await updateGroupTaskAction(editingTask.id, formData);
      if (res.success && res.task) {
        setTasks((prev) => prev.map((t) => (t.id === editingTask.id ? res.task! : t)));
        setEditingTask(null);
        setNotice(res.message || "Task updated successfully!");
        setTimeout(() => setNotice(null), 4000);
      } else {
        alert(res.error || "Failed to update task.");
      }
    });
  }

  function handleQuickAssignToggle(taskId: string, memberId: string) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const currentIds = task.assignedMemberIds || [];
    const isAssigned = currentIds.includes(memberId);
    const nextIds = isAssigned ? currentIds.filter((id) => id !== memberId) : [...currentIds, memberId];
    const nextNames = nextIds
      .map((id) => members.find((m) => m.id === id)?.name)
      .filter((n): n is string => !!n);

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, assignedMemberIds: nextIds, assignedMemberNames: nextNames }
          : t
      )
    );

    startTransition(async () => {
      const res = await assignMembersToTaskAction(taskId, nextIds, nextNames);
      if (res.success && res.task) {
        setTasks((prev) => prev.map((t) => (t.id === taskId ? res.task! : t)));
      }
    });
  }

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.assignedMemberNames.some((n) => n.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCommittee = selectedCommittee === "ALL" || task.committee === selectedCommittee;
    const matchesStatus = selectedStatus === "ALL" || task.status === selectedStatus;
    const matchesPriority = selectedPriority === "ALL" || task.priority === selectedPriority;

    return matchesSearch && matchesCommittee && matchesStatus && matchesPriority;
  });

  // Calculate stats from current tasks
  const currentStats = {
    total: tasks.length,
    todo: tasks.filter((t) => t.status === "TODO").length,
    inProgress: tasks.filter((t) => t.status === "IN_PROGRESS").length,
    inReview: tasks.filter((t) => t.status === "IN_REVIEW").length,
    completed: tasks.filter((t) => t.status === "COMPLETED").length,
    urgent: tasks.filter((t) => t.priority === "URGENT" && t.status !== "COMPLETED").length,
  };

  // Toggle checklist item
  function handleToggleItem(taskId: string, itemId: string) {
    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        const newChecklist = t.checklist.map((item) =>
          item.id === itemId ? { ...item, completed: !item.completed } : item
        );
        const allCompleted = newChecklist.every((i) => i.completed);
        return {
          ...t,
          checklist: newChecklist,
          status: allCompleted ? "COMPLETED" : t.status === "COMPLETED" ? "IN_PROGRESS" : t.status,
        };
      })
    );

    startTransition(async () => {
      const res = await toggleChecklistItemAction(taskId, itemId);
      if (res.success && res.task) {
        setTasks((prev) => prev.map((t) => (t.id === taskId ? res.task! : t)));
      }
    });
  }

  // Update task status directly
  function handleStatusChange(taskId: string, newStatus: TaskStatus) {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );

    startTransition(async () => {
      const res = await updateTaskStatusAction(taskId, newStatus);
      if (res.success && res.task) {
        setTasks((prev) => prev.map((t) => (t.id === taskId ? res.task! : t)));
        setNotice(`Task status updated to ${STATUS_CONFIG[newStatus].label}.`);
        setTimeout(() => setNotice(null), 3000);
      }
    });
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
      }
    });
  }

  // Delete task
  function handleDeleteTask(taskId: string, title: string) {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;

    setTasks((prev) => prev.filter((t) => t.id !== taskId));

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

  // Handle Create Task submit
  async function handleCreateTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    // Append assignees and checklist items
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <CheckSquare className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Committee & Group Task Center
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Collaborative committee workspaces · Task to-do checklists · Live roster member assignment
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition shadow-sm cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Group Task</span>
        </button>
      </div>

      {/* Notice Banner */}
      {notice && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Total Tasks</span>
            <ListTodo className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {currentStats.total}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Active committee initiatives
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 text-xs font-medium">
            <span>In Progress</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
            {currentStats.inProgress}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {currentStats.inReview} awaiting review
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-xs font-medium">
            <span>Completed</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {currentStats.completed}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {currentStats.total > 0
              ? `${Math.round((currentStats.completed / currentStats.total) * 100)}% execution rate`
              : "0%"}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-red-600 dark:text-red-400 text-xs font-medium">
            <span>Urgent Priority</span>
            <Flame className="w-4 h-4 text-red-500 animate-pulse" />
          </div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
            {currentStats.urgent}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Require immediate action
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search tasks, committees, or assignees..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="TODO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="COMPLETED">Completed</option>
            </select>

            {/* Priority Filter */}
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              <option value="ALL">All Priorities</option>
              <option value="URGENT">Urgent</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
        </div>

        {/* Committee Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setSelectedCommittee("ALL")}
            className={`px-2.5 py-1 rounded-full whitespace-nowrap text-[11px] font-semibold transition ${
              selectedCommittee === "ALL"
                ? "bg-rose-600 text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            All Committees
          </button>
          {Object.entries(COMMITTEE_LABELS).map(([key, config]) => (
            <button
              key={key}
              onClick={() => setSelectedCommittee(key)}
              className={`px-2.5 py-1 rounded-full whitespace-nowrap text-[11px] font-medium transition ${
                selectedCommittee === key
                  ? "bg-rose-600 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {config.label}
            </button>
          ))}
        </div>
      </div>

      {/* Task Cards Grid */}
      {filteredTasks.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <CheckSquare className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No tasks found</h3>
          <p className="text-xs text-slate-400 mt-1">
            Try adjusting your search query or committee filters, or create a new group task.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTasks.map((task) => {
            const committeeMeta = COMMITTEE_LABELS[task.committee] || {
              label: task.committee,
              color: "bg-slate-100 text-slate-700",
            };
            const priorityMeta = PRIORITY_BADGES[task.priority];
            const completedCount = task.checklist.filter((i) => i.completed).length;
            const totalCount = task.checklist.length;
            const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

            return (
              <div
                key={task.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs hover:shadow-xs transition flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar: Committee & Priority */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${committeeMeta.color}`}
                    >
                      {committeeMeta.label}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${priorityMeta.color}`}
                      >
                        {priorityMeta.icon}
                        {priorityMeta.label}
                      </span>
                      <button
                        onClick={() => openEditTask(task)}
                        className="p-1 rounded-md text-slate-400 hover:text-[#0D3594] hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        title="Edit Task & Assignees"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteTask(task.id, task.title)}
                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                        title="Delete Task"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Task Title & Description */}
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-2">
                    {task.title}
                  </h3>
                  {task.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-3">
                      {task.description}
                    </p>
                  )}

                  {/* Due Date & Assignees */}
                  <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px]">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>Due: {task.dueDate}</span>
                    </div>

                    {/* Member Avatars & Quick Assign */}
                    <div className="flex items-center gap-1.5 relative">
                      {task.assignedMemberNames.length > 0 && (
                        <div className="flex items-center -space-x-1.5 overflow-hidden">
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
                                className="w-6 h-6 rounded-full bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 flex items-center justify-center text-[10px] font-bold border-2 border-white dark:border-slate-900"
                              >
                                {initials}
                              </div>
                            );
                          })}
                          {task.assignedMemberNames.length > 3 && (
                            <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 flex items-center justify-center text-[9px] font-bold border-2 border-white dark:border-slate-900">
                              +{task.assignedMemberNames.length - 3}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Quick Assign Button (Notion / Linear style) */}
                      <div className="relative">
                        <button
                          onClick={() => setQuickAssignTaskId(quickAssignTaskId === task.id ? null : task.id)}
                          className="w-6 h-6 rounded-full border border-dashed border-slate-300 dark:border-slate-600 hover:border-[#0D3594] text-slate-400 hover:text-[#0D3594] flex items-center justify-center text-xs transition cursor-pointer"
                          title="Assign or unassign members"
                        >
                          <UserPlus className="w-3 h-3" />
                        </button>

                        {quickAssignTaskId === task.id && (
                          <div className="absolute right-0 top-full mt-1.5 w-56 bg-white dark:bg-[#161B26] border border-[#EDEDF2] dark:border-slate-800 rounded-xl elevation-popover p-2 z-30 space-y-1">
                            <p className="px-2 py-1 text-[10px] font-bold text-[#8E95A5] uppercase tracking-wider">
                              Assign Members
                            </p>
                            <div className="max-h-40 overflow-y-auto space-y-0.5">
                              {members.map((member) => {
                                const isAssigned = (task.assignedMemberIds || []).includes(member.id);
                                return (
                                  <button
                                    key={member.id}
                                    onClick={() => handleQuickAssignToggle(task.id, member.id)}
                                    className={`w-full flex items-center justify-between p-1.5 rounded-lg text-xs transition text-left cursor-pointer ${
                                      isAssigned
                                        ? "bg-blue-50 dark:bg-blue-950/40 text-[#0D3594] dark:text-blue-300 font-semibold"
                                        : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                                    }`}
                                  >
                                    <span className="truncate">{member.name}</span>
                                    {isAssigned && <Check className="w-3 h-3 text-[#17A863] shrink-0" />}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Checklist & To-Do Progress */}
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <CheckSquare className="w-3.5 h-3.5 text-rose-500" />
                        Checklist ({completedCount}/{totalCount})
                      </span>
                      <span className="text-slate-400 font-medium">{progressPercent}%</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          progressPercent === 100 ? "bg-emerald-500" : "bg-rose-500"
                        }`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>

                    {/* Checklist Items */}
                    <div className="space-y-1.5 pt-1 max-h-48 overflow-y-auto pr-1">
                      {task.checklist.map((item) => (
                        <label
                          key={item.id}
                          className="flex items-start gap-2 p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={item.completed}
                            onChange={() => handleToggleItem(task.id, item.id)}
                            className="mt-0.5 w-3.5 h-3.5 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer"
                          />
                          <span
                            className={`flex-1 text-[11px] leading-tight ${
                              item.completed
                                ? "line-through text-slate-400 dark:text-slate-500"
                                : "text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            {item.title}
                          </span>
                        </label>
                      ))}
                    </div>

                    {/* Inline Quick Add Checklist Item */}
                    <div className="flex items-center gap-1 pt-1.5">
                      <input
                        type="text"
                        placeholder="Add to-do item..."
                        value={inlineNewItem[task.id] || ""}
                        onChange={(e) =>
                          setInlineNewItem({ ...inlineNewItem, [task.id]: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddInlineItem(task.id);
                          }
                        }}
                        className="flex-1 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-rose-500"
                      />
                      <button
                        onClick={() => handleAddInlineItem(task.id)}
                        className="px-2 py-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-[10px] font-semibold transition"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>

                {/* Footer: Status Selector */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Status:</span>
                  <select
                    value={task.status}
                    onChange={(e) => handleStatusChange(task.id, e.target.value as TaskStatus)}
                    className={`text-xs font-bold px-2.5 py-1 rounded-lg border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-500 transition ${
                      STATUS_CONFIG[task.status].color
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
          })}
        </div>
      )}

      {/* Modal: Create Group Task */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <CheckSquare className="w-5 h-5" />
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Create Committee Group Task
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateTask} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  placeholder="e.g., Blood Letting Drive Logistics & Refreshments"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Committee / Group *
                  </label>
                  <select
                    name="committee"
                    required
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
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
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Priority *
                  </label>
                  <select
                    name="priority"
                    defaultValue="MEDIUM"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Target Due Date *
                  </label>
                  <input
                    type="date"
                    name="dueDate"
                    required
                    defaultValue={new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description & Deliverables
                </label>
                <textarea
                  name="description"
                  rows={2}
                  placeholder="Outline key objectives, expectations, and deliverables..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
                />
              </div>

              {/* Assign Members Multi-select */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Assign Members from Club Roster ({selectedAssignees.length} selected)
                </label>
                <div className="max-h-36 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl p-2 bg-slate-50 dark:bg-slate-800/50 space-y-1">
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
                              setSelectedAssignees([...selectedAssignees, member.id]);
                            } else {
                              setSelectedAssignees(selectedAssignees.filter((id) => id !== member.id));
                            }
                          }}
                          className="w-3.5 h-3.5 text-rose-600 rounded border-slate-300 focus:ring-rose-500"
                        />
                        <div className="flex-1 flex items-center justify-between">
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {member.name}
                          </span>
                          <span className="text-[10px] text-slate-400">
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
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Checklist & To-Do Items ({formChecklist.length})
                </label>
                <div className="space-y-1.5 mb-2">
                  {formChecklist.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                    >
                      <span className="text-slate-800 dark:text-slate-200">• {item}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveModalChecklistItem(idx)}
                        className="text-slate-400 hover:text-rose-500 text-xs font-bold"
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
                    className="flex-1 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddModalChecklistItem}
                    className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-xs font-semibold text-slate-800 dark:text-slate-200 transition"
                  >
                    Add Item
                  </button>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition shadow-sm"
                >
                  Create Group Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Task & Assignees Modal (Notion / Linear Style) */}
      {editingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl bg-white dark:bg-[#111622] rounded-2xl border border-[#EDEDF2] dark:border-slate-800 elevation-popover max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#EDEDF2] dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <span className="p-1.5 rounded-lg bg-[#E2EBFF] text-[#2563EB]">
                  <Edit2 className="w-4 h-4" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-[#111625] dark:text-white">
                    Edit Task & Assignees
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
            <form onSubmit={handleSaveEditTask} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#111625] dark:text-slate-300 mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-[#EDEDF2] dark:border-slate-700 text-[#111625] dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#0D3594]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-semibold text-[#111625] dark:text-slate-300 mb-1">
                    Committee *
                  </label>
                  <select
                    value={editCommittee}
                    onChange={(e) => setEditCommittee(e.target.value as TaskCommittee)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-[#EDEDF2] dark:border-slate-700 text-[#111625] dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#0D3594]"
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
                  <label className="block font-semibold text-[#111625] dark:text-slate-300 mb-1">
                    Priority *
                  </label>
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value as TaskPriority)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-[#EDEDF2] dark:border-slate-700 text-[#111625] dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#0D3594]"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#111625] dark:text-slate-300 mb-1">
                    Status *
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as TaskStatus)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-[#EDEDF2] dark:border-slate-700 text-[#111625] dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#0D3594]"
                  >
                    <option value="TODO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="IN_REVIEW">In Review</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#111625] dark:text-slate-300 mb-1">
                    Target Due Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-[#EDEDF2] dark:border-slate-700 text-[#111625] dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#0D3594]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#111625] dark:text-slate-300 mb-1">
                  Description & Deliverables
                </label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-[#EDEDF2] dark:border-slate-700 text-[#111625] dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#0D3594] resize-none"
                />
              </div>

              {/* Assign Members Section (Notion / Linear style) */}
              <div>
                <label className="block font-semibold text-[#111625] dark:text-slate-300 mb-1">
                  Assigned Members ({editAssignees.length})
                </label>

                {/* Selected Member Chips */}
                {editAssignees.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {editAssignees.map((id) => {
                      const member = members.find((m) => m.id === id);
                      if (!member) return null;
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-[#0D3594] dark:text-blue-300 border border-blue-200/50 text-xs font-medium"
                        >
                          <span className="w-4 h-4 rounded-full bg-[#0D3594] text-white flex items-center justify-center text-[9px] font-bold">
                            {member.name.charAt(0)}
                          </span>
                          <span>{member.name}</span>
                          <button
                            type="button"
                            onClick={() => setEditAssignees(editAssignees.filter((memId) => memId !== id))}
                            className="hover:text-red-600 transition"
                          >
                            ✕
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Member Roster Checklist to Add/Remove */}
                <div className="max-h-36 overflow-y-auto border border-[#EDEDF2] dark:border-slate-700 rounded-xl p-2 bg-slate-50 dark:bg-slate-800/50 space-y-1">
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
                              setEditAssignees(editAssignees.filter((id) => id !== member.id));
                            }
                          }}
                          className="w-3.5 h-3.5 text-[#0D3594] rounded border-slate-300 focus:ring-[#0D3594]"
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
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#EDEDF2] dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingTask(null)}
                  className="px-4 py-2 rounded-xl border border-[#EDEDF2] dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-xl bg-[#0D3594] hover:bg-[#092569] text-white font-semibold text-xs transition shadow-xs cursor-pointer disabled:opacity-50"
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
