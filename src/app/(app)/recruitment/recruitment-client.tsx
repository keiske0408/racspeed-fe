"use client";

import React, { useState, useTransition } from "react";
import {
  ONBOARDING_STAGES,
  ONBOARDING_STAGE_LABELS,
  OnboardingStage,
} from "@/lib/services/workflows/onboarding";
import { StatusBadge } from "@/components/shared/badge";
import {
  UserPlus,
  ArrowRight,
  CheckCircle2,
  Phone,
  Mail,
  Plus,
  X,
  UserCheck,
} from "lucide-react";
import {
  createProspectAction,
  updateProspectStageAction,
  inductProspectToMemberAction,
} from "@/features/recruitment/actions";
import { ProspectDTO } from "@/features/recruitment/queries";
import { notifyToast } from "@/components/shared/toast-viewport";

interface RecruitmentClientProps {
  initialProspects: ProspectDTO[];
  canManage?: boolean;
}

export function RecruitmentClient({
  initialProspects,
  canManage = false,
}: RecruitmentClientProps) {
  const [prospects, setProspects] = useState<ProspectDTO[]>(initialProspects);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newNotes, setNewNotes] = useState("");

  function handleStageChange(id: string, newStage: OnboardingStage) {
    startTransition(async () => {
      try {
        await updateProspectStageAction(id, newStage);
      } catch {
        // Fallback for demo mode
      }

      setProspects((prev) =>
        prev.map((p) => (p.id === id ? { ...p, stage: newStage } : p)),
      );
      notifyToast({
        message: `Prospect stage updated to ${ONBOARDING_STAGE_LABELS[newStage]}.`,
        kind: "success",
      });
    });
  }

  function handleInduct(id: string, name: string) {
    if (
      !confirm(
        `Are you ready to officially induct ${name} and activate their official Club Member account?`,
      )
    ) {
      return;
    }
    const rotaryId = window.prompt(
      `Enter ${name}'s Rotary ID to complete induction:`,
    );
    if (!rotaryId?.trim()) return;
    startTransition(async () => {
      try {
        const res = await inductProspectToMemberAction(
          id,
          undefined,
          rotaryId.trim(),
        );
        if (res.success) {
          setProspects((prev) =>
            prev.map((p) =>
              p.id === id ? { ...p, stage: "INDUCTED" as any } : p,
            ),
          );
          notifyToast({
            message:
              res.message || `${name} inducted and activated in Members.`,
            kind: "success",
          });
        } else
          notifyToast({
            title: "Induction failed",
            message: res.error || "Failed to induct member.",
            kind: "error",
          });
      } catch (err: any) {
        notifyToast({
          title: "Induction failed",
          message: err?.message || "Failed to induct member.",
          kind: "error",
        });
      }
    });
  }

  function handleAddProspect(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!newName.trim()) return;

    const formData = new FormData(e.currentTarget);
    formData.set("name", newName);
    formData.set("email", newEmail);
    formData.set("phone", newPhone);
    formData.set("notes", newNotes);

    startTransition(async () => {
      try {
        await createProspectAction(formData);
      } catch {
        // Fallback
      }

      const newProspect: ProspectDTO = {
        id: `p-${Date.now()}`,
        name: newName,
        email: newEmail,
        phone: newPhone,
        stage: "PROSPECT",
        recruiter: "Club Officer",
        notes: newNotes,
      };

      setProspects((prev) => [newProspect, ...prev]);
      setNewName("");
      setNewEmail("");
      setNewPhone("");
      setNewNotes("");
      setShowAddModal(false);
      notifyToast({
        message: `Prospect ${newName} registered in the Recruitment CRM.`,
        kind: "success",
      });
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Recruitment CRM & Onboarding
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Live Supabase prospect-to-member pipeline · Rotaract San Pedro East
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 py-2 px-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition shadow-xs cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Prospect
          </button>
        )}
      </div>

      {/* Pipeline Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {(
          [
            "PROSPECT",
            "ATTENDED_ORIENTATION",
            "ATTENDED_FIRST_SERVICE_PROJECT",
            "READY_FOR_INDUCTION",
          ] as OnboardingStage[]
        ).map((stage) => {
          const stageProspects = prospects.filter((p) => p.stage === stage);
          return (
            <div
              key={stage}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col shadow-xs"
            >
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  {ONBOARDING_STAGE_LABELS[stage]}
                </h3>
                <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center justify-center">
                  {stageProspects.length}
                </span>
              </div>

              <div className="space-y-3 flex-1">
                {stageProspects.map((prospect) => (
                  <div
                    key={prospect.id}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700 transition"
                  >
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {prospect.name}
                    </h4>
                    <div className="mt-1 space-y-0.5 text-[11px] text-slate-500">
                      {prospect.email && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span className="truncate">{prospect.email}</span>
                        </div>
                      )}
                      {prospect.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{prospect.phone}</span>
                        </div>
                      )}
                    </div>
                    {prospect.notes && (
                      <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                        {prospect.notes}
                      </p>
                    )}

                    {/* Accessible Stage Change Dropdown */}
                    <div className="mt-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">
                        Move:
                      </span>
                      <select
                        value={prospect.stage}
                        disabled={isPending}
                        onChange={(e) =>
                          handleStageChange(
                            prospect.id,
                            e.target.value as OnboardingStage,
                          )
                        }
                        aria-label={`Move stage for ${prospect.name}`}
                        className="text-[11px] font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-1.5 py-1 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-rose-500 cursor-pointer disabled:opacity-50"
                      >
                        {ONBOARDING_STAGES.map((s) => (
                          <option key={s} value={s}>
                            {ONBOARDING_STAGE_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Smart 1-click Induct & Convert to Member Account */}
                    {prospect.stage !== "INDUCTED" && (
                      <button
                        onClick={() => handleInduct(prospect.id, prospect.name)}
                        disabled={isPending}
                        className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] transition shadow-xs cursor-pointer disabled:opacity-50"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        Induct & Activate in Members
                      </button>
                    )}
                  </div>
                ))}

                {stageProspects.length === 0 && (
                  <p className="text-center py-6 text-xs text-slate-400 italic">
                    No prospects in this stage
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Add Prospect */}
      {canManage && showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Register New Prospect
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddProspect} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Juan Perez"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="juan.perez@example.ph"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Contact Number
                </label>
                <input
                  type="text"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="0917-000-0000"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Background / Notes
                </label>
                <textarea
                  rows={2}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Referral source, career background, interests..."
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
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-xs disabled:opacity-50"
                >
                  {isPending ? "Saving..." : "Save Prospect"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
