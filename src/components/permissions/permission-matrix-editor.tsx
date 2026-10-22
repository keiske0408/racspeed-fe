"use client";

import React, { useState, useTransition } from "react";
import {
  Shield,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Save,
  Lock,
  Unlock,
  Eye,
  Key,
  Users,
  Calendar,
  FolderKanban,
  Receipt,
  FileSpreadsheet,
  Globe,
  Award,
  ShieldAlert,
  Settings,
  CheckSquare,
  LayoutDashboard,
  UserPlus,
} from "lucide-react";
import { RoleKey, ROLE_LABELS, Permission } from "@/lib/permissions/keys";
import {
  RoleConfigDTO,
  PageModuleDef,
  APP_MODULES,
  PermissionDefinition,
  PERMISSION_DEFINITIONS,
} from "@/lib/data/role-permissions-types";
import {
  saveRolePermissionsAction,
  resetRolePermissionsAction,
} from "@/features/permissions/actions";

interface PermissionMatrixEditorProps {
  initialRoles: Record<RoleKey, RoleConfigDTO>;
  modules?: PageModuleDef[];
  permissions?: PermissionDefinition[];
}

const MODULE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  members: Users,
  recruitment: UserPlus,
  events: Calendar,
  projects: FolderKanban,
  tasks: CheckSquare,
  treasury: Receipt,
  budgets: FileSpreadsheet,
  partnerships: Globe,
  certificates: Award,
  retention: ShieldAlert,
  settings: Settings,
};

export function PermissionMatrixEditor({
  initialRoles,
  modules = APP_MODULES,
  permissions = PERMISSION_DEFINITIONS,
}: PermissionMatrixEditorProps) {
  const [roleConfigs, setRoleConfigs] = useState<Record<RoleKey, RoleConfigDTO>>(initialRoles);
  const [selectedRole, setSelectedRole] = useState<RoleKey>("PRESIDENT");
  const [activeSubTab, setActiveSubTab] = useState<"PAGES_AND_PERMS" | "OVERVIEW_TABLE">("PAGES_AND_PERMS");
  const [isPending, startTransition] = useTransition();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentConfig = roleConfigs[selectedRole] || {
    roleKey: selectedRole,
    roleLabel: ROLE_LABELS[selectedRole],
    description: "",
    allowedPages: [],
    allowedPermissions: [],
  };

  // Toggle page module access for current role
  function handleTogglePage(moduleKey: string) {
    const isAllowed = currentConfig.allowedPages.includes(moduleKey);
    const updatedPages = isAllowed
      ? currentConfig.allowedPages.filter((k) => k !== moduleKey)
      : [...currentConfig.allowedPages, moduleKey];

    setRoleConfigs((prev) => ({
      ...prev,
      [selectedRole]: {
        ...currentConfig,
        allowedPages: updatedPages,
      },
    }));
  }

  // Toggle permission for current role
  function handleTogglePermission(permKey: Permission) {
    const isAllowed = currentConfig.allowedPermissions.includes(permKey);
    const updatedPerms = isAllowed
      ? currentConfig.allowedPermissions.filter((k) => k !== permKey)
      : [...currentConfig.allowedPermissions, permKey];

    setRoleConfigs((prev) => ({
      ...prev,
      [selectedRole]: {
        ...currentConfig,
        allowedPermissions: updatedPerms,
      },
    }));
  }

  // Select / Deselect all pages
  function handleSelectAllPages() {
    setRoleConfigs((prev) => ({
      ...prev,
      [selectedRole]: {
        ...currentConfig,
        allowedPages: modules.map((m) => m.key),
      },
    }));
  }

  function handleDeselectAllPages() {
    setRoleConfigs((prev) => ({
      ...prev,
      [selectedRole]: {
        ...currentConfig,
        allowedPages: ["dashboard"], // keep dashboard minimum
      },
    }));
  }

  // Save changes
  function handleSave() {
    startTransition(async () => {
      setToastMessage(null);
      setErrorMessage(null);

      const res = await saveRolePermissionsAction(
        selectedRole,
        currentConfig.allowedPages,
        currentConfig.allowedPermissions
      );

      if (res.success && res.config) {
        setRoleConfigs((prev) => ({
          ...prev,
          [selectedRole]: res.config!,
        }));
        setToastMessage(res.message);
        setTimeout(() => setToastMessage(null), 4000);
      } else {
        setErrorMessage(res.error || "Failed to save permissions.");
        setTimeout(() => setErrorMessage(null), 4000);
      }
    });
  }

  // Reset to default standard bylaws
  function handleReset() {
    if (
      !confirm(
        `Reset ${ROLE_LABELS[selectedRole]} to default District 3820 constitutional permissions?`
      )
    ) {
      return;
    }

    startTransition(async () => {
      const res = await resetRolePermissionsAction(selectedRole);
      if (res.success && res.config) {
        setRoleConfigs((prev) => ({
          ...prev,
          [selectedRole]: res.config!,
        }));
        setToastMessage(res.message);
        setTimeout(() => setToastMessage(null), 4000);
      }
    });
  }

  // Group permissions by category
  const categories: Array<"MEMBERSHIP" | "SERVICE" | "FINANCE" | "GOVERNANCE"> = [
    "MEMBERSHIP",
    "SERVICE",
    "FINANCE",
    "GOVERNANCE",
  ];

  return (
    <div className="space-y-6">
      {/* Toast notifications */}
      {toastMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Sub Tabs: Detailed Role Editor vs Overview Table */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab("PAGES_AND_PERMS")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubTab === "PAGES_AND_PERMS"
                ? "bg-rose-600 text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
            }`}
          >
            Role Authority & Page Editor
          </button>
          <button
            onClick={() => setActiveSubTab("OVERVIEW_TABLE")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubTab === "OVERVIEW_TABLE"
                ? "bg-rose-600 text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
            }`}
          >
            Full Access Matrix Table
          </button>
        </div>

        {activeSubTab === "PAGES_AND_PERMS" && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restore Bylaws</span>
            </button>
            <button
              onClick={handleSave}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isPending ? "Saving..." : "Save Role Config"}</span>
            </button>
          </div>
        )}
      </div>

      {activeSubTab === "PAGES_AND_PERMS" ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Column: Role Selector Pills */}
          <div className="lg:col-span-1 space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
              Select Role to Customize
            </h4>
            <div className="space-y-1">
              {(Object.keys(ROLE_LABELS) as RoleKey[]).map((role) => {
                const isSelected = selectedRole === role;
                const config = roleConfigs[role];
                const pageCount = config?.allowedPages?.length || 0;
                const permCount = config?.allowedPermissions?.length || 0;

                return (
                  <button
                    key={role}
                    onClick={() => setSelectedRole(role)}
                    className={`w-full text-left p-3 rounded-xl transition flex flex-col gap-1 cursor-pointer border ${
                      isSelected
                        ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 shadow-xs"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-bold ${
                          isSelected
                            ? "text-rose-700 dark:text-rose-300"
                            : "text-slate-800 dark:text-slate-200"
                        }`}
                      >
                        {ROLE_LABELS[role]}
                      </span>
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                      <span>{pageCount} pages</span>
                      <span>·</span>
                      <span>{permCount} permissions</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Customization Cards */}
          <div className="lg:col-span-3 space-y-6">
            {/* Active Role Header Banner */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-500/10 via-slate-500/5 to-transparent border border-rose-500/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {ROLE_LABELS[selectedRole]} Authority
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Customize which pages this officer can access and which governance actions they can execute.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllPages}
                  className="px-2.5 py-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 rounded-lg hover:bg-rose-100"
                >
                  Enable All Pages
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAllPages}
                  className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200"
                >
                  Clear Pages
                </button>
              </div>
            </div>

            {/* Section A: Assigned Page Modules */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-rose-500" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Assigned App Pages & Navigation ({currentConfig.allowedPages.length}/{modules.length})
                  </h4>
                </div>
                <span className="text-[11px] text-slate-400">
                  Toggle on to grant role sidebar visibility & access
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {modules.map((mod) => {
                  const isAllowed = currentConfig.allowedPages.includes(mod.key);
                  const Icon = MODULE_ICONS[mod.key] || LayoutDashboard;

                  return (
                    <button
                      type="button"
                      key={mod.key}
                      onClick={() => handleTogglePage(mod.key)}
                      className={`p-3 rounded-xl border text-left transition flex items-start justify-between gap-2 cursor-pointer ${
                        isAllowed
                          ? "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60"
                          : "bg-slate-50/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-60"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <span
                          className={`p-1.5 rounded-lg ${
                            isAllowed
                              ? "bg-rose-600 text-white"
                              : "bg-slate-200 dark:bg-slate-700 text-slate-500"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </span>
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight">
                            {mod.name}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {mod.path}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          isAllowed
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                            : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                        }`}
                      >
                        {isAllowed ? "Active" : "Locked"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section B: Governance Action Authorities */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-rose-500" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Granular Administrative Permissions ({currentConfig.allowedPermissions.length}/{permissions.length})
                  </h4>
                </div>
                <span className="text-[11px] text-slate-400">
                  Enforces button and mutation authority
                </span>
              </div>

              {categories.map((cat) => {
                const catPerms = permissions.filter((p) => p.category === cat);
                if (catPerms.length === 0) return null;

                return (
                  <div key={cat} className="space-y-2">
                    <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      {cat} Authority
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {catPerms.map((perm) => {
                        const isGranted = currentConfig.allowedPermissions.includes(perm.key);
                        return (
                          <label
                            key={perm.key}
                            className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition ${
                              isGranted
                                ? "bg-white dark:bg-slate-800/80 border-rose-200 dark:border-rose-900/60 shadow-2xs"
                                : "bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700 opacity-60"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isGranted}
                              onChange={() => handleTogglePermission(perm.key)}
                              className="mt-0.5 w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer"
                            />
                            <div className="flex-1">
                              <div className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight">
                                {perm.name}
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {perm.description}
                              </div>
                              <span className="inline-block mt-1 text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-700 text-slate-500">
                                {perm.key}
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Section C: Full Access Overview Table */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Rotaract Club Role Authority Cross-Matrix
            </h4>
            <p className="text-[11px] text-slate-400">
              High-level overview of which roles have access to each module in the system.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3 font-semibold text-slate-700 dark:text-slate-300 min-w-36">
                    Role Title
                  </th>
                  {modules.map((m) => (
                    <th
                      key={m.key}
                      className="p-3 font-semibold text-slate-700 dark:text-slate-300 text-center whitespace-nowrap"
                    >
                      {m.name.split(" ")[0]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(Object.keys(ROLE_LABELS) as RoleKey[]).map((role) => {
                  const config = roleConfigs[role];
                  return (
                    <tr
                      key={role}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
                    >
                      <td className="p-3 font-bold text-slate-900 dark:text-slate-100">
                        {ROLE_LABELS[role]}
                      </td>
                      {modules.map((m) => {
                        const hasAccess = config?.allowedPages?.includes(m.key);
                        return (
                          <td key={m.key} className="p-3 text-center">
                            {hasAccess ? (
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-xs font-bold">
                                ✓
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 text-xs">
                                —
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
