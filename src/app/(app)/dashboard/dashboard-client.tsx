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
  Plus,
  Phone,
  Check,
  MoreHorizontal,
  Info,
  ExternalLink,
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

// Chart Data matching "Leads won vs leads lost" curve in reference image
const SPLINE_CHART_DATA = [
  { month: "March", won: 38, lost: 42 },
  { month: "April", won: 36, lost: 41 },
  { month: "May", won: 65, lost: 34 },
  { month: "June", won: 32, lost: 58 },
  { month: "July", won: 52, lost: 55 },
  { month: "August", won: 56, lost: 38 },
];

// Sources Donut series
const DONUT_DATA = [
  { name: "Campus Caravan", value: 50, color: "#4F75FF" },
  { name: "Social Media & FB", value: 25, color: "#7D9DFF" },
  { name: "Referral & Alumni", value: 15, color: "#A4B8F9" },
  { name: "Sister Club Partner", value: 10, color: "#C5D2FB" },
];

export function DashboardClient({ user, metrics }: DashboardClientProps) {
  const [mounted, setMounted] = useState(false);
  const [viewTab, setViewTab] = useState<"sales" | "leads">("leads");
  const [sourcesTab, setSourcesTab] = useState<"came" | "converted" | "size">("converted");
  const [timeRange, setTimeRange] = useState<"6m" | "30d" | "7d">("6m");
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="space-y-6 pb-12 select-none">
      {/* 1. Header Toolbar (Matching reference Dashboard header with sub-tabs) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold tracking-tight text-[#111625] dark:text-white">
            Dashboard
          </h1>
          {/* Segmented Sub-tabs: Sales / Leads */}
          <div className="inline-flex p-1 rounded-xl bg-slate-200/60 dark:bg-slate-800/60 border border-[#EDEDF2] dark:border-slate-800 text-xs font-semibold">
            <button
              onClick={() => setViewTab("sales")}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                viewTab === "sales"
                  ? "bg-white dark:bg-[#161B26] text-[#111625] dark:text-white shadow-xs"
                  : "text-[#6B7280] dark:text-slate-400 hover:text-[#111625] dark:hover:text-white"
              }`}
            >
              Sales
            </button>
            <button
              onClick={() => setViewTab("leads")}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                viewTab === "leads"
                  ? "bg-white dark:bg-[#161B26] text-[#111625] dark:text-white shadow-xs"
                  : "text-[#6B7280] dark:text-slate-400 hover:text-[#111625] dark:hover:text-white"
              }`}
            >
              Leads
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Range Dropdown Pill */}
          <div className="relative">
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#EDEDF2] dark:border-slate-800 text-xs font-semibold text-[#111625] dark:text-white bg-white dark:bg-[#111622] shadow-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition">
              <Calendar className="w-3.5 h-3.5 text-[#8E95A5]" />
              <span>Last 6 months</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#8E95A5]" />
            </button>
          </div>

          {/* Primary Action Button */}
          <Link
            href="/tasks"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0D3594] hover:bg-[#092569] text-white text-xs font-semibold shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create</span>
          </Link>
        </div>
      </div>

      {/* 2. Top Bento Grid Row: Funnel count (50%) + Sources Donut (50%) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Card 1: Funnel count */}
        <div className="bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800/80 rounded-2xl p-6 transition">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#111625] dark:text-white">
              Funnel count
            </h2>
          </div>

          <div className="mt-4 flex items-baseline gap-2.5">
            <span className="text-3xl font-extrabold tracking-tight text-[#111625] dark:text-white">
              {metrics.activeMembers * 100}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11.5px] font-semibold bg-[#E7F8F0] text-[#17A863] border border-[#17A863]/20">
              ↑ 34%
            </span>
          </div>
          <p className="mt-1 text-xs text-[#8E95A5]">active leads</p>

          {/* Multi-segment Horizontal Progress Bar */}
          <div className="mt-5 flex h-3.5 w-full rounded-md overflow-hidden gap-0.5 bg-slate-100 dark:bg-slate-800">
            <div className="h-full bg-[#4F75FF] rounded-l-md" style={{ width: "28%" }} />
            <div className="h-full bg-[#7D9DFF]" style={{ width: "22%" }} />
            <div className="h-full bg-[#A4B8F9]" style={{ width: "20%" }} />
            <div className="h-full bg-[#C5D2FB]" style={{ width: "16%" }} />
            <div className="h-full bg-[#E0E7FF] rounded-r-md" style={{ width: "14%" }} />
          </div>

          {/* Breakdown Data Rows */}
          <div className="mt-6 divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
            <div className="py-2.5 flex items-center justify-between text-[#4B5262] dark:text-slate-300">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#4F75FF]" />
                <span className="font-medium text-[#111625] dark:text-slate-100">Discovery</span>
              </div>
              <div className="flex items-center gap-8">
                <span className="w-12 text-right">200</span>
                <span className="w-16 text-right font-medium">$ 200</span>
                <span className="w-16 text-right text-[#8E95A5]">2 days</span>
              </div>
            </div>

            <div className="py-2.5 flex items-center justify-between text-[#4B5262] dark:text-slate-300">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#7D9DFF]" />
                <span className="font-medium text-[#111625] dark:text-slate-100">Qualified</span>
              </div>
              <div className="flex items-center gap-8">
                <span className="w-12 text-right">100</span>
                <span className="w-16 text-right font-medium">$ 100</span>
                <span className="w-16 text-right text-[#8E95A5]">2 days</span>
              </div>
            </div>

            <div className="py-2.5 flex items-center justify-between text-[#4B5262] dark:text-slate-300">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#A4B8F9]" />
                <span className="font-medium text-[#111625] dark:text-slate-100">In conversation</span>
              </div>
              <div className="flex items-center gap-8">
                <span className="w-12 text-right">50</span>
                <span className="w-16 text-right font-medium">$ 50</span>
                <span className="w-16 text-right text-[#8E95A5]">8 days</span>
              </div>
            </div>

            <div className="py-2.5 flex items-center justify-between text-[#4B5262] dark:text-slate-300">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#C5D2FB]" />
                <span className="font-medium text-[#111625] dark:text-slate-100">Negotiations</span>
              </div>
              <div className="flex items-center gap-8">
                <span className="w-12 text-right">20</span>
                <span className="w-16 text-right font-medium">$ 50</span>
                <span className="w-16 text-right text-[#8E95A5]">8 days</span>
              </div>
            </div>

            <div className="py-2.5 flex items-center justify-between text-[#4B5262] dark:text-slate-300">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#E0E7FF]" />
                <span className="font-medium text-[#111625] dark:text-slate-100">Closed won</span>
              </div>
              <div className="flex items-center gap-8">
                <span className="w-12 text-right">20</span>
                <span className="w-16 text-right font-medium">$ 50</span>
                <span className="w-16 text-right text-[#8E95A5]">10 days</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Sources Donut Chart */}
        <div className="bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800/80 rounded-2xl p-6 transition flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-base font-bold text-[#111625] dark:text-white">
                Sources
              </h2>
              {/* Segmented Filter Pills */}
              <div className="inline-flex p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-[11px] font-semibold">
                <button
                  onClick={() => setSourcesTab("came")}
                  className={`px-2.5 py-1 rounded-md transition ${
                    sourcesTab === "came"
                      ? "bg-white dark:bg-[#161B26] text-[#111625] dark:text-white shadow-xs"
                      : "text-[#8E95A5]"
                  }`}
                >
                  Leads came
                </button>
                <button
                  onClick={() => setSourcesTab("converted")}
                  className={`px-2.5 py-1 rounded-md transition ${
                    sourcesTab === "converted"
                      ? "bg-white dark:bg-[#161B26] text-[#111625] dark:text-white shadow-xs"
                      : "text-[#8E95A5]"
                  }`}
                >
                  Leads converted
                </button>
                <button
                  onClick={() => setSourcesTab("size")}
                  className={`px-2.5 py-1 rounded-md transition ${
                    sourcesTab === "size"
                      ? "bg-white dark:bg-[#161B26] text-[#111625] dark:text-white shadow-xs"
                      : "text-[#8E95A5]"
                  }`}
                >
                  Total deals size
                </button>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 items-center gap-6">
              {/* Left Donut representation */}
              <div className="relative flex items-center justify-center h-48">
                {mounted ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={DONUT_DATA}
                        innerRadius={54}
                        outerRadius={74}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {DONUT_DATA.map((entry, index) => (
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
                    Services
                  </p>
                  <p className="text-[10px] text-[#8E95A5] leading-tight">
                    where leads come from
                  </p>
                </div>
              </div>

              {/* Right Legend List */}
              <div className="space-y-3 text-xs">
                <p className="text-[11px] font-semibold text-[#8E95A5] uppercase tracking-wider mb-2">
                  Top 5 sources
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#4F75FF]" />
                    <span className="font-medium text-[#111625] dark:text-slate-100">Clutch</span>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <span className="font-medium">$ 3 000</span>
                    <span className="text-[#8E95A5] w-8">50 %</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#7D9DFF]" />
                    <span className="font-medium text-[#111625] dark:text-slate-100">Behance</span>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <span className="font-medium">$ 1 000</span>
                    <span className="text-[#8E95A5] w-8">40 %</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#A4B8F9]" />
                    <span className="font-medium text-[#111625] dark:text-slate-100">Instagram</span>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <span className="font-medium">$ 1 000</span>
                    <span className="text-[#8E95A5] w-8">40 %</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#C5D2FB]" />
                    <span className="font-medium text-[#111625] dark:text-slate-100">Dribbble</span>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <span className="font-medium">$ 1 000</span>
                    <span className="text-[#8E95A5] w-8">10 %</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Middle Bento Row: Leads won vs leads lost (Full-width Spline Area Chart) */}
      <div className="bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800/80 rounded-2xl p-6 transition">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-[#111625] dark:text-white">
              Leads won vs leads lost
            </h2>
            <div className="mt-3 flex items-center gap-8">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-[#111625] dark:text-white">680</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#E7F8F0] text-[#17A863] border border-[#17A863]/20">
                  ↑ 42%
                </span>
                <span className="text-xs text-[#8E95A5] ml-1">total closed</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-[#111625] dark:text-white">70</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#FEECEB] text-[#E54335] border border-[#E54335]/20">
                  ↓ 17%
                </span>
                <span className="text-xs text-[#8E95A5] ml-1">total lost</span>
              </div>
            </div>
          </div>

          {/* Timeframe Range Selector Pills */}
          <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-xs font-medium self-start sm:self-center">
            <button
              onClick={() => setTimeRange("6m")}
              className={`px-3 py-1 rounded-lg transition ${
                timeRange === "6m"
                  ? "bg-white dark:bg-[#161B26] text-[#111625] dark:text-white shadow-xs font-semibold"
                  : "text-[#8E95A5]"
              }`}
            >
              6 months
            </button>
            <button
              onClick={() => setTimeRange("30d")}
              className={`px-3 py-1 rounded-lg transition ${
                timeRange === "30d"
                  ? "bg-white dark:bg-[#161B26] text-[#111625] dark:text-white shadow-xs font-semibold"
                  : "text-[#8E95A5]"
              }`}
            >
              30 days
            </button>
            <button
              onClick={() => setTimeRange("7d")}
              className={`px-3 py-1 rounded-lg transition ${
                timeRange === "7d"
                  ? "bg-white dark:bg-[#161B26] text-[#111625] dark:text-white shadow-xs font-semibold"
                  : "text-[#8E95A5]"
              }`}
            >
              7 days
            </button>
          </div>
        </div>

        {/* Recharts Spline Curve Chart with Tooltip */}
        <div className="mt-6 h-64 w-full">
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={SPLINE_CHART_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorWon" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F75FF" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#4F75FF" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorLost" x1="0" y1="0" x2="0" y2="1">
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
                  ticks={[0, 20, 40, 60, 80, 100]}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white dark:bg-[#161B26] p-3.5 rounded-xl border border-[#EDEDF2] dark:border-slate-800 elevation-popover text-xs space-y-1.5 min-w-[140px]">
                          <p className="font-bold text-[#111625] dark:text-white mb-1">{label}, 2026</p>
                          <div className="flex items-center justify-between text-[#17A863]">
                            <span className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#17A863]" />
                              <span>Closed won</span>
                            </span>
                            <span className="font-semibold">{payload[0]?.value}</span>
                          </div>
                          <div className="flex items-center justify-between text-[#4F75FF]">
                            <span className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#4F75FF]" />
                              <span>Closed lost</span>
                            </span>
                            <span className="font-semibold">{payload[1]?.value}</span>
                          </div>
                          <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between font-semibold text-[#111625] dark:text-white">
                            <span>Total closed</span>
                            <span>{Number(payload[0]?.value || 0) + Number(payload[1]?.value || 0)}</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="lost"
                  stroke="#17A863"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorLost)"
                />
                <Area
                  type="monotone"
                  dataKey="won"
                  stroke="#4F75FF"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorWon)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full w-full bg-slate-50 dark:bg-slate-800/40 rounded-xl animate-pulse" />
          )}
        </div>
      </div>

      {/* 4. Bottom Bento Row: Reasons of leads lost (50%) + Other data (50%) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Card 1: Reasons of leads lost */}
        <div className="bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800/80 rounded-2xl p-6 transition">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#111625] dark:text-white">
              Reasons of leads lost
            </h2>
            <div className="flex items-center gap-2">
              <Link
                href="/retention-alerts"
                className="text-xs font-semibold text-[#6B7280] hover:text-[#111625] dark:hover:text-white flex items-center gap-1"
              >
                <span>View analytics</span>
                <span className="text-sm">→</span>
              </Link>
              <button className="p-1 rounded-md text-slate-400 hover:text-slate-600">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-4">
            <div>
              <p className="text-3xl font-extrabold text-[#111625] dark:text-white">40%</p>
              <p className="mt-1 text-xs text-[#8E95A5] leading-relaxed">
                The proposal is unclear
              </p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-[#111625] dark:text-white">20%</p>
              <p className="mt-1 text-xs text-[#8E95A5] leading-relaxed">
                However venture pursuit
              </p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-[#111625] dark:text-white">10%</p>
              <p className="mt-1 text-xs text-[#8E95A5] leading-relaxed">
                Other
              </p>
            </div>
          </div>
        </div>

        {/* Card 2: Other data */}
        <div className="bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800/80 rounded-2xl p-6 transition">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#111625] dark:text-white">
              Other data
            </h2>
            <div className="flex items-center gap-2">
              <Link
                href="/members"
                className="text-xs font-semibold text-[#6B7280] hover:text-[#111625] dark:hover:text-white flex items-center gap-1"
              >
                <span>View analytics</span>
                <span className="text-sm">→</span>
              </Link>
              <button className="p-1 rounded-md text-slate-400 hover:text-slate-600">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-4">
            <div>
              <p className="text-3xl font-extrabold text-[#111625] dark:text-white">900</p>
              <p className="mt-1 text-xs text-[#8E95A5]">Total leads count</p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-[#111625] dark:text-white">12</p>
              <p className="mt-1 text-xs text-[#8E95A5]">
                Days in average to convert lead
              </p>
            </div>
            <div>
              <div className="flex items-center gap-1">
                <p className="text-3xl font-extrabold text-[#111625] dark:text-white">30</p>
                <Info className="w-3.5 h-3.5 text-[#8E95A5]" />
              </div>
              <p className="mt-1 text-xs text-[#8E95A5]">inactive leads</p>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Upcoming Activities List (Matching Image 4 from the reference mockup) */}
      <div className="bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800/80 rounded-2xl p-6 transition">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-[#111625] dark:text-white">
            Upcoming activities
          </h2>
          <span className="text-xs font-semibold text-[#8E95A5]">3 tasks scheduled</span>
        </div>

        <div className="space-y-3">
          {/* Activity Row 1 */}
          <div className="p-4 rounded-xl border border-[#EDEDF2] dark:border-slate-800/80 flex items-center justify-between flex-wrap gap-3 hover:border-slate-300 dark:hover:border-slate-700 transition relative">
            <div className="space-y-1.5 max-w-2xl">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-[#E2EBFF] text-[#2563EB]">
                  <Phone className="w-3.5 h-3.5" />
                </div>
                <span className="font-bold text-sm text-[#111625] dark:text-white">Call</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#FFF3E4] text-[#D97706] border border-[#D97706]/20">
                  Upcoming
                </span>
              </div>
              <p className="text-xs text-[#4B5262] dark:text-slate-300">
                Chapter too parties its letters nor. Cheerful but whatever ladyship disposed yet judgment.
              </p>
              <div className="flex items-center gap-4 text-xs text-[#8E95A5] pt-1">
                <span>👤 Ban Rob, IBM</span>
                <span>⏱ 12:00 AM - 13:00 AM</span>
              </div>
            </div>

            <div className="relative">
              <button
                onClick={() => setActiveMenuId(activeMenuId === "act-1" ? null : "act-1")}
                className="p-1.5 rounded-lg border border-[#EDEDF2] dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-[#8E95A5] cursor-pointer"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {activeMenuId === "act-1" && (
                <div className="absolute right-0 bottom-full mb-1.5 bg-white dark:bg-[#161B26] border border-[#EDEDF2] dark:border-slate-800 rounded-xl elevation-popover py-1 px-2 z-20 whitespace-nowrap">
                  <button
                    onClick={() => setActiveMenuId(null)}
                    className="flex items-center gap-2 text-xs font-semibold text-[#111625] dark:text-white px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                  >
                    <span>Mark as done</span>
                    <Check className="w-3.5 h-3.5 text-[#17A863]" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Activity Row 2 */}
          <div className="p-4 rounded-xl border border-[#EDEDF2] dark:border-slate-800/80 flex items-center justify-between flex-wrap gap-3 hover:border-slate-300 dark:hover:border-slate-700 transition relative">
            <div className="space-y-1.5 max-w-2xl">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-[#E2EBFF] text-[#2563EB]">
                  <Phone className="w-3.5 h-3.5" />
                </div>
                <span className="font-bold text-sm text-[#111625] dark:text-white">Call</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#FEECEB] text-[#E54335] border border-[#E54335]/20">
                  Overdue
                </span>
              </div>
              <p className="text-xs text-[#4B5262] dark:text-slate-300">
                General Assembly prospective briefing & membership confirmation.
              </p>
              <div className="flex items-center gap-4 text-xs text-[#8E95A5] pt-1">
                <span>👤 Esther Howard, IBM</span>
                <span>⏱ 09:30 PM - 10:20 PM</span>
              </div>
            </div>

            <div className="relative">
              <button
                onClick={() => setActiveMenuId(activeMenuId === "act-2" ? null : "act-2")}
                className="p-1.5 rounded-lg border border-[#EDEDF2] dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-[#8E95A5] cursor-pointer"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {activeMenuId === "act-2" && (
                <div className="absolute right-0 bottom-full mb-1.5 bg-white dark:bg-[#161B26] border border-[#EDEDF2] dark:border-slate-800 rounded-xl elevation-popover py-1 px-2 z-20 whitespace-nowrap">
                  <button
                    onClick={() => setActiveMenuId(null)}
                    className="flex items-center gap-2 text-xs font-semibold text-[#111625] dark:text-white px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                  >
                    <span>Mark as done</span>
                    <Check className="w-3.5 h-3.5 text-[#17A863]" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
