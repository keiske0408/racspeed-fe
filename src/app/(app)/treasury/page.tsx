"use client";

import React, { useState } from "react";
import { StatusBadge } from "@/components/shared/badge";
import { formatPHP } from "@/lib/utils/money";
import { Receipt, UploadCloud, CheckCircle, AlertCircle, FileText, ShieldCheck, Eye } from "lucide-react";

interface Invoice {
  id: string;
  invoiceNumber: string;
  memberName: string;
  title: string;
  dueDate: string;
  amount: number;
  status: "ISSUED" | "PAID" | "PARTIALLY_PAID";
}

interface PaymentSubmission {
  id: string;
  invoiceNumber: string;
  memberName: string;
  claimedAmount: number;
  referenceNumber: string;
  paymentChannel: string;
  status: "SUBMITTED" | "VERIFIED" | "REJECTED";
  claimedDate: string;
}

const SAMPLE_INVOICES: Invoice[] = [
  {
    id: "inv-1",
    invoiceNumber: "INV-2026-001",
    memberName: "John Carlos Reyes",
    title: "Annual Membership Dues (RY 2026-27)",
    dueDate: "2026-08-31",
    amount: 1500,
    status: "PAID",
  },
  {
    id: "inv-2",
    invoiceNumber: "INV-2026-002",
    memberName: "Danilo Cruz",
    title: "Annual Membership Dues (RY 2026-27)",
    dueDate: "2026-08-31",
    amount: 1500,
    status: "PAID",
  },
  {
    id: "inv-3",
    invoiceNumber: "INV-2026-003",
    memberName: "Maria Santos",
    title: "Annual Membership Dues (RY 2026-27)",
    dueDate: "2026-08-31",
    amount: 1500,
    status: "ISSUED",
  },
  {
    id: "inv-4",
    invoiceNumber: "INV-2026-004",
    memberName: "Alyssa Mendoza",
    title: "Induction Fee & Club Shirt",
    dueDate: "2026-10-30",
    amount: 850,
    status: "ISSUED",
  },
];

const SAMPLE_SUBMISSIONS: PaymentSubmission[] = [
  {
    id: "sub-1",
    invoiceNumber: "INV-2026-003",
    memberName: "Maria Santos",
    claimedAmount: 1500,
    referenceNumber: "GCASH-9817264819",
    paymentChannel: "GCash",
    status: "SUBMITTED",
    claimedDate: "2026-10-19",
  },
];

export default function TreasuryPage() {
  const [invoices, setInvoices] = useState<Invoice[]>(SAMPLE_INVOICES);
  const [submissions, setSubmissions] = useState<PaymentSubmission[]>(SAMPLE_SUBMISSIONS);
  const [notification, setNotification] = useState<string | null>(null);

  // Verification action by Treasurer
  function handleVerifySubmission(subId: string) {
    const sub = submissions.find((s) => s.id === subId);
    if (!sub) return;

    setSubmissions((prev) =>
      prev.map((s) => (s.id === subId ? { ...s, status: "VERIFIED" } : s))
    );

    // Update invoice status to PAID
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.invoiceNumber === sub.invoiceNumber ? { ...inv, status: "PAID" } : inv
      )
    );

    setNotification(`Payment of ${formatPHP(sub.claimedAmount)} verified and posted to confirmed ledger!`);
    setTimeout(() => setNotification(null), 4000);
  }

  function handleRejectSubmission(subId: string) {
    setSubmissions((prev) =>
      prev.map((s) => (s.id === subId ? { ...s, status: "REJECTED" } : s))
    );
    setNotification("Payment submission marked as REJECTED. Submitter notified.");
    setTimeout(() => setNotification(null), 4000);
  }

  const totalInvoiced = invoices.reduce((acc, i) => acc + i.amount, 0);
  const totalCollected = invoices
    .filter((i) => i.status === "PAID")
    .reduce((acc, i) => acc + i.amount, 0);
  const totalOutstanding = totalInvoiced - totalCollected;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Treasury, Dues & Liquidation
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Auditable cash records, proof verification & member balances (PHP)
          </p>
        </div>
      </div>

      {notification && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <p className="text-xs font-semibold text-slate-400">Total Invoiced (RY 2026-27)</p>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            {formatPHP(totalInvoiced)}
          </h3>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Verified Collections</p>
          <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
            {formatPHP(totalCollected)}
          </h3>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">Outstanding Receivables</p>
          <h3 className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-2">
            {formatPHP(totalOutstanding)}
          </h3>
        </div>
      </div>

      {/* Treasurer Verification Queue */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Payment Verification Queue
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Proof uploads require Treasurer sign-off before updating confirmed balances
            </p>
          </div>
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            {submissions.filter((s) => s.status === "SUBMITTED").length} Awaiting Review
          </span>
        </div>

        {submissions.length === 0 ? (
          <p className="text-center py-6 text-xs text-slate-400 italic">No submissions awaiting review</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-semibold">
                  <th className="py-2.5 px-3">Member</th>
                  <th className="py-2.5 px-3">Invoice</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Channel / Ref</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {submissions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-3 px-3 font-semibold text-slate-900 dark:text-slate-100">
                      {sub.memberName}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-500">{sub.invoiceNumber}</td>
                    <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200">
                      {formatPHP(sub.claimedAmount)}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                      <span className="font-medium">{sub.paymentChannel}</span>
                      <p className="text-[10px] text-slate-400 font-mono">{sub.referenceNumber}</p>
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={sub.status} />
                    </td>
                    <td className="py-3 px-3 text-right">
                      {sub.status === "SUBMITTED" ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleVerifySubmission(sub.id)}
                            className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-xs"
                          >
                            Verify
                          </button>
                          <button
                            onClick={() => handleRejectSubmission(sub.id)}
                            className="px-2.5 py-1 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-semibold text-xs"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Reviewed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invoices List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">
          Member Invoices & Dues
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-semibold">
                <th className="py-2.5 px-3">Invoice #</th>
                <th className="py-2.5 px-3">Member</th>
                <th className="py-2.5 px-3">Item Description</th>
                <th className="py-2.5 px-3">Due Date</th>
                <th className="py-2.5 px-3">Amount</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="py-3 px-3 font-mono font-medium text-slate-600 dark:text-slate-400">
                    {inv.invoiceNumber}
                  </td>
                  <td className="py-3 px-3 font-semibold text-slate-900 dark:text-slate-100">
                    {inv.memberName}
                  </td>
                  <td className="py-3 px-3 text-slate-600 dark:text-slate-300">{inv.title}</td>
                  <td className="py-3 px-3 text-slate-500">{inv.dueDate}</td>
                  <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200">
                    {formatPHP(inv.amount)}
                  </td>
                  <td className="py-3 px-3">
                    <StatusBadge status={inv.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
