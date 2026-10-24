"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Calendar as CalendarIcon,
  CheckSquare,
  Clock,
  MapPin,
  Users,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Filter,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  X,
  ExternalLink,
  Layers,
  Tag,
  ShieldAlert,
  FolderKanban,
  Printer,
  ChevronDown,
} from "lucide-react";
import { EventDTO } from "@/features/events/queries";
import { GroupTaskDTO } from "@/lib/data/tasks-storage";

// ==========================================
// Types
// ==========================================

export type CalendarViewMode = "MONTH" | "WEEK" | "AGENDA";
export type CalendarTypeFilter = "ALL" | "EVENTS" | "TASKS";

export interface UnifiedCalendarItem {
  id: string;
  type: "EVENT" | "TASK";
  title: string;
  dateKey: string; // YYYY-MM-DD
  timeDisplay: string;
  categoryOrCommittee: string;
  status: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  location?: string;
  volunteerHours?: number;
  attendeesCount?: number;
  assignees?: string[];
  checklistCount?: { completed: number; total: number };
  description?: string;
  rawEvent?: EventDTO;
  rawTask?: GroupTaskDTO;
}

interface CalendarClientProps {
  initialEvents: EventDTO[];
  initialTasks: GroupTaskDTO[];
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarClient({ initialEvents, initialTasks }: CalendarClientProps) {
  // Navigation & View state
  const [viewMode, setViewMode] = useState<CalendarViewMode>("MONTH");
  const [typeFilter, setTypeFilter] = useState<CalendarTypeFilter>("ALL");
  const [selectedCommittee, setSelectedCommittee] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Current calendar viewing date (defaults to active term / current date)
  const [viewDate, setViewDate] = useState(() => {
    // If today is in 2026, use today; otherwise default to Nov 2026 for rich demo data
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Selected item for modal details
  const [activeItem, setActiveItem] = useState<UnifiedCalendarItem | null>(null);

  // Selected day for mobile or "+X more" popover
  const [expandedDayKey, setExpandedDayKey] = useState<string | null>(null);

  // Normalize all Events & Tasks into Unified Items
  const allUnifiedItems = useMemo<UnifiedCalendarItem[]>(() => {
    const items: UnifiedCalendarItem[] = [];

    // 1. Process Events
    initialEvents.forEach((ev) => {
      let dateKey = "";
      let timeDisplay = "TBA";
      try {
        const d = new Date(ev.startTime);
        dateKey = d.toISOString().substring(0, 10);
        timeDisplay = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      } catch {
        dateKey = ev.startTime.substring(0, 10);
      }

      items.push({
        id: `event-${ev.id}`,
        type: "EVENT",
        title: ev.title,
        dateKey,
        timeDisplay,
        categoryOrCommittee: ev.category,
        status: "SCHEDULED",
        location: ev.location,
        volunteerHours: ev.volunteerHours,
        attendeesCount: ev.attendeesCount,
        description: ev.description,
        rawEvent: ev,
      });
    });

    // 2. Process Tasks
    initialTasks.forEach((task) => {
      let dateKey = "";
      try {
        dateKey = task.dueDate.substring(0, 10);
      } catch {
        dateKey = task.dueDate;
      }

      const totalChecklist = task.checklist?.length || 0;
      const completedChecklist = task.checklist?.filter((c) => c.completed).length || 0;

      items.push({
        id: `task-${task.id}`,
        type: "TASK",
        title: task.title,
        dateKey,
        timeDisplay: `Due: ${dateKey}`,
        categoryOrCommittee: task.committee.replace(/_/g, " "),
        status: task.status,
        priority: task.priority,
        assignees: task.assignedMemberNames || [],
        checklistCount: totalChecklist > 0 ? { completed: completedChecklist, total: totalChecklist } : undefined,
        description: task.description,
        rawTask: task,
      });
    });

    return items;
  }, [initialEvents, initialTasks]);

  // Filter items
  const filteredItems = useMemo(() => {
    return allUnifiedItems.filter((item) => {
      // Type filter
      if (typeFilter === "EVENTS" && item.type !== "EVENT") return false;
      if (typeFilter === "TASKS" && item.type !== "TASK") return false;

      // Committee filter
      if (selectedCommittee !== "ALL") {
        const c1 = item.categoryOrCommittee.toUpperCase();
        const c2 = selectedCommittee.toUpperCase();
        if (!c1.includes(c2) && !c2.includes(c1)) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchDesc = item.description?.toLowerCase().includes(q) || false;
        const matchLoc = item.location?.toLowerCase().includes(q) || false;
        const matchAssignee = item.assignees?.some((a) => a.toLowerCase().includes(q)) || false;
        return matchTitle || matchDesc || matchLoc || matchAssignee;
      }

      return true;
    });
  }, [allUnifiedItems, typeFilter, selectedCommittee, searchQuery]);

  // Month Grid Calculation
  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth();

  const monthGridDays = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const prevMonthDaysCount = new Date(currentYear, currentMonth, 0).getDate();

    const days: {
      date: Date;
      dateKey: string;
      isCurrentMonth: boolean;
      dayNumber: number;
    }[] = [];

    // Leading padding days from previous month
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevMonthDaysCount - i;
      const dateObj = new Date(currentYear, currentMonth - 1, d);
      const dateKey = dateObj.toISOString().substring(0, 10);
      days.push({
        date: dateObj,
        dateKey,
        isCurrentMonth: false,
        dayNumber: d,
      });
    }

    // Current month days
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const dateObj = new Date(currentYear, currentMonth, d);
      // Construct dateKey with padding
      const mm = String(currentMonth + 1).padStart(2, "0");
      const dd = String(d).padStart(2, "0");
      const dateKey = `${currentYear}-${mm}-${dd}`;
      days.push({
        date: dateObj,
        dateKey,
        isCurrentMonth: true,
        dayNumber: d,
      });
    }

    // Trailing padding days to fill 5 or 6 weeks (multiples of 7)
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const dateObj = new Date(currentYear, currentMonth + 1, i);
      const mm = String(currentMonth + 2 > 12 ? 1 : currentMonth + 2).padStart(2, "0");
      const dd = String(i).padStart(2, "0");
      const y = currentMonth + 1 >= 12 ? currentYear + 1 : currentYear;
      const dateKey = `${y}-${mm}-${dd}`;
      days.push({
        date: dateObj,
        dateKey,
        isCurrentMonth: false,
        dayNumber: i,
      });
    }

    return days;
  }, [currentYear, currentMonth]);

  // Today key
  const todayKey = useMemo(() => {
    const t = new Date();
    const mm = String(t.getMonth() + 1).padStart(2, "0");
    const dd = String(t.getDate()).padStart(2, "0");
    return `${t.getFullYear()}-${mm}-${dd}`;
  }, []);

  // Items grouped by dateKey
  const itemsByDateKey = useMemo(() => {
    const map = new Map<string, UnifiedCalendarItem[]>();
    filteredItems.forEach((item) => {
      const existing = map.get(item.dateKey) || [];
      existing.push(item);
      map.set(item.dateKey, existing);
    });
    return map;
  }, [filteredItems]);

  // Top KPI metrics for current visible month
  const monthlyStats = useMemo(() => {
    const prefix = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
    const thisMonthItems = filteredItems.filter((i) => i.dateKey.startsWith(prefix));

    const eventsCount = thisMonthItems.filter((i) => i.type === "EVENT").length;
    const tasksCount = thisMonthItems.filter((i) => i.type === "TASK").length;
    const urgentTasks = thisMonthItems.filter(
      (i) => i.type === "TASK" && (i.priority === "URGENT" || i.priority === "HIGH") && i.status !== "COMPLETED"
    ).length;
    const totalHours = thisMonthItems
      .filter((i) => i.type === "EVENT")
      .reduce((acc, curr) => acc + (curr.volunteerHours || 0), 0);

    return {
      total: thisMonthItems.length,
      eventsCount,
      tasksCount,
      urgentTasks,
      totalHours,
    };
  }, [filteredItems, currentYear, currentMonth]);

  // Navigation handlers
  function handlePrev() {
    if (viewMode === "WEEK") {
      setViewDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7));
    } else {
      setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    }
  }

  function handleNext() {
    if (viewMode === "WEEK") {
      setViewDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7));
    } else {
      setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    }
  }

  function handleToday() {
    const now = new Date();
    setViewDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  }

  return (
    <div className="space-y-6 select-none max-w-7xl mx-auto pb-16">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#E2EBFF] text-[#0D3594] dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/40 mb-2">
            <CalendarDays className="w-3.5 h-3.5" />
            <span>District 3820 Unified Activity & Milestone Radar</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[#111625] dark:text-white">
            Operations Master Calendar
          </h1>
          <p className="text-xs text-[#8E95A5] mt-1">
            Real-time monitoring across club events, service projects, and committee task deliverables
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2.5">
          <Link
            href="/events"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800 text-xs font-semibold text-[#111625] dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs cursor-pointer"
          >
            <CalendarIcon className="w-3.5 h-3.5 text-[#17A863]" />
            <span>New Event</span>
          </Link>
          <Link
            href="/tasks"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0D3594] hover:bg-[#092569] text-white text-xs font-semibold transition shadow-xs cursor-pointer"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>New Task</span>
          </Link>
        </div>
      </div>

      {/* 2. Top KPI Telemetry Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Activities */}
        <div className="bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#8E95A5] uppercase tracking-wider">
              Scheduled ({MONTH_NAMES[currentMonth]})
            </span>
            <div className="w-7 h-7 rounded-xl bg-[#E2EBFF] text-[#0D3594] flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#111625] dark:text-white">
              {monthlyStats.total}
            </span>
            <span className="text-xs text-[#8E95A5]">total milestones</span>
          </div>
          <div className="mt-2 text-[11px] text-[#6B7280] dark:text-slate-400">
            {monthlyStats.eventsCount} events · {monthlyStats.tasksCount} task deliverables
          </div>
        </div>

        {/* Card 2: Events & Projects */}
        <div className="bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#8E95A5] uppercase tracking-wider">
              Club Events
            </span>
            <div className="w-7 h-7 rounded-xl bg-[#E7F8F0] text-[#17A863] flex items-center justify-center">
              <CalendarIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#111625] dark:text-white">
              {monthlyStats.eventsCount}
            </span>
            <span className="text-xs text-[#17A863] font-semibold">
              {monthlyStats.totalHours} volunteer hrs
            </span>
          </div>
          <div className="mt-2 text-[11px] text-[#6B7280] dark:text-slate-400">
            Rolling QR check-in & GA sessions
          </div>
        </div>

        {/* Card 3: Committee Tasks */}
        <div className="bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#8E95A5] uppercase tracking-wider">
              Task Deliverables
            </span>
            <div className="w-7 h-7 rounded-xl bg-[#F4EDFE] text-[#8244E8] flex items-center justify-center">
              <CheckSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#111625] dark:text-white">
              {monthlyStats.tasksCount}
            </span>
            <span className="text-xs text-[#8E95A5]">deadlines active</span>
          </div>
          <div className="mt-2 text-[11px] text-[#6B7280] dark:text-slate-400">
            Assigned to club committees
          </div>
        </div>

        {/* Card 4: Urgent & Critical Attention */}
        <div className="bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#8E95A5] uppercase tracking-wider">
              Critical Attention
            </span>
            <div className="w-7 h-7 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-600 dark:text-rose-400">
              {monthlyStats.urgentTasks}
            </span>
            <span className="text-xs text-[#8E95A5]">high/urgent</span>
          </div>
          <div className="mt-2 text-[11px] text-[#6B7280] dark:text-slate-400">
            Immediate officer deliverables
          </div>
        </div>
      </div>

      {/* 3. Navigation Bar & Filter Controls */}
      <div className="bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800/80 rounded-2xl p-4 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Date Selector Month & Nav */}
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-xl border border-[#EDEDF2] dark:border-slate-800 p-0.5 bg-slate-50 dark:bg-[#161B26]">
              <button
                onClick={handlePrev}
                className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleToday}
                className="px-3 py-1 rounded-lg text-xs font-bold text-[#0D3594] dark:text-blue-400 hover:bg-white dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Today
              </button>
              <button
                onClick={handleNext}
                className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <h2 className="text-base md:text-lg font-black text-[#111625] dark:text-white tracking-tight">
                {MONTH_NAMES[currentMonth]} {currentYear}
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                Rotary Year 2026-27
              </span>
            </div>
          </div>

          {/* View Modes (Month / Week / Agenda) */}
          <div className="flex items-center gap-2">
            <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-[#161B26] border border-[#EDEDF2] dark:border-slate-800">
              <button
                onClick={() => setViewMode("MONTH")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewMode === "MONTH"
                    ? "bg-white dark:bg-slate-800 text-[#111625] dark:text-white shadow-xs"
                    : "text-[#6B7280] dark:text-slate-400 hover:text-[#111625] dark:hover:text-white"
                }`}
              >
                Month Grid
              </button>
              <button
                onClick={() => setViewMode("WEEK")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewMode === "WEEK"
                    ? "bg-white dark:bg-slate-800 text-[#111625] dark:text-white shadow-xs"
                    : "text-[#6B7280] dark:text-slate-400 hover:text-[#111625] dark:hover:text-white"
                }`}
              >
                Week View
              </button>
              <button
                onClick={() => setViewMode("AGENDA")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewMode === "AGENDA"
                    ? "bg-white dark:bg-slate-800 text-[#111625] dark:text-white shadow-xs"
                    : "text-[#6B7280] dark:text-slate-400 hover:text-[#111625] dark:hover:text-white"
                }`}
              >
                Agenda List
              </button>
            </div>
          </div>
        </div>

        {/* Filter Bar Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
          {/* Type Filter Pills */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-[#8E95A5] mr-1">Show:</span>
            <button
              onClick={() => setTypeFilter("ALL")}
              className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                typeFilter === "ALL"
                  ? "bg-[#0D3594] text-white shadow-xs"
                  : "bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              All ({filteredItems.length})
            </button>
            <button
              onClick={() => setTypeFilter("EVENTS")}
              className={`px-2.5 py-1 rounded-lg font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                typeFilter === "EVENTS"
                  ? "bg-[#17A863] text-white shadow-xs"
                  : "bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#17A863]" />
              <span>Events Only</span>
            </button>
            <button
              onClick={() => setTypeFilter("TASKS")}
              className={`px-2.5 py-1 rounded-lg font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                typeFilter === "TASKS"
                  ? "bg-[#8244E8] text-white shadow-xs"
                  : "bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#8244E8]" />
              <span>Tasks Only</span>
            </button>
          </div>

          {/* Search Input & Committee Select */}
          <div className="flex items-center gap-2">
            <div className="relative w-48 sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search event, task, venue..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-[#EDEDF2] dark:border-slate-800 bg-white dark:bg-[#161B26] text-xs text-[#111625] dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-[#0D3594]"
              />
            </div>

            <select
              value={selectedCommittee}
              onChange={(e) => setSelectedCommittee(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-[#EDEDF2] dark:border-slate-800 bg-white dark:bg-[#161B26] text-xs text-slate-700 dark:text-slate-300 focus:outline-hidden"
            >
              <option value="ALL">All Committees</option>
              <option value="COMMUNITY_SERVICE">Community Service</option>
              <option value="CLUB_ADMINISTRATION">Club Administration</option>
              <option value="PROFESSIONAL_DEVELOPMENT">Professional Dev</option>
              <option value="PUBLIC_IMAGE">Public Image</option>
              <option value="INTERNATIONAL_SERVICE">International Service</option>
              <option value="FINANCE">Finance</option>
            </select>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* VIEW 1: CLASSIC MONTH GRID VIEW                          */}
      {/* ======================================================== */}
      {viewMode === "MONTH" && (
        <div className="bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-xs">
          {/* Day Headers (Sun-Sat) */}
          <div className="grid grid-cols-7 border-b border-[#EDEDF2] dark:border-slate-800 bg-slate-50 dark:bg-[#161B26]">
            {DAY_NAMES.map((name, i) => (
              <div
                key={name}
                className={`py-2.5 text-center text-xs font-bold uppercase tracking-wider ${
                  i === 0 || i === 6 ? "text-slate-400 dark:text-slate-500" : "text-[#111625] dark:text-white"
                }`}
              >
                {name}
              </div>
            ))}
          </div>

          {/* Month Days 7xN Grid */}
          <div className="grid grid-cols-7 divide-x divide-y divide-[#EDEDF2] dark:divide-slate-800/80">
            {monthGridDays.map((cell) => {
              const isToday = cell.dateKey === todayKey;
              const items = itemsByDateKey.get(cell.dateKey) || [];
              const maxDisplay = 3;
              const overflow = items.length - maxDisplay;

              return (
                <div
                  key={cell.dateKey}
                  className={`min-h-[125px] p-2 flex flex-col justify-between transition ${
                    cell.isCurrentMonth
                      ? "bg-white dark:bg-[#111622]"
                      : "bg-slate-50/60 dark:bg-slate-900/40 text-slate-400"
                  } ${isToday ? "ring-2 ring-[#0D3594] ring-inset bg-blue-50/20" : ""}`}
                >
                  {/* Cell Top Header (Date Number & Indicators) */}
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                        isToday
                          ? "bg-[#0D3594] text-white shadow-xs"
                          : cell.isCurrentMonth
                          ? "text-[#111625] dark:text-white"
                          : "text-slate-400"
                      }`}
                    >
                      {cell.dayNumber}
                    </span>

                    {isToday && (
                      <span className="text-[9px] font-black uppercase text-[#0D3594] bg-[#E2EBFF] px-1.5 py-0.5 rounded-md">
                        Today
                      </span>
                    )}

                    {items.length > 0 && !isToday && (
                      <span className="text-[10px] font-semibold text-[#8E95A5]">
                        {items.length} item{items.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  {/* Cell Items List */}
                  <div className="space-y-1 flex-1 overflow-hidden">
                    {items.slice(0, maxDisplay).map((item) => {
                      const isEvent = item.type === "EVENT";
                      return (
                        <button
                          key={item.id}
                          onClick={() => setActiveItem(item)}
                          className={`w-full text-left px-2 py-1 rounded-lg text-[11px] font-semibold truncate transition flex items-center gap-1.5 cursor-pointer ${
                            isEvent
                              ? "bg-[#E7F8F0] text-[#17A863] dark:bg-emerald-950/60 dark:text-emerald-300 border border-[#17A863]/20 hover:brightness-95"
                              : "bg-[#E2EBFF] text-[#0D3594] dark:bg-blue-950/60 dark:text-blue-300 border border-[#0D3594]/20 hover:brightness-95"
                          }`}
                          title={`${item.title} (${item.timeDisplay})`}
                        >
                          {isEvent ? (
                            <Clock className="w-3 h-3 shrink-0" />
                          ) : (
                            <CheckSquare className="w-3 h-3 shrink-0 text-[#8244E8]" />
                          )}
                          <span className="truncate">{item.title}</span>
                        </button>
                      );
                    })}

                    {overflow > 0 && (
                      <button
                        onClick={() => setExpandedDayKey(cell.dateKey)}
                        className="text-[10px] font-bold text-[#0D3594] dark:text-blue-400 hover:underline px-1 block cursor-pointer"
                      >
                        +{overflow} more items...
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW 2: 7-DAY TACTICAL WEEK VIEW                         */}
      {/* ======================================================== */}
      {viewMode === "WEEK" && (
        <div className="bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800/80 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-[#111625] dark:text-white">
                Tactical Sprint Week Monitoring
              </h3>
              <p className="text-xs text-[#8E95A5]">
                Hourly deliverables, scheduled check-ins, and committee milestones
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#E2EBFF] text-[#0D3594]">
              Active 7-Day Sprint
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {monthGridDays.slice(0, 7).map((dayCol) => {
              const isToday = dayCol.dateKey === todayKey;
              const items = itemsByDateKey.get(dayCol.dateKey) || [];

              return (
                <div
                  key={dayCol.dateKey}
                  className={`rounded-2xl p-3 border flex flex-col justify-between ${
                    isToday
                      ? "border-[#0D3594] bg-blue-50/20 dark:bg-blue-950/20"
                      : "border-[#EDEDF2] dark:border-slate-800 bg-slate-50/50 dark:bg-[#161B26]"
                  }`}
                >
                  <div className="pb-2 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-[#8E95A5] uppercase">
                        {DAY_NAMES[dayCol.date.getDay()]}
                      </p>
                      <p className="text-sm font-extrabold text-[#111625] dark:text-white">
                        {dayCol.date.getDate()} {MONTH_NAMES[dayCol.date.getMonth()].substring(0, 3)}
                      </p>
                    </div>
                    {isToday && (
                      <span className="w-2 h-2 rounded-full bg-[#0D3594] ring-4 ring-blue-100" />
                    )}
                  </div>

                  <div className="mt-3 space-y-2 flex-1 min-h-[220px]">
                    {items.length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic text-center pt-8">
                        No items scheduled
                      </p>
                    ) : (
                      items.map((it) => (
                        <div
                          key={it.id}
                          onClick={() => setActiveItem(it)}
                          className="p-2.5 rounded-xl bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800/80 shadow-xs hover:border-[#0D3594] transition cursor-pointer space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-[10px]">
                            <span
                              className={`font-bold px-1.5 py-0.5 rounded-md ${
                                it.type === "EVENT"
                                  ? "bg-[#E7F8F0] text-[#17A863]"
                                  : "bg-[#F4EDFE] text-[#8244E8]"
                              }`}
                            >
                              {it.type}
                            </span>
                            <span className="text-[#8E95A5] truncate">{it.timeDisplay}</span>
                          </div>
                          <h4 className="text-xs font-bold text-[#111625] dark:text-white line-clamp-2">
                            {it.title}
                          </h4>
                          {it.location && (
                            <p className="text-[10px] text-[#8E95A5] truncate flex items-center gap-1">
                              <MapPin className="w-3 h-3 shrink-0" />
                              <span>{it.location}</span>
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW 3: CHRONOLOGICAL AGENDA LIST VIEW                   */}
      {/* ======================================================== */}
      {viewMode === "AGENDA" && (
        <div className="bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800/80 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-[#111625] dark:text-white">
                Chronological Operations Timeline
              </h3>
              <p className="text-xs text-[#8E95A5]">
                Continuous monitoring of upcoming dates, deliverables, and service activities
              </p>
            </div>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#EDEDF2] dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Agenda</span>
            </button>
          </div>

          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#8E95A5]">
              No activities or tasks match your current filter criteria.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredItems
                .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
                .map((item) => {
                  const isEvent = item.type === "EVENT";
                  const isOverdue = item.dateKey < todayKey && item.status !== "COMPLETED";

                  return (
                    <div
                      key={item.id}
                      onClick={() => setActiveItem(item)}
                      className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 p-3 rounded-2xl transition cursor-pointer"
                    >
                      {/* Left side: Date Badge & Title */}
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div
                          className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center font-bold shrink-0 ${
                            isEvent
                              ? "bg-[#E7F8F0] text-[#17A863] border border-[#17A863]/20"
                              : "bg-[#E2EBFF] text-[#0D3594] border border-[#0D3594]/20"
                          }`}
                        >
                          <span className="text-[10px] uppercase">
                            {item.dateKey.substring(5, 7)}
                          </span>
                          <span className="text-base font-extrabold leading-none">
                            {item.dateKey.substring(8, 10)}
                          </span>
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isEvent
                                  ? "bg-[#E7F8F0] text-[#17A863]"
                                  : "bg-[#F4EDFE] text-[#8244E8]"
                              }`}
                            >
                              {item.type}
                            </span>
                            <span className="text-[11px] font-mono text-[#8E95A5]">
                              {item.timeDisplay}
                            </span>
                            {isOverdue && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-600 border border-rose-200">
                                Overdue
                              </span>
                            )}
                            <span className="text-[11px] font-semibold text-[#8E95A5]">
                              · {item.categoryOrCommittee}
                            </span>
                          </div>

                          <h4 className="text-sm font-bold text-[#111625] dark:text-white mt-1 truncate">
                            {item.title}
                          </h4>

                          {item.description && (
                            <p className="text-xs text-[#6B7280] dark:text-slate-400 line-clamp-1 mt-0.5">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right side: Metadata Badges & Open Action */}
                      <div className="flex items-center gap-3 shrink-0">
                        {item.location && (
                          <div className="hidden sm:flex items-center gap-1 text-xs text-[#8E95A5]">
                            <MapPin className="w-3.5 h-3.5" />
                            <span className="truncate max-w-[140px]">{item.location}</span>
                          </div>
                        )}

                        {item.volunteerHours && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {item.volunteerHours} hrs
                          </span>
                        )}

                        {item.assignees && item.assignees.length > 0 && (
                          <div className="flex items-center -space-x-1">
                            {item.assignees.slice(0, 3).map((name, i) => (
                              <div
                                key={i}
                                className="w-6 h-6 rounded-full bg-[#0D3594] text-white flex items-center justify-center text-[10px] font-bold border-2 border-white dark:border-slate-900"
                                title={name}
                              >
                                {name.charAt(0)}
                              </div>
                            ))}
                          </div>
                        )}

                        <span className="text-xs font-bold text-[#0D3594] dark:text-blue-400 flex items-center gap-1 group-hover:translate-x-1 transition">
                          <span>Details</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. MODAL: DETAILED EVENT / TASK INSPECTOR                */}
      {/* ======================================================== */}
      {activeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setActiveItem(null)}
          />
          <div className="relative w-full max-w-lg bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800 rounded-2xl elevation-popover p-6 z-10 space-y-5">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    activeItem.type === "EVENT"
                      ? "bg-[#E7F8F0] text-[#17A863]"
                      : "bg-[#E2EBFF] text-[#0D3594]"
                  }`}
                >
                  {activeItem.type === "EVENT" ? (
                    <CalendarIcon className="w-5 h-5" />
                  ) : (
                    <CheckSquare className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        activeItem.type === "EVENT"
                          ? "bg-[#E7F8F0] text-[#17A863]"
                          : "bg-[#F4EDFE] text-[#8244E8]"
                      }`}
                    >
                      {activeItem.type}
                    </span>
                    <span className="text-[11px] font-semibold text-[#8E95A5]">
                      {activeItem.categoryOrCommittee}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-[#111625] dark:text-white mt-1">
                    {activeItem.title}
                  </h3>
                </div>
              </div>

              <button
                onClick={() => setActiveItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Metadata Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-1">
                <span className="text-[10px] font-bold text-[#8E95A5] uppercase">Scheduled Date</span>
                <p className="font-bold text-[#111625] dark:text-white">{activeItem.dateKey}</p>
                <span className="text-[11px] text-[#0D3594] font-semibold">
                  {activeItem.timeDisplay}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-1">
                <span className="text-[10px] font-bold text-[#8E95A5] uppercase">
                  {activeItem.type === "EVENT" ? "Volunteer Credits" : "Priority Level"}
                </span>
                <p className="font-bold text-[#111625] dark:text-white">
                  {activeItem.type === "EVENT"
                    ? `${activeItem.volunteerHours || 3} Volunteer Hours`
                    : activeItem.priority || "MEDIUM"}
                </p>
                <span className="text-[11px] text-[#17A863] font-semibold">
                  {activeItem.type === "EVENT"
                    ? `${activeItem.attendeesCount || 0} Registered Attendees`
                    : `Status: ${activeItem.status}`}
                </span>
              </div>
            </div>

            {/* Location (for Events) */}
            {activeItem.location && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-xs">
                <MapPin className="w-4 h-4 text-[#0D3594] shrink-0" />
                <div>
                  <span className="text-[10px] font-bold text-[#8E95A5] uppercase block">
                    Venue / Meeting Location
                  </span>
                  <span className="font-semibold text-[#111625] dark:text-white">
                    {activeItem.location}
                  </span>
                </div>
              </div>
            )}

            {/* Description */}
            {activeItem.description && (
              <div>
                <span className="text-[11px] font-bold text-[#8E95A5] uppercase block mb-1">
                  Deliverable Scope & Brief
                </span>
                <p className="text-xs text-[#374151] dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-900 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
                  {activeItem.description}
                </p>
              </div>
            )}

            {/* Assignees (for Tasks) */}
            {activeItem.assignees && activeItem.assignees.length > 0 && (
              <div>
                <span className="text-[11px] font-bold text-[#8E95A5] uppercase block mb-1.5">
                  Assigned Committee Officers
                </span>
                <div className="flex flex-wrap gap-2">
                  {activeItem.assignees.map((name, i) => (
                    <div
                      key={i}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-[#111625] dark:text-white"
                    >
                      <div className="w-5 h-5 rounded-full bg-[#0D3594] text-white flex items-center justify-center text-[10px] font-bold">
                        {name.charAt(0)}
                      </div>
                      <span>{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setActiveItem(null)}
                className="px-4 py-2 rounded-xl border border-[#EDEDF2] dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Close
              </button>

              <Link
                href={activeItem.type === "EVENT" ? "/events" : "/tasks"}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0D3594] hover:bg-[#092569] text-white text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                <span>{activeItem.type === "EVENT" ? "Go to Events Center" : "Go to Task Center"}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Day Overflow Popover Modal */}
      {expandedDayKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
            onClick={() => setExpandedDayKey(null)}
          />
          <div className="relative w-full max-w-md bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800 rounded-2xl elevation-popover p-6 z-10 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-[#111625] dark:text-white">
                Scheduled for {expandedDayKey}
              </h3>
              <button
                onClick={() => setExpandedDayKey(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {(itemsByDateKey.get(expandedDayKey) || []).map((it) => (
                <div
                  key={it.id}
                  onClick={() => {
                    setExpandedDayKey(null);
                    setActiveItem(it);
                  }}
                  className="p-3 rounded-xl border border-[#EDEDF2] dark:border-slate-800 hover:border-[#0D3594] transition cursor-pointer flex items-center justify-between"
                >
                  <div className="min-w-0 pr-2">
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                        it.type === "EVENT" ? "bg-[#E7F8F0] text-[#17A863]" : "bg-[#F4EDFE] text-[#8244E8]"
                      }`}
                    >
                      {it.type}
                    </span>
                    <h4 className="text-xs font-bold text-[#111625] dark:text-white truncate mt-1">
                      {it.title}
                    </h4>
                  </div>
                  <span className="text-[11px] text-[#8E95A5] shrink-0 font-mono">
                    {it.timeDisplay}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
