"use client";

import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function ProjectCenterError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="py-12">
      <div
        role="alert"
        className="mx-auto max-w-lg rounded-2xl border border-[#EDEDF2] bg-white p-6 text-center dark:border-slate-800 dark:bg-[#161B26]"
      >
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </div>
        <h1 className="mt-3 text-base font-bold text-[#111625] dark:text-white">
          Unable to load Project Center
        </h1>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          {error.message ||
            "Something went wrong while fetching club activities."}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl bg-[#0D3594] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#092569]"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Retry</span>
        </button>
      </div>
    </main>
  );
}

