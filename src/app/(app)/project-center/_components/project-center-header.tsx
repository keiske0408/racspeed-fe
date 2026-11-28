"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  Download,
  FileSpreadsheet,
  Image as ImageIcon,
  Images,
  Plus,
  Presentation,
} from "lucide-react";

export function ProjectCenterHeader({
  rotaryYear,
  availableRotaryYears,
  currentRotaryYear,
  onRotaryYearChange,
  canCreate,
  onOpenExportCalendar,
  onOpenPresentation,
  onOpenQuickSummary,
}: {
  rotaryYear: string;
  availableRotaryYears: string[];
  currentRotaryYear: string;
  onRotaryYearChange: (ry: string) => void;
  canCreate: boolean;
  onOpenExportCalendar?: () => void;
  onOpenPresentation?: () => void;
  onOpenQuickSummary?: () => void;
}) {
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement | null>(null);

  const hasExportActions = Boolean(
    onOpenQuickSummary || onOpenExportCalendar || onOpenPresentation,
  );

  useEffect(() => {
    if (!exportOpen) return;
    function handleOutside(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setExportOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [exportOpen]);

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

        {hasExportActions && (
          <div ref={exportRef} className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={exportOpen}
              onClick={() => setExportOpen((prev) => !prev)}
              className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-xl border border-[#DDE1EA] bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-[#161B26] dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Download className="h-3.5 w-3.5 shrink-0 text-[#0D3594] dark:text-blue-400" aria-hidden="true" />
              <span>Export</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
            </button>

            {exportOpen && (
              <div
                role="menu"
                aria-label="Export options"
                className="absolute right-0 z-40 mt-1.5 w-72 rounded-xl border border-[#EDEDF2] bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-[#161B26]"
              >
                {onOpenQuickSummary && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setExportOpen(false);
                      onOpenQuickSummary();
                    }}
                    className="flex w-full cursor-pointer items-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <ImageIcon className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                    <div>
                      <p className="text-xs font-bold text-[#111625] dark:text-white">
                        Export Quick Summary (.png)
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Shareable GC summary cards or calendar image for projects &amp; tasks
                      </p>
                    </div>
                  </button>
                )}

                {onOpenExportCalendar && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setExportOpen(false);
                      onOpenExportCalendar();
                    }}
                    className="flex w-full cursor-pointer items-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <p className="text-xs font-bold text-[#111625] dark:text-white">
                        Export Excel Calendar (.xlsx)
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Styled monthly calendar grid &amp; task workbook
                      </p>
                    </div>
                  </button>
                )}

                {onOpenPresentation && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setExportOpen(false);
                      onOpenPresentation();
                    }}
                    className="flex w-full cursor-pointer items-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Presentation className="mt-0.5 h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" />
                    <div>
                      <p className="text-xs font-bold text-[#111625] dark:text-white">
                        Create Presentation (.pdf / .pptx)
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        AI-assisted deck from calendar &amp; member tasks
                      </p>
                    </div>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

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
