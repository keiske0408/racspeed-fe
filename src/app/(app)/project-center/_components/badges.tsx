import React from "react";
import {
  ACTIVITY_KIND_META,
  ACTIVITY_STATUS_LABELS,
  MEETING_TYPE_LABELS,
  type ActivityKind,
  type ActivityStatus,
  type MeetingType,
} from "@/features/activities/types";

export function KindBadge({ kind, meetingType }: { kind: ActivityKind; meetingType?: MeetingType | null }) {
  const meta = ACTIVITY_KIND_META[kind];
  const label = kind === "MEETING" && meetingType ? MEETING_TYPE_LABELS[meetingType] : meta.label;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-semibold ${meta.chipClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dotClass}`} />
      {label}
    </span>
  );
}

const STATUS_CLASSES: Record<ActivityStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  PLANNED: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20",
  ONGOING: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20",
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20",
  AWAITING_REPORT: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-500/20",
  ACCOMPLISHED: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20",
  CANCELLED: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20",
};

export function ActivityStatusBadge({ status }: { status: ActivityStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold ${STATUS_CLASSES[status]}`}>
      {ACTIVITY_STATUS_LABELS[status]}
    </span>
  );
}

export function Avatar({ name, url, size = 28 }: { name: string; url?: string | null; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} width={size} height={size} className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />;
  }
  return (
    <span
      className="rounded-full bg-[#E2EBFF] text-[#0D3594] dark:bg-blue-500/15 dark:text-blue-300 font-bold flex items-center justify-center shrink-0"
      style={{ width: size, height: size, fontSize: Math.max(10, size / 2.6) }}
      aria-hidden="true"
    >
      {initials || "?"}
    </span>
  );
}

export function ProgressBar({ value, max, tone = "blue" }: { value: number; max: number; tone?: "blue" | "emerald" | "amber" | "rose" }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const color = { blue: "bg-[#0D3594]", emerald: "bg-emerald-500", amber: "bg-amber-500", rose: "bg-rose-500" }[tone];
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}
