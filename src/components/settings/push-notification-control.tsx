"use client";

import React, { useEffect, useState } from "react";
import { BellRing, BellOff } from "lucide-react";

function decodeApplicationKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

export function PushNotificationControl() {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    void navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setEnabled(Boolean(subscription)))
      .catch(() => undefined);
  }, []);

  async function toggleSubscription() {
    setBusy(true);
    setMessage(null);
    try {
      if (!publicKey)
        throw new Error("Push notifications are not configured for this app.");
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        throw new Error("This browser does not support web push.");
      }

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        const response = await fetch("/api/push/subscriptions", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: existing.endpoint }),
        });
        if (!response.ok)
          throw new Error("Could not disable this browser's notifications.");
        await existing.unsubscribe();
        setEnabled(false);
        setMessage("Notifications disabled on this browser.");
        return;
      }

      const permission =
        Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();
      if (permission !== "granted")
        throw new Error("Allow notifications in your browser to continue.");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeApplicationKey(publicKey) as BufferSource,
      });
      const response = await fetch("/api/push/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!response.ok) {
        await subscription.unsubscribe();
        throw new Error("Could not save your notification subscription.");
      }
      setEnabled(true);
      setMessage("Notifications enabled on this browser.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not update notification settings.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="rounded-lg bg-blue-50 p-2 text-[#0D3594] dark:bg-blue-500/10 dark:text-blue-300">
          {enabled ? (
            <BellRing className="h-4 w-4" />
          ) : (
            <BellOff className="h-4 w-4" />
          )}
        </span>
        <div>
          <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100">
            Browser notifications
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Activity reminders, mentions and member updates.
          </p>
          {message && (
            <p
              role="status"
              className="mt-1 text-[11px] text-slate-600 dark:text-slate-300"
            >
              {message}
            </p>
          )}
        </div>
      </div>
      <button
        type="button"
        disabled={busy || !publicKey}
        onClick={toggleSubscription}
        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        {busy
          ? "Updating..."
          : enabled
            ? "Disable on this browser"
            : "Enable on this browser"}
      </button>
    </section>
  );
}
