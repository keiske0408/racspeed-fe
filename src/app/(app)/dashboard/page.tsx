import React from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { StatCard } from "@/components/shared/stat-card";
import {
  Users,
  Calendar,
  Clock,
  PiggyBank,
  CheckCircle,
  AlertTriangle,
  FolderKanban,
  FileText,
  ArrowUpRight,
} from "lucide-react";
import Link from "next/link";
import { formatPHP } from "@/lib/utils/money";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  // Metrics (safe defaults / dynamic indicators)
  const metrics = {
    activeMembers: 32,
    pendingApprovals: 4,
    volunteerHours: 248.5,
    upcomingEvents: 3,
    fundsRaisedCentavos: 4520000, // 45,200.00 PHP
    reportsUnderReview: 2,
    retentionAlerts: 3,
  };

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-rose-950/40 to-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 text-white relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30 mb-3">
            Rotaract San Pedro East · District 3820
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Welcome back, {user?.fullName || "Leader"}!
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            Rotary Year 2026-27 is active. Track service projects, verified dues, attendance check-ins, and onboarding pipelines seamlessly.
          </p>
        </div>
        <div className="absolute right-0 bottom-0 top-0 w-1/3 bg-radial from-rose-500/10 to-transparent pointer-events-none" />
      </div>

      {/* Key Operational Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Members"
          value={metrics.activeMembers}
          subtitle="+3 this month"
          icon={Users}
          variant="primary"
        />
        <StatCard
          title="Volunteer Hours Served"
          value={`${metrics.volunteerHours} hrs`}
          subtitle="Rotary Year 2026-27"
          icon={Clock}
          variant="secondary"
        />
        <StatCard
          title="Total Funds Raised"
          value={formatPHP(metrics.fundsRaisedCentavos as any, { isCentavos: true })}
          subtitle="Community service & dues"
          icon={PiggyBank}
          variant="emerald"
        />
        <StatCard
          title="Upcoming Events"
          value={metrics.upcomingEvents}
          subtitle="Next: Tree Planting (Oct 25)"
          icon={Calendar}
          variant="accent"
        />
      </div>

      {/* Action Center & Attention Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Officer Review Queue */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Action Required
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Items waiting for officer verification and approval
              </p>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              {metrics.pendingApprovals + metrics.reportsUnderReview + metrics.retentionAlerts} Pending
            </span>
          </div>

          <div className="space-y-3">
            <Link
              href="/members"
              className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-rose-300 dark:hover:border-rose-900/50 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-rose-600 transition">
                    Pending Account Requests
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {metrics.pendingApprovals} prospective member accounts awaiting officer approval
                  </p>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-rose-600 transition" />
            </Link>

            <Link
              href="/projects"
              className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-rose-300 dark:hover:border-rose-900/50 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-rose-600 transition">
                    Project Accomplishment Reports
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {metrics.reportsUnderReview} draft reports submitted for Secretarial/Presidential review
                  </p>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-rose-600 transition" />
            </Link>

            <Link
              href="/retention-alerts"
              className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-rose-300 dark:hover:border-rose-900/50 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-rose-600 transition">
                    Member Engagement Alerts
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {metrics.retentionAlerts} members flagged for 3+ consecutive missed General Assemblies
                  </p>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-rose-600 transition" />
            </Link>
          </div>
        </div>

        {/* Quick Launch Panel */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">
              Quick Operations
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
              Launch critical club management actions
            </p>

            <div className="space-y-2.5">
              <Link
                href="/events?action=new"
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs transition shadow-sm"
              >
                <Calendar className="w-4 h-4" />
                Create New Event / QR Session
              </Link>
              <Link
                href="/projects?action=new"
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium text-xs transition"
              >
                <FolderKanban className="w-4 h-4" />
                Register Service Project
              </Link>
              <Link
                href="/treasury"
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium text-xs transition"
              >
                <PiggyBank className="w-4 h-4" />
                Submit Payment Proof
              </Link>
              <Link
                href="/recruitment"
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium text-xs transition"
              >
                <Users className="w-4 h-4" />
                View Prospect Pipeline
              </Link>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              Need assistance? Check the Rotaract District 3820 operational guidelines or platform documentation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
