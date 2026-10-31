"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Clock3,
  Trophy,
  Users,
} from "lucide-react";
import type { MemberDTO } from "@/features/members/queries";
import type { MemberRewardsProfile } from "@/lib/services/rewards";
import { StatusBadge } from "@/components/shared/badge";
import { formatManila } from "@/lib/utils/dates";

export function MemberProfileClient({
  member,
  rewards,
  isSelf,
}: {
  member: MemberDTO;
  rewards: MemberRewardsProfile;
  isSelf: boolean;
}) {
  const initials = member.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <main className="mx-auto max-w-5xl space-y-5 pb-10">
      <Link
        href="/members"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#0D3594]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Members
      </Link>

      <section className="flex flex-col gap-4 rounded-2xl border border-[#EDEDF2] bg-white p-4 sm:flex-row sm:items-center sm:p-6 dark:border-slate-800 dark:bg-[#161B26]">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#E2EBFF] text-lg font-bold text-[#0D3594] dark:bg-blue-500/15 dark:text-blue-300">
          {initials || "?"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-[#111625] dark:text-white">
              {member.name}
            </h1>
            <StatusBadge status={member.status} />
            {isSelf && (
              <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                Your profile
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-sm text-slate-500">{member.email}</p>
          <p className="mt-1 text-xs text-slate-500">
            {member.role} · {member.classification}
            {member.rotaryId
              ? ` · Rotary ID ${member.rotaryId}`
              : " · Rotary ID pending"}
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-[10px] font-semibold uppercase text-slate-500">
            Member since
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
            {member.joinedDate}
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <header className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-[#111625] dark:text-white">
              Member engagement
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Verified participation and earned achievements for Rotary Year{" "}
              {rewards.rotaryYear}.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
            <Trophy className="h-3.5 w-3.5" /> {rewards.points} points
          </span>
        </header>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric
            icon={CheckCircle2}
            label="Activity check-ins"
            value={rewards.checkIns}
          />
          <Metric
            icon={Users}
            label="Service projects"
            value={rewards.serviceCheckIns}
          />
          <Metric
            icon={Award}
            label="Badges earned"
            value={rewards.badges.length}
          />
          <Metric
            icon={Trophy}
            label="Task completions"
            value={rewards.tasksCompleted}
          />
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,.9fr)]">
        <div className="rounded-xl border border-[#EDEDF2] bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-[#161B26]">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-[#111625] dark:text-white">
              Achievements
            </h2>
            <span className="text-[11px] text-slate-500">
              {rewards.badges.length} earned
            </span>
          </div>
          {rewards.badges.length ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {rewards.badges.map((badge) => (
                <article
                  key={badge.key}
                  className="flex items-start gap-3 rounded-lg border border-amber-100 bg-amber-50/60 p-3 dark:border-amber-500/15 dark:bg-amber-500/5"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                    <Award className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-slate-800 dark:text-slate-100">
                      {badge.name}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-slate-500">
                      {badge.description}
                    </span>
                    <span className="mt-1 block text-[10px] text-slate-400">
                      Earned {formatManila(badge.awardedAt, "MMM d, yyyy")}
                    </span>
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center dark:border-slate-700">
              <Award className="mx-auto h-5 w-5 text-slate-400" />
              <p className="mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                No badges earned yet
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Verified activity attendance and completed tasks count toward
                achievements.
              </p>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[#EDEDF2] bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-[#161B26]">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-[#111625] dark:text-white">
              Recent points
            </h2>
            <span className="text-[11px] text-slate-500">This Rotary Year</span>
          </div>
          {rewards.recent.length ? (
            <ol className="mt-3 divide-y divide-[#EDEDF2] dark:divide-slate-800">
              {rewards.recent.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-start gap-2.5 py-3 first:pt-1"
                >
                  <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {entry.reason}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-slate-500">
                      {formatManila(entry.createdAt)}
                    </span>
                  </span>
                  <span
                    className={`text-xs font-bold ${entry.points < 0 ? "text-rose-600" : "text-emerald-700 dark:text-emerald-300"}`}
                  >
                    {entry.points > 0 ? "+" : ""}
                    {entry.points}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 text-xs text-slate-500">
              Points from activity check-ins and completed tasks will appear
              here.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-[#EDEDF2] bg-white p-3.5 dark:border-slate-800 dark:bg-[#161B26]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-slate-500">
          {label}
        </span>
        <Icon className="h-4 w-4 text-slate-400" />
      </div>
      <p className="mt-2 text-2xl font-bold text-[#111625] dark:text-white">
        {value}
      </p>
    </div>
  );
}
