import React from "react";

export interface StatusBadgeProps {
  status: string;
  className?: string;
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE:
    "bg-[#E7F8F0] text-[#17A863] border-[#17A863]/20 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/20",
  ASPIRANT:
    "bg-[#E2EBFF] text-[#2563EB] border-[#2563EB]/20 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/20",
  APPROVED:
    "bg-[#E7F8F0] text-[#17A863] border-[#17A863]/20 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/20",
  VERIFIED:
    "bg-[#E7F8F0] text-[#17A863] border-[#17A863]/20 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/20",
  PAID: "bg-[#E7F8F0] text-[#17A863] border-[#17A863]/20 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/20",
  INDUCTED:
    "bg-[#E7F8F0] text-[#17A863] border-[#17A863]/20 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/20",
  COMPLETE:
    "bg-[#E7F8F0] text-[#17A863] border-[#17A863]/20 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/20",
  WON: "bg-[#E7F8F0] text-[#17A863] border-[#17A863]/20 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/20",

  SUBMITTED:
    "bg-[#E2EBFF] text-[#2563EB] border-[#2563EB]/20 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/20",
  ISSUED:
    "bg-[#E2EBFF] text-[#2563EB] border-[#2563EB]/20 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/20",
  DISCOVERY:
    "bg-[#F4EDFE] text-[#8244E8] border-[#8244E8]/20 dark:bg-purple-500/15 dark:text-purple-400 dark:border-purple-500/20",

  UNDER_REVIEW:
    "bg-[#FFF3E4] text-[#D97706] border-[#D97706]/20 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/20",
  AWAITING_REPORT:
    "bg-[#FFF3E4] text-[#D97706] border-[#D97706]/20 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/20",
  PENDING_APPROVAL:
    "bg-[#FFF3E4] text-[#D97706] border-[#D97706]/20 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/20",
  PENDING:
    "bg-[#FFF3E4] text-[#D97706] border-[#D97706]/20 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/20",
  UPCOMING:
    "bg-[#FFF3E4] text-[#D97706] border-[#D97706]/20 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/20",
  REVISION_REQUESTED:
    "bg-[#FFF3E4] text-[#D97706] border-[#D97706]/20 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/20",
  NEEDS_CLARIFICATION:
    "bg-[#FFF3E4] text-[#D97706] border-[#D97706]/20 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/20",

  REJECTED:
    "bg-[#FEECEB] text-[#E54335] border-[#E54335]/20 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/20",
  OVERDUE:
    "bg-[#FEECEB] text-[#E54335] border-[#E54335]/20 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/20",
  LOST: "bg-[#FEECEB] text-[#E54335] border-[#E54335]/20 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/20",
  SUSPENDED:
    "bg-[#FEECEB] text-[#E54335] border-[#E54335]/20 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/20",
  VOID: "bg-[#FEECEB] text-[#E54335] border-[#E54335]/20 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/20",

  CANCELLED:
    "bg-[#F3F4F8] text-[#6B7280] border-[#EDEDF2] dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
  DRAFT:
    "bg-[#F3F4F8] text-[#6B7280] border-[#EDEDF2] dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
};

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const normalized = status.toUpperCase();
  const style =
    STATUS_STYLES[normalized] ||
    "bg-[#F3F4F8] text-[#6B7280] border-[#EDEDF2] dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700";
  const label = status.replace(/_/g, " ");

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11.5px] font-semibold border capitalize tracking-tight ${style} ${className}`}
    >
      {label.toLowerCase()}
    </span>
  );
}
