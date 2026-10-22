"use client";

import React, { useState } from "react";
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
  ExternalLink,
  Users,
  Award,
  Building2,
} from "lucide-react";
import { StatusBadge } from "@/components/shared/badge";
import { createSisterClubAction, createPartnershipInitiativeAction } from "@/features/partnerships/actions";

interface SisterClub {
  id: string;
  partnerClubName: string;
  district: string;
  country: string;
  partnershipType: "SISTER_CLUB_MOA" | "DISTRICT_TWIN_CLUB" | "PROJECT_PARTNER" | "SPONSOR_ROTARY_CLUB";
  agreementSignedDate: string;
  renewalDate: string;
  liaisonOfficerName: string;
  liaisonEmail: string;
  liaisonPhone: string;
  status: "ACTIVE" | "PENDING_MOA" | "INACTIVE";
  notes: string;
  initiativesCount: number;
}

const INITIAL_SISTER_CLUBS: SisterClub[] = [
  {
    id: "sc-1",
    partnerClubName: "Rotaract Club of Manila Metro",
    district: "3810",
    country: "Philippines",
    partnershipType: "SISTER_CLUB_MOA",
    agreementSignedDate: "2024-08-15",
    renewalDate: "2027-06-30",
    liaisonOfficerName: "Bea Rodriguez (International Service Director)",
    liaisonEmail: "liaison@racmanilametro.org",
    liaisonPhone: "+63 917 888 2345",
    status: "ACTIVE",
    notes: "Active sister club agreement focusing on youth literacy and joint medical missions.",
    initiativesCount: 3,
  },
  {
    id: "sc-2",
    partnerClubName: "Rotaract Club of Taipei Diamond",
    district: "3521",
    country: "Taiwan",
    partnershipType: "SISTER_CLUB_MOA",
    agreementSignedDate: "2025-02-23",
    renewalDate: "2028-02-23",
    liaisonOfficerName: "Kevin Chen (Club President)",
    liaisonEmail: "president@ractaipeidiamond.tw",
    liaisonPhone: "+886 912 345 678",
    status: "ACTIVE",
    notes: "Cross-district sister club agreement for international cultural exchange and global grant projects.",
    initiativesCount: 2,
  },
  {
    id: "sc-3",
    partnerClubName: "Rotary Club of San Pedro East (Sponsor Club)",
    district: "3820",
    country: "Philippines",
    partnershipType: "SPONSOR_ROTARY_CLUB",
    agreementSignedDate: "2018-07-01",
    renewalDate: "Permanent Charter",
    liaisonOfficerName: "Rotarian Engr. Manuel Santos",
    liaisonEmail: "youthservice@rotarysanpedroeast.org",
    liaisonPhone: "+63 918 555 7722",
    status: "ACTIVE",
    notes: "Mother Rotary sponsor club supporting RYLA sponsorships and community water projects.",
    initiativesCount: 5,
  },
  {
    id: "sc-4",
    partnerClubName: "Rotaract Club of Bangkok South",
    district: "3350",
    country: "Thailand",
    partnershipType: "DISTRICT_TWIN_CLUB",
    agreementSignedDate: "2026-01-10",
    renewalDate: "2027-01-10",
    liaisonOfficerName: "Somchai Prasert",
    liaisonEmail: "somchai@racbkk.th",
    liaisonPhone: "+66 81 234 5678",
    status: "PENDING_MOA",
    notes: "Pending final District Governor sign-off on mutual twinning agreement.",
    initiativesCount: 1,
  },
];

export default function PartnershipsPage() {
  const [sisterClubs, setSisterClubs] = useState<SisterClub[]>(INITIAL_SISTER_CLUBS);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showInitiativeModal, setShowInitiativeModal] = useState(false);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleAddSisterClub(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);

    try {
      const res = await createSisterClubAction(formData);
      if (res.success) {
        setNotification(res.message || "Sister club registered successfully");
        // Also append to local state
        const newClub: SisterClub = {
          id: res.partnerId || `sc-${Date.now()}`,
          partnerClubName: formData.get("partnerClubName") as string,
          district: formData.get("district") as string,
          country: (formData.get("country") as string) || "Philippines",
          partnershipType: (formData.get("partnershipType") as SisterClub["partnershipType"]) || "SISTER_CLUB_MOA",
          agreementSignedDate: (formData.get("agreementSignedDate") as string) || new Date().toISOString().split("T")[0],
          renewalDate: (formData.get("renewalDate") as string) || "2027-06-30",
          liaisonOfficerName: (formData.get("liaisonOfficerName") as string) || "Designated Liaison",
          liaisonEmail: (formData.get("liaisonEmail") as string) || "",
          liaisonPhone: (formData.get("liaisonPhone") as string) || "",
          status: "ACTIVE",
          notes: (formData.get("notes") as string) || "",
          initiativesCount: 0,
        };
        setSisterClubs((prev) => [newClub, ...prev]);
        setShowAddModal(false);
      } else {
        alert(res.error || "Failed to register sister club");
      }
    } catch (err: any) {
      alert(err?.message || "Failed to submit request.");
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setNotification(null), 4000);
    }
  }

  async function handleAddInitiative(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedClubId) return;
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    formData.append("sisterClubId", selectedClubId);

    try {
      const res = await createPartnershipInitiativeAction(formData);
      if (res.success) {
        setNotification(res.message || "Joint initiative registered successfully");
        setSisterClubs((prev) =>
          prev.map((c) =>
            c.id === selectedClubId ? { ...c, initiativesCount: c.initiativesCount + 1 } : c
          )
        );
        setShowInitiativeModal(false);
      } else {
        alert(res.error || "Failed to record initiative");
      }
    } catch (err: any) {
      alert(err?.message || "Failed to record initiative");
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setNotification(null), 4000);
    }
  }

  const filteredClubs = sisterClubs.filter((c) => {
    if (filterType === "ALL") return true;
    return c.partnershipType === filterType;
  });

  const activeCount = sisterClubs.filter((c) => c.status === "ACTIVE").length;
  const internationalCount = sisterClubs.filter((c) => c.country !== "Philippines").length;

  return (
    <div className="space-y-6">
      {/* Title & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Sister Clubs & Partnerships
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Memorandum of Agreements (MOA), Twin Clubs & Cross-District Initiatives
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 py-2 px-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-xs transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Sister / Partner Club
        </button>
      </div>

      {notification && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Active Partners</span>
            <Handshake className="w-4 h-4 text-rose-500" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">{activeCount}</h3>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">International Clubs</span>
            <Globe className="w-4 h-4 text-blue-500" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">{internationalCount}</h3>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Joint Projects</span>
            <Users className="w-4 h-4 text-emerald-500" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            {sisterClubs.reduce((sum, c) => sum + c.initiativesCount, 0)}
          </h3>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Home District</span>
            <Building2 className="w-4 h-4 text-amber-500" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">D3820</h3>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-xs w-fit">
        {[
          { key: "ALL", label: "All Partnerships" },
          { key: "SISTER_CLUB_MOA", label: "Sister Club MOAs" },
          { key: "DISTRICT_TWIN_CLUB", label: "Twin Clubs" },
          { key: "SPONSOR_ROTARY_CLUB", label: "Sponsor Rotary Club" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterType(tab.key)}
            className={`px-3 py-1.5 rounded-lg font-semibold transition ${
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
        {filteredClubs.map((club) => (
          <div
            key={club.id}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition"
          >
            <div>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900 mb-1.5">
                    District {club.district} · {club.country}
                  </span>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {club.partnerClubName}
                  </h3>
                </div>
                <StatusBadge status={club.status} />
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 mt-2">
                {club.notes}
              </p>

              {/* Agreement Metadata */}
              <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <FileCheck className="w-3.5 h-3.5 text-slate-400" /> Agreement Signed:
                  </span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{club.agreementSignedDate}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" /> Renewal Date:
                  </span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{club.renewalDate}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-slate-400" /> Joint Initiatives:
                  </span>
                  <span className="font-semibold text-rose-600 dark:text-rose-400">
                    {club.initiativesCount} Collaborative Projects
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
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <button
                onClick={() => {
                  setSelectedClubId(club.id);
                  setShowInitiativeModal(true);
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-medium text-xs transition cursor-pointer"
              >
                + Record Joint Initiative
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Add Sister / Partner Club */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl">
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
                  Partnership Agreement Type
                </label>
                <select
                  name="partnershipType"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="SISTER_CLUB_MOA">Sister Club (Official MOA)</option>
                  <option value="DISTRICT_TWIN_CLUB">District Twin Club</option>
                  <option value="PROJECT_PARTNER">Service Project Partner</option>
                  <option value="SPONSOR_ROTARY_CLUB">Sponsor Rotary Club</option>
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
                    Renewal Date
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
                  Liaison Officer Name
                </label>
                <input
                  type="text"
                  name="liaisonOfficerName"
                  placeholder="e.g. Maria Clara (International Service Chair)"
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
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    name="liaisonPhone"
                    placeholder="+63 900 000 0000"
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

      {/* Modal: Record Joint Initiative */}
      {showInitiativeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Record Joint Initiative
              </h3>
              <button
                onClick={() => setShowInitiativeModal(false)}
                aria-label="Close modal"
                className="p-1 rounded-md text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddInitiative} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Initiative / Project Title *
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  placeholder="e.g. Dual-Club Coastal Cleanup & Mangrove Planting"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Joint Volunteers Estimated
                </label>
                <input
                  type="number"
                  name="jointVolunteers"
                  defaultValue={25}
                  min={0}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description & Shared Responsibilities
                </label>
                <textarea
                  name="description"
                  rows={3}
                  placeholder="Host venue, joint funding details, logistics split between clubs..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowInitiativeModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? "Recording..." : "Record Initiative"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
