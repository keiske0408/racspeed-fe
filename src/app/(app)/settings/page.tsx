"use client";

import React, { useState } from "react";
import { Settings, Save, CheckCircle, Shield, Database, FileSpreadsheet } from "lucide-react";

export default function SettingsPage() {
  const [clubName, setClubName] = useState("Rotaract Club of San Pedro East");
  const [district, setDistrict] = useState("3820");
  const [rotaryYear, setRotaryYear] = useState("2026-27");
  const [approvalPolicy, setApprovalPolicy] = useState("PRESIDENT_AND_TREASURER");
  const [gaThreshold, setGaThreshold] = useState(3);
  const [serviceDaysThreshold, setServiceDaysThreshold] = useState(60);
  const [saved, setSaved] = useState(false);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Club Configuration & Operational Settings
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Rotaract San Pedro East · District 3820 governance parameters
        </p>
      </div>

      {saved && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>Club settings saved successfully!</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Identity Section */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 pb-2 border-b border-slate-100 dark:border-slate-800">
            Club Identity & Governance
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Club Name
              </label>
              <input
                type="text"
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Rotary District
              </label>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Active Rotary Year
              </label>
              <select
                value={rotaryYear}
                onChange={(e) => setRotaryYear(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="2025-26">RY 2025-26</option>
                <option value="2026-27">RY 2026-27 (Current)</option>
                <option value="2027-28">RY 2027-28</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Budget Approval Policy
              </label>
              <select
                value={approvalPolicy}
                onChange={(e) => setApprovalPolicy(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="PRESIDENT_AND_TREASURER">President & Treasurer (Both required)</option>
                <option value="PRESIDENT_ONLY">President Only</option>
                <option value="TREASURER_ONLY">Treasurer Only</option>
                <option value="EITHER">Either Officer</option>
              </select>
            </div>
          </div>
        </div>

        {/* Retention Thresholds */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 pb-2 border-b border-slate-100 dark:border-slate-800">
            Member Retention Thresholds
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Consecutive Missed General Assemblies
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={gaThreshold}
                onChange={(e) => setGaThreshold(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Triggers retention alert when unexcused misses reach this count.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Service Inactivity Threshold (Days)
              </label>
              <input
                type="number"
                min={14}
                max={180}
                value={serviceDaysThreshold}
                onChange={(e) => setServiceDaysThreshold(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Flags members with no qualifying community service participation.
              </p>
            </div>
          </div>
        </div>

        {/* Data Protection & Backup Strategy */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-xs text-slate-300 space-y-3">
          <div className="flex items-center gap-2 text-rose-400 font-bold">
            <Shield className="w-4 h-4" />
            <span>Philippine Data Privacy Act (RA 10173) Compliance</span>
          </div>
          <p>
            Member private records (emergency contacts, health data, birthdates) are stored in restricted relational tables protected by PostgreSQL Row Level Security. General directories expose only contact classification and Rotary IDs.
          </p>
          <div className="flex items-center gap-2 text-amber-400 font-bold pt-2">
            <Database className="w-4 h-4" />
            <span>Free-Tier Operational Safeguards & Backup Strategy</span>
          </div>
          <p>
            On the Supabase free tier without automated point-in-time recovery, club officers must execute weekly CSV exports of member rosters, attendance, and financial ledgers. See <code className="text-slate-200">docs/deployment.md</code> for pg_dump and restoration instructions.
          </p>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center gap-2 py-2.5 px-5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-md transition cursor-pointer"
          >
            <Save className="w-4 h-4" />
            Save Configurations
          </button>
        </div>
      </form>
    </div>
  );
}
