"use client";

import React, { useState } from "react";
import {
  Settings,
  Save,
  CheckCircle,
  Shield,
  Database,
  FileSpreadsheet,
  AlertCircle,
  Sliders,
} from "lucide-react";
import { updateClubSettingsAction } from "@/features/settings/actions";
import { ClubSettingsDTO } from "@/features/settings/queries";
import { PermissionMatrixEditor } from "@/components/permissions/permission-matrix-editor";
import {
  RoleConfigDTO,
  PageModuleDef,
  PermissionDefinition,
} from "@/lib/data/role-permissions-types";
import { RoleKey } from "@/lib/permissions/keys";
import { PushNotificationControl } from "@/components/settings/push-notification-control";

interface SettingsClientProps {
  initialSettings: ClubSettingsDTO;
  initialPermissions?: {
    roles: Record<RoleKey, RoleConfigDTO>;
    modules: PageModuleDef[];
    permissions: PermissionDefinition[];
  };
}

export function SettingsClient({ initialSettings, initialPermissions }: SettingsClientProps) {
  const [activeTab, setActiveTab] = useState<"SETTINGS" | "PERMISSIONS">("SETTINGS");

  const [clubName, setClubName] = useState(initialSettings.clubName);
  const [districtCode, setDistrictCode] = useState(initialSettings.districtCode);
  const [sponsorRotaryClub, setSponsorRotaryClub] = useState(initialSettings.sponsorRotaryClub);
  const [currentRotaryYear, setCurrentRotaryYear] = useState(initialSettings.currentRotaryYear);
  const [budgetApprovalPolicy, setBudgetApprovalPolicy] = useState(initialSettings.budgetApprovalPolicy);
  const [requireRegistrationApproval, setRequireRegistrationApproval] = useState(initialSettings.requireRegistrationApproval);
  const [retentionConsecutiveGasThreshold, setRetentionConsecutiveGasThreshold] = useState(initialSettings.retentionConsecutiveGasThreshold);
  const [retentionServiceDaysThreshold, setRetentionServiceDaysThreshold] = useState(initialSettings.retentionServiceDaysThreshold);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setNotification(null);
    setErrorMessage(null);

    const formData = new FormData(e.currentTarget);
    formData.append("requireRegistrationApproval", requireRegistrationApproval ? "true" : "false");

    try {
      const res = await updateClubSettingsAction(formData);
      if (res.success) {
        setNotification(res.message || "Club settings saved successfully!");
      } else {
        setErrorMessage(res.error || "Failed to update club settings.");
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to submit settings update.");
    } finally {
      setIsSubmitting(false);
      setTimeout(() => {
        setNotification(null);
        setErrorMessage(null);
      }, 5000);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Club Configuration & Governance Console
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Live Supabase parameters, dual-approval policy, and customizable role authority · RY {currentRotaryYear}
        </p>
      </div>

      {/* Main Mode Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("SETTINGS")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === "SETTINGS"
              ? "bg-rose-600 text-white shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Club Identity & Governance</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("PERMISSIONS")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === "PERMISSIONS"
              ? "bg-rose-600 text-white shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Role & Page Authority Matrix</span>
        </button>
      </div>

      {activeTab === "PERMISSIONS" ? (
        <PermissionMatrixEditor
          clubId={initialSettings?.clubId}
          initialRoles={initialPermissions?.roles || ({} as any)}
          modules={initialPermissions?.modules}
          permissions={initialPermissions?.permissions}
        />
      ) : (
        <>
          {notification && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{notification}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <PushNotificationControl />

          <form onSubmit={handleSave} className="space-y-6">
            <input type="hidden" name="clubId" value={initialSettings.clubId} />

            {/* Identity Section */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                <Settings className="w-4 h-4 text-rose-500" />
                Club Identity & Governance
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Club Name *
                  </label>
                  <input
                    type="text"
                    name="clubName"
                    required
                    value={clubName}
                    onChange={(e) => setClubName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Rotary District *
                  </label>
                  <input
                    type="text"
                    name="districtCode"
                    required
                    value={districtCode}
                    onChange={(e) => setDistrictCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Sponsor Rotary Club *
                  </label>
                  <input
                    type="text"
                    name="sponsorRotaryClub"
                    required
                    value={sponsorRotaryClub}
                    onChange={(e) => setSponsorRotaryClub(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Active Rotary Year
                  </label>
                  <select
                    name="currentRotaryYear"
                    value={currentRotaryYear}
                    onChange={(e) => setCurrentRotaryYear(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="2025-26">RY 2025-26</option>
                    <option value="2026-27">RY 2026-27 (Current)</option>
                    <option value="2027-28">RY 2027-28</option>
                    <option value="2028-29">RY 2028-29</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Financial & Approvals Policy */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                <Shield className="w-4 h-4 text-rose-500" />
                Financial & Approval Policies
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Budget Disbursement Dual-Approval Policy
                  </label>
                  <select
                    name="budgetApprovalPolicy"
                    value={budgetApprovalPolicy}
                    onChange={(e) => setBudgetApprovalPolicy(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="PRESIDENT_AND_TREASURER">President & Treasurer (Both required)</option>
                    <option value="PRESIDENT_ONLY">President Only</option>
                    <option value="TREASURER_ONLY">Treasurer Only</option>
                    <option value="EITHER">Either Officer</option>
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Standard Rotary transparency policy requires both President and Treasurer authorization.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Member Registration Approval Gate
                  </label>
                  <label className="flex items-center gap-2.5 mt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requireRegistrationApproval}
                      onChange={(e) => setRequireRegistrationApproval(e.target.checked)}
                      className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500"
                    />
                    <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                      Require Officer Approval for New Registrations
                    </span>
                  </label>
                  <p className="text-[11px] text-slate-400 mt-1">
                    When enabled, newly registered accounts enter APPLICANT status until approved in the Members directory.
                  </p>
                </div>
              </div>
            </div>

            {/* Member Retention Rules */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                <Database className="w-4 h-4 text-rose-500" />
                Member Retention & Engagement Thresholds
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Missed General Assemblies Trigger
                  </label>
                  <input
                    type="number"
                    name="retentionConsecutiveGasThreshold"
                    min={1}
                    max={10}
                    value={retentionConsecutiveGasThreshold}
                    onChange={(e) => setRetentionConsecutiveGasThreshold(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Flags pastoral care alert when a member misses this many consecutive unexcused assemblies (default: 3).
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Service Inactivity Threshold (Days)
                  </label>
                  <input
                    type="number"
                    name="retentionServiceDaysThreshold"
                    min={15}
                    max={365}
                    value={retentionServiceDaysThreshold}
                    onChange={(e) => setRetentionServiceDaysThreshold(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Flags pastoral care alert when no qualifying service project attendance is recorded within this period (default: 60 days).
                  </p>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isSubmitting ? "Saving to Supabase..." : "Save Club Settings"}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
