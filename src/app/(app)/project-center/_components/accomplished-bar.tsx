"use client";

import React from "react";

export function AccomplishedBar({
  accomplishedCount,
  archivableCount,
  archivedCount,
  canManageClub,
  pending = false,
  onViewAccomplished,
  onRequestBulkArchive,
  onViewArchived,
}: {
  accomplishedCount: number;
  archivableCount: number;
  archivedCount: number;
  canManageClub: boolean;
  pending?: boolean;
  onViewAccomplished: () => void;
  onRequestBulkArchive: () => void;
  onViewArchived: () => void;
}) {
  return (
    <section
      aria-label="Accomplished projects summary"
      className="flex flex-col gap-3 rounded-xl border border-emerald-300/70 bg-emerald-50/75 px-4 py-3.5 dark:border-emerald-500/30 dark:bg-emerald-950/35 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-bold text-emerald-950 dark:text-emerald-200">
            Accomplished
          </h2>
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[11px] font-bold text-white dark:bg-emerald-500 dark:text-slate-950">
            {accomplishedCount}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-emerald-900/80 dark:text-emerald-300/80">
          Finished projects with a published report.
          {archivedCount > 0 && (
            <>
              {" "}
              <button
                type="button"
                onClick={onViewArchived}
                className="cursor-pointer font-semibold underline underline-offset-2 hover:text-emerald-950 dark:hover:text-emerald-100"
              >
                View archived ({archivedCount})
              </button>
            </>
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onViewAccomplished}
          className="inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-xl border border-emerald-300 bg-white px-3.5 py-2 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-100/70 dark:border-emerald-500/40 dark:bg-[#161B26] dark:text-emerald-200 dark:hover:bg-emerald-900/40"
        >
          View accomplished
        </button>
        {canManageClub && archivableCount > 0 && (
          <button
            type="button"
            disabled={pending}
            onClick={onRequestBulkArchive}
            className="inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-xl border border-emerald-300 bg-emerald-100/80 px-3.5 py-2 text-xs font-semibold text-emerald-950 transition hover:bg-emerald-200/80 disabled:opacity-50 dark:border-emerald-500/40 dark:bg-emerald-900/50 dark:text-emerald-100 dark:hover:bg-emerald-900/80"
          >
            Archive {archivableCount} finished
          </button>
        )}
      </div>
    </section>
  );
}

