import React from "react";
import { LucideIcon } from "lucide-react";

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: "primary" | "secondary" | "accent" | "emerald";
}

const VARIANT_ICONS: Record<string, string> = {
  primary: "text-rose-500 bg-rose-500/10 dark:bg-rose-500/20",
  secondary: "text-blue-500 bg-blue-500/10 dark:bg-blue-500/20",
  accent: "text-amber-500 bg-amber-500/10 dark:bg-amber-500/20",
  emerald: "text-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/20",
};

export function StatCard({ title, value, subtitle, icon: Icon, variant = "primary" }: StatCardProps) {
  const iconColor = VARIANT_ICONS[variant] || VARIANT_ICONS.primary;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs transition hover:shadow-md">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
        <div className={`p-2 rounded-lg ${iconColor}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="mt-3">
        <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">{value}</h3>
        {subtitle && (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
