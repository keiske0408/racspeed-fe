import React from "react";
import { AlertTriangle, CalendarDays } from "lucide-react";

export function ProjectGroup({
  title,
  count,
  subtitle,
  tone = "default",
  children,
}: {
  title: string;
  count: number;
  subtitle?: string;
  tone?: "attention" | "default";
  children: React.ReactNode;
}) {
  const isAttention = tone === "attention";

  return (
    <section
      aria-label={title}
      className={`overflow-hidden rounded-xl border bg-white dark:bg-[#161B26] ${
        isAttention
          ? "border-amber-300/70 dark:border-amber-500/35"
          : "border-[#EDEDF2] dark:border-slate-800"
      }`}
    >
      <div
        className={`flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 ${
          isAttention
            ? "border-amber-200/80 bg-amber-50/60 dark:border-amber-500/25 dark:bg-amber-950/25"
            : "border-[#EDEDF2] bg-slate-50/75 dark:border-slate-800 dark:bg-slate-900/50"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${
              isAttention
                ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
                : "bg-slate-200/80 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            {isAttention ? (
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </span>
          <h2
            className={`text-xs font-bold tracking-tight ${
              isAttention
                ? "text-amber-900 dark:text-amber-300"
                : "text-[#111625] dark:text-slate-100"
            }`}
          >
            {title}
          </h2>
          <span
            className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${
              isAttention
                ? "bg-amber-200/80 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300"
                : "bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            {count}
          </span>
        </div>
        {subtitle && (
          <span
            className={`text-xs font-medium ${
              isAttention
                ? "text-amber-800/80 dark:text-amber-300/75"
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            {subtitle}
          </span>
        )}
      </div>
      <div>{children}</div>
    </section>
  );
}

