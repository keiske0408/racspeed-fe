"use client";

import React, { useEffect, useId, useState } from "react";

const DEFAULT_ARCHIVE_PRESETS = [
  "Completed & reported",
  "Postponed / rescheduled",
  "Duplicate entry",
  "Cancelled",
];

export interface ArchiveReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  pending?: boolean;
  presets?: string[];
}

export function ArchiveReasonModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  pending = false,
  presets = DEFAULT_ARCHIVE_PRESETS,
}: ArchiveReasonModalProps) {
  const titleId = useId();
  const inputId = useId();
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose, pending]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4"
      onClick={() => !pending && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[#EDEDF2] bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-[#161B26]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id={titleId}
          className="text-base font-bold text-[#111625] dark:text-white"
        >
          {title}
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          {description}
        </p>

        <div className="mt-4 space-y-2">
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            Reason / comment for archiving (optional)
          </label>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((preset) => {
              const selected = reason.trim() === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setReason(selected ? "" : preset)}
                  className={`cursor-pointer rounded-lg border px-2 py-1 text-[11px] font-medium transition ${
                    selected
                      ? "border-[#0D3594] bg-blue-50 text-[#0D3594] dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-200"
                      : "border-[#DDE1EA] bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {preset}
                </button>
              );
            })}
          </div>
          <textarea
            id={inputId}
            rows={2}
            maxLength={300}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why this is being archived so members understand..."
            className="w-full rounded-xl border border-[#DDE1EA] bg-white px-3 py-2 text-xs text-[#111625] outline-none focus:border-[#0D3594] focus:ring-2 focus:ring-[#0D3594]/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Shown to club members on the Archived tab and record banner.
          </p>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={onClose}
            className="min-h-[44px] cursor-pointer rounded-xl border border-[#DDE1EA] px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => onConfirm(reason.trim())}
            className="min-h-[44px] cursor-pointer rounded-xl bg-[#0D3594] px-4 py-2 text-xs font-semibold text-white hover:bg-[#092569] disabled:opacity-50"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

