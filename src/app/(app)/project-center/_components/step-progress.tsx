import React from "react";
import { getActivityStepProgress } from "@/features/activities/project-center-rules";
import type { ActivityKind, ActivityStatus } from "@/features/activities/types";

export function StepProgress({
  kind,
  status,
}: {
  kind: ActivityKind;
  status: ActivityStatus;
}) {
  const { step, total, segments } = getActivityStepProgress(kind, status);
  const isFinished = status === "ACCOMPLISHED" || status === "COMPLETED";

  return (
    <div
      className="flex items-center gap-2"
      aria-label={`Step ${step} of ${total}`}
    >
      <div className="flex items-center gap-1" aria-hidden="true">
        {segments.map((state, idx) => (
          <span
            key={idx}
            className={`h-1.5 w-3.5 rounded-full ${
              state === "done"
                ? isFinished
                  ? "bg-emerald-600 dark:bg-emerald-400"
                  : "bg-[#0D3594] dark:bg-blue-400"
                : state === "current"
                  ? "bg-[#0D3594] dark:bg-blue-400"
                  : "bg-slate-200 dark:bg-slate-700"
            }`}
          />
        ))}
      </div>
      <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
        Step {step} of {total}
      </span>
    </div>
  );
}

