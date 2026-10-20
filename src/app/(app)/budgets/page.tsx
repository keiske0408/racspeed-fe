"use client";

import React, { useState } from "react";
import { StatusBadge } from "@/components/shared/badge";
import { formatPHP } from "@/lib/utils/money";
import { FileSpreadsheet, Plus, CheckCircle2, ShieldCheck, XCircle, ArrowRight } from "lucide-react";

interface BudgetRequest {
  id: string;
  projectTitle: string;
  requesterName: string;
  justification: string;
  amount: number;
  presidentApproved: boolean;
  treasurerApproved: boolean;
  status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
}

const SAMPLE_BUDGETS: BudgetRequest[] = [
  {
    id: "b-1",
    projectTitle: "Tubig Para sa Barangay: Clean Water Filtration",
    requesterName: "Rafael Alcantara",
    justification: "Procurement of 10 heavy-duty ceramic water filter units and PVC distribution fittings.",
    amount: 25000,
    presidentApproved: true,
    treasurerApproved: true,
    status: "APPROVED",
  },
  {
    id: "b-2",
    projectTitle: "Laguna Bay Greening: Seedling Sourcing",
    requesterName: "Maria Santos",
    justification: "500 mangrove propagules, bamboo stakes, and transport logistics.",
    amount: 14500,
    presidentApproved: true,
    treasurerApproved: false,
    status: "PENDING_APPROVAL",
  },
];

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<BudgetRequest[]>(SAMPLE_BUDGETS);
  const [notification, setNotification] = useState<string | null>(null);

  function handleTreasurerApprove(id: string) {
    setBudgets((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        const newTreasurer = true;
        const isApproved = b.presidentApproved && newTreasurer;
        return {
          ...b,
          treasurerApproved: newTreasurer,
          status: isApproved ? "APPROVED" : "PENDING_APPROVAL",
        };
      })
    );
    setNotification("Treasurer approval recorded for budget proposal.");
    setTimeout(() => setNotification(null), 4000);
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Project Budgets & Liquidations
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Dual Presidential & Treasurer approvals, disbursement auditing & variance liquidation
          </p>
        </div>
      </div>

      {notification && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Budget Requests Grid */}
      <div className="space-y-4">
        {budgets.map((b) => (
          <div
            key={b.id}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6"
          >
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                  {b.projectTitle}
                </span>
                <StatusBadge status={b.status} />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Requested: {formatPHP(b.amount)}
              </h3>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                {b.justification}
              </p>
              <p className="mt-2 text-[11px] text-slate-400">
                Submitted by: <span className="font-semibold text-slate-600 dark:text-slate-300">{b.requesterName}</span>
              </p>
            </div>

            {/* Approval Progress Panel */}
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl p-4 shrink-0 min-w-64">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                Required Approvals
              </p>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-300">Club President:</span>
                  {b.presidentApproved ? (
                    <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                    </span>
                  ) : (
                    <span className="text-amber-500 font-medium italic">Pending</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-300">Club Treasurer:</span>
                  {b.treasurerApproved ? (
                    <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                    </span>
                  ) : (
                    <button
                      onClick={() => handleTreasurerApprove(b.id)}
                      className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] shadow-xs cursor-pointer"
                    >
                      Sign & Approve
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
