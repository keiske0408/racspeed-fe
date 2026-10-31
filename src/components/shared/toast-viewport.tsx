"use client";

import React, { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

export type ToastKind = "success" | "error" | "info";

export interface ToastPayload {
  title?: string;
  message: string;
  kind?: ToastKind;
  duration?: number;
}

interface ToastItem extends ToastPayload {
  id: number;
  kind: ToastKind;
}

const TOAST_EVENT = "racspeed:toast";
let nextToastId = 0;

export function notifyToast(payload: ToastPayload) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ToastPayload>(TOAST_EVENT, { detail: payload }),
  );
}

export function ToastViewport() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const timers = new Map<number, ReturnType<typeof setTimeout>>();
    const onToast = (event: Event) => {
      const payload = (event as CustomEvent<ToastPayload>).detail;
      const id = ++nextToastId;
      const item: ToastItem = {
        ...payload,
        id,
        kind: payload.kind || "success",
      };
      setToasts((current) => [...current.slice(-2), item]);
      timers.set(
        id,
        setTimeout(() => {
          setToasts((current) => current.filter((toast) => toast.id !== id));
          timers.delete(id);
        }, payload.duration ?? 4200),
      );
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => {
      window.removeEventListener(TOAST_EVENT, onToast);
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-x-3 bottom-4 z-[100] flex flex-col items-end gap-2 sm:left-auto sm:right-5 sm:w-[min(24rem,calc(100vw-2.5rem))]"
      aria-live="polite"
      aria-relevant="additions"
    >
      {toasts.map((toast) => {
        const Icon =
          toast.kind === "success"
            ? CheckCircle2
            : toast.kind === "error"
              ? AlertCircle
              : Info;
        const color =
          toast.kind === "success"
            ? "border-emerald-200 bg-white text-emerald-800 dark:border-emerald-500/30 dark:bg-slate-900 dark:text-emerald-300"
            : toast.kind === "error"
              ? "border-rose-200 bg-white text-rose-800 dark:border-rose-500/30 dark:bg-slate-900 dark:text-rose-300"
              : "border-blue-200 bg-white text-blue-800 dark:border-blue-500/30 dark:bg-slate-900 dark:text-blue-300";
        return (
          <div
            key={toast.id}
            role={toast.kind === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 shadow-lg ${color}`}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              {toast.title && (
                <p className="text-xs font-bold">{toast.title}</p>
              )}
              <p
                className={`text-xs leading-relaxed ${toast.title ? "mt-0.5" : ""}`}
              >
                {toast.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setToasts((current) =>
                  current.filter((item) => item.id !== toast.id),
                )
              }
              aria-label="Dismiss notification"
              className="rounded p-0.5 opacity-60 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
