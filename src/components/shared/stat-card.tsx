import React from "react";
import { LucideIcon } from "lucide-react";

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: "primary" | "secondary" | "accent" | "emerald";
  trend?: {
    value: string;
    isPositive?: boolean;
  };
}

const VARIANT_ICONS: Record<string, string> = {
  primary: "text-[#0D3594] bg-[#E2EBFF] dark:text-blue-400 dark:bg-blue-950/50",
  secondary: "text-[#4F75FF] bg-[#E7EDFF] dark:text-indigo-400 dark:bg-indigo-950/50",
  accent: "text-[#D97706] bg-[#FFF3E4] dark:text-amber-400 dark:bg-amber-950/50",
  emerald: "text-[#17A863] bg-[#E7F8F0] dark:text-emerald-400 dark:bg-emerald-950/50",
};

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = "primary",
  trend,
}: StatCardProps) {
  const iconColor = VARIANT_ICONS[variant] || VARIANT_ICONS.primary;

  return (
    <div className="bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800/80 rounded-2xl p-6 transition-all hover:border-slate-300 dark:hover:border-slate-700">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-[#6B7280] dark:text-slate-400">{title}</p>
        <div className={`p-2.5 rounded-xl ${iconColor}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="mt-4 flex items-baseline gap-2.5">
        <h3 className="text-3xl font-extrabold tracking-tight text-[#111625] dark:text-white leading-none">
          {value}
        </h3>
        {trend && (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11.5px] font-semibold border ${
              trend.isPositive !== false
                ? "bg-[#E7F8F0] text-[#17A863] border-[#17A863]/20"
                : "bg-[#FEECEB] text-[#E54335] border-[#E54335]/20"
            }`}
          >
            {trend.value}
          </span>
        )}
      </div>
      {subtitle && (
        <p className="mt-2 text-[12px] text-[#8E95A5] dark:text-slate-400 font-medium">{subtitle}</p>
      )}
    </div>
  );
}

