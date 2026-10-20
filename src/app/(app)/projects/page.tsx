"use client";

import React, { useState } from "react";
import { StatusBadge } from "@/components/shared/badge";
import { FolderKanban, Plus, FileText, Download, CheckCircle, Clock, Eye, Sparkles } from "lucide-react";
import { formatPHP } from "@/lib/utils/money";

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

  function handleDownloadReport(project: Project) {
    setDownloadingId(project.id);
    setTimeout(() => {
      // Generate sample report document
      const content = `ROTARACT CLUB OF SAN PEDRO EAST — DISTRICT 3820
ACCOMPLISHMENT REPORT
Project Title: ${project.title}
Status: ${project.status}
Category: ${project.category}
Official Areas of Focus: ${project.areasOfFocus.join(", ")}
UN SDGs: ${project.sdgs.join(", ")}
Beneficiaries: ${project.beneficiaries}
Total Volunteer Hours: ${project.volunteerHours}
Funds Raised: PHP ${project.fundsRaised.toLocaleString()}
Generated at: ${new Date().toLocaleString()} (Asia/Manila)
--------------------------------------------------
Note: District 3820 configurable template. Review and verify before district submission.`;

      const blob = new Blob([content], { type: "text/plain;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Report_${project.title.replace(/\s+/g, "_")}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setDownloadingId(null);
    }, 800);
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
      </div>

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
                {downloadingId === project.id ? "Generating..." : "Download Report"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
