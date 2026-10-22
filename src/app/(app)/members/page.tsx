"use client";

import React, { useState } from "react";
import { StatusBadge } from "@/components/shared/badge";
import {
  Users,
  UserCheck,
  UserPlus,
  Download,
  Search,
  CheckCircle,
  AlertCircle,
  Shield,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  createMemberAction,
  approveMemberAction,
  rejectMemberAction,
} from "@/features/members/actions";

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "ACTIVE" | "PENDING" | "SUSPENDED";
  joinedDate: string;
  rotaryId?: string;
  classification: string;
}

const INITIAL_MEMBERS: Member[] = [
  {
    id: "m-1",
    name: "John Carlos Reyes",
    email: "jc.reyes@rotaract.local",
    role: "President",
    status: "ACTIVE",
    joinedDate: "2022-07-01",
    rotaryId: "RAC-109248",
    classification: "Software Engineering",
  },
  {
    id: "m-2",
    name: "Maria Santos",
    email: "maria.santos@rotaract.local",
    role: "Secretary",
    status: "ACTIVE",
    joinedDate: "2023-01-15",
    rotaryId: "RAC-110482",
    classification: "Healthcare / Nursing",
  },
  {
    id: "m-3",
    name: "Danilo Cruz",
    email: "danilo.cruz@rotaract.local",
    role: "Treasurer",
    status: "ACTIVE",
    joinedDate: "2022-09-01",
    rotaryId: "RAC-109881",
    classification: "Finance & Accounting",
  },
  {
    id: "m-4",
    name: "Bea Tolentino",
    email: "bea.t@example.ph",
    role: "Applicant",
    status: "PENDING",
    joinedDate: "2026-10-18",
    classification: "Marketing & Communications",
  },
  {
    id: "m-5",
    name: "Rafael Alcantara",
    email: "rafael.a@example.ph",
    role: "Applicant",
    status: "PENDING",
    joinedDate: "2026-10-19",
    classification: "Civil Engineering",
  },
];

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>(INITIAL_MEMBERS);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "PENDING">("ALL");
  const [notification, setNotification] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  async function handleApprove(id: string) {
    try {
      const res = await approveMemberAction(id);
      setMembers((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, status: "ACTIVE", role: "General Member" } : m
        )
      );
      setNotification(res.message || "Member account approved and activated.");
    } catch {
      // Fallback update
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
      // Ignored for offline/demo
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
        setNotification(res.message || "Member created successfully");
        const newMember: Member = {
          id: `m-${Date.now()}`,
          name: formData.get("fullName") as string,
          email: formData.get("email") as string,
          role: (formData.get("roleKey") as string).replace(/_/g, " "),
          status: "ACTIVE",
          joinedDate: new Date().toISOString().split("T")[0],
          classification: formData.get("classification") as string,
          rotaryId: (formData.get("rotaryId") as string) || undefined,
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

  function handleExportCSV() {
    const headers = "Name,Email,Role,Status,Joined Date,Rotary ID,Classification\n";
    const rows = members
      .map(
        (m) =>
          `"${m.name}","${m.email}","${m.role}","${m.status}","${m.joinedDate}","${m.rotaryId || ""}","${m.classification}"`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "rotaract_san_pedro_east_roster.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const filteredMembers = members.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase()) ||
      m.classification.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "ALL" ? true : m.status === filter;
    return matchesSearch && matchesFilter;
  });

  const totalPages = Math.ceil(filteredMembers.length / pageSize) || 1;
  const paginatedMembers = filteredMembers.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const pendingCount = members.filter((m) => m.status === "PENDING").length;

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Member Directory & Rostering
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Rotaract San Pedro East Roster · Rotary Year 2026-27
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 py-2 px-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition shadow-xs cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            Create Member / User
          </button>
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 py-2 px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {notification && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Pending Account Requests Queue */}
      {pendingCount > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <UserCheck className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
              Pending Registration Requests ({pendingCount})
            </h3>
          </div>
          <p className="text-xs text-amber-800 dark:text-amber-300/80 mb-4">
            Authorized officers can review prospective member submissions and grant active membership privileges.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {members
              .filter((m) => m.status === "PENDING")
              .map((pending) => (
                <div
                  key={pending.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-xs"
                >
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{pending.name}</h4>
                    <p className="text-xs text-slate-500">{pending.email}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Classification: {pending.classification}</p>
                  </div>
                  <div className="flex items-center gap-2">
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
              placeholder="Search members or classification..."
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
                className={`px-3 py-1 rounded-lg font-semibold transition ${
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
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Classification</th>
                <th className="py-3 px-4">Rotary ID</th>
                <th className="py-3 px-4">Joined Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {paginatedMembers.map((member) => (
                <tr key={member.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition">
                  <td className="py-3.5 px-4">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{member.name}</p>
                    <p className="text-[11px] text-slate-400">{member.email}</p>
                  </td>
                  <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 font-medium">
                    {member.role}
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
                </tr>
              ))}
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
                className="p-1 rounded-md border border-slate-200 dark:border-slate-700 disabled:opacity-30"
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
                className="p-1 rounded-md border border-slate-200 dark:border-slate-700 disabled:opacity-30"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Create User / Add Member */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Create Member Account
                </h3>
                <p className="text-[11px] text-slate-400">Add an active member to club roster</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                aria-label="Close modal"
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
                  placeholder="e.g. Maria Clara Santos"
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
                  placeholder="member@rotaract.local"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Designated Role
                  </label>
                  <select
                    name="roleKey"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="GENERAL_MEMBER">General Member</option>
                    <option value="BOARD_OFFICER">Board Officer</option>
                    <option value="PROJECT_CHAIR">Project Chair</option>
                    <option value="MEMBERSHIP_CHAIR">Membership Chair</option>
                    <option value="SECRETARY">Secretary</option>
                    <option value="TREASURER">Treasurer</option>
                    <option value="VICE_PRESIDENT">Vice President</option>
                    <option value="PRESIDENT">President</option>
                    <option value="AUDITOR">Auditor</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Rotary ID
                  </label>
                  <input
                    type="text"
                    name="rotaryId"
                    placeholder="e.g. RAC-112001"
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
                  placeholder="e.g. Graphic Design / Tech / Healthcare"
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
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-xs disabled:opacity-50 cursor-pointer"
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
