"use client";

import React from "react";
import Link from "next/link";
import { Images, Plus } from "lucide-react";

export function ProjectCenterHeader({
  rotaryYear,
  availableRotaryYears,
  currentRotaryYear,
  onRotaryYearChange,
  canCreate,
}: {
  rotaryYear: string;
  availableRotaryYears: string[];
  currentRotaryYear: string;
  onRotaryYearChange: (ry: string) => void;
  canCreate: boolean;
}) {
  const yearOptions = Array.from(
    new Set([currentRotaryYear, ...availableRotaryYears].filter(Boolean)),
  )
    .sort()
    .reverse();

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-400">
          Club operations
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#111625] dark:text-white">
          Project Center
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          See what is coming up and what needs your attention.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <label htmlFor="project-center-ry-select" className="sr-only">
          Rotary Year
        </label>
        <select
          id="project-center-ry-select"
          aria-label="Rotary Year"
          value={rotaryYear}
          onChange={(e) => onRotaryYearChange(e.target.value)}
          className="min-h-[44px] rounded-xl border border-[#DDE1EA] bg-white px-3.5 py-2 text-xs font-semibold text-[#111625] outline-none transition hover:bg-slate-50 focus:border-[#0D3594] dark:border-slate-700 dark:bg-[#161B26] dark:text-slate-100 dark:hover:bg-slate-800"
        >
          {yearOptions.map((ry) => (
            <option key={ry} value={ry}>
              RY {ry}
            </option>
          ))}
          <option value="ALL">All Rotary Years</option>
        </select>

        <Link
          href="/project-center/moments"
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#DDE1EA] bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-[#161B26] dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Images className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Moments</span>
        </Link>

        {canCreate && (
          <Link
            href="/project-center/new"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#0D3594] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#092569]"
          >
            <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>New activity</span>
          </Link>
        )}
      </div>
    </header>
  );
}

