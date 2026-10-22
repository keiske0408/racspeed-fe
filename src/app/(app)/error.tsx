"use client";

import React, { useEffect } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Authenticated App Route Error:", error);
  }, [error]);

  return (
    <div className="p-8 max-w-2xl mx-auto my-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm text-center">
      <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4 border border-rose-500/20">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
        Unable to Load Module
      </h2>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
        We encountered an error loading this operational section. You can try refreshing the state or navigate to another page.
      </p>
      {error.message && (
        <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs font-mono text-rose-600 dark:text-rose-400 text-left overflow-x-auto">
          {error.message}
        </div>
      )}
      <div className="mt-6 flex justify-center">
        <button
          onClick={() => reset()}
          className="inline-flex items-center gap-2 py-2.5 px-5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-sm transition cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reload Component
        </button>
      </div>
    </div>
  );
}
