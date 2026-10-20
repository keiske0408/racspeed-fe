"use client";

import React, { useState } from "react";
import { ShieldAlert, AlertTriangle, CheckCircle, Clock, Calendar, MessageSquare } from "lucide-react";

interface RetentionAlert {
  id: string;
  memberName: string;
  email: string;
  rule: "MISSED_CONSECUTIVE_GAS" | "SERVICE_INACTIVITY";
  ruleTitle: string;
  explanation: string;
  supportingDates: string[];
  followUpStatus: "NEW" | "CONTACT_RECOMMENDED" | "CONTACTED" | "RESOLVED" | "EXEMPTED";
}

const SAMPLE_ALERTS: RetentionAlert[] = [
  {
    id: "alt-1",
    memberName: "Christian Bautista",
    email: "c.bautista@yahoo.com",
    rule: "MISSED_CONSECUTIVE_GAS",
    ruleTitle: "Missed 3 Consecutive General Assemblies",
    explanation: "Member missed the last 3 scheduled club assemblies without an approved excuse on file.",
    supportingDates: ["2026-10-10", "2026-09-26", "2026-09-12"],
    followUpStatus: "NEW",
  },
  {
    id: "alt-2",
    memberName: "David Ramos",
    email: "david.ramos@example.ph",
    rule: "SERVICE_INACTIVITY",
    ruleTitle: "Service Inactivity (>60 Days)",
    explanation: "No qualifying community service project attendance recorded in the last 72 days.",
    supportingDates: ["Last attended: 2026-08-08 (Clean Water Drive)"],
    followUpStatus: "CONTACT_RECOMMENDED",
  },
];

export default function RetentionAlertsPage() {
  const [alerts, setAlerts] = useState<RetentionAlert[]>(SAMPLE_ALERTS);
  const [notification, setNotification] = useState<string | null>(null);

  function handleStatusChange(id: string, newStatus: RetentionAlert["followUpStatus"]) {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, followUpStatus: newStatus } : a))
    );
    setNotification("Retention follow-up status updated.");
    setTimeout(() => setNotification(null), 3000);
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Member Retention & Engagement Alerts
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Confidential retention signals · Restricted to Club President, Secretary, and Membership Chair
        </p>
      </div>

      {notification && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Philosophy Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-slate-300 text-xs leading-relaxed">
        <div className="flex items-center gap-2 text-rose-400 font-bold mb-1">
          <ShieldAlert className="w-4 h-4" />
          <span>Rotaract Retention Philosophy</span>
        </div>
        Alerts are purely for proactive pastoral care and member engagement. The platform never shames, auto-suspends, or publicly penalizes members. Reach out personally to understand life circumstances before recording exemptions.
      </div>

      {/* Alerts Grid */}
      <div className="space-y-4">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5"
          >
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="p-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-4 h-4" />
                </span>
                <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                  {alert.ruleTitle}
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {alert.memberName}
              </h3>
              <p className="text-xs text-slate-500">{alert.email}</p>
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                {alert.explanation}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
                {alert.supportingDates.map((date) => (
                  <span key={date} className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-mono">
                    {date}
                  </span>
                ))}
              </div>
            </div>

            {/* Status Follow-up Control */}
            <div className="shrink-0 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Follow-up Status
              </label>
              <select
                value={alert.followUpStatus}
                onChange={(e) => handleStatusChange(alert.id, e.target.value as any)}
                aria-label={`Follow-up status for ${alert.memberName}`}
                className="w-full text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-rose-500"
              >
                <option value="NEW">New Alert</option>
                <option value="CONTACT_RECOMMENDED">Contact Recommended</option>
                <option value="CONTACTED">Officer Contacted</option>
                <option value="RESOLVED">Resolved / Re-engaged</option>
                <option value="EXEMPTED">Exempted by Officer</option>
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
