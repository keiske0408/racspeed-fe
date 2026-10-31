"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, HelpCircle, X } from "lucide-react";
import { setRsvpAction } from "@/features/activities/actions";
import type { RsvpResponse } from "@/features/activities/types";

const OPTIONS: {
  value: RsvpResponse;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: string;
}[] = [
  {
    value: "GOING",
    label: "Going",
    icon: Check,
    active: "bg-emerald-600 text-white border-emerald-600",
  },
  {
    value: "MAYBE",
    label: "Maybe",
    icon: HelpCircle,
    active: "bg-amber-500 text-white border-amber-500",
  },
  {
    value: "NOT_GOING",
    label: "Can't go",
    icon: X,
    active: "bg-slate-700 text-white border-slate-700",
  },
];

export function RsvpButtons({
  activityId,
  current,
  compact = false,
}: {
  activityId: string;
  current: RsvpResponse | null;
  compact?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState<RsvpResponse | null>(current);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function choose(next: RsvpResponse) {
    const previous = value;
    setValue(next);
    setError(null);
    startTransition(async () => {
      const res = await setRsvpAction({ activityId, response: next });
      if (!res.success) {
        setValue(previous);
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5" role="group" aria-label="RSVP">
        {OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isActive = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={pending}
              onClick={() => choose(opt.value)}
              aria-pressed={isActive}
              className={`inline-flex items-center gap-1 rounded-lg border font-semibold transition cursor-pointer disabled:opacity-60 ${
                compact ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-xs"
              } ${
                isActive
                  ? opt.active
                  : "bg-white dark:bg-slate-900 border-[#EDEDF2] dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {opt.label}
            </button>
          );
        })}
      </div>
      {error && (
        <p className="text-[11px] text-rose-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
