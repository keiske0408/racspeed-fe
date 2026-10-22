"use client";

import React, { useState } from "react";
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
  Clock,
  Calendar,
  MessageSquare,
  Plus,
  HelpCircle,
  X,
  UserCheck,
  HeartHandshake,
  Filter,
} from "lucide-react";
import { MemberDTO } from "@/features/members/queries";

export interface RetentionAlertItem {
  id: string;
  memberName: string;
  email: string;
  rule: "MISSED_CONSECUTIVE_GAS" | "SERVICE_INACTIVITY" | "PASTORAL_CARE";
  ruleTitle: string;
  explanation: string;
  supportingDates: string[];
  followUpStatus: "NEW" | "CONTACT_RECOMMENDED" | "CONTACTED" | "RESOLVED" | "EXEMPTED";
  notes?: string;
}

const INITIAL_ALERTS: RetentionAlertItem[] = [
  {
    id: "alt-1",
    memberName: "Danilo Cruz",
    email: "danilo.cruz@rotaract3820.org",
    rule: "MISSED_CONSECUTIVE_GAS",
    ruleTitle: "Missed 3 Consecutive General Assemblies",
    explanation: "Member missed the last 3 scheduled club assemblies without an approved excuse on file.",
    supportingDates: ["2026-10-10", "2026-09-26", "2026-09-12"],
    followUpStatus: "NEW",
  },
  {
    id: "alt-2",
    memberName: "Alyssa Mendoza",
    email: "alyssa.m@gmail.com",
    rule: "SERVICE_INACTIVITY",
    ruleTitle: "Service Inactivity (>60 Days)",
    explanation: "No qualifying community service project attendance recorded in the last 72 days.",
    supportingDates: ["Last attended: 2026-08-08 (Clean Water Drive)"],
    followUpStatus: "CONTACT_RECOMMENDED",
  },
];

interface RetentionClientProps {
  members: MemberDTO[];
}

export function RetentionClient({ members }: RetentionClientProps) {
  const [alerts, setAlerts] = useState<RetentionAlertItem[]>(INITIAL_ALERTS);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [notification, setNotification] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(true);

  // Form state for manual flag
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [flagReason, setFlagReason] = useState<RetentionAlertItem["rule"]>("PASTORAL_CARE");
  const [customExplanation, setCustomExplanation] = useState<string>("");

  function handleStatusChange(id: string, newStatus: RetentionAlertItem["followUpStatus"]) {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, followUpStatus: newStatus } : a))
    );
    const statusLabels: Record<RetentionAlertItem["followUpStatus"], string> = {
      NEW: "Flagged as New",
      CONTACT_RECOMMENDED: "Contact Recommended",
      CONTACTED: "Marked as Contacted",
      RESOLVED: "Resolved — Active Attendance Resumed",
      EXEMPTED: "Exempted (Approved Academic / Work Leave)",
    };
    setNotification(`Status updated: ${statusLabels[newStatus]}`);
    setTimeout(() => setNotification(null), 4000);
  }

  function handleAddFlag(e: React.FormEvent) {
    e.preventDefault();
    const targetMember = members.find((m) => m.id === selectedMemberId);
    if (!targetMember) return;

    let ruleTitle = "Pastoral Care & Member Check-in";
    if (flagReason === "MISSED_CONSECUTIVE_GAS") ruleTitle = "Missed General Assemblies";
    if (flagReason === "SERVICE_INACTIVITY") ruleTitle = "Project Inactivity (60+ Days)";

    const newAlert: RetentionAlertItem = {
      id: `alt-${Date.now()}`,
      memberName: targetMember.name,
      email: targetMember.email,
      rule: flagReason,
      ruleTitle,
      explanation:
        customExplanation ||
        "Manually flagged by officer for pastoral follow-up and engagement support.",
      supportingDates: [`Flagged: ${new Date().toISOString().split("T")[0]}`],
      followUpStatus: "NEW",
    };

    setAlerts((prev) => [newAlert, ...prev]);
    setShowAddModal(false);
    setSelectedMemberId("");
    setCustomExplanation("");
    setNotification(`Pastoral care flag created for ${targetMember.name}.`);
    setTimeout(() => setNotification(null), 4000);
  }

  const filteredAlerts = alerts.filter((a) => {
    if (filterStatus === "ALL") return true;
    return a.followUpStatus === filterStatus;
  });

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Member Retention & Engagement Alerts
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Confidential early-warning signals · Restricted to Club President, Secretary, and Membership Director
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHowItWorks(!showHowItWorks)}
            className="inline-flex items-center gap-1.5 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <HelpCircle className="w-4 h-4 text-rose-500" />
            {showHowItWorks ? "Hide Guide" : "How Retention Works"}
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 py-2 px-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Flag Member for Care
          </button>
        </div>
      </div>

      {notification && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Explanatory Guide Box */}
      {showHowItWorks && (
        <div className="bg-gradient-to-br from-slate-900 via-rose-950/30 to-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
              <ShieldAlert className="w-4 h-4" />
              <span>How Member Retention Alerts Work</span>
            </div>
            <button
              onClick={() => setShowHowItWorks(false)}
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-300">
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
              <p className="font-bold text-rose-300">1. Automated Detection</p>
              <p>
                You <strong>do NOT need to manually add old or inactive members</strong>! The system automatically inspects attendance check-ins and project logs every night.
              </p>
            </div>
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
              <p className="font-bold text-rose-300">2. Configurable Triggers</p>
              <p>
                Configured in Club Settings: Flags members who miss <strong>3 consecutive General Assemblies</strong> or have <strong>no service project attendance for 60+ days</strong>.
              </p>
            </div>
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
              <p className="font-bold text-rose-300">3. Pastoral Follow-Up</p>
              <p>
                Alerts are 100% confidential. Reach out via coffee chat, record follow-ups, or grant an <strong>Exemption</strong> (board exam, thesis, work shift) so they aren't repeatedly flagged.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Status Filters */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-xs w-fit">
        {[
          { key: "ALL", label: "All Alerts" },
          { key: "NEW", label: "New Alerts" },
          { key: "CONTACT_RECOMMENDED", label: "Contact Needed" },
          { key: "CONTACTED", label: "Contacted" },
          { key: "RESOLVED", label: "Resolved" },
          { key: "EXEMPTED", label: "Exempted" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterStatus(tab.key)}
            className={`px-3 py-1.5 rounded-lg font-semibold transition ${
              filterStatus === tab.key
                ? "bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Alerts Grid */}
      <div className="space-y-4">
        {filteredAlerts.map((alert) => (
          <div
            key={alert.id}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5"
          >
            <div className="space-y-2 max-w-xl">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-4 h-4" />
                </span>
                <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                  {alert.ruleTitle}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    alert.followUpStatus === "RESOLVED"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : alert.followUpStatus === "EXEMPTED"
                      ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                      : alert.followUpStatus === "CONTACTED"
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                      : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                  }`}
                >
                  {alert.followUpStatus.replace("_", " ")}
                </span>
              </div>

              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {alert.memberName}
              </h3>
              <p className="text-xs text-slate-500">{alert.email}</p>

              <p className="text-xs text-slate-600 dark:text-slate-300">
                {alert.explanation}
              </p>

              <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-400">
                <Calendar className="w-3.5 h-3.5" />
                <span>{alert.supportingDates.join(" · ")}</span>
              </div>
            </div>

            {/* Officer Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {alert.followUpStatus !== "CONTACTED" && (
                <button
                  onClick={() => handleStatusChange(alert.id, "CONTACTED")}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition"
                >
                  Mark Contacted
                </button>
              )}
              {alert.followUpStatus !== "RESOLVED" && (
                <button
                  onClick={() => handleStatusChange(alert.id, "RESOLVED")}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition shadow-xs"
                >
                  Mark Resolved
                </button>
              )}
              {alert.followUpStatus !== "EXEMPTED" && (
                <button
                  onClick={() => handleStatusChange(alert.id, "EXEMPTED")}
                  className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition shadow-xs"
                >
                  Grant Exemption
                </button>
              )}
            </div>
          </div>
        ))}

        {filteredAlerts.length === 0 && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-xs">
            No retention alerts found matching the selected filter.
          </div>
        )}
      </div>

      {/* Modal: Flag Member for Pastoral Care */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <HeartHandshake className="w-4 h-4 text-rose-500" />
                Flag Member for Pastoral Care
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddFlag} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Select Member from Club Roster *
                </label>
                <select
                  required
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="">-- Choose Member --</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.role}) · {m.status}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Follow-Up
                </label>
                <select
                  value={flagReason}
                  onChange={(e) => setFlagReason(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="PASTORAL_CARE">Personal / Pastoral Care Check-in</option>
                  <option value="MISSED_CONSECUTIVE_GAS">Missed Consecutive Meetings / GAs</option>
                  <option value="SERVICE_INACTIVITY">Service Project Inactivity (60+ Days)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Notes & Circumstances
                </label>
                <textarea
                  rows={3}
                  value={customExplanation}
                  onChange={(e) => setCustomExplanation(e.target.value)}
                  placeholder="e.g. Preparing for medical board exams, relocation to Cavite, coffee chat scheduled..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedMemberId}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-xs disabled:opacity-50"
                >
                  Create Alert
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
