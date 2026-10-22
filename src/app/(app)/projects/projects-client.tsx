"use client";

import React, { useState } from "react";
import { StatusBadge } from "@/components/shared/badge";
import { FolderKanban, Plus, FileText, Download, CheckCircle, Clock, Eye, Sparkles, X } from "lucide-react";
import { formatPHP } from "@/lib/utils/money";
import { generatePrintableReportHTML } from "@/lib/documents/report";
import { createProjectAction } from "@/features/projects/actions";
import { ProjectDTO } from "@/features/projects/queries";

interface ProjectsClientProps {
  initialProjects: ProjectDTO[];
}

export function ProjectsClient({ initialProjects }: ProjectsClientProps) {
  const [projects, setProjects] = useState<ProjectDTO[]>(initialProjects);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleDownloadReport(project: ProjectDTO) {
    setDownloadingId(project.id);
    const html = generatePrintableReportHTML({
      title: project.title,
      clubName: "Rotaract Club of San Pedro East",
      district: "District 3820",
      category: project.category,
      status: project.status,
      beneficiaries: project.beneficiaries,
      volunteerHours: project.volunteerHours,
      fundsRaised: project.fundsRaised,
      areasOfFocus: project.areasOfFocus,
      sdgs: project.sdgs,
    });

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
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
        setNotification(res.message || "Project registered successfully in Supabase");
        const newProj: ProjectDTO = {
          id: `proj-${Date.now()}`,
          title: formData.get("title") as string,
          category: (formData.get("category") as string) || "Community Service",
          areasOfFocus: ["Community Economic Development"],
          sdgs: [1, 8],
          beneficiaries: Number(formData.get("beneficiaryCount") || 0),
          volunteerHours: Number(formData.get("volunteerHours") || 0),
          fundsRaised: Number(formData.get("fundsRaised") || 0),
          status: "ONGOING",
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

  const totalBeneficiaries = projects.reduce((acc, p) => acc + p.beneficiaries, 0);
  const totalHours = projects.reduce((acc, p) => acc + p.volunteerHours, 0);
  const totalFunds = projects.reduce((acc, p) => acc + p.fundsRaised, 0);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Service Projects & Accomplishment Reports
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Live Supabase impact tracking, Areas of Focus mapping & Rotary Foundation reports
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 py-2 px-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition shadow-xs cursor-pointer shrink-0"
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <p className="text-xs font-semibold text-slate-400">Total Beneficiaries Impacted</p>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            {totalBeneficiaries.toLocaleString()} Individuals
          </h3>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <p className="text-xs font-semibold text-slate-400">Total Volunteer Hours Rendered</p>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            {totalHours.toFixed(1)} Hours
          </h3>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <p className="text-xs font-semibold text-slate-400">Total Project Funds Mobilized</p>
          <h3 className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-2">
            {formatPHP(totalFunds)}
          </h3>
        </div>
      </div>

      {/* Projects List */}
      <div className="space-y-4">
        {projects.map((proj) => (
          <div
            key={proj.id}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6"
          >
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                  {proj.category}
                </span>
                <StatusBadge status={proj.status} />
              </div>

              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {proj.title}
              </h3>

              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span>
                  Beneficiaries: <strong className="text-slate-700 dark:text-slate-300">{proj.beneficiaries}</strong>
                </span>
                <span>•</span>
                <span>
                  Volunteer Hours: <strong className="text-slate-700 dark:text-slate-300">{proj.volunteerHours}</strong>
                </span>
                <span>•</span>
                <span>
                  Funds: <strong className="text-slate-700 dark:text-slate-300">{formatPHP(proj.fundsRaised)}</strong>
                </span>
              </div>

              {/* Area of Focus tags */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                {proj.areasOfFocus.map((aof, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                  >
                    {aof}
                  </span>
                ))}
                {proj.sdgs.map((sdg) => (
                  <span
                    key={sdg}
                    className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  >
                    SDG {sdg}
                  </span>
                ))}
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-2">
              <button
                onClick={() => handleDownloadReport(proj)}
                disabled={downloadingId === proj.id}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-rose-500" />
                {downloadingId === proj.id ? "Generating..." : "Print / PDF Report"}
              </button>
            </div>
          </div>
        ))}

        {projects.length === 0 && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-xs">
            No projects registered in Supabase yet.
          </div>
        )}
      </div>

      {/* Modal: Create Project */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Register Service Project
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
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
                  placeholder="e.g. Clean Water Filtration Drive"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Category *
                </label>
                <select
                  name="category"
                  defaultValue="Community Service"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="Community Service">Community Service</option>
                  <option value="Youth Service">Youth & Education Service</option>
                  <option value="International Service">International Service</option>
                  <option value="Club Service">Club Service</option>
                  <option value="Professional Development">Professional Development</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Beneficiary Count
                  </label>
                  <input
                    type="number"
                    name="beneficiaryCount"
                    defaultValue="100"
                    min="0"
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
                    defaultValue="25"
                    min="0"
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
                    defaultValue="2026-10-24"
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
                    defaultValue="2026-10-25"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Funds Mobilized (PHP)
                </label>
                <input
                  type="number"
                  name="fundsRaised"
                  defaultValue="15000"
                  min="0"
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
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? "Registering..." : "Register Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
