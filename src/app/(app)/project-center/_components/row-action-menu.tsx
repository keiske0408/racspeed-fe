"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Archive, ArchiveRestore, ExternalLink, MoreHorizontal } from "lucide-react";

export function RowActionMenu({
  activityId,
  activityTitle,
  isArchived,
  canManage,
  showOpenItem = true,
  pending = false,
  onRequestArchive,
  onRestore,
}: {
  activityId: string;
  activityTitle: string;
  isArchived: boolean;
  canManage: boolean;
  showOpenItem?: boolean;
  pending?: boolean;
  onRequestArchive: () => void;
  onRestore: () => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hasSecondaryActions = showOpenItem || canManage;

  useEffect(() => {
    if (!open) return;
    function handleOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!hasSecondaryActions) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={`More actions for ${activityTitle}`}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={pending}
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={`Actions for ${activityTitle}`}
          className="absolute right-0 z-30 mt-1 w-44 rounded-xl border border-[#EDEDF2] bg-white p-1.5 shadow-lg dark:border-slate-700 dark:bg-[#161B26]"
        >
          {showOpenItem && (
            <Link
              role="menuitem"
              href={`/project-center/${activityId}`}
              onClick={() => setOpen(false)}
              className="flex min-h-[44px] w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Open details</span>
            </Link>
          )}

          {canManage && !isArchived && (
            <button
              type="button"
              role="menuitem"
              disabled={pending}
              onClick={() => {
                setOpen(false);
                onRequestArchive();
              }}
              className="flex min-h-[44px] w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Archive className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Archive</span>
            </button>
          )}

          {canManage && isArchived && (
            <button
              type="button"
              role="menuitem"
              disabled={pending}
              onClick={() => {
                setOpen(false);
                onRestore();
              }}
              className="flex min-h-[44px] w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
            >
              <ArchiveRestore className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Restore</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

