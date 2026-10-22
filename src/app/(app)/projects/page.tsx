"use client";

import React, { useState } from "react";
import { StatusBadge } from "@/components/shared/badge";
import { FolderKanban, Plus, FileText, Download, CheckCircle, Clock, Eye, Sparkles, X } from "lucide-react";
import { formatPHP } from "@/lib/utils/money";
import { generatePrintableReportHTML } from "@/lib/documents/report";
import { createProjectAction } from "@/features/projects/actions";

interface Project {
  id: string;
  title: string;
  category: string;
  areasOfFocus: string[];
  sdgs: number[];
  beneficiaries: number;
  volunteerHours: number;
  fundsRaised: number;
  status: "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED";
  reviewNotes?: string;
}

const SAMPLE_PROJECTS: Project[] = [
  {
    id: "proj-1",
    title: "Tubig Para sa Barangay: Clean Water Filtration Drive",
    category: "Community Service",
    areasOfFocus: ["Water, Sanitation, and Hygiene", "Disease Prevention and Treatment"],
    sdgs: [3, 6],
    beneficiaries: 450,
    volunteerHours: 85.0,
    fundsRaised: 35000,
    status: "APPROVED",
  },
  {
    id: "proj-2",
    title: "Aklat at Pangarap: Mobile Children's Reading Corner",
    category: "Youth Service",
    areasOfFocus: ["Basic Education and Literacy"],
    sdgs: [4],
    beneficiaries: 180,
    volunteerHours: 42.0,
    fundsRaised: 12500,
    status: "UNDER_REVIEW",
    reviewNotes: "Secretary reviewing photo evidence and beneficiary headcount.",
  },
  {
    id: "proj-3",
    title: "Laguna Bay Greening & Mangrove Reforestation",
    category: "Community Service",
    areasOfFocus: ["Environment"],
    sdgs: [13, 14, 15],
    beneficiaries: 1200,
    volunteerHours: 120.0,
    fundsRaised: 28000,
    status: "DRAFT",
  },
];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>(SAMPLE_PROJECTS);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  function handleDownloadReport(project: Project) {
    setDownloadingId(project.id);
    const html = generatePrintableReportHTML({
      title: project.title,
      category: project.category,
      status: project.status,
      areasOfFocus: project.areasOfFocus,
      sdgs: project.sdgs,
      beneficiaries: project.beneficiaries,
      volunteerHours: project.volunteerHours,
      fundsRaised: project.fundsRaised,
    });

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    }
    setDownloadingId(null);
  }

  async function handleCreateProject(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);

    try {
      const res = await createProjectAction(formData);
      if (res.success) {
        setNotification(res.message || "Project registered successfully");
        const newProj: Project = {
          id: `proj-${Date.now()}`,
          title: formData.get("title") as string,
          category: (formData.get("category") as string) || "Community Service",
          areasOfFocus: ["Community Economic Development"],
          sdgs: [1, 8],
          beneficiaries: Number(formData.get("beneficiaryCount") || 0),
          volunteerHours: Number(formData.get("volunteerHours") || 0),
          fundsRaised: Number(formData.get("fundsRaised") || 0),
          status: "APPROVED",
        };
        setProjects((prev) => [newProj, ...prev]);
        setShowAddModal(false);
      } else {
        alert(res.error || "Failed to create project");
      }
    } catch (err: any) {
      alert(err?.message || "Failed to create project");
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setNotification(null), 4000);
    }
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Projects & Accomplishment Reports
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Rotary Areas of Focus, UN SDG tracking & reproducible district reporting
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 py-2 px-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Register Service Project
        </button>
      </div>

      {notification && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {projects.map((project) => (
          <div
            key={project.id}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  {project.category}
                </span>
                <StatusBadge status={project.status} />
              </div>

              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
                {project.title}
              </h3>

              {/* Areas of Focus */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {project.areasOfFocus.map((focus) => (
                  <span
                    key={focus}
                    className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900"
                  >
                    {focus}
                  </span>
                ))}
              </div>

              {/* SDG Chips */}
              <div className="mt-2 flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400 font-semibold">SDGs:</span>
                {project.sdgs.map((sdg) => (
                  <span
                    key={sdg}
                    className="w-5 h-5 rounded-full bg-slate-900 dark:bg-slate-800 text-white text-[10px] font-black flex items-center justify-center"
                  >
                    {sdg}
                  </span>
                ))}
              </div>

              {/* Metric stats */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <p className="text-[10px] text-slate-400">Beneficiaries</p>
                  <p className="font-bold text-slate-800 dark:text-slate-200">{project.beneficiaries}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">Hours</p>
                  <p className="font-bold text-slate-800 dark:text-slate-200">{project.volunteerHours}h</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">Raised</p>
                  <p className="font-bold text-slate-800 dark:text-slate-200">
                    {formatPHP(project.fundsRaised)}
                  </p>
                </div>
              </div>

              {project.reviewNotes && (
                <div className="mt-3 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-[11px] text-amber-800 dark:text-amber-300">
                  <span className="font-semibold">Review note: </span>
                  {project.reviewNotes}
                </div>
              )}
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <button
                onClick={() => handleDownloadReport(project)}
                disabled={downloadingId === project.id}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-medium text-xs transition cursor-pointer disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                {downloadingId === project.id ? "Opening..." : "Download Official Report"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Register Service Project */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Register Service Project
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                aria-label="Close modal"
                className="p-1 rounded-md text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Project Title *
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  placeholder="e.g. Oplan Kalusugan: Barangay Medical Mission"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    name="category"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="Community Service">Community Service</option>
                    <option value="Youth Service">Youth Service</option>
                    <option value="International Service">International Service</option>
                    <option value="Professional Development">Professional Development</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Venue
                  </label>
                  <input
                    type="text"
                    name="venue"
                    placeholder="e.g. Barangay San Antonio Covered Court"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    required
                    defaultValue={new Date().toISOString().split("T")[0]}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    End Date *
                  </label>
                  <input
                    type="date"
                    name="endDate"
                    required
                    defaultValue={new Date().toISOString().split("T")[0]}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Beneficiaries
                  </label>
                  <input
                    type="number"
                    name="beneficiaryCount"
                    defaultValue={100}
                    min={0}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Volunteer Hours
                  </label>
                  <input
                    type="number"
                    name="volunteerHours"
                    defaultValue={40}
                    min={0}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Funds Raised (PHP)
                  </label>
                  <input
                    type="number"
                    name="fundsRaised"
                    defaultValue={15000}
                    min={0}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Project Summary & Objectives
                </label>
                <textarea
                  name="summary"
                  rows={2}
                  placeholder="Target beneficiaries, partnered barangay, project goals..."
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
                  {isSubmitting ? "Registering..." : "Save Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
