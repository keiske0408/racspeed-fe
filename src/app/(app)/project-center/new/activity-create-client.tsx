"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  CheckSquare,
  ClipboardList,
  ExternalLink,
  GraduationCap,
  HeartHandshake,
  Link2,
  Plus,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
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
  type ActivityStatus,
  type Committee,
  type MeetingType,
  type PartnerRole,
} from "@/features/activities/types";
import {
  UUID_PATTERN,
  type CreateActivityInput,
} from "@/features/activities/schemas";
import type { ActivityFormState } from "@/features/activities/ai-draft-schema";
import { AiDraftPanel } from "./ai-draft-panel";
import { notifyToast } from "@/components/shared/toast-viewport";

const SDGS = [
  "No Poverty",
  "Zero Hunger",
  "Good Health and Well-being",
  "Quality Education",
  "Gender Equality",
  "Clean Water and Sanitation",
  "Affordable and Clean Energy",
  "Decent Work and Economic Growth",
  "Industry, Innovation and Infrastructure",
  "Reduced Inequalities",
  "Sustainable Cities and Communities",
  "Responsible Consumption and Production",
  "Climate Action",
  "Life Below Water",
  "Life on Land",
  "Peace, Justice and Strong Institutions",
  "Partnerships for the Goals",
];

function localDefault(offsetDays: number, hour: number) {
  const date = new Date(Date.now() + offsetDays * 86_400_000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return `${parts}T${String(hour).padStart(2, "0")}:00`;
}

export function ActivityCreateClient({
  clubId = DEFAULT_CLUB_ID,
  initialKind,
  initialSisterClubId,
  initialPartnerName,
  canCreateEvent,
  canCreateProject,
  partnerClubs,
  members = [],
}: {
  clubId?: string;
  initialKind: string | null;
  initialSisterClubId: string | null;
  initialPartnerName: string | null;
  canCreateEvent: boolean;
  canCreateProject: boolean;
  partnerClubs: {
    id: string;
    name: string;
    district: string;
    country: string;
  }[];
  members?: {
    id: string;
    fullName: string;
    role?: string;
    avatarUrl?: string | null;
  }[];
}) {
  const router = useRouter();
  const [defaultDates] = useState(() => ({
    startAt: localDefault(7, 9),
    endAt: localDefault(7, 12),
  }));
  const [kind, setKind] = useState<ActivityKind | null>(
    initialKind as ActivityKind | null,
  );
  const [step, setStep] = useState<1 | 2>(initialKind ? 2 : 1);
  const [showAiMode, setShowAiMode] = useState(false);

  // Controlled core fields (preserved for non-overwriting AI merges & direct review)
  const [title, setTitle] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [committee, setCommittee] = useState<Committee | "">("");
  const [meetingType, setMeetingType] =
    useState<MeetingType>("GENERAL_ASSEMBLY");
  const [status, setStatus] = useState<ActivityStatus>("PLANNED");
  const [startAt, setStartAt] = useState(defaultDates.startAt);
  const [endAt, setEndAt] = useState(defaultDates.endAt);
  const [allDay, setAllDay] = useState(false);
  const [objective, setObjective] = useState("");
  const [beneficiaryType, setBeneficiaryType] = useState("");
  const [beneficiaryTarget, setBeneficiaryTarget] = useState(0);
  const [fundingTarget, setFundingTarget] = useState(0);
  const [fundingSource, setFundingSource] = useState("");
  const [areasOfFocus, setAreasOfFocus] = useState<string[]>([]);
  const [sdgs, setSdgs] = useState<number[]>([]);
  const [externalPartnerNameInput, setExternalPartnerNameInput] = useState("");
  const [extraExternalPartners, setExtraExternalPartners] = useState<
    { name: string; role: PartnerRole }[]
  >([]);
  const [relatedLinks, setRelatedLinks] = useState<
    { label: string; url: string; purpose: "primer" | "registration" | "other" }[]
  >([]);

  const [minEnabled, setMinEnabled] = useState(false);
  const [rsvpEnabled, setRsvpEnabled] = useState(true);
  const [selfCheckIn, setSelfCheckIn] = useState(false);
  const [qrCheckIn, setQrCheckIn] = useState(true);
  const [selectedPartnerIds, setSelectedPartnerIds] = useState<string[]>(() => {
    const initialPartner =
      partnerClubs.find((club) => club.id === initialSisterClubId) ||
      partnerClubs.find(
        (club) =>
          club.name.trim().toLowerCase() ===
          initialPartnerName?.trim().toLowerCase(),
      );
    return initialPartner ? [initialPartner.id] : [];
  });
  const [selectedPartnerDropdown, setSelectedPartnerDropdown] = useState("");
  const [committeeMembers, setCommitteeMembers] = useState<
    { profileId: string; role: "COMMITTEE" | "CO_CHAIR" | "VOLUNTEER" }[]
  >([]);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [selectedRole, setSelectedRole] = useState<
    "COMMITTEE" | "CO_CHAIR" | "VOLUNTEER"
  >("COMMITTEE");

  // Initial tasks / action items builder state
  const defaultDueDate = defaultDates.startAt.slice(0, 10);
  const [initialTasks, setInitialTasks] = useState<
    ActivityFormState["initialTasks"]
  >([]);
  const [draftTaskTitle, setDraftTaskTitle] = useState("");
  const [draftTaskDesc, setDraftTaskDesc] = useState("");
  const [draftTaskDue, setDraftTaskDue] = useState(defaultDueDate);
  const [draftTaskPriority, setDraftTaskPriority] = useState<
    "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  >("MEDIUM");
  const [draftTaskAssigneeId, setDraftTaskAssigneeId] = useState("");

  const [isPending, startTransition] = useTransition();

  function addInitialTask() {
    const trimmed = draftTaskTitle.trim();
    if (trimmed.length < 3) return;
    setInitialTasks((prev) => [
      ...prev,
      {
        id: `manual-task-${Date.now()}-${prev.length + 1}`,
        title: trimmed,
        description: draftTaskDesc.trim(),
        dueDate: draftTaskDue || defaultDueDate,
        priority: draftTaskPriority,
        status: "TODO",
        order: prev.length + 1,
        ...(draftTaskAssigneeId ? { assigneeId: draftTaskAssigneeId } : {}),
      },
    ]);
    setDraftTaskTitle("");
    setDraftTaskDesc("");
    setDraftTaskAssigneeId("");
    setDraftTaskPriority("MEDIUM");
  }

  function removeInitialTask(idx: number) {
    setInitialTasks((prev) =>
      prev
        .filter((_, i) => i !== idx)
        .map((item, i) => ({ ...item, order: i + 1 })),
    );
  }

  function moveInitialTask(idx: number, direction: -1 | 1) {
    setInitialTasks((prev) => {
      const target = idx + direction;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(idx, 1);
      copy.splice(target, 0, moved);
      return copy.map((item, i) => ({ ...item, order: i + 1 }));
    });
  }

  function getCurrentFormState(): ActivityFormState {
    const ext = [
      ...(externalPartnerNameInput.trim()
        ? [
            {
              name: externalPartnerNameInput.trim(),
              role: "IMPLEMENTING_PARTNER" as PartnerRole,
            },
          ]
        : []),
      ...extraExternalPartners,
    ];
    return {
      kind: kind || "SERVICE_PROJECT",
      meetingType,
      title,
      shortDescription,
      description,
      location,
      startAt,
      endAt,
      allDay,
      committee,
      status,
      objective,
      beneficiaryType,
      beneficiaryTarget,
      fundingTarget,
      fundingSource,
      areasOfFocus,
      sdgs,
      selectedPartnerIds,
      externalPartners: ext,
      relatedLinks,
      initialTasks,
    };
  }

  function applyFormState(next: ActivityFormState) {
    setKind(next.kind);
    setMeetingType(next.meetingType);
    setTitle(next.title);
    setShortDescription(next.shortDescription);
    setDescription(next.description);
    setLocation(next.location);
    setStartAt(next.startAt);
    setEndAt(next.endAt);
    setAllDay(next.allDay);
    setCommittee(next.committee);
    setStatus(next.status);
    setObjective(next.objective);
    setBeneficiaryType(next.beneficiaryType);
    setBeneficiaryTarget(next.beneficiaryTarget);
    setFundingTarget(next.fundingTarget);
    setFundingSource(next.fundingSource);
    setAreasOfFocus(next.areasOfFocus);
    setSdgs(next.sdgs);
    setSelectedPartnerIds(next.selectedPartnerIds);
    setExternalPartnerNameInput(next.externalPartners[0]?.name || "");
    setExtraExternalPartners(next.externalPartners.slice(1));
    setRelatedLinks(next.relatedLinks);
    setInitialTasks(next.initialTasks);
    setStep(2);
    setShowAiMode(false);
  }

  function addCommitteeMember() {
    if (!selectedMemberId) return;
    if (committeeMembers.some((c) => c.profileId === selectedMemberId)) return;
    setCommitteeMembers((prev) => [
      ...prev,
      { profileId: selectedMemberId, role: selectedRole },
    ]);
    setSelectedMemberId("");
    setSelectedRole("COMMITTEE");
  }

  function removeCommitteeMember(profileId: string) {
    setCommitteeMembers((prev) => prev.filter((c) => c.profileId !== profileId));
  }
  const selectedPartnerClubs = selectedPartnerIds.flatMap((partnerId) => {
    const partner = partnerClubs.find((club) => club.id === partnerId);
    return partner ? [partner] : [];
  });

  const allowed = (activityKind: ActivityKind) =>
    activityKind === "SERVICE_PROJECT" || activityKind === "JOINT_PROJECT"
      ? canCreateProject
      : canCreateEvent;

  function buildAndDispatchCreate(
    payloadState: ActivityFormState,
    domOverrides?: {
      minMembersRequired?: number;
      capacity?: number;
      rsvpDeadline?: string;
      checkInWindowMinutes?: number;
      volunteerHoursDefault?: number;
      partnerIdsFromDom?: string[];
      domPartners?: { name: string; role: string }[];
    },
  ) {
    const targetKind = payloadState.kind;
    const selectedPartners = domOverrides?.partnerIdsFromDom
      ? partnerClubs.filter((club) =>
          domOverrides.partnerIdsFromDom!.includes(club.id),
        )
      : partnerClubs.filter((club) =>
          payloadState.selectedPartnerIds.includes(club.id),
        );
    const externalPartnersList =
      domOverrides?.domPartners ?? payloadState.externalPartners;
    const selectedSisterClub = selectedPartners[0];
    const sisterClubId =
      selectedSisterClub && UUID_PATTERN.test(selectedSisterClub.id)
        ? selectedSisterClub.id
        : undefined;
    const sisterClubName = selectedSisterClub?.name || "";
    const projectPartners = [
      ...selectedPartners.map((partner) => ({
        name: partner.name,
        role: "IMPLEMENTING_PARTNER" as const,
        ...(UUID_PATTERN.test(partner.id) ? { sisterClubId: partner.id } : {}),
      })),
      ...externalPartnersList,
    ].filter(
      (partner, index, all) =>
        all.findIndex(
          (candidate) =>
            candidate.name.toLowerCase() === partner.name.toLowerCase(),
        ) === index,
    );

    if (
      targetKind === "JOINT_PROJECT" &&
      selectedPartners.length === 0 &&
      externalPartnersList.length === 0
    ) {
      notifyToast({
        title: "Partnership required",
        message:
          "Please select at least one partner club or collaborating organization for a joint project.",
        kind: "error",
      });
      return;
    }

    const sanitizedTasks = payloadState.initialTasks.map((t) => ({
      title: t.title,
      ...(t.description ? { description: t.description } : {}),
      dueDate: t.dueDate || defaultDueDate,
      priority: t.priority,
      status: t.status,
      ...(t.assigneeId ? { assigneeId: t.assigneeId } : {}),
    }));

    const payload = {
      clubId,
      kind: targetKind,
      title: payloadState.title,
      shortDescription: payloadState.shortDescription,
      description: payloadState.description,
      location: payloadState.location,
      startAt: payloadState.startAt,
      endAt: payloadState.endAt,
      allDay: payloadState.allDay,
      committee: payloadState.committee || undefined,
      status: payloadState.status,
      minMembersEnabled: minEnabled,
      minMembersRequired: minEnabled
        ? domOverrides?.minMembersRequired
        : undefined,
      capacity: domOverrides?.capacity,
      rsvpEnabled,
      rsvpDeadline: domOverrides?.rsvpDeadline || undefined,
      selfCheckInEnabled: selfCheckIn,
      qrCheckInEnabled: qrCheckIn,
      checkInWindowMinutes: domOverrides?.checkInWindowMinutes ?? 180,
      volunteerHoursDefault: domOverrides?.volunteerHoursDefault ?? 0,
      committeeMembers,
      initialTasks: sanitizedTasks,
      ...(targetKind === "MEETING"
        ? { meetingType: payloadState.meetingType }
        : {}),
      ...(["SERVICE_PROJECT", "JOINT_PROJECT"].includes(targetKind)
        ? {
            ...(targetKind === "JOINT_PROJECT"
              ? { sisterClubId, sisterClubName }
              : {}),
            objective: payloadState.objective,
            beneficiaryType: payloadState.beneficiaryType,
            beneficiaryTarget: payloadState.beneficiaryTarget,
            fundingTarget: payloadState.fundingTarget,
            fundingSource: payloadState.fundingSource,
            areasOfFocus: payloadState.areasOfFocus,
            sdgs: payloadState.sdgs,
            partners: projectPartners,
            relatedLinks: payloadState.relatedLinks.map((l) => ({
              label: l.label,
              url: l.url,
            })),
          }
        : {}),
    } as CreateActivityInput;

    startTransition(async () => {
      const result = await createActivityAction(payload);
      if (!result.success) {
        notifyToast({
          title: "Activity not created",
          message: result.error,
          kind: "error",
        });
        return;
      }
      notifyToast({
        message: result.message || "Activity created.",
        kind: "success",
      });
      router.push(`/project-center/${result.activityId}`);
      router.refresh();
    });
  }

  function submit(form: HTMLFormElement, saveDraft = false) {
    if (!kind) return;
    const data = new FormData(form);
    const partnersFromDom = data
      .getAll("partnerName")
      .map((name, index) => ({
        name: String(name).trim(),
        role: String(
          data.getAll("partnerRole")[index] || "IMPLEMENTING_PARTNER",
        ),
      }))
      .filter((partner) => partner.name.length > 0);
    const mergedExternal = [
      ...partnersFromDom,
      ...extraExternalPartners,
    ];
    const currentState: ActivityFormState = {
      ...getCurrentFormState(),
      kind,
      status: saveDraft ? "DRAFT" : status,
      externalPartners: mergedExternal as { name: string; role: PartnerRole }[],
    };

    buildAndDispatchCreate(currentState, {
      minMembersRequired: minEnabled
        ? Number(data.get("minMembersRequired"))
        : undefined,
      capacity: data.get("capacity") ? Number(data.get("capacity")) : undefined,
      rsvpDeadline: String(data.get("rsvpDeadline") || "") || undefined,
      checkInWindowMinutes: Number(data.get("checkInWindowMinutes") || 180),
      volunteerHoursDefault: Number(data.get("volunteerHoursDefault") || 0),
      partnerIdsFromDom: data.getAll("sisterClubId").map(String),
      domPartners: mergedExternal,
    });
  }

  if (showAiMode) {
    return (
      <AiDraftPanel
        canCreateEvent={canCreateEvent}
        canCreateProject={canCreateProject}
        partnerClubs={partnerClubs}
        members={members}
        currentForm={getCurrentFormState()}
        defaultDates={defaultDates}
        isSubmitting={isPending}
        onCancel={() => setShowAiMode(false)}
        onApplyToForm={(merged) => {
          applyFormState(merged);
          notifyToast({
            message:
              "AI draft applied to the form. Review details and save when ready.",
            kind: "success",
          });
        }}
        onConfirmCreate={(finalForm) => buildAndDispatchCreate(finalForm)}
      />
    );
  }

  if (!kind || step === 1) {
    const internalClubKinds = ACTIVITY_KINDS.filter(
      (k) => allowed(k) && !ACTIVITY_KIND_META[k].isProject,
    );
    const communityProjectKinds = ACTIVITY_KINDS.filter(
      (k) => allowed(k) && ACTIVITY_KIND_META[k].isProject,
    );

    return (
      <main className="mx-auto max-w-5xl space-y-6 pb-10">
        <Link
          href="/project-center"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#0D3594]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Project Center
        </Link>
        <header>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#0D3594] dark:text-blue-400">
            Step 1 of 2 · Choose Scenario
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[#111625] dark:text-white">
            What are you organizing?
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Pick a quick scenario below or choose an activity type. Activities like{" "}
            <strong>L&amp;D Sessions, Meetings, and Internal Task Sprints</strong>{" "}
            do not require beneficiaries and can be marked Completed in one click.
          </p>
        </header>

        {/* AI Generate Project from Text CTA */}
        <section className="rounded-2xl border-2 border-[#0D3594]/25 bg-gradient-to-r from-[#0D3594]/[0.06] via-indigo-50/60 to-emerald-50/40 p-4 sm:p-5 dark:border-blue-500/35 dark:from-blue-950/40 dark:via-slate-900 dark:to-emerald-950/20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-[#0D3594] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                  <Sparkles className="h-3 w-3" /> AI-Assisted
                </span>
                <h2 className="text-sm font-bold text-[#111625] dark:text-white">
                  Generate Project &amp; Club Approval Checklist from Text
                </h2>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 max-w-2xl">
                Received an invitation or proposal via Messenger, Viber, or email? Paste the raw text and let AI pre-fill the project details, extract primer &amp; sign-up links, flag missing info, and generate a meeting checklist for club approval.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAiMode(true)}
              className="inline-flex items-center justify-center gap-2 shrink-0 rounded-xl bg-[#0D3594] px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#092569] transition cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              Generate from Text
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </section>

        {/* 1-Click Quick Start Scenarios */}
        <section className="rounded-2xl border border-blue-200/80 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-white p-4 sm:p-5 dark:border-blue-500/25 dark:from-blue-950/30 dark:via-slate-900 dark:to-[#161B26]">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-[#0D3594] dark:text-blue-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#0D3594] dark:text-blue-300">
              Quick-Start Scenarios (1-Click Presets)
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {canCreateEvent && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setKind("PROFESSIONAL_DEVELOPMENT");
                    setTitle("L&D Session: ");
                    setShortDescription(
                      "Learning & Development session and member training",
                    );
                    setCommittee("VOCATIONAL");
                    setQrCheckIn(true);
                    setStep(2);
                  }}
                  className="group rounded-xl border border-violet-200 bg-white p-3.5 text-left shadow-2xs transition hover:border-violet-400 hover:shadow-sm dark:border-violet-500/30 dark:bg-[#161B26] cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
                      <GraduationCap className="h-4 w-4" />
                    </span>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                      No Beneficiaries
                    </span>
                  </div>
                  <p className="mt-2.5 text-xs font-bold text-[#111625] group-hover:text-[#0D3594] dark:text-white dark:group-hover:text-blue-300">
                    L&amp;D Meeting / Training
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Leadership &amp; skill development with attendance &amp; tasks.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setKind("MEETING");
                    setMeetingType("COMMITTEE_MEETING");
                    setTitle("Committee Planning Meeting: ");
                    setShortDescription(
                      "Planning agenda, member alignment, and action items",
                    );
                    setCommittee("CLUB_SERVICE");
                    setQrCheckIn(true);
                    setStep(2);
                  }}
                  className="group rounded-xl border border-sky-200 bg-white p-3.5 text-left shadow-2xs transition hover:border-sky-400 hover:shadow-sm dark:border-sky-500/30 dark:bg-[#161B26] cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300">
                      <Users className="h-4 w-4" />
                    </span>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                      No Beneficiaries
                    </span>
                  </div>
                  <p className="mt-2.5 text-xs font-bold text-[#111625] group-hover:text-[#0D3594] dark:text-white dark:group-hover:text-blue-300">
                    Committee / Club Meeting
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    General Assembly, Board, or Committee meeting + tasks.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setKind("OTHER");
                    setTitle("Task Sprint: ");
                    setShortDescription(
                      "Internal committee workstream and task deliverables",
                    );
                    setCommittee("CLUB_SERVICE");
                    setQrCheckIn(false);
                    setStep(2);
                  }}
                  className="group rounded-xl border border-amber-200 bg-white p-3.5 text-left shadow-2xs transition hover:border-amber-400 hover:shadow-sm dark:border-amber-500/30 dark:bg-[#161B26] cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                      <CheckSquare className="h-4 w-4" />
                    </span>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                      Task-Driven
                    </span>
                  </div>
                  <p className="mt-2.5 text-xs font-bold text-[#111625] group-hover:text-[#0D3594] dark:text-white dark:group-hover:text-blue-300">
                    Internal Work &amp; Task Group
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Organize &amp; assign club tasks without QR or beneficiaries.
                  </p>
                </button>
              </>
            )}
            {canCreateProject && (
              <button
                type="button"
                onClick={() => {
                  setKind("SERVICE_PROJECT");
                  setTitle("");
                  setShortDescription("");
                  setCommittee("COMMUNITY_SERVICE");
                  setQrCheckIn(true);
                  setStep(2);
                }}
                className="group rounded-xl border border-emerald-200 bg-white p-3.5 text-left shadow-2xs transition hover:border-emerald-400 hover:shadow-sm dark:border-emerald-500/30 dark:bg-[#161B26] cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                    <HeartHandshake className="h-4 w-4" />
                  </span>
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-[#0D3594] dark:bg-blue-500/15 dark:text-blue-300">
                    With Beneficiaries
                  </span>
                </div>
                <p className="mt-2.5 text-xs font-bold text-[#111625] group-hover:text-[#0D3594] dark:text-white dark:group-hover:text-blue-300">
                  Community Service Project
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Outreach with beneficiaries, SDGs &amp; Accomplishment Report.
                </p>
              </button>
            )}
          </div>
        </section>

        {/* Track 1: Internal Club Activities (No Beneficiaries Required) */}
        {internalClubKinds.length > 0 && (
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-[#111625] dark:text-white">
                  1. Club Activities, L&amp;D, Meetings &amp; Task Sprints
                </h2>
                <p className="text-xs text-slate-500">
                  For internal club sessions, L&amp;D trainings, meetings, and task groups that{" "}
                  <strong>do not have external beneficiaries</strong>.
                </p>
              </div>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                ✓ Simple 3-Step Flow (Planned → Ongoing → Completed)
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {internalClubKinds.map((activityKind) => {
                const meta = ACTIVITY_KIND_META[activityKind];
                const Icon =
                  activityKind === "MEETING"
                    ? Users
                    : activityKind === "PROFESSIONAL_DEVELOPMENT"
                      ? GraduationCap
                      : ClipboardList;
                return (
                  <button
                    key={activityKind}
                    type="button"
                    onClick={() => {
                      setKind(activityKind);
                      setTitle("");
                      setShortDescription("");
                      setQrCheckIn(activityKind !== "OTHER");
                      setStep(2);
                    }}
                    className="group rounded-xl border border-[#EDEDF2] bg-white p-4 text-left transition hover:border-[#0D3594]/40 hover:shadow-sm dark:border-slate-800 dark:bg-[#161B26] cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${meta.chipClass}`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        No Beneficiary Report
                      </span>
                    </div>
                    <span className="mt-3 block text-sm font-bold text-[#111625] dark:text-white">
                      {meta.label}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                      {meta.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Track 2: Community Service Projects (With Beneficiaries & Accomplishment Report) */}
        {communityProjectKinds.length > 0 && (
          <section className="space-y-3 pt-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-[#111625] dark:text-white">
                  2. Community Service &amp; Joint Projects (With Beneficiaries)
                </h2>
                <p className="text-xs text-slate-500">
                  For external outreach projects that track community beneficiaries, Areas of Focus, and publish an Accomplishment Report.
                </p>
              </div>
              <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-bold text-[#0D3594] dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
                4-Step Flow (Includes Accomplishment Report)
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {communityProjectKinds.map((activityKind) => {
                const meta = ACTIVITY_KIND_META[activityKind];
                return (
                  <button
                    key={activityKind}
                    type="button"
                    onClick={() => {
                      setKind(activityKind);
                      setTitle("");
                      setShortDescription("");
                      setQrCheckIn(true);
                      setStep(2);
                    }}
                    className="group rounded-xl border border-emerald-200/90 bg-emerald-50/20 p-4 text-left transition hover:border-emerald-400 hover:shadow-sm dark:border-emerald-500/25 dark:bg-[#161B26] cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${meta.chipClass}`}
                      >
                        <HeartHandshake className="h-4 w-4" />
                      </span>
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                        Beneficiaries + Report
                      </span>
                    </div>
                    <span className="mt-3 block text-sm font-bold text-[#111625] dark:text-white">
                      {meta.label}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                      {meta.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </main>
    );
  }

  const meta = ACTIVITY_KIND_META[kind];
  return (
    <main className="mx-auto max-w-4xl space-y-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setStep(1)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#0D3594] cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Change activity type
        </button>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowAiMode(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50/80 px-3 py-1.5 text-xs font-bold text-[#0D3594] hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300 cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Generate from Text (AI)
          </button>
          <span className="text-[11px] font-semibold text-slate-500">
            Step 2 of 2
          </span>
        </div>
      </div>
      <header className="flex items-center gap-3">
        <span
          className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${meta.chipClass}`}
        >
          <ClipboardList className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-bold text-[#111625] dark:text-white">
            New {meta.label}
          </h1>
          <p className="text-xs text-slate-500">
            {meta.isProject
              ? "Plan the community service project, assign your committee & tasks, and track beneficiary impact."
              : "Schedule this club activity or meeting, assign tasks/action items, and track member participation."}
          </p>
        </div>
      </header>

      {/* Reassuring Mode Banner explaining Beneficiary vs Non-Beneficiary lifecycle */}
      {!meta.isProject ? (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-xs text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-950/20 dark:text-emerald-200">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="font-bold">
              Internal Club Activity Mode — No Beneficiaries Required
            </p>
            <p className="mt-0.5 text-[11px] text-emerald-800/90 dark:text-emerald-300/80">
              Because this is a <strong>{meta.label}</strong>, you do not need to enter external beneficiaries or publish a Showcase report. It uses a simple 3-step flow (<strong>Planned → Ongoing → Completed</strong>) and supports full task assignment below.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50/60 px-4 py-3 text-xs text-slate-800 dark:border-blue-500/30 dark:bg-blue-950/20 dark:text-slate-200">
          <HeartHandshake className="mt-0.5 h-4 w-4 shrink-0 text-[#0D3594] dark:text-blue-400" />
          <div>
            <p className="font-bold">
              Community Impact Project Mode — Includes Beneficiaries &amp; Accomplishment Report
            </p>
            <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">
              Uses the 4-step guided flow (<strong>Planned → Ongoing → Awaiting Report → Accomplished</strong>). Looking to organize an internal L&amp;D session, meeting, or task group without beneficiaries?{" "}
              <button
                type="button"
                onClick={() => setStep(1)}
                className="font-bold text-[#0D3594] underline dark:text-blue-300 cursor-pointer"
              >
                Switch to an Internal Activity type
              </button>
              .
            </p>
          </div>
        </div>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit(event.currentTarget);
        }}
        className="space-y-5"
      >
        <section className="space-y-4 rounded-xl border border-[#EDEDF2] bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-[#161B26]">
          <FormSectionTitle title="Overview" />
          <Field label="Title" required>
            <input
              name="title"
              required
              minLength={3}
              maxLength={160}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                kind === "PROFESSIONAL_DEVELOPMENT"
                  ? "e.g. L&D Session: Public Speaking & Leadership Workshop"
                  : kind === "MEETING"
                    ? "e.g. L&D Committee Alignment & Planning Meeting"
                    : kind === "OTHER"
                      ? "e.g. Q2 PR & Social Media Task Sprint"
                      : "e.g. Community health screening"
              }
              className={inputClass}
            />
          </Field>
          <Field
            label="Short description"
            hint="Appears on activity cards and dashboards. Up to 280 characters."
          >
            <input
              name="shortDescription"
              maxLength={280}
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              placeholder="A clear one-line summary"
              className={inputClass}
            />
          </Field>
          <Field
            label={
              kind === "MEETING" || kind === "PROFESSIONAL_DEVELOPMENT"
                ? "Agenda, Learning Topics & Notes"
                : "Description"
            }
          >
            <textarea
              name="description"
              rows={3}
              maxLength={10000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                kind === "MEETING" || kind === "PROFESSIONAL_DEVELOPMENT"
                  ? "Key agenda items, speaker/facilitator, learning objectives, and preparation notes for members"
                  : "Purpose, audience and what members should expect"
              }
              className={inputClass}
            />
          </Field>
          {kind === "MEETING" && (
            <Field label="Meeting type" required>
              <select
                name="meetingType"
                value={meetingType}
                onChange={(e) => setMeetingType(e.target.value as MeetingType)}
                className={inputClass}
              >
                {MEETING_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {MEETING_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Committee">
              <select
                name="committee"
                value={committee}
                onChange={(e) => setCommittee(e.target.value as Committee | "")}
                className={inputClass}
              >
                <option value="">No committee</option>
                {COMMITTEES.map((c) => (
                  <option key={c} value={c}>
                    {c.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Location">
              <input
                name="location"
                maxLength={300}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Venue or online meeting link"
                className={inputClass}
              />
            </Field>
          </div>

          {/* Project Committee & Team */}
          <div className="space-y-3 rounded-xl border border-[#EDEDF2] bg-white p-4 dark:border-slate-800 dark:bg-[#161B26]">
            <div>
              <h3 className="text-xs font-bold text-[#111625] dark:text-white flex items-center gap-1.5">
                <Users className="h-4 w-4 text-[#0D3594] dark:text-blue-400" />
                Project Committee &amp; Team
              </h3>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Appoint committee members to coordinate, assign tasks, and lead this project. They will automatically be notified.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <select
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                className={`flex-1 ${inputClass}`}
              >
                <option value="">Select a member or officer to appoint...</option>
                {members
                  .filter((m) => !committeeMembers.some((c) => c.profileId === m.id))
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fullName} {m.role ? `(${m.role.replaceAll("_", " ")})` : ""}
                    </option>
                  ))}
              </select>

              <select
                value={selectedRole}
                onChange={(e) =>
                  setSelectedRole(
                    e.target.value as "COMMITTEE" | "CO_CHAIR" | "VOLUNTEER",
                  )
                }
                className={`w-full sm:w-36 ${inputClass}`}
              >
                <option value="COMMITTEE">Committee</option>
                <option value="CO_CHAIR">Co-Chair</option>
                <option value="VOLUNTEER">Volunteer</option>
              </select>

              <button
                type="button"
                disabled={!selectedMemberId}
                onClick={addCommitteeMember}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0D3594] px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-900 disabled:opacity-50 transition cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Member
              </button>
            </div>

            {committeeMembers.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                {committeeMembers.map((cm) => {
                  const member = members.find((m) => m.id === cm.profileId);
                  return (
                    <div
                      key={cm.profileId}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200"
                    >
                      <span className="font-semibold">{member?.fullName || "Member"}</span>
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
                        {cm.role.replaceAll("_", " ")}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeCommitteeMember(cm.profileId)}
                        className="text-slate-400 hover:text-rose-600 p-0.5 rounded cursor-pointer"
                        aria-label="Remove committee member"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Initial Tasks & Action Items Builder */}
          <div className="space-y-3 rounded-xl border border-blue-200/70 bg-blue-50/30 p-4 dark:border-blue-500/20 dark:bg-blue-950/15">
            <div>
              <h3 className="text-xs font-bold text-[#111625] dark:text-white flex items-center gap-1.5">
                <CheckSquare className="h-4 w-4 text-[#0D3594] dark:text-blue-400" />
                Action Items &amp; Tasks to Assign (Optional)
              </h3>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Add initial preparation tasks, L&amp;D deliverables, or meeting action items right now. You can also add more tasks anytime after creating the activity.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-[minmax(180px,2fr)_minmax(130px,1fr)_minmax(110px,.8fr)_minmax(140px,1fr)_auto]">
              <input
                type="text"
                value={draftTaskTitle}
                onChange={(e) => setDraftTaskTitle(e.target.value)}
                placeholder="e.g. Prepare L&D slide deck & materials"
                className={inputClass}
              />
              <input
                type="date"
                value={draftTaskDue}
                onChange={(e) => setDraftTaskDue(e.target.value)}
                className={inputClass}
              />
              <select
                value={draftTaskPriority}
                onChange={(e) =>
                  setDraftTaskPriority(
                    e.target.value as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
                  )
                }
                className={inputClass}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
              <select
                value={draftTaskAssigneeId}
                onChange={(e) => setDraftTaskAssigneeId(e.target.value)}
                className={inputClass}
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={draftTaskTitle.trim().length < 3}
                onClick={addInitialTask}
                className="inline-flex items-center justify-center gap-1 rounded-lg bg-[#0D3594] px-3 py-2 text-xs font-semibold text-white hover:bg-[#092569] disabled:opacity-50 transition cursor-pointer shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Task
              </button>
            </div>
            <input
              type="text"
              value={draftTaskDesc}
              onChange={(e) => setDraftTaskDesc(e.target.value)}
              placeholder="Optional task notes, checklist details, or link reference..."
              className={inputClass}
            />

            {initialTasks.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-blue-100 dark:border-slate-800">
                {initialTasks.map((task, idx) => {
                  const assignee = members.find(
                    (m) => m.id === task.assigneeId,
                  );
                  return (
                    <div
                      key={task.id || `${task.title}-${idx}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] font-bold text-[#0D3594] dark:text-blue-400 shrink-0">
                            #{idx + 1}
                          </span>
                          <span className="font-semibold text-[#111625] dark:text-white truncate">
                            {task.title}
                          </span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300 shrink-0">
                            {task.priority}
                          </span>
                        </div>
                        {task.description && (
                          <p className="mt-0.5 truncate text-[11px] text-slate-500">
                            {task.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                        <span>Due {task.dueDate}</span>
                        {assignee && (
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            · {assignee.fullName}
                          </span>
                        )}
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveInitialTask(idx, -1)}
                          className="text-slate-400 hover:text-[#0D3594] disabled:opacity-30 p-0.5 rounded cursor-pointer"
                          aria-label="Move task up"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === initialTasks.length - 1}
                          onClick={() => moveInitialTask(idx, 1)}
                          className="text-slate-400 hover:text-[#0D3594] disabled:opacity-30 p-0.5 rounded cursor-pointer"
                          aria-label="Move task down"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeInitialTask(idx)}
                          className="text-slate-400 hover:text-rose-600 p-0.5 rounded cursor-pointer"
                          aria-label="Remove task"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Starts" required>
              <input
                name="startAt"
                type="datetime-local"
                required
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Ends" required>
              <input
                name="endAt"
                type="datetime-local"
                required
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              name="allDay"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="accent-[#0D3594]"
            />{" "}
            All-day activity
          </label>
        </section>

        {meta.isProject && (
          <section className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 sm:p-5 dark:border-emerald-500/20 dark:bg-emerald-500/5">
            <FormSectionTitle
              title="Service project planning"
              subtitle="These fields start the Rotary Showcase accomplishment record."
            />
            <Field
              label="Objective"
              hint="What change should this project create?"
            >
              <textarea
                name="objective"
                rows={2}
                maxLength={2000}
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                className={inputClass}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Beneficiary group">
                <input
                  name="beneficiaryType"
                  maxLength={200}
                  value={beneficiaryType}
                  onChange={(e) => setBeneficiaryType(e.target.value)}
                  placeholder="e.g. mothers and children"
                  className={inputClass}
                />
              </Field>
              <Field label="Target beneficiaries">
                <input
                  name="beneficiaryTarget"
                  type="number"
                  min="0"
                  value={beneficiaryTarget}
                  onChange={(e) =>
                    setBeneficiaryTarget(Number(e.target.value || 0))
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Funding target">
                <input
                  name="fundingTarget"
                  type="number"
                  min="0"
                  step="0.01"
                  value={fundingTarget}
                  onChange={(e) =>
                    setFundingTarget(Number(e.target.value || 0))
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Funding source">
                <input
                  name="fundingSource"
                  maxLength={300}
                  value={fundingSource}
                  onChange={(e) => setFundingSource(e.target.value)}
                  placeholder="Club, grant or partner"
                  className={inputClass}
                />
              </Field>
            </div>
            <Field label="Rotary Area of Focus">
              <div className="grid gap-2 sm:grid-cols-2">
                {AREAS_OF_FOCUS.map((area) => (
                  <label
                    key={area.code}
                    className="flex items-start gap-2 rounded-lg border border-emerald-100 bg-white px-3 py-2 text-xs text-slate-700 dark:border-emerald-500/10 dark:bg-slate-900 dark:text-slate-200"
                  >
                    <input
                      type="checkbox"
                      name="areasOfFocus"
                      value={area.code}
                      checked={areasOfFocus.includes(area.code)}
                      onChange={(e) =>
                        setAreasOfFocus((prev) =>
                          e.target.checked
                            ? [...prev, area.code]
                            : prev.filter((c) => c !== area.code),
                        )
                      }
                      className="mt-0.5 accent-emerald-600"
                    />{" "}
                    {area.name}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="UN Sustainable Development Goals">
              <div className="grid gap-2 sm:grid-cols-2">
                {SDGS.map((goal, index) => {
                  const goalNum = index + 1;
                  return (
                    <label
                      key={goal}
                      className="flex items-start gap-2 rounded-lg border border-emerald-100 bg-white px-3 py-2 text-xs text-slate-700 dark:border-emerald-500/10 dark:bg-slate-900 dark:text-slate-200"
                    >
                      <input
                        type="checkbox"
                        name="sdgs"
                        value={goalNum}
                        checked={sdgs.includes(goalNum)}
                        onChange={(e) =>
                          setSdgs((prev) =>
                            e.target.checked
                              ? [...prev, goalNum]
                              : prev.filter((n) => n !== goalNum),
                          )
                        }
                        className="mt-0.5 accent-emerald-600"
                      />{" "}
                      {goalNum}. {goal}
                    </label>
                  );
                })}
              </div>
            </Field>
            <Field
              label="Partnerships (Sister / Partner Clubs)"
              required={kind === "JOINT_PROJECT"}
              hint={
                kind === "JOINT_PROJECT"
                  ? "Select one or more sister or partner clubs co-implementing this project."
                  : "Optionally link any sister or partner clubs collaborating on this activity."
              }
            >
              <div className="mb-2 flex flex-wrap gap-2">
                {selectedPartnerClubs.map((partner) => (
                  <div
                    key={partner.id}
                    className="inline-flex max-w-full items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100"
                  >
                    <input
                      type="hidden"
                      name="sisterClubId"
                      value={partner.id}
                    />
                    <span className="min-w-0 break-words font-medium">{partner.name}</span>
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-300">
                      (D{partner.district})
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove partner ${partner.name}`}
                      title={`Remove ${partner.name}`}
                      onClick={() =>
                        setSelectedPartnerIds((previous) =>
                          previous.filter(
                            (partnerId) => partnerId !== partner.id,
                          ),
                        )
                      }
                      className="shrink-0 rounded p-1 hover:bg-emerald-100 focus-visible:ring-2 focus-visible:ring-emerald-600 dark:hover:bg-emerald-900 cursor-pointer text-emerald-800 dark:text-emerald-200"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
              <select
                aria-label="Add partnership"
                value={selectedPartnerDropdown}
                disabled={partnerClubs.filter((c) => !selectedPartnerIds.includes(c.id)).length === 0}
                onChange={(event) => {
                  const partnerId = event.target.value;
                  if (partnerId) {
                    setSelectedPartnerIds((previous) =>
                      previous.includes(partnerId)
                        ? previous
                        : [...previous, partnerId],
                    );
                    setSelectedPartnerDropdown("");
                  }
                }}
                className={inputClass}
              >
                <option value="">
                  {partnerClubs.filter((c) => !selectedPartnerIds.includes(c.id)).length === 0
                    ? partnerClubs.length === 0
                      ? "No partner clubs registered yet"
                      : "All available partner clubs added"
                    : selectedPartnerIds.length === 0
                      ? "+ Select a sister or partner club..."
                      : `+ Add another partner club (${partnerClubs.filter((c) => !selectedPartnerIds.includes(c.id)).length} remaining)...`}
                </option>
                {partnerClubs
                  .filter((club) => !selectedPartnerIds.includes(club.id))
                  .map((club) => (
                    <option key={club.id} value={club.id}>
                      {club.name} · District {club.district}, {club.country}
                    </option>
                  ))}
              </select>
              {partnerClubs.length === 0 && (
                <Link
                  href="/partnerships"
                  className="mt-2 inline-flex text-xs font-semibold text-[#0D3594] dark:text-blue-300"
                >
                  Register a partner club first
                </Link>
              )}
            </Field>
            <Field
              label="Additional partner organizations"
              hint="External non-Rotary partners, NGOs, LGUs, or corporate co-organizers."
            >
              <input
                name="partnerName"
                maxLength={200}
                value={externalPartnerNameInput}
                onChange={(e) => setExternalPartnerNameInput(e.target.value)}
                placeholder="Partner organization name"
                className={inputClass}
              />
              <input
                type="hidden"
                name="partnerRole"
                value="IMPLEMENTING_PARTNER"
              />
            </Field>
            {extraExternalPartners.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {extraExternalPartners.map((partner, idx) => (
                  <span
                    key={`${partner.name}-${idx}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    {partner.name}
                    <button
                      type="button"
                      onClick={() =>
                        setExtraExternalPartners((prev) =>
                          prev.filter((_, i) => i !== idx),
                        )
                      }
                      className="text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {relatedLinks.length > 0 && (
              <div className="space-y-1.5 rounded-lg border border-emerald-200/80 bg-white p-3 dark:border-emerald-500/20 dark:bg-slate-900/50">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5 text-emerald-600" />
                  Attached Project Links ({relatedLinks.length})
                </p>
                <div className="space-y-1">
                  {relatedLinks.map((link, idx) => (
                    <div
                      key={`${link.url}-${idx}`}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[#0D3594] hover:underline truncate dark:text-blue-300"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        <span className="font-semibold">{link.label}:</span>
                        <span className="truncate font-mono text-[11px]">
                          {link.url}
                        </span>
                      </a>
                      <button
                        type="button"
                        onClick={() =>
                          setRelatedLinks((prev) =>
                            prev.filter((_, i) => i !== idx),
                          )
                        }
                        className="text-slate-400 hover:text-rose-600 cursor-pointer shrink-0"
                        aria-label="Remove attached link"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        <section className="space-y-4 rounded-xl border border-[#EDEDF2] bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-[#161B26]">
          <FormSectionTitle title="Participation" />
          <ToggleRow
            title="Set a minimum number of members"
            description="Track confirmed RSVPs against the minimum. Turn off to omit this requirement."
            checked={minEnabled}
            onChange={setMinEnabled}
          >
            {minEnabled && (
              <input
                name="minMembersRequired"
                type="number"
                required
                min="1"
                max="100000"
                placeholder="Minimum members"
                className={`${inputClass} max-w-48`}
              />
            )}
          </ToggleRow>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Capacity" hint="Leave blank for unlimited capacity.">
              <input
                name="capacity"
                type="number"
                min="1"
                placeholder="Unlimited"
                className={inputClass}
              />
            </Field>
            <Field label="Default volunteer hours">
              <input
                name="volunteerHoursDefault"
                type="number"
                min="0"
                max="24"
                step="0.25"
                defaultValue={meta.isProject ? "0" : "1"}
                className={inputClass}
              />
            </Field>
          </div>
          <ToggleRow
            title="Allow members to RSVP"
            description="Members can respond Going, Maybe or Can't go."
            checked={rsvpEnabled}
            onChange={setRsvpEnabled}
          />
          {rsvpEnabled && (
            <Field label="RSVP deadline">
              <input
                name="rsvpDeadline"
                type="datetime-local"
                className={`${inputClass} max-w-sm`}
              />
            </Field>
          )}
          <ToggleRow
            title="Enable QR Attendance Check-In"
            description="Generate dynamic rolling QR codes for members to scan on-site. Turn this off for promotional campaigns, recruitment drives, or non-assembly projects."
            checked={qrCheckIn}
            onChange={setQrCheckIn}
          />
          <ToggleRow
            title="Allow 'Check in as me'"
            description="Members can check themselves in during the activity check-in window. QR check-in remains available."
            checked={selfCheckIn}
            onChange={setSelfCheckIn}
          />
          <Field
            label="Check-in window after start"
            hint="Set 0 to allow check-in until the activity ends."
          >
            <select
              name="checkInWindowMinutes"
              defaultValue="180"
              className={`${inputClass} max-w-48`}
            >
              <option value="0">Until activity ends</option>
              <option value="60">1 hour</option>
              <option value="180">3 hours</option>
              <option value="360">6 hours</option>
              <option value="720">12 hours</option>
            </select>
          </Field>
        </section>

        <footer className="flex flex-col-reverse justify-between gap-3 sm:flex-row sm:items-center">
          <Link
            href="/project-center"
            className="text-center text-xs font-semibold text-slate-500 hover:text-slate-700"
          >
            Cancel
          </Link>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={(event) => {
                const form = event.currentTarget.form;
                if (form?.reportValidity()) submit(form, true);
              }}
              className="rounded-lg border border-[#EDEDF2] px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Save draft
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0D3594] px-4 py-2 text-xs font-semibold text-white hover:bg-[#092569] disabled:opacity-60"
            >
              {isPending ? "Creating..." : "Create activity"}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </footer>
      </form>
    </main>
  );
}

const inputClass =
  "w-full rounded-lg border border-[#DDE1EA] bg-white px-3 py-2 text-sm text-[#111625] outline-none focus:border-[#0D3594] focus:ring-2 focus:ring-[#0D3594]/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white";

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
      <span>
        {label}
        {required && <span className="text-rose-500 font-bold ml-0.5">*</span>}
      </span>
      {children}
      {hint && (
        <span className="block text-[11px] font-normal text-slate-500">
          {hint}
        </span>
      )}
    </label>
  );
}

function FormSectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="border-b border-[#EDEDF2] pb-2 dark:border-slate-800">
      <h2 className="text-sm font-bold text-[#111625] dark:text-white">
        {title}
      </h2>
      {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
    </div>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
  children,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-[#EDEDF2] pb-3 last:border-0 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-1 h-4 w-4 accent-[#0D3594]"
        />
        <span>
          <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
            {title}
          </span>
          <span className="mt-0.5 block text-[11px] font-normal text-slate-500">
            {description}
          </span>
        </span>
      </div>
      {children && <div className="pl-7 sm:pl-0">{children}</div>}
    </div>
  );
}
