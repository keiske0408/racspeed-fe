"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Award,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  FolderKanban,
  MapPin,
  Sparkles,
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

  const attendedList = rewards.attendedActivities || [];

  return (
    <main className="mx-auto max-w-5xl space-y-6 pb-12">
      <Link
        href="/members"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#0D3594]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Members Directory
      </Link>

      {/* Member Identity Banner */}
      <section className="flex flex-col gap-4 rounded-2xl border border-[#EDEDF2] bg-white p-5 sm:flex-row sm:items-center sm:p-6 shadow-2xs dark:border-slate-800 dark:bg-[#161B26]">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0D3594] to-blue-600 text-xl font-bold text-white shadow-sm">
          {initials || "?"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-[#111625] dark:text-white">
              {member.name}
            </h1>
            <StatusBadge status={member.status} />
            {isSelf && (
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-[#0D3594] border border-blue-200 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
                Your Profile
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-sm text-slate-500">{member.email}</p>
          <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            {member.role} · {member.classification}
            {member.rotaryId
              ? ` · Rotary ID ${member.rotaryId}`
              : " · Rotary ID pending"}
          </p>
        </div>
        <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100 dark:border-slate-800">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Member since
          </p>
          <p className="mt-0.5 text-sm font-bold text-slate-700 dark:text-slate-200">
            {member.joinedDate}
          </p>
        </div>
      </section>

      {/* Engagement Summary KPIs */}
      <section className="space-y-3">
        <header className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-[#111625] dark:text-white">
              Member Engagement & Points
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Verified project participation, attendance, and earned points for Rotary Year{" "}
              {rewards.rotaryYear}.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-extrabold text-amber-800 shadow-2xs dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
            <Trophy className="h-4 w-4 text-amber-500" /> {rewards.points} Total Points
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

      {/* Points Breakdown & Achievements Grid */}
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,.8fr)]">
        {/* Detailed Where You Got Your Points Card */}
        <div className="rounded-2xl border border-[#EDEDF2] bg-white p-4 sm:p-5 shadow-2xs dark:border-slate-800 dark:bg-[#161B26]">
          <div className="flex items-center justify-between gap-2 border-b border-[#EDEDF2] pb-3 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-[#111625] dark:text-white flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Where You Earned Your Points
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Complete breakdown of projects attended, check-ins, and tasks completed.
              </p>
            </div>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              RY {rewards.rotaryYear}
            </span>
          </div>

          {rewards.recent.length ? (
            <ol className="mt-3 divide-y divide-[#EDEDF2] dark:divide-slate-800">
              {rewards.recent.map((entry) => {
                const isService = entry.sourceType === "SERVICE_CHECK_IN";
                const isTask = entry.sourceType === "TASK_COMPLETED";
                return (
                  <li
                    key={entry.id}
                    className="flex items-start justify-between gap-3 py-3.5 first:pt-1"
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <span
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                          isService
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : isTask
                              ? "bg-violet-500/10 text-violet-600 dark:text-violet-400"
                              : "bg-blue-500/10 text-[#0D3594] dark:text-blue-400"
                        }`}
                      >
                        {isService ? (
                          <Users className="h-4 w-4" />
                        ) : isTask ? (
                          <Trophy className="h-4 w-4" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="inline-block rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {entry.categoryLabel ||
                              entry.sourceType.replaceAll("_", " ")}
                          </span>
                          {entry.volunteerHours != null &&
                            entry.volunteerHours > 0 && (
                              <span className="inline-block rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                                {entry.volunteerHours}h service
                              </span>
                            )}
                        </div>

                        {entry.projectTitle ? (
                          entry.activityId ? (
                            <Link
                              href={`/project-center/${entry.activityId}`}
                              className="mt-1 inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-[#111625] hover:text-[#0D3594] dark:text-white dark:hover:text-blue-300 transition"
                            >
                              <span>{entry.projectTitle}</span>
                              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                            </Link>
                          ) : (
                            <p className="mt-1 text-xs sm:text-sm font-bold text-[#111625] dark:text-white">
                              {entry.projectTitle}
                            </p>
                          )
                        ) : null}

                        <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                          {entry.reason}
                        </p>
                        <span className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                          <Clock3 className="h-3 w-3" />
                          {formatManila(entry.createdAt)}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-extrabold ${
                        entry.points < 0
                          ? "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
                          : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                      }`}
                    >
                      {entry.points > 0 ? "+" : ""}
                      {entry.points} pts
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center dark:border-slate-700">
              <Trophy className="mx-auto h-5 w-5 text-slate-400" />
              <p className="mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                No points recorded yet
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Points from project check-ins, meetings, and completed tasks will appear here with the exact project name.
              </p>
            </div>
          )}
        </div>

        {/* Achievements & Badges Card */}
        <div className="rounded-2xl border border-[#EDEDF2] bg-white p-4 sm:p-5 shadow-2xs dark:border-slate-800 dark:bg-[#161B26]">
          <div className="flex items-center justify-between gap-2 border-b border-[#EDEDF2] pb-3 dark:border-slate-800">
            <h2 className="text-sm font-bold text-[#111625] dark:text-white">
              Achievements & Badges
            </h2>
            <span className="text-[11px] font-semibold text-slate-500">
              {rewards.badges.length} earned
            </span>
          </div>
          {rewards.badges.length ? (
            <div className="mt-4 grid gap-2.5">
              {rewards.badges.map((badge) => (
                <article
                  key={badge.key}
                  className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50/60 p-3 dark:border-amber-500/15 dark:bg-amber-500/5"
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
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center dark:border-slate-700">
              <Award className="mx-auto h-5 w-5 text-slate-400" />
              <p className="mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                No badges earned yet
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Verified activity attendance and completed tasks count toward achievements.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Attended Projects & Activities History */}
      <section className="rounded-2xl border border-[#EDEDF2] bg-white p-4 sm:p-5 shadow-2xs dark:border-slate-800 dark:bg-[#161B26]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EDEDF2] pb-3 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-bold text-[#111625] dark:text-white flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-[#0D3594] dark:text-blue-400" />
              Projects & Activities Attended
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Verified attendance log showing which projects and club events {isSelf ? "you" : member.name} participated in.
            </p>
          </div>
          <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-[#0D3594] dark:bg-blue-500/10 dark:text-blue-300">
            {attendedList.length} attended
          </span>
        </div>

        {attendedList.length > 0 ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {attendedList.map((item) => (
              <article
                key={item.id}
                className="flex flex-col justify-between rounded-xl border border-[#EDEDF2] bg-slate-50/50 p-3.5 hover:border-blue-300 transition dark:border-slate-800 dark:bg-slate-900/40 dark:hover:border-blue-500/40"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-[#0D3594] dark:text-blue-300">
                      <FolderKanban className="h-3 w-3" />
                      {item.kind.replaceAll("_", " ")}
                    </span>
                    <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                      +{item.pointsEarned} pts
                    </span>
                  </div>

                  {item.activityId ? (
                    <Link
                      href={`/project-center/${item.activityId}`}
                      className="mt-2 block text-sm font-bold text-[#111625] hover:text-[#0D3594] dark:text-white dark:hover:text-blue-300 transition"
                    >
                      {item.title}
                    </Link>
                  ) : (
                    <h3 className="mt-2 text-sm font-bold text-[#111625] dark:text-white">
                      {item.title}
                    </h3>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="h-3 w-3 text-slate-400" />
                      {formatManila(item.attendedAt, "MMM d, yyyy · h:mm a")}
                    </span>
                    {item.location && (
                      <span className="inline-flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3 text-slate-400" />
                        {item.location}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-[#EDEDF2] pt-2.5 text-[11px] dark:border-slate-800">
                  <span className="text-slate-500">
                    Method: <strong className="text-slate-700 dark:text-slate-300">{item.checkInMethod}</strong>
                  </span>
                  {item.volunteerHours > 0 && (
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {item.volunteerHours} Volunteer Hours
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center dark:border-slate-700">
            <CalendarCheck className="mx-auto h-5 w-5 text-slate-400" />
            <p className="mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              No attended projects recorded yet
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Check in to club activities or service projects via QR or Self Check-in to build your attendance record.
            </p>
          </div>
        )}
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
    <div className="rounded-xl border border-[#EDEDF2] bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-[#161B26]">
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
