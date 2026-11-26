"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck, ChevronDown, Settings2 } from "lucide-react";

type NotificationFilter = "ALL" | "UNREAD" | "TASKS_DEADLINES" | "PROJECTS";

const TASK_DEADLINE_TYPES = new Set([
  "TASK_ASSIGNED",
  "TASK_UPDATED",
  "TASK_DEADLINE",
  "PROJECT_DEADLINE",
  "REPORT_DUE",
]);

const PROJECT_TYPES = new Set([
  "ACTIVITY_REMINDER",
  "RSVP_REMINDER",
  "MIN_MEMBERS_ALERT",
  "COMMENT",
  "MENTION",
  "REPORT_REVIEW",
]);

function getTypeBadgeClass(type: string): string {
  if (type === "TASK_DEADLINE" || type === "PROJECT_DEADLINE" || type === "REPORT_DUE") {
    return "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300";
  }
  if (type === "TASK_ASSIGNED" || type === "TASK_UPDATED") {
    return "bg-blue-50 text-[#0D3594] dark:bg-blue-500/15 dark:text-blue-300";
  }
  if (type === "RETENTION_NUDGE" || type === "ATTENDANCE_ALERT") {
    return "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300";
  }
  return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  link_url: string | null;
  is_read: boolean;
  created_at: string;
}

interface NotificationResponse {
  notifications: NotificationItem[];
  unreadCount: number;
  nextCursor: string | null;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>("ALL");

  const filteredNotifications = useMemo(() => {
    switch (activeFilter) {
      case "UNREAD":
        return notifications.filter((n) => !n.is_read);
      case "TASKS_DEADLINES":
        return notifications.filter((n) => TASK_DEADLINE_TYPES.has(n.type));
      case "PROJECTS":
        return notifications.filter((n) => PROJECT_TYPES.has(n.type));
      case "ALL":
      default:
        return notifications;
    }
  }, [activeFilter, notifications]);

  async function load(before?: string) {
    const response = await fetch(
      `/api/notifications?limit=25${before ? `&before=${encodeURIComponent(before)}` : ""}`,
      { cache: "no-store" },
    );
    const body = (await response.json()) as NotificationResponse & { error?: string };
    if (!response.ok) throw new Error(body.error || "Could not load notifications.");
    setNotifications((current) =>
      before ? [...current, ...body.notifications] : body.notifications,
    );
    setUnreadCount(body.unreadCount);
    setCursor(body.nextCursor);
  }

  useEffect(() => {
    let active = true;
    fetch("/api/notifications?limit=25", { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json()) as NotificationResponse & { error?: string };
        if (!response.ok) throw new Error(body.error || "Could not load notifications.");
        if (!active) return;
        setNotifications(body.notifications || []);
        setUnreadCount(body.unreadCount);
        setCursor(body.nextCursor);
      })
      .catch((reason) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Could not load notifications.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function markAllRead() {
    setError(null);
    const response = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error || "Could not mark notifications as read.");
      return;
    }
    setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
    setUnreadCount(0);
  }

  async function openNotification(item: NotificationItem) {
    if (!item.is_read) {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
      if (!response.ok) {
        setError("Could not update notification status.");
        return;
      }
      setNotifications((current) =>
        current.map((entry) => entry.id === item.id ? { ...entry, is_read: true } : entry),
      );
      setUnreadCount((count) => Math.max(0, count - 1));
    }
    if (item.link_url?.startsWith("/") && !item.link_url.startsWith("//")) {
      router.push(item.link_url);
    }
  }

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    setError(null);
    try {
      await load(cursor);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load more notifications.");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#0D3594] dark:text-blue-300">
            <Bell className="h-5 w-5" />
            <p className="text-[11px] font-bold uppercase tracking-[0.16em]">Notification center</p>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">Your notifications</h1>
          <p className="mt-1 text-sm text-slate-500">
            {unreadCount} unread {unreadCount === 1 ? "notification" : "notifications"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/settings/notifications"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Settings2 className="h-4 w-4" /> Settings
          </Link>
          <button
            type="button"
            disabled={unreadCount === 0}
            onClick={markAllRead}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0D3594] px-3 py-2 text-xs font-semibold text-white hover:bg-[#092569] disabled:opacity-50"
          >
            <CheckCheck className="h-4 w-4" /> Mark all read
          </button>
        </div>
      </header>

      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}

      {!loading && notifications.length > 0 && (
        <div
          role="tablist"
          aria-label="Filter notifications"
          className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3 dark:border-slate-800"
        >
          {(
            [
              ["ALL", `All (${notifications.length})`],
              ["UNREAD", `Unread (${unreadCount})`],
              ["TASKS_DEADLINES", "Tasks & Deadlines"],
              ["PROJECTS", "Projects"],
            ] as [NotificationFilter, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={activeFilter === key}
              onClick={() => setActiveFilter(key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                activeFilter === key
                  ? "bg-[#0D3594] text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">Loading notifications...</p>
      ) : filteredNotifications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
          <Bell className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-3 font-semibold text-slate-800 dark:text-white">
            {notifications.length === 0
              ? "You are all caught up."
              : "No notifications match this filter."}
          </p>
          {notifications.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveFilter("ALL")}
              className="mt-3 text-xs font-semibold text-[#0D3594] hover:underline dark:text-blue-300 cursor-pointer"
            >
              View all notifications
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          {filteredNotifications.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => void openNotification(item)}
              className={`flex w-full gap-4 border-b border-slate-100 p-4 text-left last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50 ${item.is_read ? "" : "bg-blue-50/50 dark:bg-blue-500/5"}`}
            >
              <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${item.is_read ? "bg-slate-300" : "bg-blue-600"}`} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-900 dark:text-white">{item.title}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${getTypeBadgeClass(item.type)}`}>{item.type.replaceAll("_", " ")}</span>
                </span>
                <span className="mt-1 block whitespace-pre-wrap text-sm leading-relaxed text-slate-600 dark:text-slate-300">{item.message}</span>
                <span className="mt-2 block text-xs text-slate-400">
                  {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(item.created_at))}
                </span>
              </span>
              {item.link_url && <ChevronDown className="mt-1 h-4 w-4 -rotate-90 shrink-0 text-slate-400" />}
            </button>
          ))}
        </div>
      )}
      {!loading && cursor && (
        <div className="text-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {loadingMore ? "Loading..." : "Load older notifications"}
          </button>
        </div>
      )}
    </div>
  );
}
