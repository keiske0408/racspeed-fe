import React from "react";
import Link from "next/link";
import { Clock, ShieldAlert } from "lucide-react";

export default function PendingApprovalPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4 py-12">
      <div className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center">
        <div className="w-14 h-14 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4">
          <Clock className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-bold text-white">Account Pending Approval</h1>
        <p className="mt-2 text-sm text-slate-400">
          Your account has been registered, but it requires authorization by the Club President, Secretary, or Platform Administrator before accessing operational records.
        </p>
        <div className="mt-4 p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400 text-left">
          <p className="font-semibold text-slate-300 mb-1">What happens next?</p>
          <ul className="list-disc list-inside space-y-1">
            <li>An officer verifies your club affiliation.</li>
            <li>Role-based permissions are assigned.</li>
            <li>You will receive an email upon activation.</li>
          </ul>
        </div>
        <div className="mt-6 flex flex-col gap-2">
          <Link
            href="/login"
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-sm transition"
          >
            Check Again / Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
