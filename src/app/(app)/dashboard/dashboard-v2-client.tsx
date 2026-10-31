"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarDays, Check, Clock3, FileText, HeartHandshake, Receipt, ShieldAlert, Users } from "lucide-react";
import type { ActivitySummaryDTO } from "@/features/activities/types";
import { selfCheckInAction } from "@/features/activities/actions";
import { formatPHP } from "@/lib/utils/money";
import { formatManila } from "@/lib/utils/dates";
import type { LeaderboardEntry } from "@/lib/services/rewards";
import { ActivityStatusBadge, KindBadge } from "../project-center/_components/badges";
import { ActivityCard, formatActivityWhen, isRsvpOpen } from "../project-center/_components/activity-card";
import { RsvpButtons } from "../project-center/_components/rsvp-buttons";

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
}: {
  user: { id: string; fullName: string; email: string } | null;
  metrics: Metrics;
  upcoming: ActivitySummaryDTO[];
  highlights: ActivitySummaryDTO[];
  leaderboard: LeaderboardEntry[];
}) {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const firstName = user?.fullName?.trim().split(/\s+/)[0] || "there";
  const hour = Number(new Intl.DateTimeFormat("en", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Manila" }).format(new Date()));
  const salutation = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  function checkIn(activityId: string) {
    setPendingId(activityId);
    setNotice(null);
    startTransition(async () => {
      const result = await selfCheckInAction(activityId);
      setPendingId(null);
      setNotice(result.success ? result.message || "Check-in recorded." : result.error || "Could not check in.");
      if (result.success) router.refresh();
    });
  }

  return (
    <main className="space-y-6 pb-10">
      <header className="flex flex-col gap-4 border-b border-[#EDEDF2] pb-5 sm:flex-row sm:items-end sm:justify-between dark:border-slate-800">
        <div>
          <p className="text-[11px] font-semibold uppercase text-slate-500">Rotaract Club of San Pedro East · District 3820</p>
          <h1 className="mt-1 text-2xl font-bold text-[#111625] dark:text-white">Hello, {firstName}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{salutation}. Here is what is happening with your club.</p>
        </div>
        <Link href="/project-center" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0D3594] hover:underline dark:text-blue-300">Open Project Center <ArrowRight className="h-3.5 w-3.5" /></Link>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Club snapshot">
        <Metric label="Upcoming activities" value={metrics.upcomingEvents} icon={CalendarDays} href="/project-center?view=calendar" />
        <Metric label="Active members" value={metrics.activeMembers} icon={Users} href="/members" detail={metrics.aspirants ? `${metrics.aspirants} aspirant${metrics.aspirants === 1 ? "" : "s"}` : undefined} />
        <Metric label="Reports to review" value={metrics.reportsToReview} icon={FileText} href="/project-center?status=AWAITING_REPORT" />
        <Metric label="Retention alerts" value={metrics.retentionAlerts} icon={ShieldAlert} href="/retention-alerts" tone={metrics.retentionAlerts ? "amber" : "default"} />
      </section>

      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">{notice}</p>}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,.8fr)]">
        <div className="space-y-3">
          <header className="flex items-end justify-between gap-3"><div><h2 className="text-base font-bold text-[#111625] dark:text-white">Upcoming Events</h2><p className="mt-0.5 text-xs text-slate-500">Your next club activities.</p></div><Link href="/project-center?view=calendar" className="text-xs font-semibold text-[#0D3594] hover:underline dark:text-blue-300">Calendar</Link></header>
          <div className="divide-y divide-[#EDEDF2] overflow-hidden rounded-xl border border-[#EDEDF2] bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-[#161B26]">
            {upcoming.map((activity) => (
              <article key={activity.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><KindBadge kind={activity.kind} meetingType={activity.meetingType} /><ActivityStatusBadge status={activity.status} /></div>
                  <Link href={`/project-center/${activity.id}`} className="mt-2 block truncate text-sm font-bold text-[#111625] hover:text-[#0D3594] dark:text-white dark:hover:text-blue-300">{activity.title}</Link>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500"><span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />{formatActivityWhen(activity)}</span>{activity.location && <span className="truncate">{activity.location}</span>}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {activity.rsvpEnabled && isRsvpOpen(activity) && <RsvpButtons activityId={activity.id} current={activity.myRsvp} compact />}
                  {activity.selfCheckInEnabled && !activity.checkedIn && <button type="button" disabled={pendingId === activity.id} onClick={() => checkIn(activity.id)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-semibold text-white disabled:opacity-60"><Check className="h-3.5 w-3.5" />{pendingId === activity.id ? "Checking in" : "Check in as me"}</button>}
                  {activity.checkedIn && <span className="text-[11px] font-semibold text-emerald-700">Checked in</span>}
                </div>
              </article>
            ))}
            {upcoming.length === 0 && <div className="px-5 py-10 text-center"><CalendarDays className="mx-auto h-5 w-5 text-slate-400" /><p className="mt-2 text-xs text-slate-500">No upcoming activities are scheduled.</p></div>}
          </div>
        </div>

        <aside className="space-y-4">
          <section className="rounded-xl border border-[#EDEDF2] bg-white p-4 dark:border-slate-800 dark:bg-[#161B26]">
            <header className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><Receipt className="h-4 w-4 text-amber-600" /><h2 className="text-sm font-bold text-[#111625] dark:text-white">Outstanding Dues</h2></div><Link href="/treasury" aria-label="Open treasury" className="rounded p-1 text-slate-400 hover:text-[#0D3594]"><ArrowRight className="h-4 w-4" /></Link></header>
            <p className="mt-4 text-2xl font-bold text-[#111625] dark:text-white">{formatPHP(metrics.outstandingDues)}</p>
            <p className="mt-1 text-xs text-slate-500">Your unpaid invoices and dues.</p>
            <Link href="/treasury" className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-[#EDEDF2] px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Review dues <ArrowRight className="h-3.5 w-3.5" /></Link>
          </section>
          <section className="rounded-xl border border-[#EDEDF2] bg-white p-4 dark:border-slate-800 dark:bg-[#161B26]">
            <header className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><FileText className="h-4 w-4 text-blue-700 dark:text-blue-300" /><h2 className="text-sm font-bold text-[#111625] dark:text-white">Approvals & Finance</h2></div><Link href="/budgets" className="text-[11px] font-semibold text-[#0D3594] dark:text-blue-300">Open queue</Link></header>
            <div className="mt-4 flex items-center justify-between border-t border-[#EDEDF2] pt-3 text-xs dark:border-slate-800"><span className="text-slate-500">Budget requests</span><span className="font-bold text-[#111625] dark:text-white">{metrics.pendingBudgets} pending</span></div>
            <div className="mt-3 flex items-center justify-between border-t border-[#EDEDF2] pt-3 text-xs dark:border-slate-800"><span className="text-slate-500">Aspirant members</span><span className="font-bold text-[#111625] dark:text-white">{metrics.aspirants}</span></div>
          </section>
          <section className="rounded-xl border border-[#EDEDF2] bg-white p-4 dark:border-slate-800 dark:bg-[#161B26]">
            <header className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><HeartHandshake className="h-4 w-4 text-emerald-600" /><h2 className="text-sm font-bold text-[#111625] dark:text-white">Member Engagement</h2></div><Link href="/members" className="text-[11px] font-semibold text-[#0D3594] dark:text-blue-300">Members</Link></header>
            <p className="mt-3 text-xs text-slate-500">Your Rotary Year points</p>
            <p className="mt-0.5 text-2xl font-bold text-[#111625] dark:text-white">{metrics.myPoints}<span className="ml-1 text-xs font-semibold text-slate-500">pts</span></p>
            {leaderboard.length > 0 && <ol className="mt-3 space-y-2 border-t border-[#EDEDF2] pt-3 dark:border-slate-800">{leaderboard.slice(0, 3).map((entry, index) => <li key={entry.profileId} className="flex items-center gap-2 text-xs"><span className="w-4 text-[10px] font-bold text-slate-400">{index + 1}</span><span className={`min-w-0 flex-1 truncate ${entry.profileId === user?.id ? "font-bold text-[#0D3594] dark:text-blue-300" : "text-slate-600 dark:text-slate-300"}`}>{entry.fullName}</span><span className="font-semibold text-slate-700 dark:text-slate-200">{entry.points}</span></li>)}</ol>}
            {leaderboard.length === 0 && <p className="mt-2 text-[11px] text-slate-500">Points are awarded for activity check-ins and completed tasks.</p>}
          </section>
        </aside>
      </section>

      <section className="space-y-3">
        <header className="flex items-end justify-between gap-3"><div><h2 className="text-base font-bold text-[#111625] dark:text-white">Project Highlights</h2><p className="mt-0.5 text-xs text-slate-500">Recently accomplished service projects.</p></div><Link href="/project-center?kind=SERVICE_PROJECT" className="text-xs font-semibold text-[#0D3594] hover:underline dark:text-blue-300">All projects</Link></header>
        {highlights.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{highlights.map((activity) => <ActivityCard key={activity.id} activity={activity} />)}</div> : <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 px-5 py-8 text-center dark:border-slate-700"><HeartHandshake className="h-5 w-5 text-slate-400" /><p className="mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">No accomplished projects yet</p><p className="mt-1 text-[11px] text-slate-500">Published project reports will appear here.</p><Link href="/project-center" className="mt-3 text-xs font-semibold text-[#0D3594] dark:text-blue-300">View active projects</Link></div>}
      </section>
      <p className="text-right text-[10px] text-slate-400">Updated {formatManila(new Date())} · Manila time</p>
    </main>
  );
}

function Metric({ label, value, icon: Icon, href, detail, tone = "default" }: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; href: string; detail?: string; tone?: "default" | "amber" }) {
  return (
    <Link href={href} className={`group rounded-xl border p-3.5 transition hover:shadow-sm ${tone === "amber" ? "border-amber-200 bg-amber-50/60 dark:border-amber-500/20 dark:bg-amber-500/5" : "border-[#EDEDF2] bg-white dark:border-slate-800 dark:bg-[#161B26]"}`}>
      <div className="flex items-center justify-between"><span className="text-[11px] font-semibold text-slate-500">{label}</span><Icon className={`h-4 w-4 ${tone === "amber" ? "text-amber-600" : "text-slate-400"}`} /></div>
      <p className="mt-2 text-2xl font-bold text-[#111625] dark:text-white">{value}</p>
      {detail && <p className="mt-0.5 text-[10px] text-slate-500">{detail}</p>}
    </Link>
  );
}