"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check } from "lucide-react";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  link_url: string | null;
  is_read: boolean;
  created_at: string;
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unread = items.filter((item) => !item.is_read).length;

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next || items.length > 0) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "Could not load notifications.");
      setItems(body.notifications || []);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not load notifications.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function openItem(item: NotificationItem) {
    if (!item.is_read) {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notificationId: item.id }),
      });
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id ? { ...entry, is_read: true } : entry,
        ),
      );
    }
    setOpen(false);
    if (item.link_url) router.push(item.link_url);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        className="relative rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        aria-label={
          unread ? `View notifications, ${unread} unread` : "View notifications"
        }
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <section className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[#EDEDF2] bg-white shadow-lg dark:border-slate-800 dark:bg-[#161B26]">
          <header className="flex items-center justify-between border-b border-[#EDEDF2] px-4 py-3 dark:border-slate-800">
            <h2 className="text-xs font-bold text-[#111625] dark:text-white">
              Notifications
            </h2>
            {unread > 0 && (
              <span className="text-[10px] font-semibold text-slate-500">
                {unread} unread
              </span>
            )}
          </header>
          <div className="max-h-96 overflow-y-auto">
            {loading && (
              <p className="p-5 text-center text-xs text-slate-500">
                Loading...
              </p>
            )}
            {error && (
              <p role="alert" className="p-4 text-xs text-rose-600">
                {error}
              </p>
            )}
            {!loading &&
              !error &&
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openItem(item)}
                  className={`flex w-full gap-3 border-b border-[#EDEDF2] px-4 py-3 text-left last:border-0 dark:border-slate-800 ${item.is_read ? "" : "bg-blue-50/60 dark:bg-blue-500/5"}`}
                >
                  <span
                    className={`mt-1 h-2 w-2 shrink-0 rounded-full ${item.is_read ? "bg-slate-300 dark:bg-slate-600" : "bg-blue-600"}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-[#111625] dark:text-white">
                      {item.title}
                    </span>
                    <span className="mt-1 block line-clamp-2 text-[11px] leading-relaxed text-slate-500">
                      {item.message}
                    </span>
                    <span className="mt-1 block text-[10px] text-slate-400">
                      {new Intl.DateTimeFormat("en", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Asia/Manila",
                      }).format(new Date(item.created_at))}
                    </span>
                  </span>
                  {!item.is_read && (
                    <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-blue-600" />
                  )}
                </button>
              ))}
            {!loading && !error && items.length === 0 && (
              <p className="p-6 text-center text-xs text-slate-500">
                You are all caught up.
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
