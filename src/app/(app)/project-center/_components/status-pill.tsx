import React from "react";
import {
  AlertTriangle,
  Archive,
  Ban,
  CalendarClock,
  CheckCircle2,
  FileEdit,
  FileText,
  PlayCircle,
} from "lucide-react";
import type { RowVisualStatus } from "@/features/activities/project-center-rules";

const STATUS_CONFIG: Record<
  RowVisualStatus,
  {
    label: string;
    className: string;
    Icon: React.ComponentType<{ className?: string }>;
  }
> = {
  PAST_DUE: {
    label: "Past due",
    className:
      "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/60 dark:text-amber-200",
    Icon: AlertTriangle,
  },
  DRAFT: {
    label: "Draft",
    className:
      "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
    Icon: FileEdit,
  },
  PLANNED: {
    label: "Planned",
    className:
      "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/40 dark:bg-blue-950/60 dark:text-blue-200",
    Icon: CalendarClock,
  },
  ONGOING: {
    label: "Ongoing",
    className:
      "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/50 dark:text-amber-200",
    Icon: PlayCircle,
  },
  AWAITING_REPORT: {
    label: "Report due",
    className:
      "border-orange-300 bg-orange-50 text-orange-900 dark:border-orange-500/40 dark:bg-orange-950/60 dark:text-orange-200",
    Icon: FileText,
  },
  ACCOMPLISHED: {
    label: "Accomplished",
    className:
      "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-950/60 dark:text-emerald-200",
    Icon: CheckCircle2,
  },
  COMPLETED: {
    label: "Completed",
    className:
      "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-950/60 dark:text-emerald-200",
    Icon: CheckCircle2,
  },
  CANCELLED: {
    label: "Cancelled",
    className:
      "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/40 dark:bg-rose-950/60 dark:text-rose-200",
    Icon: Ban,
  },
};

export function StatusPill({
  status,
  isArchived = false,
}: {
  status: RowVisualStatus;
  isArchived?: boolean;
}) {
  if (isArchived) {
    return (
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-dashed border-slate-400 bg-slate-100/90 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:border-slate-500 dark:bg-slate-800/90 dark:text-slate-300">
        <Archive className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span>Archived</span>
      </span>
    );
  }

  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.PLANNED;
  const Icon = config.Icon;

  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${config.className}`}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span>{config.label}</span>
    </span>
  );
}

