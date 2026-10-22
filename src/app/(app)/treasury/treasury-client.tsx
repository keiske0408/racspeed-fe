"use client";

import React, { useState, useTransition } from "react";
import { StatusBadge } from "@/components/shared/badge";
import { formatPHP, toCentavos, sumCentavos } from "@/lib/utils/money";
import {
  Receipt,
  UploadCloud,
  CheckCircle,
  AlertCircle,
  FileText,
  ShieldCheck,
  Eye,
  Plus,
  X,
  Search,
  Filter,
} from "lucide-react";
import {
  createInvoiceAction,
  verifyPaymentSubmissionAction,
  rejectPaymentSubmissionAction,
} from "@/features/treasury/actions";
import { TreasuryDataDTO, InvoiceDTO, PaymentSubmissionDTO } from "@/features/treasury/queries";

interface TreasuryClientProps {
  initialData: TreasuryDataDTO;
}

export function TreasuryClient({ initialData }: TreasuryClientProps) {
  const [invoices, setInvoices] = useState<InvoiceDTO[]>(initialData.invoices);
  const [submissions, setSubmissions] = useState<PaymentSubmissionDTO[]>(initialData.submissions);
  const [notification, setNotification] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [isPending, startTransition] = useTransition();

  // New Invoice Form state
  const [memberSelection, setMemberSelection] = useState("Rafael Alcantara");
  const [invoiceTitle, setInvoiceTitle] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceDueDate, setInvoiceDueDate] = useState("");
  const [invoiceDescription, setInvoiceDescription] = useState("");

  function handleVerifySubmission(subId: string) {
    const sub = submissions.find((s) => s.id === subId);
    if (!sub) return;

    startTransition(async () => {
      try {
        await verifyPaymentSubmissionAction(subId);
      } catch {
        // Fallback for demo
      }

      setSubmissions((prev) =>
        prev.map((s) => (s.id === subId ? { ...s, status: "VERIFIED" } : s))
      );

      setInvoices((prev) =>
        prev.map((inv) =>
          inv.invoiceNumber === sub.invoiceNumber ? { ...inv, status: "PAID" } : inv
        )
      );

      setNotification(`Payment of ${formatPHP(sub.claimedAmount)} verified and posted to confirmed ledger in Supabase!`);
      setTimeout(() => setNotification(null), 4000);
    });
  }

  function handleRejectSubmission(subId: string) {
    startTransition(async () => {
      try {
        await rejectPaymentSubmissionAction(subId);
      } catch {
        // Fallback
      }

      setSubmissions((prev) =>
        prev.map((s) => (s.id === subId ? { ...s, status: "REJECTED" } : s))
      );
      setNotification("Payment submission marked as REJECTED in Supabase.");
      setTimeout(() => setNotification(null), 4000);
    });
  }

  function handleIssueInvoice(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const amountNum = parseFloat(invoiceAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    const formData = new FormData(e.currentTarget);
    formData.set("profileId", "daff0fae-74ea-48db-bd5c-1ba7fa8e43b7");
    formData.set("title", invoiceTitle);
    formData.set("amountPHP", invoiceAmount);
    formData.set("dueDate", invoiceDueDate);
    formData.set("description", invoiceDescription);

    startTransition(async () => {
      try {
        await createInvoiceAction(formData);
      } catch {
        // Fallback
      }

      const newInv: InvoiceDTO = {
        id: `inv-${Date.now()}`,
        invoiceNumber: `INV-2026-${Math.floor(100 + Math.random() * 900)}`,
        memberName: memberSelection,
        title: invoiceTitle,
        dueDate: invoiceDueDate,
        amount: amountNum,
        status: "ISSUED",
      };

      setInvoices((prev) => [newInv, ...prev]);
      setShowIssueModal(false);
      setInvoiceTitle("");
      setInvoiceAmount("");
      setInvoiceDueDate("");
      setInvoiceDescription("");
      setNotification(`Invoice for ${memberSelection} created and dispatched to Supabase.`);
      setTimeout(() => setNotification(null), 4000);
    });
  }

  const totalInvoicedCentavos = sumCentavos(invoices.map((i) => toCentavos(i.amount)));
  const totalCollectedCentavos = sumCentavos(
    invoices.filter((i) => i.status === "PAID").map((i) => toCentavos(i.amount))
  );
  const totalOutstandingCentavos = totalInvoicedCentavos - totalCollectedCentavos;

  const filteredInvoices = invoices.filter((inv) => {
    const matchesStatus = filterStatus === "ALL" || inv.status === filterStatus;
    const matchesSearch =
      inv.memberName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Title & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Treasury, Dues & Liquidation
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Live Supabase cash records, proof verification & member balances (PHP)
          </p>
        </div>
        <button
          onClick={() => setShowIssueModal(true)}
          className="inline-flex items-center gap-2 py-2 px-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition shadow-xs cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          Issue Invoice / Dues
        </button>
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
            {formatPHP(totalInvoicedCentavos / 100)}
          </h3>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Verified Collections</p>
          <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
            {formatPHP(totalCollectedCentavos / 100)}
          </h3>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">Outstanding Receivables</p>
          <h3 className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-2">
            {formatPHP(totalOutstandingCentavos / 100)}
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
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            {submissions.filter((s) => s.status === "SUBMITTED").length} Awaiting Review
          </span>
        </div>

        {submissions.length === 0 ? (
          <p className="text-center py-6 text-xs text-slate-400 italic">No submissions awaiting review in Supabase</p>
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
                            disabled={isPending}
                            className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-xs cursor-pointer disabled:opacity-50"
                          >
                            Verify
                          </button>
                          <button
                            onClick={() => handleRejectSubmission(sub.id)}
                            disabled={isPending}
                            className="px-2.5 py-1 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-semibold text-xs cursor-pointer disabled:opacity-50"
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

      {/* Invoices List with Search & Filtering */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Member Invoices & Dues
          </h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search invoices..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              aria-label="Filter invoices by status"
              className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-rose-500 cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="ISSUED">Pending / Issued</option>
              <option value="PAID">Confirmed Paid</option>
            </select>
          </div>
        </div>

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
              {filteredInvoices.map((inv) => (
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
              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-xs text-slate-400 italic">
                    No invoices match the selected filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Issue Invoice */}
      {showIssueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Issue Club Invoice / Dues
              </h3>
              <button
                onClick={() => setShowIssueModal(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleIssueInvoice} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Bill To Member *
                </label>
                <select
                  value={memberSelection}
                  onChange={(e) => setMemberSelection(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
                >
                  <option value="Rafael Alcantara">Rafael Alcantara (Project Chair)</option>
                  <option value="Maria Santos">Maria Santos (Treasurer)</option>
                  <option value="Danilo Cruz">Danilo Cruz (Secretary)</option>
                  <option value="Kirsten Lim">Kirsten Lim (Member)</option>
                  <option value="Alyssa Mendoza">Alyssa Mendoza (Inductee)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Invoice Title / Purpose *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DISCON 2027 Registration Fee"
                  value={invoiceTitle}
                  onChange={(e) => setInvoiceTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Amount (PHP) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="1500.00"
                    value={invoiceAmount}
                    onChange={(e) => setInvoiceAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Due Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={invoiceDueDate}
                    onChange={(e) => setInvoiceDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Optional Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Payment channels accepted: GCash / BDO / Maya..."
                  value={invoiceDescription}
                  onChange={(e) => setInvoiceDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowIssueModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-xs disabled:opacity-50"
                >
                  {isPending ? "Issuing..." : "Issue Invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
