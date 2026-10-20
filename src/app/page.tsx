import React from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck, QrCode, FileText, PiggyBank, Users } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      {/* Navbar */}
      <header className="border-b border-slate-800/80 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-600 flex items-center justify-center text-white font-black text-base shadow-md shadow-rose-600/30">
            R
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white">
              Rotaract Club of San Pedro East
            </h1>
            <p className="text-[11px] text-slate-400">Rotary District 3820 · Laguna, Philippines</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-xs font-semibold text-slate-300 hover:text-white transition px-3 py-1.5"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="text-xs font-semibold px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition shadow-sm"
          >
            Join Club
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-4xl mx-auto px-6 py-16 text-center my-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 mb-6">
          Mobile-First Progressive Web App (PWA)
        </div>
        <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
          Rotaract Club Operations Platform
        </h2>
        <p className="mt-4 text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
          Centralizing district reporting, dynamic QR attendance, dues and treasury ledgers, and guest-to-member onboarding for Rotaract San Pedro East and partner clubs.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm transition shadow-lg shadow-rose-600/30"
          >
            Enter Operations Portal
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/register"
            className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 font-semibold text-sm transition"
          >
            Request Membership Account
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-left">
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
            <QrCode className="w-6 h-6 text-rose-500 mb-3" />
            <h4 className="text-sm font-bold text-white">Dynamic QR Check-in</h4>
            <p className="text-xs text-slate-400 mt-1">
              Time-windowed sessions with anti-duplicate enforcement & automatic volunteer-hour calculations.
            </p>
          </div>
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
            <FileText className="w-6 h-6 text-blue-500 mb-3" />
            <h4 className="text-sm font-bold text-white">District Reporting</h4>
            <p className="text-xs text-slate-400 mt-1">
              Tagged by official 7 Areas of Focus & 17 SDGs with reproducible data snapshots.
            </p>
          </div>
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
            <PiggyBank className="w-6 h-6 text-emerald-500 mb-3" />
            <h4 className="text-sm font-bold text-white">Treasury & Dues</h4>
            <p className="text-xs text-slate-400 mt-1">
              Proof verification portal, dual-officer budget approvals, and variance liquidation.
            </p>
          </div>
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
            <Users className="w-6 h-6 text-amber-500 mb-3" />
            <h4 className="text-sm font-bold text-white">Guest-to-Member CRM</h4>
            <p className="text-xs text-slate-400 mt-1">
              Kanban pipeline tracking orientation, first project attendance, and induction readiness.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 px-6 py-4 text-center text-xs text-slate-500">
        Rotaract Club of San Pedro East · Rotary International District 3820 · Philippine Data Privacy Act Compliant
      </footer>
    </div>
  );
}
