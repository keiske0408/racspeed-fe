"use client";

import React from "react";
import Link from "next/link";
import { CheckSquare, Clock, MapPin, MessageSquare, Users } from "lucide-react";
import { formatManila } from "@/lib/utils/dates";
import { ACTIVITY_KIND_META, type ActivitySummaryDTO } from "@/features/activities/types";
import { minMembersStatus } from "@/features/activities/rules";
import { ActivityStatusBadge, KindBadge, ProgressBar } from "./badges";
import { RsvpButtons } from "./rsvp-buttons";

export function formatActivityWhen(a: Pick<ActivitySummaryDTO, "startAt" | "endAt" | "allDay">) {
  if (a.allDay) {
    const start = formatManila(a.startAt, "EEE, MMM d");
    const end = formatManila(a.endAt, "EEE, MMM d");
    return start === end ? `${start} · All day` : `${start} – ${end}`;
  }
  const sameDay = formatManila(a.startAt, "yyyy-MM-dd") === formatManila(a.endAt, "yyyy-MM-dd");
  return sameDay
    ? `${formatManila(a.startAt, "EEE, MMM d · h:mm a")} – ${formatManila(a.endAt, "h:mm a")}`
    : `${formatManila(a.startAt, "MMM d, h:mm a")} – ${formatManila(a.endAt, "MMM d, h:mm a")}`;
}

export function isRsvpOpen(a: ActivitySummaryDTO, now = new Date()) {
  if (!a.rsvpEnabled || !["PLANNED", "ONGOING"].includes(a.status)) return false;
  const deadline = new Date(a.rsvpDeadline || a.startAt);
  return now <= deadline;
}

export function ActivityCard({ activity, layout = "grid" }: { activity: ActivitySummaryDTO; layout?: "grid" | "board" }) {
  const meta = ACTIVITY_KIND_META[activity.kind];
  const minStatus = minMembersStatus(activity.rsvp.going, activity.minMembersRequired);
  const rsvpOpen = isRsvpOpen(activity);

  return (
    <div className="group relative rounded-2xl border border-[#EDEDF2] dark:border-slate-800 bg-white dark:bg-[#161B26] overflow-hidden hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition">
      {layout === "grid" &&
        (activity.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={activity.coverUrl} alt="" className="h-32 w-full object-cover" />
        ) : (
          <div className={`h-1.5 w-full ${meta.dotClass}`} />
        ))}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <KindBadge kind={activity.kind} meetingType={activity.meetingType} />
          <ActivityStatusBadge status={activity.status} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-[#111625] dark:text-white leading-snug line-clamp-2 group-hover:text-[#0D3594] dark:group-hover:text-blue-300">
            <Link href={`/project-center/${activity.id}`} className="after:absolute after:inset-0 focus:outline-none">
              {activity.title}
            </Link>
          </h3>
          {activity.shortDescription && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{activity.shortDescription}</p>
          )}
        </div>
        <div className="space-y-1 text-[11.5px] text-slate-600 dark:text-slate-300">
          <p className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{formatActivityWhen(activity)}</span>
          </p>
          {activity.location && (
            <p className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{activity.location}</span>
            </p>
          )}
        </div>

        {minStatus.required ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-600 dark:text-slate-300">
                {minStatus.confirmed}/{minStatus.required} minimum confirmed
              </span>
              {!minStatus.met && <span className="text-amber-600 font-semibold">{minStatus.shortfall} more needed</span>}
            </div>
            <ProgressBar value={minStatus.confirmed} max={minStatus.required} tone={minStatus.met ? "emerald" : "amber"} />
          </div>
        ) : null}

        <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1" title="Going">
            <Users className="w-3.5 h-3.5" /> {activity.rsvp.going}
          </span>
          {activity.tasksTotal > 0 && (
            <span className="inline-flex items-center gap-1" title="Tasks done">
              <CheckSquare className="w-3.5 h-3.5" /> {activity.tasksDone}/{activity.tasksTotal}
            </span>
          )}
          {activity.commentsCount > 0 && (
            <span className="inline-flex items-center gap-1" title="Comments">
              <MessageSquare className="w-3.5 h-3.5" /> {activity.commentsCount}
            </span>
          )}
          {activity.checkedIn && <span className="ml-auto text-emerald-600 font-semibold">Checked in</span>}
        </div>

        {rsvpOpen && layout === "grid" && (
          <div className="relative z-10">
            <RsvpButtons activityId={activity.id} current={activity.myRsvp} compact />
          </div>
        )}
      </div>
    </div>
  );
}
