import React from "react";

export interface StatusBadgeProps {
  status: string;
  className?: string;
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  APPROVED: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  VERIFIED: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  PAID: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  INDUCTED: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",

  SUBMITTED: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/20",
  ISSUED: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/20",
  UNDER_REVIEW: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20",
  PENDING_APPROVAL: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20",
  PENDING: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20",
  REVISION_REQUESTED: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/20",
  NEEDS_CLARIFICATION: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/20",

  REJECTED: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20",
  SUSPENDED: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20",
  VOID: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20",
  CANCELLED: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/20",
  DRAFT: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/20",
};

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const normalized = status.toUpperCase();
  const style = STATUS_STYLES[normalized] || "bg-slate-500/10 text-slate-600 border-slate-400/20";
  const label = status.replace(/_/g, " ");

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border capitalize ${style} ${className}`}
    >
      {label.toLowerCase()}
    </span>
  );
}
