"use client";

import React, { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CalendarDays,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock,
  ExternalLink,
  Globe2,
  GraduationCap,
  HeartHandshake,
  Link2,
  MapPin,
  Plus,
  QrCode,
  Repeat,
  Search,
  Sparkles,
  Target,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { createActivityAction } from "@/features/activities/actions";
import {
  computeSeriesBoundsLocal,
  formatRecurrenceSummary,
  isRecurringSchedule,
} from "@/features/activities/recurrence";
import { manilaLocalToISO } from "@/lib/utils/dates";
import {
  ACTIVITY_KINDS,
  ACTIVITY_KIND_META,
  ACTIVITY_PRIORITIES,
  ACTIVITY_PRIORITY_META,
  AREAS_OF_FOCUS,
  COMMITTEES,
  DEFAULT_CLUB_ID,
  MEETING_TYPES,
  MEETING_TYPE_LABELS,
  type ActivityKind,
  type ActivityPriority,
  type ActivityRecurrence,
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
import { Avatar, KindBadge, PriorityBadge } from "../_components/badges";
import { RecurrenceEditor } from "../_components/recurrence-editor";
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

function formatCommitteeLabel(code: string) {
  return code
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function formatRoleLabel(role: string) {
  return role
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function computeDurationLabel(
  startLocal: string,
  endLocal: string,
  allDay: boolean,
): { valid: boolean; label: string } {
  if (!startLocal || !endLocal) {
    return { valid: false, label: "Select both start and end date/time" };
  }
  if (endLocal < startLocal) {
    return {
      valid: false,
      label: "End date & time must be after Start date & time",
    };
  }
  const startMs = Date.parse(startLocal);
  const endMs = Date.parse(endLocal);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return { valid: false, label: "Invalid date format" };
  }
  const totalMinutes = Math.max(0, Math.round((endMs - startMs) / 60_000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} ${days === 1 ? "day" : "days"}`);
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
  if (days === 0 && minutes > 0) {
    parts.push(`${minutes} ${minutes === 1 ? "min" : "mins"}`);
  }
  if (parts.length === 0) {
    parts.push(allDay ? "1 day" : "Same start & end time");
  }
  return {
    valid: true,
    label: allDay ? `All-day · ${parts.join(" ")}` : parts.join(" "),
  };
}

function formatPreviewDate(startLocal: string) {
  if (!startLocal) return "Schedule not set";
  const parsed = new Date(startLocal);
  if (Number.isNaN(parsed.getTime())) return startLocal;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function getKindIcon(activityKind: ActivityKind) {
  switch (activityKind) {
    case "MEETING":
      return Users;
    case "PROFESSIONAL_DEVELOPMENT":
      return GraduationCap;
    case "SERVICE_PROJECT":
    case "JOINT_PROJECT":
      return HeartHandshake;
    case "DISTRICT_EVENT":
      return Globe2;
    case "FELLOWSHIP":
      return Sparkles;
    case "FUNDRAISER":
      return Target;
    default:
      return ClipboardList;
  }
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
  const formRef = useRef<HTMLFormElement | null>(null);
  const [defaultDates] = useState(() => ({
    startAt: localDefault(7, 9),
    endAt: localDefault(7, 12),
  }));
  const [kind, setKind] = useState<ActivityKind | null>(
    initialKind as ActivityKind | null,
  );
  const [step, setStep] = useState<1 | 2>(initialKind ? 2 : 1);
  const [showAiMode, setShowAiMode] = useState(false);

  // Controlled core fields (preserved for non-overwriting AI merges & live preview)
  const [title, setTitle] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [committee, setCommittee] = useState<Committee | "">("");
  const [meetingType, setMeetingType] =
    useState<MeetingType>("GENERAL_ASSEMBLY");
  const [status, setStatus] = useState<ActivityStatus>("PLANNED");
  const [priority, setPriority] = useState<ActivityPriority>("MEDIUM");
  const [startAt, setStartAt] = useState(defaultDates.startAt);
  const [endAt, setEndAt] = useState(defaultDates.endAt);
  const [allDay, setAllDay] = useState(false);
  const [recurrence, setRecurrence] = useState<ActivityRecurrence | null>(null);
  const [objective, setObjective] = useState("");
  const [beneficiaryType, setBeneficiaryType] = useState("");
  const [beneficiaryTarget, setBeneficiaryTarget] = useState(0);
  const [fundingTarget, setFundingTarget] = useState(0);
  const [fundingSource, setFundingSource] = useState("");
  const [areasOfFocus, setAreasOfFocus] = useState<string[]>([]);
  const [sdgs, setSdgs] = useState<number[]>([]);
  const [sdgsExpanded, setSdgsExpanded] = useState(false);
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
  const [memberSearch, setMemberSearch] = useState("");
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

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTransitioning, startTransition] = useTransition();
  const isPending = isSubmitting || isTransitioning;

  const durationInfo = useMemo(
    () => computeDurationLabel(startAt, endAt, allDay),
    [allDay, endAt, startAt],
  );

  const recurrenceSummary = useMemo(() => {
    if (!isRecurringSchedule(recurrence)) return null;
    const sIso = manilaLocalToISO(startAt);
    const eIso = manilaLocalToISO(endAt || startAt);
    return sIso ? formatRecurrenceSummary(recurrence, sIso, eIso || sIso) : null;
  }, [endAt, recurrence, startAt]);

  const availableMembers = useMemo(
    () =>
      members.filter(
        (m) => !committeeMembers.some((c) => c.profileId === m.id),
      ),
    [committeeMembers, members],
  );

  const filteredQuickMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return [];
    return availableMembers
      .filter(
        (m) =>
          m.fullName.toLowerCase().includes(q) ||
          (m.role && m.role.toLowerCase().includes(q)),
      )
      .slice(0, 6);
  }, [availableMembers, memberSearch]);

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
      recurrence,
      committee,
      status,
      priority,
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
    setRecurrence(next.recurrence ?? null);
    setCommittee(next.committee);
    setStatus(next.status);
    setPriority(next.priority ?? "MEDIUM");
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

  function addCommitteeMember(
    profileId = selectedMemberId,
    role = selectedRole,
  ) {
    if (!profileId) return;
    if (committeeMembers.some((c) => c.profileId === profileId)) return;
    setCommitteeMembers((prev) => [...prev, { profileId, role }]);
    setSelectedMemberId("");
    setMemberSearch("");
  }

  function updateCommitteeMemberRole(
    profileId: string,
    role: "COMMITTEE" | "CO_CHAIR" | "VOLUNTEER",
  ) {
    setCommitteeMembers((prev) =>
      prev.map((c) => (c.profileId === profileId ? { ...c, role } : c)),
    );
  }

  function removeCommitteeMember(profileId: string) {
    setCommitteeMembers((prev) =>
      prev.filter((c) => c.profileId !== profileId),
    );
  }

  function addExtraExternalPartner() {
    const trimmed = externalPartnerNameInput.trim();
    if (!trimmed) return;
    if (
      !extraExternalPartners.some(
        (p) => p.name.toLowerCase() === trimmed.toLowerCase(),
      )
    ) {
      setExtraExternalPartners((prev) => [
        ...prev,
        { name: trimmed, role: "IMPLEMENTING_PARTNER" },
      ]);
    }
    setExternalPartnerNameInput("");
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

    const sanitizedTasks = (payloadState.initialTasks || []).map((t) => ({
      title: t.title,
      description: t.description || "",
      dueDate: t.dueDate,
      priority: t.priority,
      status: t.status || "TODO",
      ...(t.assigneeId && UUID_PATTERN.test(t.assigneeId)
        ? { assigneeId: t.assigneeId }
        : {}),
    }));

    const seriesBounds = computeSeriesBoundsLocal({
      startAtLocal: payloadState.startAt,
      endAtLocal: payloadState.endAt,
      recurrence: payloadState.recurrence,
    });

    const payload = {
      clubId,
      kind: targetKind,
      title: payloadState.title,
      shortDescription: payloadState.shortDescription,
      description: payloadState.description,
      location: payloadState.location,
      startAt: seriesBounds.startAtLocal,
      endAt: seriesBounds.endAtLocal,
      allDay: payloadState.allDay,
      recurrence: seriesBounds.recurrence,
      committee: payloadState.committee || undefined,
      status: payloadState.status,
      priority: payloadState.priority ?? "MEDIUM",
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

    setIsSubmitting(true);
    void (async () => {
      try {
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
        startTransition(() => {
          router.push(`/project-center/${result.activityId}`);
          router.refresh();
        });
      } finally {
        setIsSubmitting(false);
      }
    })();
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

  // ============================================================================
  // STEP 1: SCENARIO CHOOSER
  // ============================================================================
  if (!kind || step === 1) {
    const internalClubKinds = ACTIVITY_KINDS.filter(
      (k) => allowed(k) && !ACTIVITY_KIND_META[k].isProject,
    );
    const communityProjectKinds = ACTIVITY_KINDS.filter(
      (k) => allowed(k) && ACTIVITY_KIND_META[k].isProject,
    );

    return (
      <main className="mx-auto max-w-5xl space-y-7 pb-12">
        {/* Top bar + 2-Step Indicator */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/project-center"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-[#0D3594] dark:text-slate-400 dark:hover:text-blue-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Project Center
          </Link>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold shadow-2xs dark:border-slate-800 dark:bg-[#161B26]">
            <span className="inline-flex items-center gap-1 text-[#0D3594] dark:text-blue-300">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#0D3594] text-[10px] font-bold text-white">
                1
              </span>
              Choose Type
            </span>
            <span className="text-slate-300 dark:text-slate-700">/</span>
            <span className="text-slate-400">2. Details &amp; Launch</span>
          </div>
        </div>

        <header className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-[#111625] dark:text-white sm:text-3xl">
            What are you organizing?
          </h1>
          <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            Start from an invitation message with AI, pick a 1-click preset, or choose an activity category tailored to your workflow.
          </p>
        </header>

        {/* AI Assistant Hero Banner */}
        <section className="relative overflow-hidden rounded-2xl border border-[#0D3594]/20 bg-gradient-to-br from-[#0D3594]/[0.07] via-indigo-50/60 to-white p-5 shadow-2xs dark:border-blue-500/30 dark:from-blue-950/40 dark:via-slate-900 dark:to-[#161B26] sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-[#0D3594] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                  <Sparkles className="h-3 w-3" /> AI-Assisted
                </span>
                <h2 className="text-base font-bold text-[#111625] dark:text-white">
                  Generate Project &amp; Approval Checklist from Text
                </h2>
              </div>
              <p className="max-w-2xl text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                Paste any chat or email project invitation — AI extracts dates, primer/sign-up links, flags missing info, and builds a ready-to-review checklist for your club meeting.
              </p>
              <div className="flex flex-wrap gap-2 pt-0.5">
                {[
                  "Messenger & Viber invites",
                  "Auto-extracts links & deadlines",
                  "Club approval checklist",
                ].map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-md border border-blue-200/80 bg-white/80 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:border-blue-500/20 dark:bg-slate-800/70 dark:text-slate-300"
                  >
                    <Check className="h-3 w-3 text-[#0D3594] dark:text-blue-400" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowAiMode(true)}
              className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#0D3594] px-5 py-3 text-xs font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#092569] hover:shadow-md"
            >
              <Sparkles className="h-4 w-4" />
              Generate from Text
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </section>

        {/* Compact 1-Click Quick-Start Strip */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              1-Click Quick-Start Presets
            </h2>
            <span className="text-[11px] text-slate-400">
              Pre-fills common templates in 1 click
            </span>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
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
                  className="group flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-sm dark:border-slate-800 dark:bg-[#161B26] dark:hover:border-violet-500/40"
                >
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
                    <GraduationCap className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-[#111625] group-hover:text-[#0D3594] dark:text-white dark:group-hover:text-blue-300">
                      L&amp;D Meeting / Training
                    </p>
                    <p className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                      No beneficiaries
                    </p>
                  </div>
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
                  className="group flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-sm dark:border-slate-800 dark:bg-[#161B26] dark:hover:border-sky-500/40"
                >
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300">
                    <Users className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-[#111625] group-hover:text-[#0D3594] dark:text-white dark:group-hover:text-blue-300">
                      Committee / Club Meeting
                    </p>
                    <p className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                      No beneficiaries
                    </p>
                  </div>
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
                  className="group flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-sm dark:border-slate-800 dark:bg-[#161B26] dark:hover:border-amber-500/40"
                >
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                    <CheckSquare className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-[#111625] group-hover:text-[#0D3594] dark:text-white dark:group-hover:text-blue-300">
                      Internal Work &amp; Task Group
                    </p>
                    <p className="text-[10px] font-medium text-amber-700 dark:text-amber-400">
                      Task-driven · No QR
                    </p>
                  </div>
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
                className="group flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-sm dark:border-slate-800 dark:bg-[#161B26] dark:hover:border-emerald-500/40"
              >
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                  <HeartHandshake className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-[#111625] group-hover:text-[#0D3594] dark:text-white dark:group-hover:text-blue-300">
                    Community Service Project
                  </p>
                  <p className="text-[10px] font-medium text-[#0D3594] dark:text-blue-400">
                    With Beneficiaries + Report
                  </p>
                </div>
              </button>
            )}
          </div>
        </section>

        {/* Track 1: Internal Club Activities */}
        {internalClubKinds.length > 0 && (
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-[#111625] dark:text-white">
                  1. Club Activities, L&amp;D, Meetings &amp; Task Sprints
                </h2>
                <p className="text-xs text-slate-500">
                  Internal sessions &amp; operations without external community beneficiaries.
                </p>
              </div>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                Planned → Ongoing → Completed
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {internalClubKinds.map((activityKind) => {
                const meta = ACTIVITY_KIND_META[activityKind];
                const Icon = getKindIcon(activityKind);
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
                    className="group flex cursor-pointer flex-col justify-between rounded-2xl border border-[#EDEDF2] bg-white p-4 text-left shadow-2xs transition hover:-translate-y-0.5 hover:border-[#0D3594]/40 hover:shadow-md dark:border-slate-800 dark:bg-[#161B26]"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border ${meta.chipClass}`}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          No Beneficiary Report
                        </span>
                      </div>
                      <span className="mt-3 block text-sm font-bold text-[#111625] group-hover:text-[#0D3594] dark:text-white dark:group-hover:text-blue-300">
                        {meta.label}
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                        {meta.description}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-end text-[11px] font-semibold text-slate-400 transition group-hover:text-[#0D3594] dark:group-hover:text-blue-300">
                      <span>Continue</span>
                      <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Track 2: Community Service Projects */}
        {communityProjectKinds.length > 0 && (
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-[#111625] dark:text-white">
                  2. Community Service &amp; Joint Projects
                </h2>
                <p className="text-xs text-slate-500">
                  Outreach initiatives tracking beneficiaries, Areas of Focus, SDGs, and Showcase Reporting.
                </p>
              </div>
              <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-semibold text-[#0D3594] dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
                Planned → Ongoing → Awaiting Report → Accomplished
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {communityProjectKinds.map((activityKind) => {
                const meta = ACTIVITY_KIND_META[activityKind];
                const Icon = getKindIcon(activityKind);
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
                    className="group flex cursor-pointer flex-col justify-between rounded-2xl border border-emerald-200/80 bg-emerald-50/20 p-4 text-left shadow-2xs transition hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md dark:border-emerald-500/25 dark:bg-[#161B26]"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border ${meta.chipClass}`}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                          Beneficiaries + Report
                        </span>
                      </div>
                      <span className="mt-3 block text-sm font-bold text-[#111625] group-hover:text-emerald-700 dark:text-white dark:group-hover:text-emerald-300">
                        {meta.label}
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                        {meta.description}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-end text-[11px] font-semibold text-emerald-700/70 transition group-hover:text-emerald-700 dark:text-emerald-400">
                      <span>Plan Project</span>
                      <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </main>
    );
  }

  // ============================================================================
  // STEP 2: TWO-COLUMN CREATION STUDIO
  // ============================================================================
  const meta = ACTIVITY_KIND_META[kind];
  const HeaderIcon = getKindIcon(kind);
  const titleReady = title.trim().length >= 3;
  const scheduleReady = durationInfo.valid;
  const partnerReady =
    kind !== "JOINT_PROJECT" ||
    selectedPartnerClubs.length > 0 ||
    extraExternalPartners.length > 0 ||
    externalPartnerNameInput.trim().length > 0;

  return (
    <main className="mx-auto max-w-6xl space-y-6 pb-14">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setStep(1)}
          className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-[#0D3594] dark:text-slate-400 dark:hover:text-blue-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Change activity type
        </button>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold shadow-2xs dark:border-slate-800 dark:bg-[#161B26]">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex cursor-pointer items-center gap-1 text-emerald-600 hover:underline dark:text-emerald-400"
            >
              <Check className="h-3 w-3" /> 1. Type
            </button>
            <span className="text-slate-300 dark:text-slate-700">/</span>
            <span className="inline-flex items-center gap-1 text-[#0D3594] dark:text-blue-300">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#0D3594] text-[10px] font-bold text-white">
                2
              </span>
              Details &amp; Launch
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowAiMode(true)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50/80 px-3 py-1.5 text-xs font-bold text-[#0D3594] transition hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Generate from Text (AI)
          </button>
        </div>
      </div>

      {/* Compact Page Header */}
      <header className="flex flex-col gap-3 rounded-2xl border border-[#EDEDF2] bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-[#161B26] sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-start gap-3.5">
          <span
            className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${meta.chipClass}`}
          >
            <HeaderIcon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-[#111625] dark:text-white">
              New {meta.label}
            </h1>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {meta.isProject
                ? "Plan your community service project, assign committee leads & tasks, and align Rotary goals."
                : "Schedule your activity or meeting, appoint organizers & action items, and configure check-in."}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {!meta.isProject ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
              3-Step Flow · No Beneficiary Report
            </span>
          ) : (
            <div className="flex flex-col items-start gap-1 sm:items-end">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-semibold text-[#0D3594] dark:border-blue-500/30 dark:bg-blue-950/30 dark:text-blue-300">
                <HeartHandshake className="h-3.5 w-3.5" />
                4-Step Flow · Includes Accomplishment Report
              </span>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="cursor-pointer text-[11px] font-semibold text-slate-500 underline hover:text-[#0D3594] dark:text-slate-400"
              >
                Need an internal meeting without beneficiaries?
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Two-Column Creation Studio */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_310px]">
        <form
          id="create-activity-form"
          ref={formRef}
          onSubmit={(event) => {
            event.preventDefault();
            submit(event.currentTarget);
          }}
          className="space-y-5"
        >
          {/* CARD 1: CORE DETAILS & PRIORITY */}
          <section
            id="create-section-basics"
            className="scroll-mt-6 space-y-4 rounded-2xl border border-[#EDEDF2] bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-[#161B26] sm:p-6"
          >
            <FormSectionTitle
              stepNumber="1"
              title="Core Details & Priority"
              subtitle="Set a recognizable title, urgency level, overseeing avenue, and venue."
            />

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
                        : "e.g. Community Literacy & Reading Corner Drive"
                }
                className={inputClass}
              />
            </Field>

            {/* Visual 4-Pill Priority Selector */}
            <div className="space-y-1.5">
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Priority Level
              </span>
              <input type="hidden" name="priority" value={priority} />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {ACTIVITY_PRIORITIES.map((p) => {
                  const pMeta = ACTIVITY_PRIORITY_META[p];
                  const selected = priority === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setPriority(p)}
                      className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                        selected
                          ? "border-[#0D3594] bg-[#0D3594]/8 text-[#0D3594] ring-1 ring-[#0D3594]/25 dark:border-blue-400 dark:bg-blue-500/15 dark:text-blue-200"
                          : "border-[#DDE1EA] bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${pMeta.dotClass}`}
                      />
                      <span>{pMeta.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {kind === "MEETING" && (
              <Field label="Meeting type" required>
                <select
                  name="meetingType"
                  value={meetingType}
                  onChange={(e) =>
                    setMeetingType(e.target.value as MeetingType)
                  }
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
              <Field
                label="Club Avenue / Committee"
                hint="Primary avenue overseeing this initiative."
              >
                <select
                  name="committee"
                  value={committee}
                  onChange={(e) =>
                    setCommittee(e.target.value as Committee | "")
                  }
                  className={inputClass}
                >
                  <option value="">No committee</option>
                  {COMMITTEES.map((c) => (
                    <option key={c} value={c}>
                      {formatCommitteeLabel(c)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label="Location / Venue"
                hint="Physical address or online meeting link."
              >
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    name="location"
                    maxLength={300}
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. San Pedro City Hall or Google Meet"
                    className={`${inputClass} pl-9`}
                  />
                </div>
              </Field>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="create-short-desc"
                  className="text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  Short description
                </label>
                <span className="text-[11px] font-medium text-slate-400">
                  {shortDescription.length}/280
                </span>
              </div>
              <input
                id="create-short-desc"
                name="shortDescription"
                maxLength={280}
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="A clear one-line summary shown on dashboard cards"
                className={inputClass}
              />
            </div>

            <Field
              label={
                kind === "MEETING" || kind === "PROFESSIONAL_DEVELOPMENT"
                  ? "Agenda, Learning Topics & Notes"
                  : "Full Description"
              }
            >
              <textarea
                name="description"
                rows={4}
                maxLength={10000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  kind === "MEETING" || kind === "PROFESSIONAL_DEVELOPMENT"
                    ? "Key agenda items, speaker/facilitator, learning objectives, and preparation notes for members"
                    : "Purpose, scope, reminders, and what members should expect"
                }
                className={inputClass}
              />
            </Field>
          </section>

          {/* CARD 2: SCHEDULE & TIMING */}
          <section
            id="create-section-schedule"
            className="scroll-mt-6 space-y-4 rounded-2xl border border-[#EDEDF2] bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-[#161B26] sm:p-6"
          >
            <FormSectionTitle
              stepNumber="2"
              title="Schedule & Timeframe"
              subtitle="All dates use Asia/Manila local time."
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Starts (Asia/Manila)" required>
                <input
                  name="startAt"
                  type="datetime-local"
                  required
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Ends (Asia/Manila)" required>
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

            <div
              className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-medium ${
                durationInfo.valid
                  ? "border-blue-200 bg-blue-50/70 text-[#0D3594] dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200"
                  : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300"
              }`}
            >
              {durationInfo.valid ? (
                <Clock className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span>
                {recurrenceSummary
                  ? `Schedule: ${recurrenceSummary}`
                  : `Duration: ${durationInfo.label}`}
              </span>
            </div>

            <RecurrenceEditor
              recurrence={recurrence}
              onChange={setRecurrence}
              startAt={startAt}
              endAt={endAt}
              allDay={allDay}
            />

            <div className="rounded-xl border border-[#EDEDF2] bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-900/40">
              <input
                type="checkbox"
                name="allDay"
                checked={allDay}
                readOnly
                className="sr-only"
                aria-hidden="true"
                tabIndex={-1}
              />
              <ToggleSwitch
                id="create-allday-switch"
                checked={allDay}
                onChange={setAllDay}
                title="All-day activity"
                description="Mark this as a full-day item on the club calendar."
              />
            </div>
          </section>

          {/* CARD 3: COMMITTEE TEAM & INITIAL TASKS */}
          <section
            id="create-section-team"
            className="scroll-mt-6 space-y-5 rounded-2xl border border-[#EDEDF2] bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-[#161B26] sm:p-6"
          >
            <FormSectionTitle
              stepNumber="3"
              title="Organizing Committee & Initial Tasks"
              subtitle="Appoint your team leads and optionally set up initial deliverables right away."
            />

            {/* Committee Builder */}
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="flex items-center gap-1.5 text-xs font-bold text-[#111625] dark:text-white">
                    <Users className="h-4 w-4 text-[#0D3594] dark:text-blue-400" />
                    Project Committee &amp; Team ({committeeMembers.length})
                  </h3>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Appointed members unlock project tabs immediately and receive an invite notification.
                  </p>
                </div>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-[1fr_150px]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="search"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Search club members by name or role..."
                    aria-label="Search club members for committee"
                    className={`${inputClass} pl-9`}
                  />
                </div>
                <select
                  aria-label="Committee member role"
                  value={selectedRole}
                  onChange={(e) =>
                    setSelectedRole(
                      e.target.value as
                        | "COMMITTEE"
                        | "CO_CHAIR"
                        | "VOLUNTEER",
                    )
                  }
                  className={inputClass}
                >
                  <option value="COMMITTEE">Committee</option>
                  <option value="CO_CHAIR">Co-Chair</option>
                  <option value="VOLUNTEER">Volunteer</option>
                </select>
              </div>

              {memberSearch.trim().length > 0 ? (
                filteredQuickMembers.length > 0 ? (
                  <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900">
                    {filteredQuickMembers.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between gap-3 px-3 py-2"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Avatar
                            name={m.fullName}
                            url={m.avatarUrl}
                            size={28}
                          />
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                              {m.fullName}
                            </p>
                            {m.role && (
                              <p className="truncate text-[11px] text-slate-500">
                                {formatRoleLabel(m.role)}
                              </p>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          aria-label={`Add ${m.fullName} to committee`}
                          onClick={() => addCommitteeMember(m.id, selectedRole)}
                          className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg bg-[#0D3594] px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#092569]"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900">
                    No matching members found for &ldquo;{memberSearch}&rdquo;.
                  </p>
                )
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <select
                    aria-label="Select a member or officer to appoint"
                    value={selectedMemberId}
                    onChange={(e) => setSelectedMemberId(e.target.value)}
                    className={`flex-1 ${inputClass}`}
                  >
                    <option value="">
                      {availableMembers.length === 0
                        ? "All club members are appointed"
                        : "Select a member or officer to appoint..."}
                    </option>
                    {availableMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName}{" "}
                        {m.role ? `(${formatRoleLabel(m.role)})` : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!selectedMemberId}
                    onClick={() => addCommitteeMember()}
                    className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-[#0D3594] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#092569] disabled:opacity-45"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Member
                  </button>
                </div>
              )}

              {committeeMembers.length > 0 && (
                <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900">
                  {committeeMembers.map((cm) => {
                    const member = members.find((m) => m.id === cm.profileId);
                    const displayName = member?.fullName || "Club Member";
                    return (
                      <div
                        key={cm.profileId}
                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Avatar
                            name={displayName}
                            url={member?.avatarUrl}
                            size={28}
                          />
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-[#111625] dark:text-white">
                              {displayName}
                            </p>
                            {member?.role && (
                              <p className="truncate text-[10px] text-slate-500">
                                {formatRoleLabel(member.role)}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            aria-label={`Role for ${displayName}`}
                            value={cm.role}
                            onChange={(e) =>
                              updateCommitteeMemberRole(
                                cm.profileId,
                                e.target.value as
                                  | "COMMITTEE"
                                  | "CO_CHAIR"
                                  | "VOLUNTEER",
                              )
                            }
                            className="rounded-lg border border-[#DDE1EA] bg-white px-2.5 py-1 text-xs font-medium text-slate-700 outline-none focus:border-[#0D3594] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          >
                            <option value="COMMITTEE">Committee</option>
                            <option value="CO_CHAIR">Co-Chair</option>
                            <option value="VOLUNTEER">Volunteer</option>
                          </select>
                          <button
                            type="button"
                            aria-label={`Remove ${displayName}`}
                            onClick={() => removeCommitteeMember(cm.profileId)}
                            className="cursor-pointer rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
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

            {/* Clean 2-Row Action Items / Initial Tasks Builder */}
            <div className="space-y-3 rounded-xl border border-blue-200/70 bg-blue-50/30 p-4 dark:border-blue-500/20 dark:bg-blue-950/15">
              <div>
                <h3 className="flex items-center gap-1.5 text-xs font-bold text-[#111625] dark:text-white">
                  <CheckSquare className="h-4 w-4 text-[#0D3594] dark:text-blue-400" />
                  Action Items &amp; Tasks to Assign (Optional ·{" "}
                  {initialTasks.length})
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Add preparation deliverables or meeting action items now (you can also manage tasks later).
                </p>
              </div>

              <div className="space-y-2.5">
                <input
                  type="text"
                  value={draftTaskTitle}
                  onChange={(e) => setDraftTaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addInitialTask();
                    }
                  }}
                  placeholder="Task title (e.g. Prepare L&D slide deck & materials)"
                  className={inputClass}
                />
                <div className="grid gap-2 sm:grid-cols-[140px_120px_1fr_auto]">
                  <input
                    type="date"
                    aria-label="Task due date"
                    value={draftTaskDue}
                    onChange={(e) => setDraftTaskDue(e.target.value)}
                    className={inputClass}
                  />
                  <select
                    aria-label="Task priority"
                    value={draftTaskPriority}
                    onChange={(e) =>
                      setDraftTaskPriority(
                        e.target.value as
                          | "LOW"
                          | "MEDIUM"
                          | "HIGH"
                          | "URGENT",
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
                    aria-label="Task assignee"
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
                    className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-1 rounded-lg bg-[#0D3594] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#092569] disabled:opacity-45"
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
              </div>

              {initialTasks.length > 0 && (
                <div className="space-y-1.5 border-t border-blue-100 pt-2.5 dark:border-slate-800">
                  {initialTasks.map((task, idx) => {
                    const assignee = members.find(
                      (m) => m.id === task.assigneeId,
                    );
                    const pChip =
                      ACTIVITY_PRIORITY_META[
                        task.priority as ActivityPriority
                      ]?.chipClass || "";
                    return (
                      <div
                        key={task.id || `${task.title}-${idx}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="shrink-0 text-[10px] font-bold text-[#0D3594] dark:text-blue-400">
                              #{idx + 1}
                            </span>
                            <span className="truncate font-semibold text-[#111625] dark:text-white">
                              {task.title}
                            </span>
                            <span
                              className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold ${pChip}`}
                            >
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
                            className="cursor-pointer rounded p-0.5 text-slate-400 hover:text-[#0D3594] disabled:opacity-30"
                            aria-label="Move task up"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === initialTasks.length - 1}
                            onClick={() => moveInitialTask(idx, 1)}
                            className="cursor-pointer rounded p-0.5 text-slate-400 hover:text-[#0D3594] disabled:opacity-30"
                            aria-label="Move task down"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeInitialTask(idx)}
                            className="cursor-pointer rounded p-0.5 text-slate-400 hover:text-rose-600"
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
          </section>

          {/* CARD 4: IMPACT GOALS, ALIGNMENT & PARTNERSHIPS (PROJECTS ONLY) */}
          {meta.isProject && (
            <section
              id="create-section-impact"
              className="scroll-mt-6 space-y-5 rounded-2xl border border-emerald-200/80 bg-white p-5 shadow-2xs dark:border-emerald-500/25 dark:bg-[#161B26] sm:p-6"
            >
              <FormSectionTitle
                stepNumber="4"
                title="Impact Goals, Alignment & Partnerships"
                subtitle="Starts your Rotary Showcase accomplishment record and links collaborating clubs."
              />

              <Field
                label="Objective"
                hint="What measurable change will this project create?"
              >
                <textarea
                  name="objective"
                  rows={2}
                  maxLength={2000}
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  placeholder="Describe the core community impact goal..."
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
                    placeholder="e.g. Elementary students, families"
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
                <Field label="Funding target (PHP)">
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-2 text-sm font-semibold text-slate-400">
                      ₱
                    </span>
                    <input
                      name="fundingTarget"
                      type="number"
                      min="0"
                      step="0.01"
                      value={fundingTarget}
                      onChange={(e) =>
                        setFundingTarget(Number(e.target.value || 0))
                      }
                      className={`${inputClass} pl-7`}
                    />
                  </div>
                </Field>
                <Field label="Funding source">
                  <input
                    name="fundingSource"
                    maxLength={300}
                    value={fundingSource}
                    onChange={(e) => setFundingSource(e.target.value)}
                    placeholder="Club treasury, grant, or sponsor"
                    className={inputClass}
                  />
                </Field>
              </div>

              {/* Rotary Areas of Focus */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Rotary Areas of Focus
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {areasOfFocus.length} selected
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {AREAS_OF_FOCUS.map((area) => {
                    const checked = areasOfFocus.includes(area.code);
                    return (
                      <label
                        key={area.code}
                        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                          checked
                            ? "border-emerald-500 bg-emerald-50 text-emerald-900 dark:border-emerald-500/60 dark:bg-emerald-950/40 dark:text-emerald-200"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          name="areasOfFocus"
                          value={area.code}
                          checked={checked}
                          onChange={(e) =>
                            setAreasOfFocus((prev) =>
                              e.target.checked
                                ? [...prev, area.code]
                                : prev.filter((c) => c !== area.code),
                            )
                          }
                          className="sr-only"
                        />
                        {checked && (
                          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        )}
                        <span>{area.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Expandable UN Sustainable Development Goals */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-900/40">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                      UN Sustainable Development Goals (SDGs)
                    </span>
                    <p className="text-[11px] text-slate-500">
                      {sdgs.length === 0
                        ? "Optional alignment for District & Rotary Showcase reporting"
                        : `${sdgs.length} SDG${sdgs.length === 1 ? "" : "s"} selected`}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-expanded={sdgsExpanded}
                    onClick={() => setSdgsExpanded((prev) => !prev)}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    {sdgsExpanded ? (
                      <>
                        Hide SDGs <ChevronUp className="h-3.5 w-3.5" />
                      </>
                    ) : (
                      <>
                        Select SDGs (17) <ChevronDown className="h-3.5 w-3.5" />
                      </>
                    )}
                  </button>
                </div>

                {!sdgsExpanded && sdgs.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {sdgs.map((goalNum) => (
                      <span
                        key={goalNum}
                        className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
                      >
                        SDG {goalNum}: {SDGS[goalNum - 1]}
                      </span>
                    ))}
                  </div>
                )}

                {!sdgsExpanded ? (
                  sdgs.map((goalNum) => (
                    <input
                      key={`sdg-hidden-${goalNum}`}
                      type="hidden"
                      name="sdgs"
                      value={goalNum}
                    />
                  ))
                ) : (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {SDGS.map((goal, index) => {
                      const goalNum = index + 1;
                      const checked = sdgs.includes(goalNum);
                      return (
                        <label
                          key={goal}
                          className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-xs transition ${
                            checked
                              ? "border-emerald-400 bg-emerald-50/70 text-emerald-950 dark:border-emerald-500/50 dark:bg-emerald-950/30 dark:text-emerald-200"
                              : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                          }`}
                        >
                          <input
                            type="checkbox"
                            name="sdgs"
                            value={goalNum}
                            checked={checked}
                            onChange={(e) =>
                              setSdgs((prev) =>
                                e.target.checked
                                  ? [...prev, goalNum]
                                  : prev.filter((n) => n !== goalNum),
                              )
                            }
                            className="mt-0.5 accent-emerald-600"
                          />
                          <span>
                            {goalNum}. {goal}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Partnerships & Links Card */}
              <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                <Field
                  label="Partnerships (Sister / Partner Clubs)"
                  required={kind === "JOINT_PROJECT"}
                  hint={
                    kind === "JOINT_PROJECT"
                      ? "Select one or more sister or partner clubs co-implementing this project."
                      : "Optionally link any sister or partner clubs collaborating on this activity."
                  }
                >
                  {selectedPartnerClubs.length > 0 && (
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
                          <span className="min-w-0 break-words font-medium">
                            {partner.name}
                          </span>
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
                            className="shrink-0 cursor-pointer rounded p-1 text-emerald-800 hover:bg-emerald-100 focus-visible:ring-2 focus-visible:ring-emerald-600 dark:text-emerald-200 dark:hover:bg-emerald-900"
                          >
                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <select
                    aria-label="Add partnership"
                    value={selectedPartnerDropdown}
                    disabled={
                      partnerClubs.filter(
                        (c) => !selectedPartnerIds.includes(c.id),
                      ).length === 0
                    }
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
                      {partnerClubs.filter(
                        (c) => !selectedPartnerIds.includes(c.id),
                      ).length === 0
                        ? partnerClubs.length === 0
                          ? "No partner clubs registered yet"
                          : "All available partner clubs added"
                        : selectedPartnerIds.length === 0
                          ? "+ Select a sister or partner club..."
                          : `+ Add another partner club (${
                              partnerClubs.filter(
                                (c) => !selectedPartnerIds.includes(c.id),
                              ).length
                            } remaining)...`}
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
                      className="mt-2 inline-flex text-xs font-semibold text-[#0D3594] hover:underline dark:text-blue-300"
                    >
                      Register a partner club first
                    </Link>
                  )}
                </Field>

                <Field
                  label="Additional partner organizations"
                  hint="External non-Rotary partners, NGOs, LGUs, or corporate co-organizers."
                >
                  <div className="flex gap-2">
                    <input
                      name="partnerName"
                      maxLength={200}
                      value={externalPartnerNameInput}
                      onChange={(e) =>
                        setExternalPartnerNameInput(e.target.value)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addExtraExternalPartner();
                        }
                      }}
                      placeholder="Partner organization name"
                      className={`${inputClass} flex-1`}
                    />
                    <input
                      type="hidden"
                      name="partnerRole"
                      value="IMPLEMENTING_PARTNER"
                    />
                    <button
                      type="button"
                      disabled={!externalPartnerNameInput.trim()}
                      onClick={addExtraExternalPartner}
                      className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add
                    </button>
                  </div>
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
                          className="cursor-pointer text-slate-400 hover:text-rose-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {relatedLinks.length > 0 && (
                  <div className="space-y-1.5 rounded-lg border border-emerald-200/80 bg-white p-3 dark:border-emerald-500/20 dark:bg-slate-900/50">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
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
                            className="inline-flex items-center gap-1 truncate text-[#0D3594] hover:underline dark:text-blue-300"
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
                            className="shrink-0 cursor-pointer text-slate-400 hover:text-rose-600"
                            aria-label="Remove attached link"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* CARD 5: PARTICIPATION, RSVP & CHECK-IN */}
          <section
            id="create-section-participation"
            className="scroll-mt-6 space-y-4 rounded-2xl border border-[#EDEDF2] bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-[#161B26] sm:p-6"
          >
            <FormSectionTitle
              stepNumber={meta.isProject ? "5" : "4"}
              title="Participation, RSVP & Check-In"
              subtitle="Control member registration, QR attendance scanning, and volunteer hour defaults."
            />

            <div className="space-y-3">
              <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-900/40">
                <ToggleSwitch
                  id="create-qr-switch"
                  title="Enable QR Attendance Check-In"
                  description="Generate dynamic rolling QR codes for members to scan on-site."
                  icon={
                    <QrCode className="h-3.5 w-3.5 text-[#0D3594] dark:text-blue-400" />
                  }
                  checked={qrCheckIn}
                  onChange={setQrCheckIn}
                />
                {!qrCheckIn ? (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-medium text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
                    QR check-in disabled — ideal for promotional campaigns, online task sprints, or non-assembly work.
                  </p>
                ) : (
                  <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-medium text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
                    QR check-in enabled — Officers can generate live scanning codes from the Attendance tab.
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Capacity"
                  hint="Leave blank for unlimited capacity."
                >
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

              <div className="space-y-3 rounded-xl border border-[#EDEDF2] p-3.5 dark:border-slate-800">
                <ToggleSwitch
                  id="create-rsvp-switch"
                  title="Allow members to RSVP"
                  description="Members can respond Going, Maybe or Can't go."
                  checked={rsvpEnabled}
                  onChange={setRsvpEnabled}
                />
                {rsvpEnabled && (
                  <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
                    <Field label="RSVP deadline (Optional)">
                      <input
                        name="rsvpDeadline"
                        type="datetime-local"
                        className={`${inputClass} max-w-sm`}
                      />
                    </Field>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-[#EDEDF2] p-3.5 dark:border-slate-800">
                <ToggleSwitch
                  id="create-self-checkin-switch"
                  title="Allow 'Check in as me'"
                  description="Members can check themselves in during the activity check-in window."
                  checked={selfCheckIn}
                  onChange={setSelfCheckIn}
                />
              </div>

              <div className="space-y-3 rounded-xl border border-[#EDEDF2] p-3.5 dark:border-slate-800">
                <ToggleSwitch
                  id="create-min-members-switch"
                  title="Set a minimum number of members"
                  description="Track confirmed RSVPs against a required quorum or headcount."
                  checked={minEnabled}
                  onChange={setMinEnabled}
                />
                {minEnabled && (
                  <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
                    <input
                      name="minMembersRequired"
                      type="number"
                      required
                      min="1"
                      max="100000"
                      placeholder="Minimum members required"
                      className={`${inputClass} max-w-48`}
                    />
                  </div>
                )}
              </div>

              <Field
                label="Check-in window after start"
                hint="Set to 'Until activity ends' to allow check-ins throughout the event."
              >
                <select
                  name="checkInWindowMinutes"
                  defaultValue="180"
                  className={`${inputClass} max-w-xs`}
                >
                  <option value="0">Until activity ends</option>
                  <option value="60">1 hour</option>
                  <option value="180">3 hours</option>
                  <option value="360">6 hours</option>
                  <option value="720">12 hours</option>
                </select>
              </Field>
            </div>
          </section>

          {/* Bottom Form Action Bar */}
          <footer className="flex flex-col-reverse justify-between gap-3 rounded-2xl border border-[#EDEDF2] bg-white px-5 py-4 shadow-2xs dark:border-slate-800 dark:bg-[#161B26] sm:flex-row sm:items-center">
            <Link
              href="/project-center"
              className="text-center text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400"
            >
              Cancel
            </Link>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={(event) => {
                  const form = event.currentTarget.form;
                  if (form?.reportValidity()) submit(form, true);
                }}
                className="cursor-pointer rounded-xl border border-[#DDE1EA] px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Save draft
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#0D3594] px-5 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#092569] disabled:opacity-60"
              >
                {isPending
                  ? "Creating..."
                  : meta.isProject
                    ? "Create project"
                    : "Create activity"}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </footer>
        </form>

        {/* RIGHT COLUMN: STICKY LIVE PREVIEW & READINESS RAIL */}
        <aside className="hidden space-y-4 lg:sticky lg:top-6 lg:block">
          {/* Live Card Preview */}
          <div className="overflow-hidden rounded-2xl border border-[#EDEDF2] bg-white shadow-2xs dark:border-slate-800 dark:bg-[#161B26]">
            <div className={`h-1.5 w-full ${meta.dotClass}`} />
            <div className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Live Card Preview
                </span>
                <PriorityBadge priority={priority} />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <KindBadge kind={kind} meetingType={meetingType} />
                {committee && (
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {formatCommitteeLabel(committee)}
                  </span>
                )}
              </div>

              <div>
                <h2 className="text-sm font-bold leading-snug text-[#111625] dark:text-white">
                  {title.trim() || `Untitled ${meta.label}`}
                </h2>
                <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                  {shortDescription.trim() ||
                    "Your one-line summary will appear here on dashboards and calendars."}
                </p>
              </div>

              <div className="space-y-1.5 border-t border-slate-100 pt-3 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0 text-[#0D3594] dark:text-blue-400" />
                  <span className="truncate">{formatPreviewDate(startAt)}</span>
                </div>
                {recurrenceSummary && (
                  <div className="flex items-center gap-1.5 text-[#0D3594] dark:text-blue-300">
                    <Repeat className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate font-semibold">
                      {recurrenceSummary}
                    </span>
                  </div>
                )}
                {location.trim() && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">{location.trim()}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1 text-[10px] font-semibold">
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {committeeMembers.length} committee
                </span>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {initialTasks.length} initial tasks
                </span>
                {meta.isProject && selectedPartnerClubs.length > 0 && (
                  <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    {selectedPartnerClubs.length} partner club
                    {selectedPartnerClubs.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Section Jump Links & Readiness */}
          <div className="space-y-3 rounded-2xl border border-[#EDEDF2] bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-[#161B26]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Setup Readiness
            </h3>
            <nav aria-label="Form sections" className="space-y-1.5">
              {[
                {
                  href: "#create-section-basics",
                  label: "Core Details & Priority",
                  done: titleReady,
                  hint: titleReady ? "Title ready" : "Add title (min 3 chars)",
                },
                {
                  href: "#create-section-schedule",
                  label: "Schedule & Timing",
                  done: scheduleReady,
                  hint: scheduleReady ? durationInfo.label : "Check dates",
                },
                {
                  href: "#create-section-team",
                  label: "Committee & Tasks",
                  done:
                    committeeMembers.length > 0 || initialTasks.length > 0,
                  hint: `${committeeMembers.length} leads · ${initialTasks.length} tasks`,
                },
                ...(meta.isProject
                  ? [
                      {
                        href: "#create-section-impact",
                        label: "Impact & Partnerships",
                        done: partnerReady && Boolean(objective.trim()),
                        hint:
                          kind === "JOINT_PROJECT" && !partnerReady
                            ? "Partner club required"
                            : objective.trim()
                              ? "Goal configured"
                              : "Optional details",
                      },
                    ]
                  : []),
                {
                  href: "#create-section-participation",
                  label: "RSVP & Check-In",
                  done: true,
                  hint: qrCheckIn ? "QR enabled" : "QR off",
                },
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="flex items-start justify-between gap-2 rounded-lg px-2.5 py-2 text-xs transition hover:bg-slate-50 dark:hover:bg-slate-800/70"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-[#111625] dark:text-white">
                      {item.label}
                    </p>
                    <p className="truncate text-[10px] text-slate-500">
                      {item.hint}
                    </p>
                  </div>
                  <span
                    className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                      item.done
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                        : "border border-slate-300 dark:border-slate-700"
                    }`}
                  >
                    {item.done && <Check className="h-2.5 w-2.5" />}
                  </span>
                </a>
              ))}
            </nav>
          </div>

          {/* Sticky Quick Actions */}
          <div className="space-y-2 rounded-2xl border border-[#EDEDF2] bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-[#161B26]">
            <button
              type="submit"
              form="create-activity-form"
              disabled={isPending}
              className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#0D3594] px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#092569] disabled:opacity-60"
            >
              {isPending
                ? "Creating..."
                : meta.isProject
                  ? "Create Project"
                  : "Create Activity"}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                const form = formRef.current;
                if (form?.reportValidity()) submit(form, true);
              }}
              className="w-full cursor-pointer rounded-xl border border-[#DDE1EA] px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Save as Draft
            </button>
            <Link
              href="/project-center"
              className="block pt-1 text-center text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400"
            >
              Cancel &amp; return
            </Link>
          </div>
        </aside>
      </div>
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
        {required && <span className="ml-0.5 font-bold text-rose-500">*</span>}
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
  stepNumber,
  title,
  subtitle,
}: {
  stepNumber?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-[#EDEDF2] pb-3 dark:border-slate-800">
      {stepNumber && (
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#0D3594]/10 text-xs font-bold text-[#0D3594] dark:bg-blue-500/20 dark:text-blue-300">
          {stepNumber}
        </span>
      )}
      <div>
        <h2 className="text-sm font-bold text-[#111625] dark:text-white">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

function ToggleSwitch({
  id,
  title,
  description,
  icon,
  checked,
  onChange,
}: {
  id: string;
  title: string;
  description: string;
  icon?: React.ReactNode;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        <label
          htmlFor={id}
          className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100"
        >
          {icon}
          <span>{title}</span>
        </label>
        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
          {description}
        </p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-[#0D3594]/30 ${
          checked ? "bg-[#0D3594]" : "bg-slate-200 dark:bg-slate-700"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-sm transition duration-150 ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
