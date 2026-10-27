import React from "react";
import Link from "next/link";
import { ShieldAlert, ArrowLeft, HelpCircle, LayoutDashboard } from "lucide-react";

export default function AccessDeniedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FB] dark:bg-[#0A0D14] px-4 py-12">
      <div className="w-full max-w-md bg-white dark:bg-[#0E121B] border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-xl text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        
        <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 mb-2">
          Authority Restricted
        </span>
        
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          Module Access Denied
        </h1>
        
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Your current leadership role does not have permission to view or manage this module under the Club Role & Page Authority Matrix.
        </p>

        <div className="mt-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 text-left space-y-2">
          <p className="font-semibold text-slate-800 dark:text-slate-200">
            Need access to this module?
          </p>
          <p className="text-[11px] leading-normal">
            Club Presidents and Platform Administrators can customize role authorities and page access anytime under <span className="font-semibold text-rose-600 dark:text-rose-400">Club Settings &gt; Role & Page Authority Matrix</span>.
          </p>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row items-center gap-2">
          <Link
            href="/dashboard"
            className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition shadow-xs"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Return to Dashboard</span>
          </Link>
          <Link
            href="/help"
            className="w-full py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center justify-center gap-2 transition"
          >
            <HelpCircle className="w-4 h-4" />
            <span>Help Center</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
