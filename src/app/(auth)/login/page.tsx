"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Lock, Mail, ArrowRight, AlertCircle, QrCode } from "lucide-react";

function sanitizeRedirectTarget(raw: string | null): string {
  if (!raw) return "/dashboard";
  const trimmed = raw.trim();
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return trimmed;
  }
  return "/dashboard";
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = sanitizeRedirectTarget(searchParams.get("redirectTo"));
  const isQrAttendanceRedirect =
    redirectTo.includes("token=") ||
    redirectTo.includes("sessionToken=") ||
    redirectTo.includes("checkInToken=");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (typeof window !== "undefined" && redirectTo !== "/dashboard") {
      try {
        window.sessionStorage.setItem("racspeed_post_login_redirect", redirectTo);
      } catch {}
    }
  }, [redirectTo]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      let destination = redirectTo;
      if (typeof window !== "undefined") {
        try {
          const stored = window.sessionStorage.getItem("racspeed_post_login_redirect");
          if (destination === "/dashboard" && stored) {
            destination = sanitizeRedirectTarget(stored);
          }
          window.sessionStorage.removeItem("racspeed_post_login_redirect");
        } catch {}
      }

      router.push(destination);
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Failed to sign in. Please verify your credentials.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      {isQrAttendanceRedirect && (
        <div className="mb-4 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 flex items-start gap-3 text-xs">
          <QrCode className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" />
          <div>
            <p className="font-bold text-emerald-200">QR Attendance Scan Detected</p>
            <p className="mt-0.5 text-emerald-300/90">
              Sign in with your club account to automatically verify and record your event attendance.
            </p>
          </div>
        </div>
      )}
      {error && (
        <div className="mb-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-start gap-3 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-slate-300 mb-1.5">
          Email Address
        </label>
        <div className="relative">
          <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="member@rotaract.local"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 transition"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-300 mb-1.5">
          Password
        </label>
        <div className="relative">
          <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 transition"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full mt-2 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm transition shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
      >
        {loading ? "Signing in..." : "Continue"}
        {!loading && <ArrowRight className="w-4 h-4" />}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4 py-12">
      <div className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-2 mb-4 shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/logo%20icon.jpg"
              alt="RacSpeed"
              className="h-8 w-auto object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Sign In</h1>
          <p className="text-sm text-slate-400 mt-1">
            Rotaract San Pedro East Operations
          </p>
        </div>

        <Suspense fallback={<div className="text-center py-6 text-sm text-slate-500">Loading form...</div>}>
          <LoginForm />
        </Suspense>

        <div className="mt-6 pt-6 border-t border-slate-800 text-center text-xs text-slate-400">
          New member or officer?{" "}
          <Link href="/register" className="text-rose-400 hover:text-rose-300 font-medium">
            Request an account
          </Link>
        </div>
      </div>
    </div>
  );
}
