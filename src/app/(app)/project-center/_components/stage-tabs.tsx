"use client";

import React, { useEffect } from "react";
import { HelpCircle, X } from "lucide-react";
import type { ProjectStageTab } from "@/features/activities/project-center-rules";

export function StageTabs({
  activeTab,
  counts,
  onTabChange,
  guideOpen,
  onOpenGuide,
  onCloseGuide,
}: {
  activeTab: ProjectStageTab;
  counts: Record<ProjectStageTab, number>;
  onTabChange: (tab: ProjectStageTab) => void;
  guideOpen: boolean;
  onOpenGuide: () => void;
  onCloseGuide: () => void;
}) {
  useEffect(() => {
    if (!guideOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseGuide();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [guideOpen, onCloseGuide]);

  const tabs: { id: ProjectStageTab; label: string; count: number }[] = [
    { id: "UPCOMING", label: "Upcoming", count: counts.UPCOMING },
    { id: "ONGOING", label: "Ongoing", count: counts.ONGOING },
    { id: "REPORT_DUE", label: "Report due", count: counts.REPORT_DUE },
    { id: "ACCOMPLISHED", label: "Accomplished", count: counts.ACCOMPLISHED },
  ];

  return (
    <div className="border-b border-[#EDEDF2] dark:border-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="tablist"
          aria-label="Project Center lifecycle stages"
          className="flex flex-wrap items-center gap-1 sm:gap-2"
        >
          {tabs.map((tab) => {
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => onTabChange(tab.id)}
                className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2 border-b-2 px-3 py-2 text-xs font-semibold transition ${
                  selected
                    ? "border-[#0D3594] text-[#111625] dark:border-blue-400 dark:text-white"
                    : "border-transparent text-slate-600 hover:text-[#111625] dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[11px] font-bold ${
                    selected
                      ? "bg-slate-200 text-[#111625] dark:bg-slate-700 dark:text-white"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onOpenGuide}
          className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 px-2 text-xs font-medium text-slate-600 underline-offset-4 transition hover:text-[#0D3594] hover:underline dark:text-slate-400 dark:hover:text-blue-300"
        >
          <HelpCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>How publishing a project works</span>
        </button>
      </div>

      {guideOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="publishing-guide-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4"
          onClick={onCloseGuide}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-[#EDEDF2] bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-[#161B26]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#EDEDF2] pb-3 dark:border-slate-800">
              <div>
                <h2
                  id="publishing-guide-title"
                  className="text-base font-bold text-[#111625] dark:text-white"
                >
                  How publishing a project works
                </h2>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                  Service and Joint projects follow a 4-step completion flow.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close guide"
                onClick={onCloseGuide}
                className="inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
              <p className="font-semibold text-[#111625] dark:text-white">
                1. Planned → 2. Ongoing → 3. Awaiting Report → 4. Accomplished
              </p>
              <p>
                To mark a service project as finished, open its{" "}
                <strong>Report</strong> tab, attach at least{" "}
                <strong>1 photo</strong>, complete the{" "}
                <strong>6 Rotary Showcase fields</strong>, and click{" "}
                <strong>Publish as accomplished</strong>.
              </p>
              <p className="text-slate-600 dark:text-slate-400">
                Internal activities (Meetings, L&amp;D sessions, Fellowships, and
                Internal Work) do not require an accomplishment report and move
                directly from Ongoing to Completed in 3 steps.
              </p>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={onCloseGuide}
                className="min-h-[44px] cursor-pointer rounded-xl bg-[#0D3594] px-4 py-2 text-xs font-semibold text-white hover:bg-[#092569]"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

