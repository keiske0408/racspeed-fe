"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Award,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  FileText,
  Flame,
  FolderKanban,
  HeartHandshake,
  MapPin,
  QrCode,
  Receipt,
  ShieldAlert,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import type { ActivitySummaryDTO, RsvpResponse } from "@/features/activities/types";
import { ACTIVITY_KIND_META } from "@/features/activities/types";
import { selfCheckInAction } from "@/features/activities/actions";
import { formatPHP } from "@/lib/utils/money";
import { formatManila } from "@/lib/utils/dates";
import type { LeaderboardEntry } from "@/lib/services/rewards";
import { notifyToast } from "@/components/shared/toast-viewport";
import {
  ActivityStatusBadge,
  KindBadge,
} from "../project-center/_components/badges";
import {
  ActivityCard,
  formatActivityWhen,
  isRsvpOpen,
} from "../project-center/_components/activity-card";
import { RsvpButtons } from "../project-center/_components/rsvp-buttons";

export interface DashboardNotificationDTO {
  id: string;
  title: string;
  message: string;
  type: string;
  link_url: string | null;
  is_read: boolean;
  created_at: string;
}

interface Metrics {
  activeMembers: number;
  aspirants: number;
  upcomingEvents: number;
  reportsToReview: number;
  pendingBudgets: number;
  retentionAlerts: number;
  outstandingDues: number;
  myPoints: number;
}

export function DashboardV2Client({
  user,
  metrics,
  upcoming,
  highlights,
  leaderboard,
  recentNotifications = [],
}: {
  user: { id: string; fullName: string; email: string } | null;
  metrics: Metrics;
  upcoming: ActivitySummaryDTO[];
  highlights: ActivitySummaryDTO[];
  leaderboard: LeaderboardEntry[];
  recentNotifications?: DashboardNotificationDTO[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [rsvpMap, setRsvpMap] = useState<Record<string, RsvpResponse | null>>({});
  const [checkedInMap, setCheckedInMap] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();

  const visibleUpcoming = upcoming.filter((a) => !a.isArchived);
  const visibleHighlights = highlights.filter((a) => !a.isArchived);

  const firstName = user?.fullName?.trim().split(/\s+/)[0] || "Rotaractor";
  const hour = Number(
    new Intl.DateTimeFormat("en", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: "Asia/Manila",
    }).format(new Date()),
  );
  const salutation =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const nextMilestone =
    metrics.myPoints < 25
      ? 25
      : metrics.myPoints < 50
        ? 50
        : metrics.myPoints < 100
          ? 100
          : 200;
  const milestonePct = Math.min(
    100,
    Math.round((metrics.myPoints / nextMilestone) * 100),
  );

  function checkIn(activityId: string) {
    setPendingId(activityId);
    startTransition(async () => {
      const result = await selfCheckInAction(activityId);
      setPendingId(null);
      notifyToast({
        title: result.success ? "Check-in complete" : "Check-in failed",
        message: result.success
          ? result.message || "Check-in recorded."
          : result.error || "Could not check in.",
        kind: result.success ? "success" : "error",
      });
      if (result.success) {
        setCheckedInMap((prev) => ({ ...prev, [activityId]: true }));
        router.refresh();
      }
    });
  }

  return (
    <main className="space-y-6 pb-12">
      {/* Engaging Hero Banner */}
      <section className="relative overflow-hidden rounded-2xl border border-[#E2E8F0] bg-gradient-to-br from-white via-[#F8FAFF] to-[#EEF4FF] p-5 sm:p-7 shadow-2xs dark:border-slate-800/90 dark:from-[#121723] dark:via-[#111827] dark:to-[#0F1D3A]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl dark:bg-blue-500/15"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-rose-500/10 blur-3xl dark:bg-rose-500/10"
        />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200/80 bg-blue-50/90 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-[#0D3594] uppercase dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
                <Sparkles className="h-3 w-3 text-amber-500" />
                Rotaract Club of San Pedro East · D3820
              </span>
              {metrics.myPoints > 0 && (
                <Link
                  href={user ? `/members/${user.id}` : "/members"}
                  className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 hover:bg-amber-100 transition dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
                >
                  <Trophy className="h-3 w-3 text-amber-500" />
                  {metrics.myPoints} Impact Pts
                </Link>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111625] dark:text-white">
              {salutation}, {firstName}!
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Track upcoming service initiatives, RSVP to unlock project workspaces, and build your Rotary Year engagement record.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Link
              href="/project-center"
              className="inline-flex items-center gap-2 rounded-xl bg-[#0D3594] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#0A2A78] transition"
            >
              <FolderKanban className="h-3.5 w-3.5" />
              Project Center
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/events"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <QrCode className="h-3.5 w-3.5 text-rose-500" />
              QR Check-in
            </Link>
            {user && (
              <Link
                href={`/members/${user.id}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Award className="h-3.5 w-3.5 text-amber-500" />
                My Points
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Club Snapshot KPI Grid */}
      <section
        className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
        aria-label="Club snapshot"
      >
        <Metric
          label="Upcoming activities"
          value={visibleUpcoming.length}
          icon={CalendarDays}
          href="/project-center?view=calendar"
          tone="blue"
          detail="Active schedule"
        />
        <Metric
          label="Active members"
          value={metrics.activeMembers}
          icon={Users}
          href="/members"
          tone="emerald"
          detail={
            metrics.aspirants
              ? `+${metrics.aspirants} aspirant${metrics.aspirants === 1 ? "" : "s"} in pipeline`
              : "Verified club roster"
          }
        />
        <Metric
          label="Reports to review"
          value={metrics.reportsToReview}
          icon={FileText}
          href="/project-center?status=AWAITING_REPORT"
          tone="violet"
          detail="Awaiting sign-off"
        />
        <Metric
          label="Retention alerts"
          value={metrics.retentionAlerts}
          icon={ShieldAlert}
          href="/retention-alerts"
          tone={metrics.retentionAlerts ? "amber" : "default"}
          detail={metrics.retentionAlerts ? "Needs outreach" : "All members engaged"}
        />
      </section>

      {/* Main Two-Column Responsive Workspace */}
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,.85fr)]">
        {/* Left Column: Upcoming Events */}
        <div className="space-y-4">
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#111625] dark:text-white">
                  Upcoming Events & Projects
                </h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {visibleUpcoming.length}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                RSVP &ldquo;Going&rdquo; to unlock project details and enable check-in.
              </p>
            </div>
            <Link
              href="/project-center?view=calendar"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#0D3594] hover:underline dark:text-blue-300"
            >
              Full Calendar <ArrowRight className="h-3 w-3" />
            </Link>
          </header>

          <div className="divide-y divide-[#EDEDF2] overflow-hidden rounded-2xl border border-[#EDEDF2] bg-white shadow-2xs dark:divide-slate-800/80 dark:border-slate-800 dark:bg-[#161B26]">
            {visibleUpcoming.map((activity) => {
              const effectiveRsvp =
                rsvpMap[activity.id] !== undefined
                  ? rsvpMap[activity.id]
                  : activity.myRsvp;
              const isCheckedIn =
                checkedInMap[activity.id] !== undefined
                  ? checkedInMap[activity.id]
                  : activity.checkedIn;
              const canShowCheckIn =
                activity.selfCheckInEnabled &&
                !isCheckedIn &&
                (!activity.rsvpEnabled || effectiveRsvp === "GOING");
              const kindMeta = ACTIVITY_KIND_META[activity.kind];

              return (
                <article
                  key={activity.id}
                  className="group flex flex-col gap-3.5 p-4 sm:p-5 transition hover:bg-slate-50/70 dark:hover:bg-slate-800/30 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <Link
                      href={`/project-center/${activity.id}`}
                      className="shrink-0 overflow-hidden rounded-xl border border-[#EDEDF2] dark:border-slate-800 shadow-2xs"
                    >
                      {activity.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={activity.coverUrl}
                          alt=""
                          className="h-16 w-20 sm:h-18 sm:w-24 object-cover transition duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-16 w-20 sm:h-18 sm:w-24 flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200/70 dark:from-slate-800 dark:to-slate-900 text-slate-500 dark:text-slate-400">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${kindMeta?.dotClass || "bg-blue-500"} mb-1`}
                          />
                          <CalendarDays className="h-5 w-5 opacity-75" />
                        </div>
                      )}
                    </Link>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <KindBadge
                          kind={activity.kind}
                          meetingType={activity.meetingType}
                        />
                        <ActivityStatusBadge status={activity.status} />
                        {effectiveRsvp === "GOING" && !isCheckedIn && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            <Sparkles className="h-2.5 w-2.5" /> Unlocked
                          </span>
                        )}
                      </div>
                      <Link
                        href={`/project-center/${activity.id}`}
                        className="mt-1.5 block truncate text-sm sm:text-[15px] font-bold text-[#111625] group-hover:text-[#0D3594] dark:text-white dark:group-hover:text-blue-300 transition"
                      >
                        {activity.title}
                      </Link>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="h-3 w-3 text-slate-400" />
                          {formatActivityWhen(activity)}
                        </span>
                        {activity.location && (
                          <span className="inline-flex items-center gap-1 truncate max-w-[220px] sm:max-w-[280px]">
                            <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                            <span className="truncate">{activity.location}</span>
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 text-slate-400">
                          <Users className="h-3 w-3" />
                          {activity.rsvp.going} going
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1 lg:pt-0 lg:justify-end shrink-0">
                    {activity.rsvpEnabled && isRsvpOpen(activity) && (
                      <RsvpButtons
                        activityId={activity.id}
                        current={effectiveRsvp}
                        compact
                        onResponseChange={(next) =>
                          setRsvpMap((prev) => ({
                            ...prev,
                            [activity.id]: next,
                          }))
                        }
                      />
                    )}
                    {canShowCheckIn && (
                      <button
                        type="button"
                        disabled={pendingId === activity.id}
                        onClick={() => checkIn(activity.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-[11px] font-bold text-white shadow-xs transition disabled:opacity-60 cursor-pointer"
                      >
                        <Check className="h-3.5 w-3.5" />
                        {pendingId === activity.id
                          ? "Checking in..."
                          : "Check in as me"}
                      </button>
                    )}
                    {isCheckedIn && (
                      <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Checked in
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
            {visibleUpcoming.length === 0 && (
              <div className="px-5 py-12 text-center">
                <CalendarDays className="mx-auto h-6 w-6 text-slate-400" />
                <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  No upcoming activities scheduled
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  New club meetings and service projects will appear here once published.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Engagement, Notifications & Finance */}
        <aside className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 content-start">
          {/* Member Engagement & Leaderboard Card */}
          <section className="rounded-2xl border border-[#EDEDF2] bg-white p-4 sm:p-5 shadow-2xs dark:border-slate-800 dark:bg-[#161B26]">
            <header className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Flame className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-bold text-[#111625] dark:text-white">
                  Member Engagement
                </h2>
              </div>
              <Link
                href={user ? `/members/${user.id}` : "/members"}
                className="text-[11px] font-semibold text-[#0D3594] hover:underline dark:text-blue-300"
              >
                My Points History →
              </Link>
            </header>

            <div className="mt-3.5 rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80">
              <div className="flex items-baseline justify-between">
                <div>
                  <p className="text-[11px] font-medium text-slate-500">
                    Your Rotary Year Points
                  </p>
                  <p className="mt-0.5 text-2xl font-extrabold text-[#111625] dark:text-white">
                    {metrics.myPoints}
                    <span className="ml-1 text-xs font-semibold text-slate-500">
                      pts
                    </span>
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  Goal: {nextMilestone} pts
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                  style={{ width: `${milestonePct}%` }}
                />
              </div>
            </div>

            {leaderboard.length > 0 ? (
              <div className="mt-3.5 pt-3 border-t border-[#EDEDF2] dark:border-slate-800">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Top Contributors
                </p>
                <ol className="space-y-2">
                  {leaderboard.slice(0, 4).map((entry, index) => {
                    const rankBadge =
                      index === 0
                        ? "🥇"
                        : index === 1
                          ? "🥈"
                          : index === 2
                            ? "🥉"
                            : `${index + 1}`;
                    return (
                      <li
                        key={entry.profileId}
                        className="flex items-center gap-2.5 text-xs"
                      >
                        <span className="w-5 text-center text-xs font-bold text-slate-400">
                          {rankBadge}
                        </span>
                        <Link
                          href={`/members/${entry.profileId}`}
                          className={`min-w-0 flex-1 truncate hover:underline ${
                            entry.profileId === user?.id
                              ? "font-bold text-[#0D3594] dark:text-blue-300"
                              : "text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {entry.fullName}
                          {entry.profileId === user?.id ? " (You)" : ""}
                        </Link>
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          {entry.points} pts
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ) : (
              <p className="mt-3 text-[11px] text-slate-500">
                Points are awarded for activity check-ins and completed tasks.
              </p>
            )}
          </section>

          {/* Project & Activity Notifications */}
          <section className="rounded-2xl border border-[#EDEDF2] bg-white p-4 sm:p-5 shadow-2xs dark:border-slate-800 dark:bg-[#161B26]">
            <header className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-[#0D3594] dark:text-blue-400">
                  <Bell className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-bold text-[#111625] dark:text-white">
                  Project & Activity Updates
                </h2>
              </div>
              {recentNotifications.filter((n) => !n.is_read).length > 0 && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-[#0D3594] dark:bg-blue-900/40 dark:text-blue-300">
                  {recentNotifications.filter((n) => !n.is_read).length} new
                </span>
              )}
            </header>
            <div className="mt-3 space-y-2">
              {recentNotifications.length > 0 ? (
                recentNotifications.slice(0, 4).map((notif) => (
                  <Link
                    key={notif.id}
                    href={notif.link_url || "/project-center"}
                    className="group block rounded-xl border border-[#EDEDF2] p-2.5 hover:border-blue-300 hover:bg-blue-50/40 dark:border-slate-800 dark:hover:border-blue-700/50 dark:hover:bg-slate-800/50 transition"
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <h3 className="text-xs font-semibold text-slate-900 dark:text-white group-hover:text-[#0D3594] dark:group-hover:text-blue-300 transition line-clamp-1">
                        {notif.title}
                      </h3>
                      {!notif.is_read && (
                        <span className="h-2 w-2 rounded-full bg-blue-600 shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500 line-clamp-2">
                      {notif.message}
                    </p>
                    <span className="mt-1 block text-[10px] text-slate-400">
                      {formatManila(notif.created_at, "MMM d, h:mm a")}
                    </span>
                  </Link>
                ))
              ) : (
                <p className="py-4 text-center text-xs text-slate-400">
                  You&apos;re all caught up! Project updates and committee alerts appear here.
                </p>
              )}
            </div>
          </section>

          {/* Outstanding Dues */}
          <section className="rounded-2xl border border-[#EDEDF2] bg-white p-4 sm:p-5 shadow-2xs dark:border-slate-800 dark:bg-[#161B26]">
            <header className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                  <Receipt className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-bold text-[#111625] dark:text-white">
                  Outstanding Dues
                </h2>
              </div>
              <Link
                href="/treasury"
                aria-label="Open treasury"
                className="rounded p-1 text-slate-400 hover:text-[#0D3594]"
              >
                <ArrowRight className="h-4 w-4" />
              </Link>
            </header>
            <p className="mt-3 text-2xl font-extrabold text-[#111625] dark:text-white">
              {formatPHP(metrics.outstandingDues)}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Your unpaid club invoices and semi-annual dues.
            </p>
            <Link
              href="/treasury"
              className="mt-3.5 inline-flex items-center gap-1.5 rounded-xl border border-[#EDEDF2] px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 transition"
            >
              Review dues <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </section>

          {/* Approvals & Finance */}
          <section className="rounded-2xl border border-[#EDEDF2] bg-white p-4 sm:p-5 shadow-2xs dark:border-slate-800 dark:bg-[#161B26]">
            <header className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <FileText className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-bold text-[#111625] dark:text-white">
                  Approvals & Finance
                </h2>
              </div>
              <Link
                href="/budgets"
                className="text-[11px] font-semibold text-[#0D3594] dark:text-blue-300 hover:underline"
              >
                Open queue
              </Link>
            </header>
            <div className="mt-3.5 flex items-center justify-between border-t border-[#EDEDF2] pt-3 text-xs dark:border-slate-800">
              <span className="text-slate-500">Budget requests</span>
              <span className="font-bold text-[#111625] dark:text-white">
                {metrics.pendingBudgets} pending
              </span>
            </div>
            <div className="mt-2.5 flex items-center justify-between border-t border-[#EDEDF2] pt-2.5 text-xs dark:border-slate-800">
              <span className="text-slate-500">Aspirant members</span>
              <span className="font-bold text-[#111625] dark:text-white">
                {metrics.aspirants}
              </span>
            </div>
          </section>
        </aside>
      </section>

      {/* Project Highlights */}
      <section className="space-y-3">
        <header className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#111625] dark:text-white">
              Project Highlights
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Recently accomplished service projects.
            </p>
          </div>
          <Link
            href="/project-center?kind=SERVICE_PROJECT"
            className="text-xs font-semibold text-[#0D3594] hover:underline dark:text-blue-300"
          >
            All projects
          </Link>
        </header>
        {visibleHighlights.length ? (
          <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
            {visibleHighlights.map((activity) => (
              <ActivityCard key={activity.id} activity={activity} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 px-5 py-8 text-center dark:border-slate-700">
            <HeartHandshake className="h-5 w-5 text-slate-400" />
            <p className="mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              No accomplished projects yet
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Published project reports will appear here.
            </p>
            <Link
              href="/project-center"
              className="mt-3 text-xs font-semibold text-[#0D3594] dark:text-blue-300"
            >
              View active projects
            </Link>
          </div>
        )}
      </section>
      <p className="text-right text-[10px] text-slate-400">
        Updated {formatManila(new Date())} · Manila time
      </p>
    </main>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  href,
  detail,
  tone = "default",
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  detail?: string;
  tone?: "default" | "amber" | "blue" | "emerald" | "violet";
}) {
  const toneStyles: Record<string, { card: string; iconBox: string }> = {
    default: {
      card: "border-[#EDEDF2] bg-white dark:border-slate-800 dark:bg-[#161B26]",
      iconBox: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    },
    blue: {
      card: "border-[#EDEDF2] bg-white hover:border-blue-300 dark:border-slate-800 dark:bg-[#161B26] dark:hover:border-blue-500/40",
      iconBox: "bg-blue-500/10 text-[#0D3594] dark:text-blue-400",
    },
    emerald: {
      card: "border-[#EDEDF2] bg-white hover:border-emerald-300 dark:border-slate-800 dark:bg-[#161B26] dark:hover:border-emerald-500/40",
      iconBox: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    violet: {
      card: "border-[#EDEDF2] bg-white hover:border-violet-300 dark:border-slate-800 dark:bg-[#161B26] dark:hover:border-violet-500/40",
      iconBox: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    },
    amber: {
      card: "border-amber-200 bg-amber-50/60 dark:border-amber-500/20 dark:bg-amber-500/5",
      iconBox: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    },
  };
  const style = toneStyles[tone] || toneStyles.default;

  return (
    <Link
      href={href}
      className={`group relative overflow-hidden rounded-2xl border p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${style.card}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          {label}
        </span>
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition group-hover:scale-105 ${style.iconBox}`}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2.5 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111625] dark:text-white">
        {value}
      </p>
      {detail && (
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
          {detail}
        </p>
      )}
    </Link>
  );
}
