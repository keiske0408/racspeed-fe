"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  Globe,
  Plus,
  Handshake,
  Calendar,
  Mail,
  Phone,
  FileCheck,
  CheckCircle,
  X,
  Users,
  Award,
  Building2,
  Trash2,
  Edit2,
  ChevronDown,
  ChevronUp,
  Eye,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { StatusBadge } from "@/components/shared/badge";
import { notifyToast } from "@/components/shared/toast-viewport";
import {
  createSisterClubAction,
  updateSisterClubAction,
  deleteSisterClubAction,
} from "@/features/partnerships/actions";
import {
  SisterClubDTO,
  InitiativeStatus,
  PartnershipType,
  ClubPartnershipStatus,
} from "@/features/partnerships/queries";

interface PartnershipsClientProps {
  initialSisterClubs: SisterClubDTO[];
}

const INITIATIVE_STATUS_CONFIG: Record<
  InitiativeStatus,
  { label: string; color: string; icon?: React.ReactNode }
> = {
  PROPOSED: {
    label: "Proposed",
    color:
      "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-900",
  },
  IN_PROGRESS: {
    label: "In Progress",
    color:
      "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-900",
  },
  COMPLETED: {
    label: "Completed",
    color:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900",
  },
  CANCELLED: {
    label: "Postponed",
    color:
      "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700",
  },
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function PartnershipsClient({
  initialSisterClubs,
}: PartnershipsClientProps) {
  const [sisterClubs, setSisterClubs] =
    useState<SisterClubDTO[]>(initialSisterClubs);
  const [filterType, setFilterType] = useState<string>("ALL");

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditClubModal, setShowEditClubModal] = useState(false);
  const [showAllInitiativesModal, setShowAllInitiativesModal] = useState(false);

  const [editingClub, setEditingClub] = useState<SisterClubDTO | null>(null);
  const [initiativesViewFilter, setInitiativesViewFilter] =
    useState<string>("ALL");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Expanded cards state for initiatives
  const [expandedClubIds, setExpandedClubIds] = useState<
    Record<string, boolean>
  >({});

  function toggleClubExpanded(clubId: string) {
    setExpandedClubIds((prev) => ({
      ...prev,
      [clubId]: !prev[clubId],
    }));
  }

  // Add Sister Club
  async function handleAddSisterClub(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);

    try {
      const res = await createSisterClubAction(formData);
      if (res.success) {
        notifyToast({
          message: res.message || "Sister club registered successfully.",
          kind: "success",
        });
        const newClub: SisterClubDTO = res.club || {
          id: res.partnerId || `sc-${Date.now()}`,
          partnerClubName: formData.get("partnerClubName") as string,
          district: formData.get("district") as string,
          country: (formData.get("country") as string) || "Philippines",
          partnershipType:
            (formData.get("partnershipType") as PartnershipType) ||
            "SISTER_CLUB_MOA",
          agreementSignedDate:
            (formData.get("agreementSignedDate") as string) ||
            new Date().toISOString().split("T")[0],
          renewalDate: (formData.get("renewalDate") as string) || "2027-06-30",
          liaisonOfficerName:
            (formData.get("liaisonOfficerName") as string) ||
            "Designated Liaison",
          liaisonEmail: (formData.get("liaisonEmail") as string) || "",
          liaisonPhone: (formData.get("liaisonPhone") as string) || "",
          status: "ACTIVE",
          notes: (formData.get("notes") as string) || "",
          initiativesCount: 0,
          initiatives: [],
        };
        setSisterClubs((prev) => [newClub, ...prev]);
        setShowAddModal(false);
      } else {
        notifyToast({
          title: "Partner club not added",
          message: res.error || "Failed to register sister club.",
          kind: "error",
        });
      }
    } catch (err: any) {
      notifyToast({
        title: "Partner club not added",
        message: err?.message || "Failed to submit request.",
        kind: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  // Edit Sister Club
  function handleOpenEditClub(club: SisterClubDTO) {
    setEditingClub(club);
    setShowEditClubModal(true);
  }

  async function handleUpdateSisterClub(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingClub) return;
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    formData.append("clubId", editingClub.id);

    try {
      const res = await updateSisterClubAction(formData);
      if (res.success && res.club) {
        const updated = res.club;
        setSisterClubs((prev) =>
          prev.map((c) =>
            c.id === updated.id
              ? {
                  ...c,
                  ...updated,
                  initiatives: c.initiatives,
                  initiativesCount: c.initiativesCount,
                }
              : c,
          ),
        );
        setShowEditClubModal(false);
        setEditingClub(null);
        notifyToast({
          message: res.message || "Partner club details updated.",
          kind: "success",
        });
      } else {
        notifyToast({
          title: "Partner club not updated",
          message: res.error || "Failed to update sister club.",
          kind: "error",
        });
      }
    } catch (err: any) {
      notifyToast({
        title: "Partner club not updated",
        message: err?.message || "Failed to update sister club.",
        kind: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  // Delete Sister Club
  function handleDeleteSisterClub(clubId: string, clubName: string) {
    if (
      !confirm(
        `Are you sure you want to delete partner club "${clubName}"? Bound Project Center projects will not be deleted.`,
      )
    ) {
      return;
    }

    startTransition(async () => {
      // Optimistic UI update
      setSisterClubs((prev) => prev.filter((c) => c.id !== clubId));

      const res = await deleteSisterClubAction(clubId);
      if (res.success) {
        notifyToast({
          message: res.message || "Partner club removed.",
          kind: "success",
        });
      } else {
        notifyToast({
          title: "Partner club not removed",
          message: res.error || "Failed to delete partner club.",
          kind: "error",
        });
      }
    });
  }

  const filteredClubs = sisterClubs.filter((c) => {
    if (filterType === "ALL") return true;
    return c.partnershipType === filterType;
  });

  const activeCount = sisterClubs.filter((c) => c.status === "ACTIVE").length;
  const internationalCount = sisterClubs.filter(
    (c) => c.country !== "Philippines",
  ).length;
  const allInitiativesWithClub = sisterClubs.flatMap((c) =>
    (c.initiatives || []).map((init) => ({
      ...init,
      partnerClubName: c.partnerClubName,
      district: c.district,
      country: c.country,
    })),
  );
  const allInitiativesCount = new Set(
    allInitiativesWithClub.map((project) => project.activityId || project.id),
  ).size;

  const filteredAllInitiatives = allInitiativesWithClub.filter((init) => {
    if (initiativesViewFilter === "ALL") return true;
    return init.status === initiativesViewFilter;
  });

  return (
    <div className="space-y-6">
      {/* Title & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Sister Clubs & Partnerships
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Memorandum of Agreements (MOA), Twin Clubs & Joint Projects
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowAllInitiativesModal(true)}
            className="inline-flex items-center gap-2 py-2 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-xs transition cursor-pointer"
          >
            <Eye className="w-4 h-4 text-rose-500" />
            <span>View All Projects ({allInitiativesCount})</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 py-2 px-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-xs transition cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Partner Club</span>
          </button>
          <Link
            href="/project-center/new?kind=JOINT_PROJECT"
            className="inline-flex items-center gap-2 py-2 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-semibold text-xs transition"
          >
            <Plus className="w-4 h-4" />
            New Joint Project
          </Link>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">
              Active Partners
            </span>
            <Handshake className="w-4 h-4 text-rose-500" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            {activeCount}
          </h3>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">
              International Clubs
            </span>
            <Globe className="w-4 h-4 text-blue-500" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            {internationalCount}
          </h3>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">
              Bound Projects
            </span>
            <Users className="w-4 h-4 text-emerald-500" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            {allInitiativesCount}
          </h3>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">
              Home District
            </span>
            <Building2 className="w-4 h-4 text-amber-500" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            D3820
          </h3>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-xs w-fit max-w-full overflow-x-auto">
        {[
          { key: "ALL", label: "All Partnerships" },
          { key: "SISTER_CLUB_MOA", label: "Sister Club MOAs" },
          { key: "DISTRICT_TWIN_CLUB", label: "Twin Clubs" },
          { key: "PROJECT_PARTNER", label: "Project Partners" },
          { key: "SPONSOR_ROTARY_CLUB", label: "Sponsor Rotary Club" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterType(tab.key)}
            className={`px-3 py-1.5 rounded-lg font-semibold transition whitespace-nowrap cursor-pointer ${
              filterType === tab.key
                ? "bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sister Clubs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredClubs.map((club) => {
          const isExpanded = !!expandedClubIds[club.id];
          const initiatives = club.initiatives || [];
          const visibleInitiatives = isExpanded
            ? initiatives
            : initiatives.slice(0, 3);

          return (
            <div
              key={club.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition"
            >
              <div>
                {/* Header with Title, Status & Club Edit/Delete Controls */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900 mb-1.5">
                      District {club.district} · {club.country}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                      {club.partnerClubName}
                    </h3>
                  </div>

                  {/* Status & Edit/Delete Club Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <StatusBadge status={club.status} />
                    <button
                      type="button"
                      onClick={() => handleOpenEditClub(club)}
                      className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      title="Edit Partner Club"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleDeleteSisterClub(club.id, club.partnerClubName)
                      }
                      className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                      title="Delete Partner Club"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 mt-2">
                  {club.notes}
                </p>

                {/* Agreement Metadata */}
                <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <FileCheck className="w-3.5 h-3.5 text-slate-400" />{" "}
                      Agreement Signed:
                    </span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      {club.agreementSignedDate}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />{" "}
                      Renewal Date:
                    </span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      {club.renewalDate}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-slate-400" /> Joint
                      Projects:
                    </span>
                    <span className="font-semibold text-rose-600 dark:text-rose-400">
                      {initiatives.length} Bound Projects
                    </span>
                  </div>
                </div>

                {/* Liaison Contact */}
                <div className="mt-3 text-xs space-y-1 text-slate-500">
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    Liaison: {club.liaisonOfficerName}
                  </p>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400">
                    {club.liaisonEmail && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" /> {club.liaisonEmail}
                      </span>
                    )}
                    {club.liaisonPhone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {club.liaisonPhone}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Bound Projects ({initiatives.length})
                    </span>
                    {initiatives.length > 3 && (
                      <button
                        type="button"
                        onClick={() => toggleClubExpanded(club.id)}
                        className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-0.5"
                      >
                        {isExpanded ? (
                          <>
                            Show Less <ChevronUp className="w-3 h-3" />
                          </>
                        ) : (
                          <>
                            View All ({initiatives.length}){" "}
                            <ChevronDown className="w-3 h-3" />
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {initiatives.length === 0 ? (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-center text-xs text-slate-400">
                      No bound projects yet.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {visibleInitiatives.map((init) => {
                        const statusMeta =
                          INITIATIVE_STATUS_CONFIG[init.status] ||
                          INITIATIVE_STATUS_CONFIG.IN_PROGRESS;

                        return (
                          <div
                            key={init.id}
                            className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 transition"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span
                                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${statusMeta.color}`}
                                  >
                                    {statusMeta.label}
                                  </span>
                                  <Link
                                    href={`/project-center/${init.activityId || init.id}`}
                                    className="font-semibold text-xs text-slate-900 hover:underline dark:text-slate-100 break-words"
                                  >
                                    {init.title}
                                  </Link>
                                </div>
                                {init.description && (
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                                    {init.description}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 font-semibold">
                                  {init.jointVolunteers} vols
                                </span>
                                <Link
                                  href={`/project-center/${init.activityId || init.id}`}
                                  className="rounded-md px-2 py-1 text-[10px] font-semibold text-[#0D3594] hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-500/10"
                                >
                                  Open Project
                                </Link>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Card Footer: Record Joint Initiative Button */}
              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                <Link
                  href={
                    UUID_PATTERN.test(club.id)
                      ? `/project-center/new?kind=JOINT_PROJECT&sisterClubId=${encodeURIComponent(club.id)}`
                      : `/project-center/new?kind=JOINT_PROJECT&partnerClubName=${encodeURIComponent(club.partnerClubName)}`
                  }
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-medium text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Joint Project</span>
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Add Sister / Partner Club */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Add Partner or Sister Club
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                aria-label="Close modal"
                className="p-1 rounded-md text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSisterClub} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Partner Club Name *
                </label>
                <input
                  type="text"
                  name="partnerClubName"
                  required
                  placeholder="e.g. Rotaract Club of Cebu East"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Rotary District *
                  </label>
                  <input
                    type="text"
                    name="district"
                    required
                    placeholder="e.g. 3860"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Country *
                  </label>
                  <input
                    type="text"
                    name="country"
                    required
                    defaultValue="Philippines"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Partnership Category *
                </label>
                <select
                  name="partnershipType"
                  defaultValue="SISTER_CLUB_MOA"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="SISTER_CLUB_MOA">
                    Sister Club MOA (Official Bilateral)
                  </option>
                  <option value="DISTRICT_TWIN_CLUB">
                    District Twin Club (District-level)
                  </option>
                  <option value="PROJECT_PARTNER">
                    Collaborative Project Partner
                  </option>
                  <option value="SPONSOR_ROTARY_CLUB">
                    Sponsor Rotary Club
                  </option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Agreement Signed Date
                  </label>
                  <input
                    type="date"
                    name="agreementSignedDate"
                    defaultValue={new Date().toISOString().split("T")[0]}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Renewal / Expiration Date
                  </label>
                  <input
                    type="date"
                    name="renewalDate"
                    defaultValue="2027-06-30"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Designated Liaison Officer
                </label>
                <input
                  type="text"
                  name="liaisonOfficerName"
                  placeholder="e.g. John Doe (Club VP / Liaison)"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Liaison Email
                  </label>
                  <input
                    type="email"
                    name="liaisonEmail"
                    placeholder="liaison@partnerclub.org"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Liaison Phone
                  </label>
                  <input
                    type="text"
                    name="liaisonPhone"
                    placeholder="+63 917 123 4567"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Scope of Partnership / Notes
                </label>
                <textarea
                  name="notes"
                  rows={2}
                  placeholder="Focus areas (e.g. Basic Education, Water), joint meeting commitments..."
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
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : "Save Partnership"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Partner or Sister Club */}
      {showEditClubModal && editingClub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Edit Partner Club: {editingClub.partnerClubName}
              </h3>
              <button
                onClick={() => {
                  setShowEditClubModal(false);
                  setEditingClub(null);
                }}
                aria-label="Close modal"
                className="p-1 rounded-md text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleUpdateSisterClub}
              className="mt-4 space-y-3.5"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Partner Club Name *
                </label>
                <input
                  type="text"
                  name="partnerClubName"
                  required
                  defaultValue={editingClub.partnerClubName}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Rotary District *
                  </label>
                  <input
                    type="text"
                    name="district"
                    required
                    defaultValue={editingClub.district}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Country *
                  </label>
                  <input
                    type="text"
                    name="country"
                    required
                    defaultValue={editingClub.country}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Partnership Category *
                  </label>
                  <select
                    name="partnershipType"
                    defaultValue={editingClub.partnershipType}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="SISTER_CLUB_MOA">
                      Sister Club MOA (Official Bilateral)
                    </option>
                    <option value="DISTRICT_TWIN_CLUB">
                      District Twin Club (District-level)
                    </option>
                    <option value="PROJECT_PARTNER">
                      Collaborative Project Partner
                    </option>
                    <option value="SPONSOR_ROTARY_CLUB">
                      Sponsor Rotary Club
                    </option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Partnership Status *
                  </label>
                  <select
                    name="status"
                    defaultValue={editingClub.status}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="PENDING_MOA">Pending MOA</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Agreement Signed Date
                  </label>
                  <input
                    type="date"
                    name="agreementSignedDate"
                    defaultValue={editingClub.agreementSignedDate}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Renewal / Expiration Date
                  </label>
                  <input
                    type="date"
                    name="renewalDate"
                    defaultValue={editingClub.renewalDate}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Designated Liaison Officer
                </label>
                <input
                  type="text"
                  name="liaisonOfficerName"
                  defaultValue={editingClub.liaisonOfficerName}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Liaison Email
                  </label>
                  <input
                    type="email"
                    name="liaisonEmail"
                    defaultValue={editingClub.liaisonEmail}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Liaison Phone
                  </label>
                  <input
                    type="text"
                    name="liaisonPhone"
                    defaultValue={editingClub.liaisonPhone}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Scope of Partnership / Notes
                </label>
                <textarea
                  name="notes"
                  rows={2}
                  defaultValue={editingClub.notes}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditClubModal(false);
                    setEditingClub(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAllInitiativesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  All Bound Projects
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Sister club, twin club, sponsor & partner projects
                </p>
              </div>
              <button
                onClick={() => setShowAllInitiativesModal(false)}
                aria-label="Close modal"
                className="p-1 rounded-md text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter pills in modal */}
            <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center gap-1.5 overflow-x-auto text-xs">
              <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Status:
              </span>
              {[
                { key: "ALL", label: "All" },
                { key: "PROPOSED", label: "Proposed" },
                { key: "IN_PROGRESS", label: "In Progress" },
                { key: "COMPLETED", label: "Completed" },
                { key: "CANCELLED", label: "Postponed" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setInitiativesViewFilter(tab.key)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer whitespace-nowrap ${
                    initiativesViewFilter === tab.key
                      ? "bg-rose-600 text-white"
                      : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Initiatives List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {filteredAllInitiatives.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  No bound projects match this filter.
                </div>
              ) : (
                filteredAllInitiatives.map((init) => {
                  const statusMeta =
                    INITIATIVE_STATUS_CONFIG[init.status] ||
                    INITIATIVE_STATUS_CONFIG.IN_PROGRESS;

                  return (
                    <div
                      key={`${init.id}:${init.sisterClubId || init.partnerClubName}`}
                      className="p-4 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 shadow-2xs hover:shadow-xs transition"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${statusMeta.color}`}
                            >
                              {statusMeta.label}
                            </span>
                            <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                              {init.partnerClubName} (D{init.district})
                            </span>
                            <span className="text-[10px] text-slate-400">
                              RY {init.rotaryYear || "2026-27"}
                            </span>
                          </div>

                          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1">
                            <Link href={`/project-center/${init.activityId || init.id}`} className="hover:underline break-words">
                              {init.title}
                            </Link>
                          </h4>

                          {init.description && (
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                              {init.description}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0 pt-1">
                          <span className="text-xs px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 font-bold border border-rose-200 dark:border-rose-900">
                            {init.jointVolunteers} Volunteers
                          </span>

                          <Link
                            href={`/project-center/${init.activityId || init.id}`}
                            className="inline-flex items-center gap-1.5 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Open Project
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setShowAllInitiativesModal(false)}
                className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-white font-semibold text-xs transition hover:bg-slate-800 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
