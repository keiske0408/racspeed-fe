import React from "react";

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
  return (
    <section aria-label={title}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#EDEDF2] bg-slate-50/80 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900/60">
        <div className="flex flex-wrap items-baseline gap-2.5">
          <h2
            className={`text-[11px] font-bold uppercase tracking-wider ${
              tone === "attention"
                ? "text-amber-800 dark:text-amber-400"
                : "text-slate-600 dark:text-slate-300"
            }`}
          >
            {title} · {count}
          </h2>
          {subtitle && (
            <span className="text-xs text-slate-600 dark:text-slate-400">
              {subtitle}
            </span>
          )}
        </div>
      </div>
      <div>{children}</div>
    </section>
  );
}

