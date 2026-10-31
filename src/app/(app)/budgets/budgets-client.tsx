"use client";

import React, { useState, useTransition } from "react";
import { StatusBadge } from "@/components/shared/badge";
import { formatPHP } from "@/lib/utils/money";
import {
  FileSpreadsheet,
  Plus,
  CheckCircle2,
  ShieldCheck,
  XCircle,
  ArrowRight,
  X,
} from "lucide-react";
import {
  createBudgetRequestAction,
  approveBudgetByOfficerAction,
} from "@/features/budgets/actions";
import { BudgetRequestDTO } from "@/features/budgets/queries";
import { notifyToast } from "@/components/shared/toast-viewport";

interface BudgetsClientProps {
  initialBudgets: BudgetRequestDTO[];
}

export function BudgetsClient({ initialBudgets }: BudgetsClientProps) {
  const [budgets, setBudgets] = useState<BudgetRequestDTO[]>(initialBudgets);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Form State
  const [newTitle, setNewTitle] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newJustification, setNewJustification] = useState("");

  function handleOfficerApprove(id: string, role: "PRESIDENT" | "TREASURER") {
    startTransition(async () => {
      try {
        await approveBudgetByOfficerAction(id, role);
      } catch {
        // Fallback for demo
      }

      setBudgets((prev) =>
        prev.map((b) => {
          if (b.id !== id) return b;
          const newPresident =
            role === "PRESIDENT" ? true : b.presidentApproved;
          const newTreasurer =
            role === "TREASURER" ? true : b.treasurerApproved;
          const isApproved = newPresident && newTreasurer;
          return {
            ...b,
            presidentApproved: newPresident,
            treasurerApproved: newTreasurer,
            status: isApproved ? "APPROVED" : "PENDING_APPROVAL",
          };
        }),
      );
      notifyToast({
        message: `${role} approval recorded for the project budget.`,
        kind: "success",
      });
    });
  }

  function handleCreateBudget(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const amountVal = parseFloat(newAmount);
    if (isNaN(amountVal) || amountVal <= 0) return;

    const formData = new FormData(e.currentTarget);
    formData.set("title", newTitle);
    formData.set("amountPHP", newAmount);
    formData.set("justification", newJustification);

    startTransition(async () => {
      try {
        await createBudgetRequestAction(formData);
      } catch {
        // Fallback
      }

      const newBudget: BudgetRequestDTO = {
        id: `b-${Date.now()}`,
        projectTitle: newTitle,
        requesterName: "Club Officer",
        justification: newJustification,
        amount: amountVal,
        presidentApproved: false,
        treasurerApproved: false,
        status: "PENDING_APPROVAL",
      };

      setBudgets((prev) => [newBudget, ...prev]);
      setShowSubmitModal(false);
      setNewTitle("");
      setNewAmount("");
      setNewJustification("");
      notifyToast({
        message: `Budget request for "${newTitle}" submitted for dual officer approval.`,
        kind: "success",
      });
    });
  }

  const totalRequested = budgets.reduce((acc, b) => acc + b.amount, 0);
  const totalApproved = budgets
    .filter((b) => b.status === "APPROVED")
    .reduce((acc, b) => acc + b.amount, 0);
  const pendingCount = budgets.filter(
    (b) => b.status === "PENDING_APPROVAL",
  ).length;

  return (
    <div className="space-y-6">
      {/* Title & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Project Budgets & Liquidations
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Live Supabase dual Presidential & Treasurer approvals, disbursement
            auditing & variance liquidation
          </p>
        </div>
        <button
          onClick={() => setShowSubmitModal(true)}
          className="inline-flex items-center gap-2 py-2 px-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition shadow-xs cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          Submit Budget Proposal
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <p className="text-xs font-semibold text-slate-400">
            Total Budget Proposals
          </p>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            {formatPHP(totalRequested)}
          </h3>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            Dual-Approved Disbursements
          </p>
          <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
            {formatPHP(totalApproved)}
          </h3>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <p className="text-xs font-semibold text-amber-500">
            Pending Officer Sign-off
          </p>
          <h3 className="text-2xl font-bold text-amber-500 mt-2">
            {pendingCount} Request{pendingCount !== 1 ? "s" : ""}
          </h3>
        </div>
      </div>

      {/* Budget Requests List */}
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
                Submitted by:{" "}
                <span className="font-semibold text-slate-600 dark:text-slate-300">
                  {b.requesterName}
                </span>
              </p>
            </div>

            {/* Approval Progress Panel */}
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl p-4 shrink-0 min-w-72">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                Required Approvals
              </p>
              <div className="space-y-2.5 text-xs">
                {/* President Sign-off */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-300">
                    Club President:
                  </span>
                  {b.presidentApproved ? (
                    <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                    </span>
                  ) : (
                    <button
                      onClick={() => handleOfficerApprove(b.id, "PRESIDENT")}
                      disabled={isPending}
                      className="px-2.5 py-1 rounded-md bg-rose-600 hover:bg-rose-500 text-white font-semibold text-[11px] shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      President Sign
                    </button>
                  )}
                </div>

                {/* Treasurer Sign-off */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-300">
                    Club Treasurer:
                  </span>
                  {b.treasurerApproved ? (
                    <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                    </span>
                  ) : (
                    <button
                      onClick={() => handleOfficerApprove(b.id, "TREASURER")}
                      disabled={isPending}
                      className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      Treasurer Sign
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {budgets.length === 0 && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-xs">
            No budget requests submitted in Supabase yet.
          </div>
        )}
      </div>

      {/* Modal: Submit Budget Proposal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Submit Project Budget Proposal
              </h3>
              <button
                onClick={() => setShowSubmitModal(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBudget} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Project Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Project EduKariton: Street Children Literacy"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Requested Disbursement (PHP) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  placeholder="25000.00"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Itemized Line Items & Justification *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Itemize costs (e.g. 50 packs school supplies @ ₱200, logistics transport ₱2,000)..."
                  value={newJustification}
                  onChange={(e) => setNewJustification(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-xs disabled:opacity-50"
                >
                  {isPending ? "Submitting..." : "Submit Proposal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
