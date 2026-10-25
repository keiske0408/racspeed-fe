"use client";

import React, { useEffect, useState } from "react";
import { WifiOff, Wifi, X } from "lucide-react";

export function PwaRegister() {
  const [isOffline, setIsOffline] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // 1. Register Service Worker in production or local environments
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => {
            // Service worker successfully registered
          })
          .catch((err) => {
            // Non-critical fallback
          });
      });
    }

    // 2. Network connectivity status listeners
    function handleOnline() {
      setIsOffline(false);
      setDismissed(false);
    }

    function handleOffline() {
      setIsOffline(true);
      setDismissed(false);
    }

    if (typeof window !== "undefined") {
      setIsOffline(!navigator.onLine);
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      }
    };
  }, []);

  if (!isOffline || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 p-3.5 rounded-2xl bg-slate-900/95 dark:bg-slate-800/95 text-white shadow-2xl border border-amber-500/30 backdrop-blur-md flex items-center justify-between gap-3 animate-slide-up">
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
          <WifiOff className="w-4 h-4" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-slate-100">Field Outreach Offline Mode</h4>
          <p className="text-[11px] text-slate-300 leading-tight">
            No internet detected. Cached views remain accessible; attendance will sync upon reconnection.
          </p>
        </div>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="p-1 rounded-lg text-slate-400 hover:text-white shrink-0 cursor-pointer"
        aria-label="Dismiss offline banner"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
