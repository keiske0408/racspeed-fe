"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  CheckSquare,
  ExternalLink,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  ACTIVITY_KINDS,
  ACTIVITY_KIND_META,
  AREAS_OF_FOCUS,
  COMMITTEES,
  MEETING_TYPES,
  MEETING_TYPE_LABELS,
  type ActivityKind,
  type ActivityStatus,
  type Committee,
  type MeetingType,
  type PartnerRole,
} from "@/features/activities/types";
import { TASK_PRIORITIES } from "@/features/activities/schemas";
import {
  MAX_RAW_TEXT_LENGTH,
  URL_PURPOSES,
  detectFormConflicts,
  mapAiDraftToFormDraft,
  mergeAiDraftWithExistingForm,
  type ActivityFormState,
  type AiDraftResponse,
  type AiUrlPurpose,
  type MappedAiDraftResult,
} from "@/features/activities/ai-draft-schema";
import type { TaskPriority } from "@/lib/data/tasks-types";

interface PartnerClubOption {
  id: string;
  name: string;
  district: string;
  country: string;
}

interface MemberOption {
  id: string;
  fullName: string;
  role?: string;
}

export function AiDraftPanel({
  canCreateEvent,
  canCreateProject,
  partnerClubs,
  members,
  currentForm,
  defaultDates,
  isSubmitting,
  onCancel,
  onApplyToForm,
  onConfirmCreate,
}: {
  canCreateEvent: boolean;
  canCreateProject: boolean;
  partnerClubs: PartnerClubOption[];
  members: MemberOption[];
  currentForm: ActivityFormState;
  defaultDates: { startAt: string; endAt: string };
  isSubmitting: boolean;
  onCancel: () => void;
  onApplyToForm: (merged: ActivityFormState, strategy: "fill_empty" | "overwrite") => void;
  onConfirmCreate: (finalForm: ActivityFormState) => void;
}) {
  const [rawText, setRawText] = useState("");
  const [phase, setPhase] = useState<"INPUT" | "REVIEW">("INPUT");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftMeta, setDraftMeta] = useState<MappedAiDraftResult["meta"] | null>(
    null,
  );
  const [reviewedForm, setReviewedForm] = useState<ActivityFormState | null>(
    null,
  );
  const [conflictStrategy, setConflictStrategy] = useState<
    "fill_empty" | "overwrite"
  >("fill_empty");
  const [newPartnerName, setNewPartnerName] = useState("");
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newLinkPurpose, setNewLinkPurpose] = useState<AiUrlPurpose>("other");

  const allowedKinds = useMemo(
    () =>
      ACTIVITY_KINDS.filter((k) =>
        k === "SERVICE_PROJECT" || k === "JOINT_PROJECT"
          ? canCreateProject
          : canCreateEvent,
      ),
    [canCreateEvent, canCreateProject],
  );

  const conflicts = useMemo(() => {
    if (!reviewedForm) return [];
    return detectFormConflicts(currentForm, reviewedForm, {
      defaultStartAt: defaultDates.startAt,
      defaultEndAt: defaultDates.endAt,
    });
  }, [currentForm, defaultDates.endAt, defaultDates.startAt, reviewedForm]);

  const trimmedLength = rawText.trim().length;
  const isTooLong = trimmedLength > MAX_RAW_TEXT_LENGTH;

  async function handleGenerate() {
    if (!trimmedLength || isTooLong || isGenerating) return;
    setError(null);
    setIsGenerating(true);

    try {
      const res = await fetch("/api/activities/draft-from-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText }),
      });

      const body = (await res.json().catch(() => null)) as
        | {
            success: true;
            data: AiDraftResponse;
            todayIso: string;
          }
        | {
            success: false;
            error?: string;
          }
        | null;

      if (!res.ok || !body || !body.success) {
        setError(
          (body && "error" in body && body.error) ||
            "Could not generate a project draft from this text. Please retry.",
        );
        return;
      }

      const mapped = mapAiDraftToFormDraft(body.data, {
        todayIso: body.todayIso,
        partnerClubs,
        canCreateProject,
        canCreateEvent,
      });

      setReviewedForm(mapped.form);
      setDraftMeta(mapped.meta);
      setConflictStrategy("fill_empty");
      setPhase("REVIEW");
    } catch {
      setError(
        "Network error while contacting the AI service. Please check your connection and retry.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  function updateChecklistItem(
    idx: number,
    patch: Partial<ActivityFormState["initialTasks"][number]>,
  ) {
    setReviewedForm((prev) => {
      if (!prev) return prev;
      const next = prev.initialTasks.map((item, i) =>
        i === idx ? { ...item, ...patch } : item,
      );
      return { ...prev, initialTasks: next };
    });
  }

  function moveChecklistItem(idx: number, direction: -1 | 1) {
    setReviewedForm((prev) => {
      if (!prev) return prev;
      const target = idx + direction;
      if (target < 0 || target >= prev.initialTasks.length) return prev;
      const copy = [...prev.initialTasks];
      const [moved] = copy.splice(idx, 1);
      copy.splice(target, 0, moved);
      return {
        ...prev,
        initialTasks: copy.map((item, orderIdx) => ({
          ...item,
          order: orderIdx + 1,
        })),
      };
    });
  }

  function removeChecklistItem(idx: number) {
    setReviewedForm((prev) => {
      if (!prev) return prev;
      const next = prev.initialTasks
        .filter((_, i) => i !== idx)
        .map((item, orderIdx) => ({ ...item, order: orderIdx + 1 }));
      return { ...prev, initialTasks: next };
    });
  }

  function addChecklistItem() {
    setReviewedForm((prev) => {
      if (!prev) return prev;
      const defaultDue = prev.startAt ? prev.startAt.slice(0, 10) : "";
      const nextOrder = prev.initialTasks.length + 1;
      return {
        ...prev,
        initialTasks: [
          ...prev.initialTasks,
          {
            id: `custom-task-${Date.now()}-${nextOrder}`,
            title: "New club preparation step",
            description: "",
            dueDate: defaultDue,
            priority: "MEDIUM",
            status: "TODO",
            order: nextOrder,
          },
        ],
      };
    });
  }

  if (phase === "INPUT" || !reviewedForm) {
    return (
      <section className="mx-auto max-w-4xl space-y-5 pb-10">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#0D3594] cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to creation options
          </button>
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-[#0D3594] dark:bg-blue-500/15 dark:text-blue-300">
            <Sparkles className="h-3 w-3" /> AI Project Assistant
          </span>
        </div>

        <div className="rounded-2xl border border-[#DDE4F4] bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-[#161B26]">
          <header className="space-y-1.5">
            <h1 className="text-xl font-bold text-[#111625] dark:text-white flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#0D3594] dark:text-blue-400" />
              Generate Project &amp; Checklist from Text
            </h1>
            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Paste a chat message, Messenger invite, or email proposal (supports
              English, Taglish, emojis, markdown links, and multiple URLs). The
              AI extracts project details, flags missing information, and builds
              a tailored checklist for your club&apos;s meeting and approval.{" "}
              <strong>Nothing is saved until you review and confirm.</strong>
            </p>
          </header>

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label
                htmlFor="ai-raw-project-text"
                className="font-semibold text-slate-700 dark:text-slate-200"
              >
                Pasted invitation / proposal message
              </label>
              <span
                className={`text-[11px] font-medium ${
                  isTooLong
                    ? "text-rose-600 font-bold"
                    : "text-slate-400 dark:text-slate-500"
                }`}
              >
                {trimmedLength.toLocaleString()} /{" "}
                {MAX_RAW_TEXT_LENGTH.toLocaleString()} chars
              </span>
            </div>
            <textarea
              id="ai-raw-project-text"
              rows={9}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              disabled={isGenerating}
              placeholder={`Paste raw chat or email text here...\n\nExample:\nHi Pres! Inviting your club to partner with us on Project Handog on Nov 28 and/or Dec 20. Check the primer here: https://drive.google.com/... and register via https://tinyurl.com/...`}
              className="w-full rounded-xl border border-[#DDE1EA] bg-slate-50/50 px-3.5 py-3 text-sm text-[#111625] outline-none focus:border-[#0D3594] focus:bg-white focus:ring-2 focus:ring-[#0D3594]/10 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
            {isTooLong && (
              <p className="text-xs font-medium text-rose-600">
                Message exceeds the {MAX_RAW_TEXT_LENGTH.toLocaleString()}-character
                limit. Please shorten it before generating.
              </p>
            )}
          </div>

          {error && (
            <div
              role="alert"
              className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-200"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                disabled={isGenerating || !trimmedLength || isTooLong}
                onClick={handleGenerate}
                className="inline-flex items-center gap-1.5 self-start sm:self-auto shrink-0 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </button>
            </div>
          )}

          <div className="mt-5 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-[#EDEDF2] dark:border-slate-800">
            <button
              type="button"
              onClick={onCancel}
              disabled={isGenerating}
              className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!trimmedLength || isTooLong || isGenerating}
              onClick={handleGenerate}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0D3594] px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#092569] disabled:opacity-50 transition cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing message &amp; generating checklist...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Draft &amp; Checklist
                </>
              )}
            </button>
          </div>
        </div>
      </section>
    );
  }

  const isProject =
    reviewedForm.kind === "SERVICE_PROJECT" ||
    reviewedForm.kind === "JOINT_PROJECT";

  const resolvedFinalForm =
    conflicts.length > 0
      ? mergeAiDraftWithExistingForm(
          currentForm,
          reviewedForm,
          conflictStrategy,
          {
            defaultStartAt: defaultDates.startAt,
            defaultEndAt: defaultDates.endAt,
          },
        )
      : reviewedForm;

  return (
    <section className="mx-auto max-w-5xl space-y-5 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setPhase("INPUT")}
          disabled={isSubmitting}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#0D3594] cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Edit pasted message / regenerate
        </button>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Review Draft (Not Saved Yet)
        </span>
      </div>

      {/* Conflict Alert when user already filled fields in the main form */}
      {conflicts.length > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50/80 p-4 dark:border-amber-500/40 dark:bg-amber-950/30">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <p className="text-xs font-bold text-amber-950 dark:text-amber-200">
                Existing form inputs detected ({conflicts.length}{" "}
                {conflicts.length === 1 ? "field" : "fields"})
              </p>
              <p className="text-[11px] text-amber-900/90 dark:text-amber-300/90">
                To avoid overwriting what you already entered, choose how to merge
                the AI draft:
              </p>
              <ul className="space-y-1 text-[11px] text-amber-900 dark:text-amber-200">
                {conflicts.slice(0, 5).map((c) => (
                  <li key={String(c.field)}>
                    <strong>{c.label}:</strong> yours is &ldquo;{c.currentValue}
                    &rdquo; vs AI &ldquo;{c.incomingValue}&rdquo;
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setConflictStrategy("fill_empty")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold border transition cursor-pointer ${
                    conflictStrategy === "fill_empty"
                      ? "bg-[#0D3594] text-white border-[#0D3594]"
                      : "bg-white text-slate-700 border-amber-300 dark:bg-slate-900 dark:text-slate-200"
                  }`}
                >
                  Keep My Values (Fill Empty Only)
                </button>
                <button
                  type="button"
                  onClick={() => setConflictStrategy("overwrite")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold border transition cursor-pointer ${
                    conflictStrategy === "overwrite"
                      ? "bg-amber-600 text-white border-amber-600"
                      : "bg-white text-slate-700 border-amber-300 dark:bg-slate-900 dark:text-slate-200"
                  }`}
                >
                  Replace with AI Draft
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invitation Context & Missing Info Card */}
      {draftMeta && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-[#EDEDF2] bg-white p-4 dark:border-slate-800 dark:bg-[#161B26] space-y-2.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Extracted Invitation Context
            </h2>
            <dl className="grid grid-cols-[115px_1fr] gap-y-1.5 gap-x-2 text-xs">
              <dt className="text-slate-500">Organizer / Host</dt>
              <dd className="font-semibold text-[#111625] dark:text-white">
                {draftMeta.organizer || "Not specified"}
              </dd>
              <dt className="text-slate-500">Addressed To</dt>
              <dd className="font-medium text-slate-700 dark:text-slate-200">
                {draftMeta.addressedTo || "Not specified"}
              </dd>
              <dt className="text-slate-500">Sent By</dt>
              <dd className="font-medium text-slate-700 dark:text-slate-200">
                {draftMeta.sentBy || "Not specified"}
              </dd>
              <dt className="text-slate-500">Call to Action</dt>
              <dd className="font-medium text-[#0D3594] dark:text-blue-300">
                {draftMeta.callToAction || "Not specified"}
              </dd>
            </dl>
            {draftMeta.datesMentioned.length > 0 && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <p className="text-[11px] font-semibold text-slate-500 mb-1.5">
                  Dates found in message:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {draftMeta.datesMentioned.map((d, i) => (
                    <span
                      key={`${d.date}-${i}`}
                      className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-[#0D3594] dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300"
                    >
                      {d.date} · {d.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-4 dark:border-amber-500/25 dark:bg-amber-950/15 space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              Missing or Unclear Details ({draftMeta.missingInfo.length})
            </h2>
            {draftMeta.missingInfo.length > 0 ? (
              <ul className="list-disc pl-4 space-y-1 text-xs text-amber-950 dark:text-amber-200">
                {draftMeta.missingInfo.map((info, i) => (
                  <li key={i}>{info}</li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                No missing fields flagged — review all details below before saving.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Editable Pre-Filled Project Details */}
      <div className="rounded-2xl border border-[#EDEDF2] bg-white p-5 space-y-4 dark:border-slate-800 dark:bg-[#161B26]">
        <div className="border-b border-[#EDEDF2] pb-2 dark:border-slate-800">
          <h2 className="text-sm font-bold text-[#111625] dark:text-white">
            1. Pre-filled Project / Activity Details (Editable)
          </h2>
          <p className="text-xs text-slate-500">
            Verify dates, type, partners, and committee before saving.
          </p>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block space-y-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
            <span>Activity Type</span>
            <select
              value={reviewedForm.kind}
              onChange={(e) =>
                setReviewedForm({
                  ...reviewedForm,
                  kind: e.target.value as ActivityKind,
                })
              }
              className={reviewInputClass}
            >
              {allowedKinds.map((k) => (
                <option key={k} value={k}>
                  {ACTIVITY_KIND_META[k].label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
            <span>Initial Status</span>
            <select
              value={reviewedForm.status}
              onChange={(e) =>
                setReviewedForm({
                  ...reviewedForm,
                  status: e.target.value as ActivityStatus,
                })
              }
              className={reviewInputClass}
            >
              <option value="DRAFT">Draft (Pending Club Approval)</option>
              <option value="PLANNED">Planned (Approved Upcoming)</option>
              <option value="ONGOING">Ongoing</option>
            </select>
          </label>

          <label className="block space-y-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
            <span>Committee</span>
            <select
              value={reviewedForm.committee}
              onChange={(e) =>
                setReviewedForm({
                  ...reviewedForm,
                  committee: e.target.value as Committee | "",
                })
              }
              className={reviewInputClass}
            >
              <option value="">No committee</option>
              {COMMITTEES.map((c) => (
                <option key={c} value={c}>
                  {c.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
        </div>

        {reviewedForm.kind === "MEETING" && (
          <label className="block space-y-1 text-xs font-semibold text-slate-700 dark:text-slate-200 max-w-xs">
            <span>Meeting Type</span>
            <select
              value={reviewedForm.meetingType}
              onChange={(e) =>
                setReviewedForm({
                  ...reviewedForm,
                  meetingType: e.target.value as MeetingType,
                })
              }
              className={reviewInputClass}
            >
              {MEETING_TYPES.map((mt) => (
                <option key={mt} value={mt}>
                  {MEETING_TYPE_LABELS[mt]}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="grid gap-3.5 sm:grid-cols-2">
          <label className="block space-y-1 text-xs font-semibold text-slate-700 dark:text-slate-200 sm:col-span-2">
            <span>
              Project / Activity Title <span className="text-rose-500">*</span>
            </span>
            <input
              type="text"
              value={reviewedForm.title}
              maxLength={160}
              onChange={(e) =>
                setReviewedForm({ ...reviewedForm, title: e.target.value })
              }
              className={reviewInputClass}
            />
          </label>

          <label className="block space-y-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
            <span>Starts</span>
            <input
              type="datetime-local"
              value={reviewedForm.startAt}
              onChange={(e) =>
                setReviewedForm({ ...reviewedForm, startAt: e.target.value })
              }
              className={reviewInputClass}
            />
          </label>

          <label className="block space-y-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
            <span>Ends</span>
            <input
              type="datetime-local"
              value={reviewedForm.endAt}
              onChange={(e) =>
                setReviewedForm({ ...reviewedForm, endAt: e.target.value })
              }
              className={reviewInputClass}
            />
          </label>

          <label className="block space-y-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
            <span>Venue / Mode</span>
            <input
              type="text"
              value={reviewedForm.location}
              maxLength={300}
              placeholder="Venue, barangay, or Zoom/online link"
              onChange={(e) =>
                setReviewedForm({ ...reviewedForm, location: e.target.value })
              }
              className={reviewInputClass}
            />
          </label>

          <label className="block space-y-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
            <span>Short Summary</span>
            <input
              type="text"
              value={reviewedForm.shortDescription}
              maxLength={280}
              onChange={(e) =>
                setReviewedForm({
                  ...reviewedForm,
                  shortDescription: e.target.value,
                })
              }
              className={reviewInputClass}
            />
          </label>

          <label className="block space-y-1 text-xs font-semibold text-slate-700 dark:text-slate-200 sm:col-span-2">
            <span>Full Description &amp; Proposal Notes</span>
            <textarea
              rows={4}
              value={reviewedForm.description}
              onChange={(e) =>
                setReviewedForm({
                  ...reviewedForm,
                  description: e.target.value,
                })
              }
              className={reviewInputClass}
            />
          </label>
        </div>

        {isProject && (
          <div className="space-y-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/5">
            <h3 className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
              Service / Joint Project Fields
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-xs font-semibold text-slate-700 dark:text-slate-200 sm:col-span-2">
                <span>Project Objective</span>
                <textarea
                  rows={2}
                  value={reviewedForm.objective}
                  onChange={(e) =>
                    setReviewedForm({
                      ...reviewedForm,
                      objective: e.target.value,
                    })
                  }
                  className={reviewInputClass}
                />
              </label>
              <label className="block space-y-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                <span>Beneficiary Group</span>
                <input
                  type="text"
                  value={reviewedForm.beneficiaryType}
                  onChange={(e) =>
                    setReviewedForm({
                      ...reviewedForm,
                      beneficiaryType: e.target.value,
                    })
                  }
                  className={reviewInputClass}
                />
              </label>
              <label className="block space-y-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                <span>Target Beneficiaries</span>
                <input
                  type="number"
                  min={0}
                  value={reviewedForm.beneficiaryTarget}
                  onChange={(e) =>
                    setReviewedForm({
                      ...reviewedForm,
                      beneficiaryTarget: Number(e.target.value || 0),
                    })
                  }
                  className={reviewInputClass}
                />
              </label>
            </div>

            {/* Areas of Focus */}
            <div className="space-y-1.5">
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Rotary Areas of Focus
              </span>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {AREAS_OF_FOCUS.map((area) => {
                  const checked = reviewedForm.areasOfFocus.includes(area.code);
                  return (
                    <label
                      key={area.code}
                      className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-white px-2.5 py-1.5 text-xs dark:border-emerald-500/20 dark:bg-slate-900"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...reviewedForm.areasOfFocus, area.code]
                            : reviewedForm.areasOfFocus.filter(
                                (c) => c !== area.code,
                              );
                          setReviewedForm({
                            ...reviewedForm,
                            areasOfFocus: next,
                          });
                        }}
                        className="accent-emerald-600"
                      />
                      {area.name}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Partners */}
            <div className="space-y-2">
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Host / Partner Clubs &amp; Organizations
                {reviewedForm.kind === "JOINT_PROJECT" && (
                  <span className="text-rose-500 ml-0.5">*</span>
                )}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {reviewedForm.selectedPartnerIds.map((id) => {
                  const club = partnerClubs.find((c) => c.id === id);
                  if (!club) return null;
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-100/70 px-2.5 py-1 text-xs font-semibold text-emerald-900 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-100"
                    >
                      {club.name}
                      <button
                        type="button"
                        onClick={() =>
                          setReviewedForm({
                            ...reviewedForm,
                            selectedPartnerIds:
                              reviewedForm.selectedPartnerIds.filter(
                                (pid) => pid !== id,
                              ),
                          })
                        }
                        className="hover:text-rose-600 cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
                {reviewedForm.externalPartners.map((partner, idx) => (
                  <span
                    key={`${partner.name}-${idx}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    {partner.name}
                    <button
                      type="button"
                      onClick={() =>
                        setReviewedForm({
                          ...reviewedForm,
                          externalPartners:
                            reviewedForm.externalPartners.filter(
                              (_, i) => i !== idx,
                            ),
                        })
                      }
                      className="text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  value=""
                  onChange={(e) => {
                    const pid = e.target.value;
                    if (
                      pid &&
                      !reviewedForm.selectedPartnerIds.includes(pid)
                    ) {
                      setReviewedForm({
                        ...reviewedForm,
                        selectedPartnerIds: [
                          ...reviewedForm.selectedPartnerIds,
                          pid,
                        ],
                      });
                    }
                  }}
                  className={`${reviewInputClass} max-w-xs`}
                >
                  <option value="">+ Link registered partner club...</option>
                  {partnerClubs
                    .filter(
                      (c) => !reviewedForm.selectedPartnerIds.includes(c.id),
                    )
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} (D{c.district})
                      </option>
                    ))}
                </select>
                <div className="flex gap-1.5 flex-1 min-w-[200px]">
                  <input
                    type="text"
                    value={newPartnerName}
                    onChange={(e) => setNewPartnerName(e.target.value)}
                    placeholder="Add external organizer or club name"
                    className={reviewInputClass}
                  />
                  <button
                    type="button"
                    disabled={!newPartnerName.trim()}
                    onClick={() => {
                      const trimmed = newPartnerName.trim();
                      if (!trimmed) return;
                      setReviewedForm({
                        ...reviewedForm,
                        externalPartners: [
                          ...reviewedForm.externalPartners,
                          {
                            name: trimmed,
                            role: "IMPLEMENTING_PARTNER" as PartnerRole,
                          },
                        ],
                      });
                      setNewPartnerName("");
                    }}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Extracted & Editable Reference URLs */}
      <div className="rounded-2xl border border-[#EDEDF2] bg-white p-5 space-y-3 dark:border-slate-800 dark:bg-[#161B26]">
        <div className="flex items-center justify-between border-b border-[#EDEDF2] pb-2 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-bold text-[#111625] dark:text-white flex items-center gap-1.5">
              <Link2 className="h-4 w-4 text-[#0D3594] dark:text-blue-400" />
              2. Extracted Links ({reviewedForm.relatedLinks.length})
            </h2>
            <p className="text-xs text-slate-500">
              Primer documents and registration URLs preserved verbatim.
            </p>
          </div>
        </div>

        {reviewedForm.relatedLinks.length > 0 ? (
          <div className="space-y-2">
            {reviewedForm.relatedLinks.map((link, idx) => (
              <div
                key={`${link.url}-${idx}`}
                className="grid gap-2 items-center rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 sm:grid-cols-[160px_130px_1fr_auto] dark:border-slate-700 dark:bg-slate-900/50"
              >
                <input
                  type="text"
                  aria-label="Link label"
                  value={link.label}
                  onChange={(e) => {
                    const next = reviewedForm.relatedLinks.map((l, i) =>
                      i === idx ? { ...l, label: e.target.value } : l,
                    );
                    setReviewedForm({ ...reviewedForm, relatedLinks: next });
                  }}
                  className={reviewInputClass}
                />
                <select
                  aria-label="Link purpose"
                  value={link.purpose}
                  onChange={(e) => {
                    const next = reviewedForm.relatedLinks.map((l, i) =>
                      i === idx
                        ? { ...l, purpose: e.target.value as AiUrlPurpose }
                        : l,
                    );
                    setReviewedForm({ ...reviewedForm, relatedLinks: next });
                  }}
                  className={reviewInputClass}
                >
                  {URL_PURPOSES.map((p) => (
                    <option key={p} value={p}>
                      {p === "primer"
                        ? "Primer / Doc"
                        : p === "registration"
                          ? "Registration"
                          : "Other"}
                    </option>
                  ))}
                </select>
                <input
                  type="url"
                  aria-label="Link URL"
                  value={link.url}
                  onChange={(e) => {
                    const next = reviewedForm.relatedLinks.map((l, i) =>
                      i === idx ? { ...l, url: e.target.value } : l,
                    );
                    setReviewedForm({ ...reviewedForm, relatedLinks: next });
                  }}
                  className={`${reviewInputClass} font-mono text-xs`}
                />
                <div className="flex items-center gap-1 justify-end">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open link in new tab"
                    className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:text-[#0D3594] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <button
                    type="button"
                    aria-label="Remove link"
                    onClick={() =>
                      setReviewedForm({
                        ...reviewedForm,
                        relatedLinks: reviewedForm.relatedLinks.filter(
                          (_, i) => i !== idx,
                        ),
                      })
                    }
                    className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:text-rose-600 dark:border-slate-700 dark:bg-slate-800 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">No links extracted.</p>
        )}

        <div className="grid gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 sm:grid-cols-[150px_130px_1fr_auto]">
          <input
            type="text"
            placeholder="Label (e.g. Primer)"
            value={newLinkLabel}
            onChange={(e) => setNewLinkLabel(e.target.value)}
            className={reviewInputClass}
          />
          <select
            value={newLinkPurpose}
            onChange={(e) => setNewLinkPurpose(e.target.value as AiUrlPurpose)}
            className={reviewInputClass}
          >
            <option value="primer">Primer / Doc</option>
            <option value="registration">Registration</option>
            <option value="other">Other</option>
          </select>
          <input
            type="url"
            placeholder="https://..."
            value={newLinkUrl}
            onChange={(e) => setNewLinkUrl(e.target.value)}
            className={reviewInputClass}
          />
          <button
            type="button"
            disabled={!newLinkLabel.trim() || !newLinkUrl.trim()}
            onClick={() => {
              setReviewedForm({
                ...reviewedForm,
                relatedLinks: [
                  ...reviewedForm.relatedLinks,
                  {
                    label: newLinkLabel.trim(),
                    url: newLinkUrl.trim(),
                    purpose: newLinkPurpose,
                  },
                ],
              });
              setNewLinkLabel("");
              setNewLinkUrl("");
            }}
            className="inline-flex items-center justify-center gap-1 rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50 cursor-pointer dark:bg-slate-700"
          >
            <Plus className="h-3.5 w-3.5" /> Add Link
          </button>
        </div>
      </div>

      {/* Editable Club Meeting & Approval Checklist */}
      <div className="rounded-2xl border border-[#EDEDF2] bg-white p-5 space-y-3 dark:border-slate-800 dark:bg-[#161B26]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EDEDF2] pb-2 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-bold text-[#111625] dark:text-white flex items-center gap-1.5">
              <CheckSquare className="h-4 w-4 text-[#0D3594] dark:text-blue-400" />
              3. Club Approval &amp; Preparation Checklist (
              {reviewedForm.initialTasks.length})
            </h2>
            <p className="text-xs text-slate-500">
              Edit, reorder, assign owners, or remove items before creating tasks.
            </p>
          </div>
          <button
            type="button"
            onClick={addChecklistItem}
            className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-[#0D3594] hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" /> Add Item
          </button>
        </div>

        <div className="space-y-2.5">
          {reviewedForm.initialTasks.map((item, idx) => (
            <div
              key={item.id}
              className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-2.5 dark:border-slate-700 dark:bg-slate-900/40"
            >
              <div className="flex items-start gap-2">
                <span className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0D3594] text-[11px] font-bold text-white">
                  {idx + 1}
                </span>
                <div className="grid flex-1 gap-2 sm:grid-cols-[minmax(200px,2fr)_140px_110px_160px]">
                  <input
                    type="text"
                    aria-label={`Checklist item ${idx + 1} title`}
                    value={item.title}
                    onChange={(e) =>
                      updateChecklistItem(idx, { title: e.target.value })
                    }
                    className={reviewInputClass}
                  />
                  <input
                    type="date"
                    aria-label={`Checklist item ${idx + 1} due date`}
                    value={item.dueDate}
                    onChange={(e) =>
                      updateChecklistItem(idx, { dueDate: e.target.value })
                    }
                    className={reviewInputClass}
                  />
                  <select
                    aria-label={`Checklist item ${idx + 1} priority`}
                    value={item.priority}
                    onChange={(e) =>
                      updateChecklistItem(idx, {
                        priority: e.target.value as TaskPriority,
                      })
                    }
                    className={reviewInputClass}
                  >
                    {TASK_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={`Checklist item ${idx + 1} assignee`}
                    value={item.assigneeId || ""}
                    onChange={(e) =>
                      updateChecklistItem(idx, {
                        assigneeId: e.target.value || undefined,
                      })
                    }
                    className={reviewInputClass}
                  >
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveChecklistItem(idx, -1)}
                    aria-label={`Move item ${idx + 1} up`}
                    className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === reviewedForm.initialTasks.length - 1}
                    onClick={() => moveChecklistItem(idx, 1)}
                    aria-label={`Move item ${idx + 1} down`}
                    className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeChecklistItem(idx)}
                    aria-label={`Remove item ${idx + 1}`}
                    className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:text-rose-600 dark:border-slate-700 dark:bg-slate-800 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="pl-8">
                <input
                  type="text"
                  aria-label={`Checklist item ${idx + 1} description`}
                  value={item.description}
                  placeholder="Optional details, specific date, or link reference..."
                  onChange={(e) =>
                    updateChecklistItem(idx, { description: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-200/80 bg-white px-2.5 py-1.5 text-xs text-slate-600 outline-none focus:border-[#0D3594] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Review Footer Actions */}
      <footer className="flex flex-col-reverse gap-3 rounded-2xl border border-[#EDEDF2] bg-white p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-[#161B26]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onCancel}
            className="text-xs font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
          >
            Discard
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => onApplyToForm(resolvedFinalForm, conflictStrategy)}
            className="rounded-lg border border-[#EDEDF2] px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
          >
            Apply to Full Form (Keep Editing)
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isSubmitting || !resolvedFinalForm.title.trim()}
            onClick={() =>
              onConfirmCreate({ ...resolvedFinalForm, status: "DRAFT" })
            }
            className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-bold text-[#0D3594] hover:bg-blue-100 disabled:opacity-50 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-200 cursor-pointer"
          >
            Save as Draft (For Approval)
          </button>
          <button
            type="button"
            disabled={isSubmitting || !resolvedFinalForm.title.trim()}
            onClick={() => onConfirmCreate(resolvedFinalForm)}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                Confirm &amp; Create Project
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>
      </footer>
    </section>
  );
}

const reviewInputClass =
  "w-full rounded-lg border border-[#DDE1EA] bg-white px-2.5 py-1.5 text-xs text-[#111625] outline-none focus:border-[#0D3594] focus:ring-2 focus:ring-[#0D3594]/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white";

