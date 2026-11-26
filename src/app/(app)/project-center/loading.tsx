import React from "react";

export default function ProjectCenterLoading() {
  return (
    <main
      className="space-y-5 pb-12"
      aria-busy="true"
      aria-label="Loading Project Center"
    >
      {/* Header skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="h-3 w-28 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-7 w-44 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-4 w-72 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        </div>
        <div className="flex gap-2.5">
          <div className="h-11 w-28 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
          <div className="h-11 w-32 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
        </div>
      </div>

      {/* Stage tabs skeleton */}
      <div className="flex gap-4 border-b border-[#EDEDF2] pb-2 dark:border-slate-800">
        {[1, 2, 3, 4].map((idx) => (
          <div
            key={idx}
            className="h-7 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-800"
          />
        ))}
      </div>

      {/* Toolbar skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <div className="h-11 w-56 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
          <div className="h-11 w-28 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
          <div className="h-11 w-32 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
        </div>
        <div className="h-11 w-48 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
      </div>

      {/* 4-column rows skeleton */}
      <div className="overflow-hidden rounded-xl border border-[#EDEDF2] bg-white dark:border-slate-800 dark:bg-[#161B26]">
        {[1, 2, 3, 4, 5].map((row) => (
          <div
            key={row}
            className="grid gap-3 border-b border-[#EDEDF2] px-4 py-4 last:border-b-0 dark:border-slate-800 md:grid-cols-[minmax(240px,2.2fr)_minmax(160px,1fr)_minmax(165px,1fr)_auto] md:items-center md:gap-4"
          >
            <div className="space-y-2">
              <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            </div>
            <div className="space-y-1.5">
              <div className="h-3.5 w-28 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-3 w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            </div>
            <div className="space-y-1.5">
              <div className="h-5 w-20 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
              <div className="h-3 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            </div>
            <div className="flex justify-end gap-2">
              <div className="h-11 w-24 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
              <div className="h-11 w-11 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

