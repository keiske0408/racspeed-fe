"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Calendar,
  Clock,
  PiggyBank,
  AlertTriangle,
  FolderKanban,
  FileText,
  ArrowUpRight,
  ChevronDown,
  Phone,
  Check,
  MoreHorizontal,
  Info,
  ExternalLink,
  ShieldCheck,
  UserPlus,
  Receipt,
  QrCode,
  Sparkles,
} from "lucide-react";
import { formatPHP } from "@/lib/utils/money";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

export interface DashboardMetrics {
  activeMembers: number;
  pendingApprovals: number;
  volunteerHours: number;
  upcomingEvents: number;
  fundsRaisedCentavos: number;
  reportsUnderReview: number;
  retentionAlerts: number;
}

export interface DashboardClientProps {
  user: { fullName?: string | null; email?: string | null } | null;
  metrics: DashboardMetrics;
}

// Monthly Service Hours & Assembly Attendance Trend
const IMPACT_CHART_DATA = [
  { month: "March", hours: 24, attendees: 18 },
  { month: "April", hours: 36, attendees: 22 },
  { month: "May", hours: 55, attendees: 28 },
  { month: "June", hours: 42, attendees: 25 },
  { month: "July", hours: 68, attendees: 32 },
  { month: "August", hours: 85, attendees: 38 },
];

// Recruitment Channels Donut
const CHANNELS_DATA = [
  { name: "Campus Caravan", value: 45, color: "#4F75FF" },
  { name: "Official Facebook Page", value: 30, color: "#7D9DFF" },
  { name: "Alumni & Referrals", value: 15, color: "#A4B8F9" },
  { name: "Sister Club Partners", value: 10, color: "#C5D2FB" },
];

export function DashboardClient({ user, metrics }: DashboardClientProps) {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"operations" | "recruitment">("operations");
  const [timeRange, setTimeRange] = useState<"ry" | "30d" | "7d">("ry");
  const [completedActivities, setCompletedActivities] = useState<Record<string, boolean>>({});
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  function toggleComplete(id: string) {
    setCompletedActivities((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
    setActiveMenuId(null);
  }

  const totalCandidates = metrics.activeMembers + metrics.pendingApprovals + 12;

  return (
    <div className="space-y-6 pb-12 select-none">
      {/* 1. Header Toolbar (Clean, functional, and zero duplicate buttons) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111625] dark:text-white">
            Club Operations Dashboard
          </h1>
          <p className="mt-1 text-xs text-[#8E95A5]">
            Rotaract San Pedro East · District 3820 · Real-time service impact, membership pipeline & compliance
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Segmented Perspective Switcher */}
          <div className="inline-flex p-1 rounded-xl bg-slate-200/60 dark:bg-slate-800/60 border border-[#EDEDF2] dark:border-slate-800 text-xs font-semibold">
            <button
              onClick={() => setActiveTab("operations")}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                activeTab === "operations"
                  ? "bg-white dark:bg-[#161B26] text-[#111625] dark:text-white shadow-xs"
                  : "text-[#6B7280] dark:text-slate-400 hover:text-[#111625] dark:hover:text-white"
              }`}
            >
              Operations & Impact
            </button>
            <button
              onClick={() => setActiveTab("recruitment")}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                activeTab === "recruitment"
                  ? "bg-white dark:bg-[#161B26] text-[#111625] dark:text-white shadow-xs"
                  : "text-[#6B7280] dark:text-slate-400 hover:text-[#111625] dark:hover:text-white"
              }`}
            >
              Recruitment Pipeline
            </button>
          </div>

          <Link
            href="/resources"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#EDEDF2] dark:border-slate-800 text-xs font-semibold text-[#111625] dark:text-white bg-white dark:bg-[#111622] hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs"
          >
            <ExternalLink className="w-3.5 h-3.5 text-[#0D3594]" />
            <span>Links Hub</span>
          </Link>
        </div>
      </div>

      {/* 2. Top Bento Grid Row: Membership Pipeline Funnel (50%) + Recruitment Channels (50%) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Card 1: Real Membership Pipeline Funnel */}
        <div className="bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800/80 rounded-2xl p-6 transition flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#111625] dark:text-white">
                  Membership Onboarding Pipeline
                </h2>
                <p className="text-xs text-[#8E95A5] mt-0.5">
                  Five-stage prospect journey to official Rotary induction
                </p>
              </div>
              <Link
                href="/recruitment"
                className="text-xs font-semibold text-[#0D3594] dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <span>Manage</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="mt-4 flex items-baseline gap-2.5">
              <span className="text-3xl font-extrabold tracking-tight text-[#111625] dark:text-white">
                {totalCandidates}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11.5px] font-semibold bg-[#E7F8F0] text-[#17A863] border border-[#17A863]/20">
                ↑ 28% YoY
              </span>
              <span className="text-xs text-[#8E95A5]">total prospects & members</span>
            </div>

            {/* Proportional Segmented Progress Bar */}
            <div className="mt-4 flex h-3.5 w-full rounded-md overflow-hidden gap-0.5 bg-slate-100 dark:bg-slate-800">
              <div className="h-full bg-[#4F75FF] rounded-l-md" style={{ width: "30%" }} title="Orientation" />
              <div className="h-full bg-[#7D9DFF]" style={{ width: "25%" }} title="Qualified" />
              <div className="h-full bg-[#A4B8F9]" style={{ width: "20%" }} title="Service Project" />
              <div className="h-full bg-[#C5D2FB]" style={{ width: "15%" }} title="Dues Verified" />
              <div className="h-full bg-[#17A863] rounded-r-md" style={{ width: "10%" }} title="Inducted" />
            </div>

            {/* Breakdown Data Rows */}
            <div className="mt-5 divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
              <div className="py-2.5 flex items-center justify-between text-[#4B5262] dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#4F75FF]" />
                  <span className="font-medium text-[#111625] dark:text-slate-100">1. Inquiry & Orientation</span>
                </div>
                <div className="flex items-center gap-6">
                  <span className="w-12 text-right font-semibold">12 leads</span>
                  <span className="w-20 text-right text-[#8E95A5]">Avg 3 days</span>
                </div>
              </div>

              <div className="py-2.5 flex items-center justify-between text-[#4B5262] dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#7D9DFF]" />
                  <span className="font-medium text-[#111625] dark:text-slate-100">2. General Assembly Attended</span>
                </div>
                <div className="flex items-center gap-6">
                  <span className="w-12 text-right font-semibold">8 leads</span>
                  <span className="w-20 text-right text-[#8E95A5]">Avg 7 days</span>
                </div>
              </div>

              <div className="py-2.5 flex items-center justify-between text-[#4B5262] dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#A4B8F9]" />
                  <span className="font-medium text-[#111625] dark:text-slate-100">3. Service Project Completed</span>
                </div>
                <div className="flex items-center gap-6">
                  <span className="w-12 text-right font-semibold">5 leads</span>
                  <span className="w-20 text-right text-[#8E95A5]">Avg 14 days</span>
                </div>
              </div>

              <div className="py-2.5 flex items-center justify-between text-[#4B5262] dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#C5D2FB]" />
                  <span className="font-medium text-[#111625] dark:text-slate-100">4. Club & District Dues Settled</span>
                </div>
                <div className="flex items-center gap-6">
                  <span className="w-12 text-right font-semibold">3 leads</span>
                  <span className="w-20 text-right text-[#8E95A5]">Avg 5 days</span>
                </div>
              </div>

              <div className="py-2.5 flex items-center justify-between text-[#4B5262] dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#17A863]" />
                  <span className="font-medium text-[#111625] dark:text-slate-100">5. Conferred Active Members</span>
                </div>
                <div className="flex items-center gap-6">
                  <span className="w-12 text-right font-semibold text-[#17A863]">{metrics.activeMembers} inducted</span>
                  <span className="w-20 text-right text-[#8E95A5]">Active</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Real Recruitment Channels Donut */}
        <div className="bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800/80 rounded-2xl p-6 transition flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-base font-bold text-[#111625] dark:text-white">
                  Acquisition Channels
                </h2>
                <p className="text-xs text-[#8E95A5]">
                  Where prospective Rotaractors discover our club
                </p>
              </div>
              <Link
                href="/resources"
                className="text-xs font-semibold text-[#0D3594] dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <span>Channels Hub</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 items-center gap-6">
              {/* Donut representation */}
              <div className="relative flex items-center justify-center h-48">
                {mounted ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={CHANNELS_DATA}
                        innerRadius={54}
                        outerRadius={74}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {CHANNELS_DATA.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-36 h-36 rounded-full border-8 border-[#4F75FF]" />
                )}
                <div className="absolute text-center px-4">
                  <p className="text-xs font-bold text-[#111625] dark:text-white leading-tight">
                    Channels
                  </p>
                  <p className="text-[10px] text-[#8E95A5] leading-tight">
                    Recruitment source
                  </p>
                </div>
              </div>

              {/* Right Channel Breakdown */}
              <div className="space-y-3 text-xs">
                <p className="text-[11px] font-semibold text-[#8E95A5] uppercase tracking-wider mb-2">
                  Top Inflow Channels
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#4F75FF]" />
                    <span className="font-medium text-[#111625] dark:text-slate-100">Campus Caravan</span>
                  </div>
                  <span className="font-bold text-[#111625] dark:text-white">45 %</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#7D9DFF]" />
                    <span className="font-medium text-[#111625] dark:text-slate-100">Facebook Page</span>
                  </div>
                  <span className="font-bold text-[#111625] dark:text-white">30 %</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#A4B8F9]" />
                    <span className="font-medium text-[#111625] dark:text-slate-100">Alumni Referrals</span>
                  </div>
                  <span className="font-bold text-[#111625] dark:text-white">15 %</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#C5D2FB]" />
                    <span className="font-medium text-[#111625] dark:text-slate-100">Sister Club MOA</span>
                  </div>
                  <span className="font-bold text-[#111625] dark:text-white">10 %</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Middle Bento Row: Volunteer Service Hours & Member Engagement Trend */}
      <div className="bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800/80 rounded-2xl p-6 transition">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-[#111625] dark:text-white">
              Service Impact & Assembly Attendance
            </h2>
            <p className="text-xs text-[#8E95A5]">
              Monthly volunteer service hours delivered vs active General Assembly turnout
            </p>
            <div className="mt-3 flex items-center gap-8">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-[#111625] dark:text-white">
                  {metrics.volunteerHours} hrs
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#E7F8F0] text-[#17A863] border border-[#17A863]/20">
                  ↑ 35%
                </span>
                <span className="text-xs text-[#8E95A5] ml-1">volunteer hours</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-[#111625] dark:text-white">
                  {formatPHP(metrics.fundsRaisedCentavos as any, { isCentavos: true })}
                </span>
                <span className="text-xs text-[#8E95A5] ml-1">community funds raised</span>
              </div>
            </div>
          </div>

          {/* Timeframe Range Selector Pills */}
          <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-xs font-medium self-start sm:self-center">
            <button
              onClick={() => setTimeRange("ry")}
              className={`px-3 py-1 rounded-lg transition ${
                timeRange === "ry"
                  ? "bg-white dark:bg-[#161B26] text-[#111625] dark:text-white shadow-xs font-semibold"
                  : "text-[#8E95A5]"
              }`}
            >
              RY 2026-27
            </button>
            <button
              onClick={() => setTimeRange("30d")}
              className={`px-3 py-1 rounded-lg transition ${
                timeRange === "30d"
                  ? "bg-white dark:bg-[#161B26] text-[#111625] dark:text-white shadow-xs font-semibold"
                  : "text-[#8E95A5]"
              }`}
            >
              Last 30 days
            </button>
            <button
              onClick={() => setTimeRange("7d")}
              className={`px-3 py-1 rounded-lg transition ${
                timeRange === "7d"
                  ? "bg-white dark:bg-[#161B26] text-[#111625] dark:text-white shadow-xs font-semibold"
                  : "text-[#8E95A5]"
              }`}
            >
              Last 7 days
            </button>
          </div>
        </div>

        {/* Recharts Spline Curve Chart */}
        <div className="mt-6 h-64 w-full">
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={IMPACT_CHART_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F75FF" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#4F75FF" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorAttendees" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#17A863" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#17A863" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#8E95A5", fontSize: 11 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#8E95A5", fontSize: 11 }}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white dark:bg-[#161B26] p-3.5 rounded-xl border border-[#EDEDF2] dark:border-slate-800 elevation-popover text-xs space-y-1.5 min-w-[150px]">
                          <p className="font-bold text-[#111625] dark:text-white mb-1">{label}, 2026</p>
                          <div className="flex items-center justify-between text-[#4F75FF]">
                            <span className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#4F75FF]" />
                              <span>Volunteer Hours</span>
                            </span>
                            <span className="font-semibold">{payload[0]?.value} hrs</span>
                          </div>
                          <div className="flex items-center justify-between text-[#17A863]">
                            <span className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#17A863]" />
                              <span>GA Attendees</span>
                            </span>
                            <span className="font-semibold">{payload[1]?.value} members</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="hours"
                  stroke="#4F75FF"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorHours)"
                />
                <Area
                  type="monotone"
                  dataKey="attendees"
                  stroke="#17A863"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorAttendees)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full w-full bg-slate-50 dark:bg-slate-800/40 rounded-xl animate-pulse" />
          )}
        </div>
      </div>

      {/* 4. Bottom Bento Row: Retention Risk Breakdown (50%) + Operational Health (50%) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Card 1: Retention Risk Breakdown */}
        <div className="bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800/80 rounded-2xl p-6 transition">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#111625] dark:text-white">
                Retention Alerts & Reasons
              </h2>
              <p className="text-xs text-[#8E95A5]">
                Key root causes for member disengagement
              </p>
            </div>
            <Link
              href="/retention-alerts"
              className="text-xs font-semibold text-[#0D3594] dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <span>View Alerts</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-4">
            <div>
              <p className="text-3xl font-extrabold text-[#E54335]">45%</p>
              <p className="mt-1 text-xs text-[#8E95A5] leading-relaxed">
                Graduation & Work Relocation
              </p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-[#D97706]">35%</p>
              <p className="mt-1 text-xs text-[#8E95A5] leading-relaxed">
                Academic & Schedule Conflict
              </p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-[#6B7280]">20%</p>
              <p className="mt-1 text-xs text-[#8E95A5] leading-relaxed">
                3+ Consecutive Missed Assemblies
              </p>
            </div>
          </div>
        </div>

        {/* Card 2: Club Operational Health Metrics */}
        <div className="bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800/80 rounded-2xl p-6 transition">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#111625] dark:text-white">
                Club Operations Summary
              </h2>
              <p className="text-xs text-[#8E95A5]">
                Real-time Supabase operational health
              </p>
            </div>
            <Link
              href="/treasury"
              className="text-xs font-semibold text-[#0D3594] dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <span>Treasury Hub</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-4">
            <div>
              <p className="text-3xl font-extrabold text-[#111625] dark:text-white">
                {metrics.activeMembers}
              </p>
              <p className="mt-1 text-xs text-[#8E95A5]">Active Inducted Members</p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-[#111625] dark:text-white">
                {metrics.reportsUnderReview}
              </p>
              <p className="mt-1 text-xs text-[#8E95A5]">
                Budget Disb. Awaiting Review
              </p>
            </div>
            <div>
              <div className="flex items-center gap-1">
                <p className="text-3xl font-extrabold text-[#111625] dark:text-white">
                  {metrics.upcomingEvents}
                </p>
                <Info className="w-3.5 h-3.5 text-[#8E95A5]" />
              </div>
              <p className="mt-1 text-xs text-[#8E95A5]">Scheduled Calendar Events</p>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Real Upcoming Club Calendar Events & Activities */}
      <div className="bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800/80 rounded-2xl p-6 transition">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-[#111625] dark:text-white">
              Upcoming Club Events & Sessions
            </h2>
            <p className="text-xs text-[#8E95A5]">
              Real scheduled General Assemblies, service drives, and officer meetings
            </p>
          </div>
          <Link
            href="/events"
            className="text-xs font-semibold text-[#0D3594] dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            <span>Full Calendar</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="space-y-3">
          {/* Event 1 */}
          <div
            className={`p-4 rounded-xl border flex items-center justify-between flex-wrap gap-3 transition ${
              completedActivities["act-1"]
                ? "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-60"
                : "border-[#EDEDF2] dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700"
            }`}
          >
            <div className="space-y-1.5 max-w-2xl">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-[#E2EBFF] text-[#2563EB]">
                  <Calendar className="w-3.5 h-3.5" />
                </div>
                <span className="font-bold text-sm text-[#111625] dark:text-white">
                  Monthly General Assembly & Prospect Orientation
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#FFF3E4] text-[#D97706] border border-[#D97706]/20">
                  Upcoming
                </span>
              </div>
              <p className="text-xs text-[#4B5262] dark:text-slate-300">
                Official gathering of Rotaract San Pedro East members and applicants. Agenda includes District 3820 updates and project nominations.
              </p>
              <div className="flex items-center gap-4 text-xs text-[#8E95A5] pt-1">
                <span>📍 San Pedro City Hall Multi-Purpose Hall</span>
                <span>⏱ Saturday · 02:00 PM - 05:00 PM</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/events"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[#EDEDF2] dark:border-slate-800 text-xs font-semibold text-[#111625] dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                <QrCode className="w-3.5 h-3.5 text-[#0D3594]" />
                <span>QR Check-in</span>
              </Link>
              <button
                onClick={() => toggleComplete("act-1")}
                className={`p-1.5 rounded-xl border transition cursor-pointer ${
                  completedActivities["act-1"]
                    ? "bg-[#E7F8F0] text-[#17A863] border-[#17A863]/30"
                    : "border-[#EDEDF2] dark:border-slate-800 text-[#8E95A5] hover:text-[#17A863]"
                }`}
                title={completedActivities["act-1"] ? "Completed" : "Mark as completed"}
              >
                <Check className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Event 2 */}
          <div
            className={`p-4 rounded-xl border flex items-center justify-between flex-wrap gap-3 transition ${
              completedActivities["act-2"]
                ? "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-60"
                : "border-[#EDEDF2] dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700"
            }`}
          >
            <div className="space-y-1.5 max-w-2xl">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-[#E7F8F0] text-[#17A863]">
                  <FolderKanban className="w-3.5 h-3.5" />
                </div>
                <span className="font-bold text-sm text-[#111625] dark:text-white">
                  Oplan Kalusugan — Community Feeding & Hygiene Drive
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#E7F8F0] text-[#17A863] border border-[#17A863]/20">
                  Confirmed
                </span>
              </div>
              <p className="text-xs text-[#4B5262] dark:text-slate-300">
                Rotary Area of Focus: Disease Prevention & Maternal and Child Health. Partnered with Barangay San Antonio Health Center.
              </p>
              <div className="flex items-center gap-4 text-xs text-[#8E95A5] pt-1">
                <span>📍 Barangay San Antonio Covered Court</span>
                <span>⏱ Sunday · 08:00 AM - 12:00 PM</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/projects"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[#EDEDF2] dark:border-slate-800 text-xs font-semibold text-[#111625] dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                <FolderKanban className="w-3.5 h-3.5 text-[#17A863]" />
                <span>Project Report</span>
              </Link>
              <button
                onClick={() => toggleComplete("act-2")}
                className={`p-1.5 rounded-xl border transition cursor-pointer ${
                  completedActivities["act-2"]
                    ? "bg-[#E7F8F0] text-[#17A863] border-[#17A863]/30"
                    : "border-[#EDEDF2] dark:border-slate-800 text-[#8E95A5] hover:text-[#17A863]"
                }`}
                title={completedActivities["act-2"] ? "Completed" : "Mark as completed"}
              >
                <Check className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
