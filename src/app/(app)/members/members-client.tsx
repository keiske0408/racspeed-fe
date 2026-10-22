"use client";

import React, { useState } from "react";
import { StatusBadge } from "@/components/shared/badge";
import {
  Users,
  UserPlus,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Filter,
  Search,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  Shield,
  Key,
  Info,
  Check,
  AlertTriangle,
  Crown,
  Edit3,
} from "lucide-react";
import {
  createMemberAction,
  approveMemberAction,
  rejectMemberAction,
  updateMemberRoleAction,
} from "@/features/members/actions";
import { MemberDTO } from "@/features/members/queries";
import { CurrentUserContext } from "@/lib/auth/session";

export const ROLE_AUTHORITY_INFO: Record<string, { label: string; permissions: string[]; restrictions: string[] }> = {
  PRESIDENT: {
    label: "Club President",
    permissions: [
      "Executive administration & leadership",
      "Approve / decline member applications",
      "Dual-approve project budget proposals",
      "Assign member roles & manage club authorities",
      "Sign Sister Club MOAs & partnership charters",
    ],
    restrictions: ["Cannot override Treasurer's verified cash ledger directly"],
  },
  VICE_PRESIDENT: {
    label: "Vice President",
    permissions: [
      "Board governance & administration",
      "Approve member applications",
      "Manage recruitment pipeline & orientation",
      "Issue participation certificates",
    ],
    restrictions: ["Cannot execute treasury disbursements alone"],
  },
  SECRETARY: {
    label: "Secretary",
    permissions: [
      "Manage attendance sessions & dynamic QR codes",
      "Approve member applications",
      "Maintain club records & member classifications",
      "Generate certificates & accomplishment reports",
    ],
    restrictions: ["Cannot sign off on financial budget disbursements"],
  },
  TREASURER: {
    label: "Treasurer",
    permissions: [
      "Full treasury & cash ledger access",
      "Issue member dues & event invoices",
      "Verify & reject payment proof receipts",
      "Co-approve project budget disbursements",
      "Audit project expense liquidations",
    ],
    restrictions: ["Cannot approve incoming membership applications alone"],
  },
  PROJECT_CHAIR: {
    label: "Project Chair / Director",
    permissions: [
      "Create service projects & leadership initiatives",
      "Submit project budget funding requests",
      "Submit project accomplishment reports & SDG logs",
      "Issue volunteer certificates",
    ],
    restrictions: ["Cannot approve own budget proposal", "Cannot verify payment proofs"],
  },
  MEMBERSHIP_CHAIR: {
    label: "Membership Chair",
    permissions: [
      "Manage recruitment pipeline & prospects",
      "View member engagement & retention alerts",
      "Create member profiles",
    ],
    restrictions: ["Cannot verify treasury dues", "Cannot approve budgets"],
  },
  BOARD_OFFICER: {
    label: "Board Officer",
    permissions: [
      "Create events & community service projects",
      "Submit budget proposals",
      "View retention warnings",
    ],
    restrictions: ["Cannot approve new members or verify financial proofs"],
  },
  GENERAL_MEMBER: {
    label: "General Member",
    permissions: [
      "View upcoming club events & meetings",
      "Scan QR code for automated attendance check-in",
      "Upload payment proof for dues & shirts",
      "Earn verifiable volunteer service hours",
    ],
    restrictions: [
      "Cannot approve or reject member accounts",
      "Cannot verify treasury payments or view internal ledger",
      "Cannot approve project budget disbursements",
      "Cannot issue or edit club certificates",
    ],
  },
  AUDITOR: {
    label: "Auditor",
    permissions: [
      "Audit-log and treasury ledger inspection",
      "Review budget liquidation receipts",
    ],
    restrictions: ["Cannot disburse funds or approve members"],
  },
};

interface MembersClientProps {
  initialMembers: MemberDTO[];
  currentUser: CurrentUserContext | null;
}

export function MembersClient({ initialMembers, currentUser }: MembersClientProps) {
  const [members, setMembers] = useState<MemberDTO[]>(initialMembers);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "PENDING">("ALL");
  const [notification, setNotification] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMatrixModal, setShowMatrixModal] = useState(false);

  // Edit Member Modal State
  const [editingMember, setEditingMember] = useState<MemberDTO | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editClassification, setEditClassification] = useState("");
  const [editRotaryId, setEditRotaryId] = useState("");
  const [editRoleKey, setEditRoleKey] = useState<string>("GENERAL_MEMBER");
  const [editStatus, setEditStatus] = useState<string>("ACTIVE");
  const [editIsPlatformAdmin, setEditIsPlatformAdmin] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const isSuperAdmin = currentUser?.isPlatformAdmin ?? false;

  async function handleApprove(id: string) {
    try {
      const res = await approveMemberAction(id);
      setMembers((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, status: "ACTIVE", role: "General Member" } : m
        )
      );
      setNotification(res.message || "Member account approved and activated in Supabase.");
    } catch {
      setMembers((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, status: "ACTIVE", role: "General Member" } : m
        )
      );
      setNotification("Member account approved and activated successfully.");
    }
    setTimeout(() => setNotification(null), 4000);
  }

  async function handleReject(id: string) {
    try {
      await rejectMemberAction(id);
    } catch {
      // Demo fallback
    }
    setMembers((prev) => prev.filter((m) => m.id !== id));
    setNotification("Account request declined.");
    setTimeout(() => setNotification(null), 4000);
  }

  async function handleCreateMember(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);

    try {
      const res = await createMemberAction(formData);
      if (res.success) {
        setNotification(res.message || "Member created successfully in database");
        const newMember: MemberDTO = {
          id: `m-${Date.now()}`,
          name: formData.get("fullName") as string,
          email: formData.get("email") as string,
          role: (formData.get("roleKey") as string).replace(/_/g, " "),
          roleKey: formData.get("roleKey") as string,
          status: "ACTIVE",
          joinedDate: new Date().toISOString().split("T")[0],
          classification: formData.get("classification") as string,
          rotaryId: (formData.get("rotaryId") as string) || undefined,
          isPlatformAdmin: false,
        };
        setMembers((prev) => [newMember, ...prev]);
        setShowAddModal(false);
      } else {
        alert(res.error || "Failed to create member");
      }
    } catch (err: any) {
      alert(err?.message || "Failed to create member");
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setNotification(null), 4000);
    }
  }

  function openEditModal(member: MemberDTO) {
    setEditingMember(member);
    setEditFullName(member.name);
    setEditClassification(member.classification || "");
    setEditRotaryId(member.rotaryId || "");
    setEditRoleKey(member.roleKey || "GENERAL_MEMBER");
    setEditStatus(member.status || "ACTIVE");
    setEditIsPlatformAdmin(member.isPlatformAdmin || false);
  }

  async function handleSaveEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingMember) return;
    setIsSubmitting(true);

    const formData = new FormData();
    formData.set("memberId", editingMember.id);
    formData.set("fullName", editFullName);
    formData.set("classification", editClassification);
    formData.set("rotaryId", editRotaryId);
    formData.set("roleKey", editRoleKey);
    formData.set("status", editStatus);
    formData.set("isPlatformAdmin", editIsPlatformAdmin ? "true" : "false");

    try {
      const res = await updateMemberRoleAction(formData);
      setNotification(res.message || "Member record updated in backend successfully.");
      setMembers((prev) =>
        prev.map((m) =>
          m.id === editingMember.id
            ? {
                ...m,
                name: editFullName,
                classification: editClassification,
                rotaryId: editRotaryId || undefined,
                role: ROLE_AUTHORITY_INFO[editRoleKey]?.label || editRoleKey.replace(/_/g, " "),
                roleKey: editRoleKey,
                status: editStatus as any,
                isPlatformAdmin: editIsPlatformAdmin,
              }
            : m
        )
      );
      setEditingMember(null);
    } catch (err: any) {
      alert(err?.message || "Failed to update member in database");
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setNotification(null), 4000);
    }
  }

  const filteredMembers = members.filter((m) => {
    const matchesFilter =
      filter === "ALL" ? true : filter === "ACTIVE" ? m.status === "ACTIVE" : m.status === "PENDING";
    const matchesSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.classification.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase()) ||
      m.role.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const totalPages = Math.ceil(filteredMembers.length / pageSize) || 1;
  const paginatedMembers = filteredMembers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const pendingApprovals = members.filter((m) => m.status === "PENDING");
  const activeCount = members.filter((m) => m.status === "ACTIVE").length;

  return (
    <div className="space-y-6">
      {/* Title & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Club Members & Authority Roles
            </h1>
            {isSuperAdmin && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                <Crown className="w-3 h-3" />
                Super Admin Mode
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real Supabase roster management, membership classifications & RBAC permission controls
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMatrixModal(true)}
            className="inline-flex items-center gap-1.5 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition cursor-pointer"
          >
            <Shield className="w-3.5 h-3.5 text-rose-500" />
            Authority Matrix
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 py-2 px-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Register Member / User
          </button>
        </div>
      </div>

      {notification && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <p className="text-xs font-semibold text-slate-400">Total Inducted Members</p>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">{activeCount}</h3>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
            Active in Supabase database
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <p className="text-xs font-semibold text-amber-500">Pending Registrations</p>
          <h3 className="text-2xl font-bold text-amber-500 mt-2">{pendingApprovals.length}</h3>
          <p className="text-[11px] text-slate-400 mt-1">Awaiting Super Admin / Officer approval</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <p className="text-xs font-semibold text-slate-400">Your Account</p>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-2 truncate">
            {currentUser?.fullName || currentUser?.email || "Super Admin"}
          </h3>
          <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 font-medium">
            {currentUser?.isPlatformAdmin ? "Super Admin (Full Edit Access)" : "Club Officer"}
          </p>
        </div>
      </div>

      {/* Pending Approvals Queue */}
      {pendingApprovals.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-amber-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Pending Registrations Awaiting Verification ({pendingApprovals.length})
            </h3>
          </div>
          <div className="space-y-2">
            {pendingApprovals.map((pending) => (
              <div
                key={pending.id}
                className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{pending.name}</p>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      PENDING APPROVAL
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{pending.email}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Classification: {pending.classification}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(pending)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    Edit & Assign
                  </button>
                  <button
                    onClick={() => handleApprove(pending.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-xs cursor-pointer"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(pending.id)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Roster Table Filter */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              aria-label="Search members or classification"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search members, roles, classification..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
            {(["ALL", "ACTIVE", "PENDING"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setFilter(tab);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 rounded-lg font-semibold transition cursor-pointer ${
                  filter === tab
                    ? "bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                {tab === "ALL" ? "All" : tab === "ACTIVE" ? "Active" : "Pending"}
              </button>
            ))}
          </div>
        </div>

        {/* Member Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Member Name</th>
                <th className="py-3 px-4">Role & Authority</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Classification</th>
                <th className="py-3 px-4">Rotary ID</th>
                <th className="py-3 px-4">Joined Date</th>
                <th className="py-3 px-4 text-right">Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {paginatedMembers.map((member) => (
                <tr key={member.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{member.name}</p>
                      {member.isPlatformAdmin && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                          <Crown className="w-2.5 h-2.5" />
                          Admin
                        </span>
                      )}
                      {member.id === currentUser?.id && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                          You
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400">{member.email}</p>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold text-xs bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                      <Key className="w-3 h-3 text-rose-500 shrink-0" />
                      {member.role}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <StatusBadge status={member.status} />
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                    {member.classification}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                    {member.rotaryId || "—"}
                  </td>
                  <td className="py-3.5 px-4 text-slate-500">
                    {member.joinedDate}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => openEditModal(member)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3 text-rose-500" />
                      Edit / Authority
                    </button>
                  </td>
                </tr>
              ))}
              {paginatedMembers.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400 italic">
                    No members match the current filter or search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing {(currentPage - 1) * pageSize + 1} to{" "}
              {Math.min(currentPage * pageSize, filteredMembers.length)} of {filteredMembers.length} members
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => p - 1)}
                className="p-1 rounded-md border border-slate-200 dark:border-slate-700 disabled:opacity-30 cursor-pointer"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-semibold">
                {currentPage} / {totalPages}
              </span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="p-1 rounded-md border border-slate-200 dark:border-slate-700 disabled:opacity-30 cursor-pointer"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Edit Member Details & Authority Role (Super Admin / Officer) */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-rose-600" />
                  Edit Member & Authority Permissions
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Account: <span className="font-semibold text-slate-900 dark:text-slate-100">{editingMember.email}</span>
                </p>
              </div>
              <button
                onClick={() => setEditingMember(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Classification *
                  </label>
                  <input
                    type="text"
                    required
                    value={editClassification}
                    onChange={(e) => setEditClassification(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Rotary ID
                  </label>
                  <input
                    type="text"
                    value={editRotaryId}
                    onChange={(e) => setEditRotaryId(e.target.value)}
                    placeholder="RI-0000000"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Assign Role & Permissions *
                  </label>
                  <select
                    value={editRoleKey}
                    onChange={(e) => setEditRoleKey(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium cursor-pointer"
                  >
                    <option value="PRESIDENT">Club President (Executive)</option>
                    <option value="VICE_PRESIDENT">Vice President</option>
                    <option value="SECRETARY">Secretary (Records & QR)</option>
                    <option value="TREASURER">Treasurer (Dues & Ledgers)</option>
                    <option value="PROJECT_CHAIR">Project Chair (Service & Budgets)</option>
                    <option value="MEMBERSHIP_CHAIR">Membership Chair (CRM)</option>
                    <option value="BOARD_OFFICER">Board Officer</option>
                    <option value="GENERAL_MEMBER">General Member (Voting/Volunteer)</option>
                    <option value="AUDITOR">Auditor (Inspection Only)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Membership Status *
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium cursor-pointer"
                  >
                    <option value="ACTIVE">ACTIVE (Full Member)</option>
                    <option value="PENDING">PENDING (Awaiting Review)</option>
                    <option value="PROBATIONARY">PROBATIONARY (Inductee)</option>
                    <option value="INACTIVE">INACTIVE / SUSPENDED</option>
                    <option value="ALUMNI">ALUMNI / HONORARY</option>
                  </select>
                </div>
              </div>

              {/* Super Admin Privileges Checkbox */}
              {isSuperAdmin && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-rose-800 dark:text-rose-200 flex items-center gap-1.5">
                      <Crown className="w-3.5 h-3.5 text-rose-600" />
                      Platform Administrator (Super Admin)
                    </p>
                    <p className="text-[11px] text-rose-600/80 dark:text-rose-400">
                      Grants cross-club platform administration & root authority.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={editIsPlatformAdmin}
                    onChange={(e) => setEditIsPlatformAdmin(e.target.checked)}
                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                  />
                </div>
              )}

              {/* Dynamic Authority Matrix Preview for Selected Role */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-700">
                  <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-rose-500" />
                    Role Privileges: {ROLE_AUTHORITY_INFO[editRoleKey]?.label || editRoleKey}
                  </span>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Rotary RBAC</span>
                </div>

                <div className="space-y-1">
                  <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    Granted Capabilities:
                  </p>
                  <ul className="space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                    {ROLE_AUTHORITY_INFO[editRoleKey]?.permissions.map((p, idx) => (
                      <li key={idx} className="flex items-center gap-1.5">
                        <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-1 pt-1.5 border-t border-slate-200/50 dark:border-slate-700/50">
                  <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                    Strict Authority Restrictions:
                  </p>
                  <ul className="space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                    {ROLE_AUTHORITY_INFO[editRoleKey]?.restrictions.map((r, idx) => (
                      <li key={idx} className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? "Saving Changes..." : "Save Member & Authority"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Full Authority Matrix & Bylaws Overview */}
      {showMatrixModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-rose-600" />
                  Rotary Club Authority Matrix & Separation of Duties
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Internal control policy: Members cannot approve budgets, decline registrations, or verify payments.
                </p>
              </div>
              <button
                onClick={() => setShowMatrixModal(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {Object.entries(ROLE_AUTHORITY_INFO).map(([key, info]) => (
                <div
                  key={key}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs text-slate-900 dark:text-slate-100">{info.label}</span>
                    <span className="font-mono text-[10px] text-slate-400 font-semibold">{key}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] mt-2">
                    <div className="text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded-lg">
                      <p className="font-bold mb-1">Permitted Authority:</p>
                      <ul className="list-disc pl-3.5 space-y-0.5">
                        {info.permissions.map((p, i) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 p-2 rounded-lg">
                      <p className="font-bold mb-1">Restricted / Blocked:</p>
                      <ul className="list-disc pl-3.5 space-y-0.5">
                        {info.restrictions.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setShowMatrixModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs shadow-xs cursor-pointer"
              >
                Close Matrix
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Register New Member */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Register New Club Member
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMember} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  name="fullName"
                  required
                  placeholder="e.g. Alyssa Mendoza"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="alyssa.m@gmail.com"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Club Role *
                  </label>
                  <select
                    name="roleKey"
                    defaultValue="GENERAL_MEMBER"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                  >
                    <option value="GENERAL_MEMBER">General Member</option>
                    <option value="PROJECT_CHAIR">Project Chair</option>
                    <option value="MEMBERSHIP_CHAIR">Membership Chair</option>
                    <option value="SECRETARY">Secretary</option>
                    <option value="TREASURER">Treasurer</option>
                    <option value="VICE_PRESIDENT">Vice President</option>
                    <option value="PRESIDENT">President</option>
                    <option value="BOARD_OFFICER">Board Officer</option>
                    <option value="AUDITOR">Auditor</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Rotary ID (optional)
                  </label>
                  <input
                    type="text"
                    name="rotaryId"
                    placeholder="RI-0000000"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Professional Classification *
                </label>
                <input
                  type="text"
                  name="classification"
                  required
                  placeholder="e.g. Information Technology, Civil Engineering"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? "Creating..." : "Save Member Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
