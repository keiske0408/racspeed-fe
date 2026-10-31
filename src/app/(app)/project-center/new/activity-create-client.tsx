"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, ClipboardList, HeartHandshake, Users } from "lucide-react";
import { createActivityAction } from "@/features/activities/actions";
import {
  ACTIVITY_KINDS,
  ACTIVITY_KIND_META,
  AREAS_OF_FOCUS,
  COMMITTEES,
  DEFAULT_CLUB_ID,
  MEETING_TYPES,
  MEETING_TYPE_LABELS,
  type ActivityKind,
} from "@/features/activities/types";
import type { CreateActivityInput } from "@/features/activities/schemas";

const SDGS = [
  "No Poverty", "Zero Hunger", "Good Health and Well-being", "Quality Education", "Gender Equality",
  "Clean Water and Sanitation", "Affordable and Clean Energy", "Decent Work and Economic Growth",
  "Industry, Innovation and Infrastructure", "Reduced Inequalities", "Sustainable Cities and Communities",
  "Responsible Consumption and Production", "Climate Action", "Life Below Water", "Life on Land",
  "Peace, Justice and Strong Institutions", "Partnerships for the Goals",
];

function localDefault(offsetDays: number, hour: number) {
  const date = new Date(Date.now() + offsetDays * 86_400_000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
  return `${parts}T${String(hour).padStart(2, "0")}:00`;
}

export function ActivityCreateClient({
  clubId = DEFAULT_CLUB_ID,
  initialKind,
  canCreateEvent,
  canCreateProject,
}: {
  clubId?: string;
  initialKind: string | null;
  canCreateEvent: boolean;
  canCreateProject: boolean;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<ActivityKind | null>(initialKind as ActivityKind | null);
  const [step, setStep] = useState<1 | 2>(initialKind ? 2 : 1);
  const [minEnabled, setMinEnabled] = useState(false);
  const [rsvpEnabled, setRsvpEnabled] = useState(true);
  const [selfCheckIn, setSelfCheckIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const allowed = (activityKind: ActivityKind) =>
    activityKind === "SERVICE_PROJECT" || activityKind === "JOINT_PROJECT" ? canCreateProject : canCreateEvent;

  function submit(form: HTMLFormElement, saveDraft = false) {
    if (!kind) return;
    const data = new FormData(form);
    const checkedValues = (name: string) => data.getAll(name).map(Number);
    const partners = data.getAll("partnerName").map((name, index) => ({
      name: String(name).trim(),
      role: String(data.getAll("partnerRole")[index] || "IMPLEMENTING_PARTNER"),
    })).filter((partner) => partner.name.length > 0);

    const payload = {
      clubId,
      kind,
      title: String(data.get("title") || ""),
      shortDescription: String(data.get("shortDescription") || ""),
      description: String(data.get("description") || ""),
      location: String(data.get("location") || ""),
      startAt: String(data.get("startAt") || ""),
      endAt: String(data.get("endAt") || ""),
      allDay: data.has("allDay"),
      committee: String(data.get("committee") || "") || undefined,
      status: saveDraft ? "DRAFT" : "PLANNED",
      minMembersEnabled: minEnabled,
      minMembersRequired: minEnabled ? Number(data.get("minMembersRequired")) : undefined,
      capacity: data.get("capacity") ? Number(data.get("capacity")) : undefined,
      rsvpEnabled,
      rsvpDeadline: String(data.get("rsvpDeadline") || "") || undefined,
      selfCheckInEnabled: selfCheckIn,
      checkInWindowMinutes: Number(data.get("checkInWindowMinutes") || 180),
      volunteerHoursDefault: Number(data.get("volunteerHoursDefault") || 0),
      ...(kind === "MEETING" ? { meetingType: String(data.get("meetingType") || "GENERAL_ASSEMBLY") } : {}),
      ...(["SERVICE_PROJECT", "JOINT_PROJECT"].includes(kind)
        ? {
            objective: String(data.get("objective") || ""),
            beneficiaryType: String(data.get("beneficiaryType") || ""),
            beneficiaryTarget: Number(data.get("beneficiaryTarget") || 0),
            fundingTarget: Number(data.get("fundingTarget") || 0),
            fundingSource: String(data.get("fundingSource") || ""),
            areasOfFocus: data.getAll("areasOfFocus").map(String),
            sdgs: checkedValues("sdgs"),
            partners,
          }
        : {}),
    } as CreateActivityInput;

    setError(null);
    startTransition(async () => {
      const result = await createActivityAction(payload);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.push(`/project-center/${result.activityId}`);
      router.refresh();
    });
  }

  if (!kind || step === 1) {
    return (
      <main className="mx-auto max-w-5xl space-y-6 pb-10">
        <Link href="/project-center" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#0D3594]"><ArrowLeft className="h-3.5 w-3.5" /> Project Center</Link>
        <header>
          <p className="text-[11px] font-semibold uppercase text-slate-500">Step 1 of 2</p>
          <h1 className="mt-1 text-2xl font-bold text-[#111625] dark:text-white">What are you organizing?</h1>
          <p className="mt-1 text-sm text-slate-500">Choose a type. We will tailor the form to the activity.</p>
        </header>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ACTIVITY_KINDS.filter(allowed).map((activityKind) => {
            const meta = ACTIVITY_KIND_META[activityKind];
            const Icon = meta.isProject ? HeartHandshake : activityKind === "MEETING" ? Users : ClipboardList;
            return (
              <button
                key={activityKind}
                type="button"
                onClick={() => { setKind(activityKind); setStep(2); }}
                className="group min-h-40 rounded-xl border border-[#EDEDF2] bg-white p-4 text-left transition hover:border-[#0D3594]/40 hover:shadow-sm dark:border-slate-800 dark:bg-[#161B26]"
              >
                <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${meta.chipClass}`}><Icon className="h-4 w-4" /></span>
                <span className="mt-3 block text-sm font-bold text-[#111625] dark:text-white">{meta.label}</span>
                <span className="mt-1 block text-xs leading-relaxed text-slate-500">{meta.description}</span>
              </button>
            );
          })}
        </div>
      </main>
    );
  }

  const meta = ACTIVITY_KIND_META[kind];
  return (
    <main className="mx-auto max-w-4xl space-y-5 pb-10">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setStep(1)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#0D3594]"><ArrowLeft className="h-3.5 w-3.5" /> Change type</button>
        <span className="text-[11px] font-semibold text-slate-500">Step 2 of 2</span>
      </div>
      <header className="flex items-center gap-3">
        <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${meta.chipClass}`}><ClipboardList className="h-5 w-5" /></span>
        <div>
          <h1 className="text-xl font-bold text-[#111625] dark:text-white">New {meta.label}</h1>
          <p className="text-xs text-slate-500">Plan the activity, set attendance expectations and invite the club.</p>
        </div>
      </header>

      <form onSubmit={(event) => { event.preventDefault(); submit(event.currentTarget); }} className="space-y-5">
        <section className="space-y-4 rounded-xl border border-[#EDEDF2] bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-[#161B26]">
          <FormSectionTitle title="Overview" />
          <Field label="Title" required>
            <input name="title" required minLength={3} maxLength={160} placeholder="e.g. Community health screening" className={inputClass} />
          </Field>
          <Field label="Short description" hint="Appears on activity cards and dashboards. Up to 280 characters.">
            <input name="shortDescription" maxLength={280} placeholder="A clear one-line summary" className={inputClass} />
          </Field>
          <Field label="Description">
            <textarea name="description" rows={3} maxLength={10000} placeholder="Purpose, audience and what members should expect" className={inputClass} />
          </Field>
          {kind === "MEETING" && (
            <Field label="Meeting type">
              <select name="meetingType" defaultValue="GENERAL_ASSEMBLY" className={inputClass}>
                {MEETING_TYPES.map((type) => <option key={type} value={type}>{MEETING_TYPE_LABELS[type]}</option>)}
              </select>
            </Field>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Committee">
              <select name="committee" defaultValue="" className={inputClass}>
                <option value="">No committee</option>
                {COMMITTEES.map((committee) => <option key={committee} value={committee}>{committee.replaceAll("_", " ")}</option>)}
              </select>
            </Field>
            <Field label="Location">
              <input name="location" maxLength={300} placeholder="Venue or online meeting link" className={inputClass} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Starts" required>
              <input name="startAt" type="datetime-local" required defaultValue={localDefault(7, 9)} className={inputClass} />
            </Field>
            <Field label="Ends" required>
              <input name="endAt" type="datetime-local" required defaultValue={localDefault(7, 12)} className={inputClass} />
            </Field>
          </div>
          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300"><input type="checkbox" name="allDay" className="accent-[#0D3594]" /> All-day activity</label>
        </section>

        {meta.isProject && (
          <section className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 sm:p-5 dark:border-emerald-500/20 dark:bg-emerald-500/5">
            <FormSectionTitle title="Service project planning" subtitle="These fields start the Rotary Showcase accomplishment record." />
            <Field label="Objective" hint="What change should this project create?">
              <textarea name="objective" rows={2} maxLength={2000} className={inputClass} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Beneficiary group"><input name="beneficiaryType" maxLength={200} placeholder="e.g. mothers and children" className={inputClass} /></Field>
              <Field label="Target beneficiaries"><input name="beneficiaryTarget" type="number" min="0" defaultValue="0" className={inputClass} /></Field>
              <Field label="Funding target"><input name="fundingTarget" type="number" min="0" step="0.01" defaultValue="0" className={inputClass} /></Field>
              <Field label="Funding source"><input name="fundingSource" maxLength={300} placeholder="Club, grant or partner" className={inputClass} /></Field>
            </div>
            <Field label="Rotary Area of Focus">
              <div className="grid gap-2 sm:grid-cols-2">
                {AREAS_OF_FOCUS.map((area) => (
                  <label key={area.code} className="flex items-start gap-2 rounded-lg border border-emerald-100 bg-white px-3 py-2 text-xs text-slate-700 dark:border-emerald-500/10 dark:bg-slate-900 dark:text-slate-200">
                    <input type="checkbox" name="areasOfFocus" value={area.code} className="mt-0.5 accent-emerald-600" /> {area.name}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="UN Sustainable Development Goals">
              <div className="grid gap-2 sm:grid-cols-2">
                {SDGS.map((goal, index) => (
                  <label key={goal} className="flex items-start gap-2 rounded-lg border border-emerald-100 bg-white px-3 py-2 text-xs text-slate-700 dark:border-emerald-500/10 dark:bg-slate-900 dark:text-slate-200">
                    <input type="checkbox" name="sdgs" value={index + 1} className="mt-0.5 accent-emerald-600" /> {index + 1}. {goal}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="Partner organizations" hint="Add partners later from the activity detail page.">
              <input name="partnerName" maxLength={200} placeholder="Partner organization name" className={inputClass} />
              <input type="hidden" name="partnerRole" value="IMPLEMENTING_PARTNER" />
            </Field>
          </section>
        )}

        <section className="space-y-4 rounded-xl border border-[#EDEDF2] bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-[#161B26]">
          <FormSectionTitle title="Participation" />
          <ToggleRow title="Set a minimum number of members" description="Track confirmed RSVPs against the minimum. Turn off to omit this requirement." checked={minEnabled} onChange={setMinEnabled}>
            {minEnabled && <input name="minMembersRequired" type="number" required min="1" max="100000" placeholder="Minimum members" className={`${inputClass} max-w-48`} />}
          </ToggleRow>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Capacity" hint="Leave blank for unlimited capacity."><input name="capacity" type="number" min="1" placeholder="Unlimited" className={inputClass} /></Field>
            <Field label="Default volunteer hours"><input name="volunteerHoursDefault" type="number" min="0" max="24" step="0.25" defaultValue={meta.isProject ? "0" : "1"} className={inputClass} /></Field>
          </div>
          <ToggleRow title="Allow members to RSVP" description="Members can respond Going, Maybe or Can't go." checked={rsvpEnabled} onChange={setRsvpEnabled} />
          {rsvpEnabled && <Field label="RSVP deadline"><input name="rsvpDeadline" type="datetime-local" className={`${inputClass} max-w-sm`} /></Field>}
          <ToggleRow title="Allow 'Check in as me'" description="Members can check themselves in during the activity check-in window. QR check-in remains available." checked={selfCheckIn} onChange={setSelfCheckIn} />
          <Field label="Check-in window after start" hint="Set 0 to allow check-in until the activity ends."><select name="checkInWindowMinutes" defaultValue="180" className={`${inputClass} max-w-48`}><option value="0">Until activity ends</option><option value="60">1 hour</option><option value="180">3 hours</option><option value="360">6 hours</option><option value="720">12 hours</option></select></Field>
        </section>

        {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>}
        <footer className="flex flex-col-reverse justify-between gap-3 sm:flex-row sm:items-center">
          <Link href="/project-center" className="text-center text-xs font-semibold text-slate-500 hover:text-slate-700">Cancel</Link>
          <div className="flex gap-2">
            <button type="button" disabled={isPending} onClick={(event) => { const form = event.currentTarget.form; if (form?.reportValidity()) submit(form, true); }} className="rounded-lg border border-[#EDEDF2] px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Save draft</button>
            <button type="submit" disabled={isPending} className="inline-flex items-center gap-2 rounded-lg bg-[#0D3594] px-4 py-2 text-xs font-semibold text-white hover:bg-[#092569] disabled:opacity-60">
              {isPending ? "Creating..." : "Create activity"}<ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </footer>
      </form>
    </main>
  );
}

const inputClass = "w-full rounded-lg border border-[#DDE1EA] bg-white px-3 py-2 text-sm text-[#111625] outline-none focus:border-[#0D3594] focus:ring-2 focus:ring-[#0D3594]/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white";

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
      <span>{label}{required && <span className="ml-1 text-rose-600">*</span>}</span>
      {children}
      {hint && <span className="block text-[11px] font-normal text-slate-500">{hint}</span>}
    </label>
  );
}

function FormSectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return <div className="border-b border-[#EDEDF2] pb-2 dark:border-slate-800"><h2 className="text-sm font-bold text-[#111625] dark:text-white">{title}</h2>{subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}</div>;
}

function ToggleRow({ title, description, checked, onChange, children }: { title: string; description: string; checked: boolean; onChange: (value: boolean) => void; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-[#EDEDF2] pb-3 last:border-0 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4 accent-[#0D3594]" />
        <span><span className="block text-xs font-semibold text-slate-700 dark:text-slate-200">{title}</span><span className="mt-0.5 block text-[11px] font-normal text-slate-500">{description}</span></span>
      </div>
      {children && <div className="pl-7 sm:pl-0">{children}</div>}
    </div>
  );
}