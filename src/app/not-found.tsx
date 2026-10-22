import React from "react";
import Link from "next/link";
import { Compass, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-12 text-slate-100">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-800 text-rose-400 flex items-center justify-center mx-auto mb-4 border border-slate-700">
          <Compass className="w-7 h-7" />
        </div>
        <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 mb-3">
          404 Not Found
        </span>
        <h1 className="text-xl font-bold tracking-tight text-white">
          Page Does Not Exist
        </h1>
        <p className="mt-2 text-xs text-slate-400 leading-relaxed">
          The requested page or operational record could not be found or has been relocated.
        </p>
        <div className="mt-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 py-2.5 px-6 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-md transition"
          >
            <Home className="w-3.5 h-3.5" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
