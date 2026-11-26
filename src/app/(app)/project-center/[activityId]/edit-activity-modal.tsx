"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Crown,
  FileText,
  HeartHandshake,
  MapPin,
  Plus,
  QrCode,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { updateActivityAction } from "@/features/activities/actions";
import {
  ACTIVITY_PRIORITIES,
  ACTIVITY_PRIORITY_META,
  COMMITTEES,
  isProjectKind,
  type ActivityDetailDTO,
  type ActivityPriority,
  type Committee,
  type TeamRole,
} from "@/features/activities/types";
import type { MemberDTO } from "@/features/members/queries";
import { isoToManilaLocal } from "@/lib/utils/dates";
import { notifyToast } from "@/components/shared/toast-viewport";
import { Avatar } from "../_components/badges";
import type { PartnerClubOption } from "./activity-detail-client";

export type EditModalSection =
  | "BASICS"
  | "TEAM"
  | "SCHEDULE"
  | "GOALS"
  | "ATTENDANCE";

type AppointableRole = "COMMITTEE" | "CO_CHAIR" | "VOLUNTEER";

interface EditableCommitteeMember {
  profileId: string;
  role: AppointableRole;
}

interface EditActivityModalProps {
  activity: ActivityDetailDTO;
  members: MemberDTO[];
  partnerClubs?: PartnerClubOption[];
  canReassignOwner: boolean;
  isOpen: boolean;
  initialSection?: EditModalSection;
  onClose: () => void;
  onSaved: () => void;
}

const inputClass =
  "mt-1.5 block w-full rounded-lg border border-[#DDE1EA] bg-white px-3 py-2 text-sm font-normal text-[#111625] outline-none focus:border-[#0D3594] focus:ring-2 focus:ring-[#0D3594]/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white";

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

function ToggleSwitch({
  id,
  checked,
  onChange,
  label,
  description,
  icon,
}: {
  id: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        <label
          htmlFor={id}
          className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-white"
        >
          {icon}
          <span>{label}</span>
        </label>
        {description && (
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            {description}
          </p>
        )}
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

export function EditActivityModal({
  activity,
  members,
  partnerClubs = [],
  canReassignOwner,
  isOpen,
  initialSection = "BASICS",
  onClose,
  onSaved,
}: EditActivityModalProps) {
  const isProject = isProjectKind(activity.kind);

  // Active tab section
  const [section, setSection] = useState<EditModalSection>(
    initialSection === "GOALS" && !isProject ? "BASICS" : initialSection,
  );

  // Section 1: Basics
  const [title, setTitle] = useState(activity.title);
  const [shortDescription, setShortDescription] = useState(
    activity.shortDescription || "",
  );
  const [description, setDescription] = useState(activity.description || "");
  const [location, setLocation] = useState(activity.location || "");
  const [priority, setPriority] = useState<ActivityPriority>(
    activity.priority ?? "MEDIUM",
  );
  const [committee, setCommittee] = useState<string>(activity.committee || "");

  // Section 2: Leadership & Committee Team
  const [ownerId, setOwnerId] = useState(activity.ownerId || "");
  const [committeeMembers, setCommitteeMembers] = useState<
    EditableCommitteeMember[]
  >(() =>
    (activity.team || [])
      .filter((t) => t.profileId !== (activity.ownerId || ""))
      .map((t) => ({
        profileId: t.profileId,
        role:
          t.role === "CO_CHAIR" || t.role === "VOLUNTEER"
            ? t.role
            : "COMMITTEE",
      })),
  );
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [selectedTeamRole, setSelectedTeamRole] =
    useState<AppointableRole>("COMMITTEE");

  // Section 3: Schedule
  const [startAt, setStartAt] = useState(() =>
    isoToManilaLocal(activity.startAt),
  );
  const [endAt, setEndAt] = useState(() => isoToManilaLocal(activity.endAt));
  const [allDay, setAllDay] = useState(Boolean(activity.allDay));

  // Section 4: Project Goals & Partnerships
  const [objective, setObjective] = useState(
    activity.projectDetails?.objective || "",
  );
  const [beneficiaryType, setBeneficiaryType] = useState(
    activity.projectDetails?.beneficiaryType || "",
  );
  const [beneficiaryTarget, setBeneficiaryTarget] = useState(
    String(activity.projectDetails?.beneficiaryCount ?? 0),
  );
  const [fundingTarget, setFundingTarget] = useState(
    String(activity.projectDetails?.fundingTotal ?? 0),
  );
  const [fundingSource, setFundingSource] = useState(
    activity.projectDetails?.fundingSource || "",
  );

  const [selectedPartnerIds, setSelectedPartnerIds] = useState<string[]>(() => {
    const existingPartners = activity.projectDetails?.partners || [];
    const matchedIds: string[] = [];
    for (const p of existingPartners) {
      const match =
        (p.sisterClubId &&
          partnerClubs.find((club) => club.id === p.sisterClubId)) ||
        partnerClubs.find(
          (club) =>
            club.name.trim().toLowerCase() === p.name.trim().toLowerCase(),
        );
      if (match && !matchedIds.includes(match.id)) {
        matchedIds.push(match.id);
      }
    }
    return matchedIds;
  });
  const [selectedPartnerDropdown, setSelectedPartnerDropdown] = useState("");
  const [customPartners, setCustomPartners] = useState<string[]>(() => {
    const existingPartners = activity.projectDetails?.partners || [];
    return existingPartners
      .filter((p) => {
        const matchedClub =
          (p.sisterClubId &&
            partnerClubs.some((club) => club.id === p.sisterClubId)) ||
          partnerClubs.some(
            (club) =>
              club.name.trim().toLowerCase() === p.name.trim().toLowerCase(),
          );
        return !matchedClub && p.name.trim().length > 0;
      })
      .map((p) => p.name.trim());
  });
  const [customPartnerInput, setCustomPartnerInput] = useState("");

  // Section 5: Attendance
  const [capacity, setCapacity] = useState(
    activity.capacity ? String(activity.capacity) : "",
  );
  const [minMembersEnabled, setMinMembersEnabled] = useState(
    Boolean(activity.minMembersRequired),
  );
  const [minMembersRequired, setMinMembersRequired] = useState(
    activity.minMembersRequired ? String(activity.minMembersRequired) : "",
  );
  const [rsvpEnabled, setRsvpEnabled] = useState(Boolean(activity.rsvpEnabled));
  const [rsvpDeadline, setRsvpDeadline] = useState(() =>
    activity.rsvpDeadline ? isoToManilaLocal(activity.rsvpDeadline) : "",
  );
  const [volunteerHoursDefault, setVolunteerHoursDefault] = useState(
    String(activity.volunteerHoursDefault ?? 0),
  );
  const [qrCheckInEnabled, setQrCheckInEnabled] = useState(
    activity.qrCheckInEnabled ?? true,
  );
  const [selfCheckInEnabled, setSelfCheckInEnabled] = useState(
    Boolean(activity.selfCheckInEnabled),
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSection(
      initialSection === "GOALS" && !isProject ? "BASICS" : initialSection,
    );
  }, [initialSection, isOpen, isProject]);

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose, saving]);

  const initialSnapshot = useMemo(
    () =>
      JSON.stringify({
        title: activity.title,
        shortDescription: activity.shortDescription || "",
        description: activity.description || "",
        location: activity.location || "",
        priority: activity.priority ?? "MEDIUM",
        committee: activity.committee || "",
        ownerId: activity.ownerId || "",
        committeeMembers: (activity.team || [])
          .filter((t) => t.profileId !== (activity.ownerId || ""))
          .map((t) => ({
            profileId: t.profileId,
            role:
              t.role === "CO_CHAIR" || t.role === "VOLUNTEER"
                ? t.role
                : "COMMITTEE",
          })),
        startAt: isoToManilaLocal(activity.startAt),
        endAt: isoToManilaLocal(activity.endAt),
        allDay: Boolean(activity.allDay),
        objective: activity.projectDetails?.objective || "",
        beneficiaryType: activity.projectDetails?.beneficiaryType || "",
        beneficiaryTarget: String(
          activity.projectDetails?.beneficiaryCount ?? 0,
        ),
        fundingTarget: String(activity.projectDetails?.fundingTotal ?? 0),
        fundingSource: activity.projectDetails?.fundingSource || "",
        capacity: activity.capacity ? String(activity.capacity) : "",
        minMembersEnabled: Boolean(activity.minMembersRequired),
        minMembersRequired: activity.minMembersRequired
          ? String(activity.minMembersRequired)
          : "",
        rsvpEnabled: Boolean(activity.rsvpEnabled),
        rsvpDeadline: activity.rsvpDeadline
          ? isoToManilaLocal(activity.rsvpDeadline)
          : "",
        volunteerHoursDefault: String(activity.volunteerHoursDefault ?? 0),
        qrCheckInEnabled: activity.qrCheckInEnabled ?? true,
        selfCheckInEnabled: Boolean(activity.selfCheckInEnabled),
      }),
    [activity],
  );

  const currentSnapshot = JSON.stringify({
    title,
    shortDescription,
    description,
    location,
    priority,
    committee,
    ownerId,
    committeeMembers,
    startAt,
    endAt,
    allDay,
    objective,
    beneficiaryType,
    beneficiaryTarget,
    fundingTarget,
    fundingSource,
    capacity,
    minMembersEnabled,
    minMembersRequired,
    rsvpEnabled,
    rsvpDeadline,
    volunteerHoursDefault,
    qrCheckInEnabled,
    selfCheckInEnabled,
  });

  const isDirty = currentSnapshot !== initialSnapshot;

  const memberLookup = useMemo(() => {
    const map = new Map<
      string,
      { name: string; email?: string; clubRole?: string; avatarUrl: string | null }
    >();
    for (const m of members) {
      map.set(m.id, {
        name: m.name,
        email: m.email,
        clubRole: m.role,
        avatarUrl: m.avatarUrl || null,
      });
    }
    for (const t of activity.team || []) {
      const existing = map.get(t.profileId);
      map.set(t.profileId, {
        name: existing?.name || t.fullName,
        email: existing?.email,
        clubRole: existing?.clubRole,
        avatarUrl: existing?.avatarUrl || t.avatarUrl || null,
      });
    }
    return map;
  }, [activity.team, members]);

  const ownerInfo = useMemo(() => {
    if (!ownerId) {
      return {
        name: activity.ownerName || "Unassigned Chair",
        email: undefined,
        avatarUrl: null,
      };
    }
    return (
      memberLookup.get(ownerId) || {
        name: activity.ownerName || "Project Chair",
        email: undefined,
        avatarUrl: null,
      }
    );
  }, [activity.ownerName, memberLookup, ownerId]);

  const availableMembers = useMemo(() => {
    const assignedIds = new Set<string>([
      ...(ownerId ? [ownerId] : []),
      ...committeeMembers.map((cm) => cm.profileId),
    ]);
    return members.filter((m) => !assignedIds.has(m.id));
  }, [committeeMembers, members, ownerId]);

  const filteredQuickMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return [];
    return availableMembers
      .filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          (m.role && m.role.toLowerCase().includes(q)),
      )
      .slice(0, 6);
  }, [availableMembers, memberSearch]);

  const selectedPartnerClubs = selectedPartnerIds.flatMap((id) => {
    const club = partnerClubs.find((c) => c.id === id);
    return club ? [club] : [];
  });

  const durationInfo = useMemo(
    () => computeDurationLabel(startAt, endAt, allDay),
    [allDay, endAt, startAt],
  );

  const visibleTabs: {
    id: EditModalSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number | string;
  }[] = useMemo(() => {
    const totalTeamCount = committeeMembers.length + (ownerId ? 1 : 0);
    const totalPartnerCount = selectedPartnerIds.length + customPartners.length;
    const base: {
      id: EditModalSection;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      badge?: number | string;
    }[] = [
      { id: "BASICS", label: "Basics", icon: FileText },
      {
        id: "TEAM",
        label: "Committee & Team",
        icon: Users,
        badge: totalTeamCount,
      },
      { id: "SCHEDULE", label: "Schedule", icon: CalendarDays },
      ...(isProject
        ? [
            {
              id: "GOALS" as const,
              label: "Goals & Partners",
              icon: ShieldCheck,
              badge: totalPartnerCount > 0 ? totalPartnerCount : undefined,
            },
          ]
        : []),
      { id: "ATTENDANCE", label: "Attendance", icon: QrCode },
    ];
    return base;
  }, [
    committeeMembers.length,
    customPartners.length,
    isProject,
    ownerId,
    selectedPartnerIds.length,
  ]);

  if (!isOpen) return null;

  const currentTabIndex = visibleTabs.findIndex((t) => t.id === section);

  function addCommitteeMember(profileId: string, role = selectedTeamRole) {
    if (!profileId || profileId === ownerId) return;
    setCommitteeMembers((prev) => {
      if (prev.some((cm) => cm.profileId === profileId)) return prev;
      return [...prev, { profileId, role }];
    });
    setSelectedMemberId("");
    setMemberSearch("");
  }

  function updateCommitteeMemberRole(
    profileId: string,
    role: AppointableRole,
  ) {
    setCommitteeMembers((prev) =>
      prev.map((cm) =>
        cm.profileId === profileId ? { ...cm, role } : cm,
      ),
    );
  }

  function removeCommitteeMember(profileId: string) {
    setCommitteeMembers((prev) =>
      prev.filter((cm) => cm.profileId !== profileId),
    );
  }

  function handleOwnerChange(nextOwnerId: string) {
    setOwnerId(nextOwnerId);
    if (nextOwnerId) {
      setCommitteeMembers((prev) =>
        prev.filter((cm) => cm.profileId !== nextOwnerId),
      );
    }
  }

  function handleAddCustomPartner() {
    const trimmed = customPartnerInput.trim();
    if (!trimmed) return;
    if (
      !customPartners.some(
        (existing) => existing.toLowerCase() === trimmed.toLowerCase(),
      )
    ) {
      setCustomPartners((prev) => [...prev, trimmed]);
    }
    setCustomPartnerInput("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim() || title.trim().length < 3) {
      setSection("BASICS");
      setError("Title must be at least 3 characters.");
      return;
    }
    if (!startAt || !endAt) {
      setSection("SCHEDULE");
      setError("Please specify valid start and end dates.");
      return;
    }
    if (endAt < startAt) {
      setSection("SCHEDULE");
      setError("End date and time must be after the start date and time.");
      return;
    }

    const filteredCommitteeMembers = committeeMembers
      .filter((cm) => cm.profileId !== ownerId)
      .map((cm) => ({
        profileId: cm.profileId,
        role: cm.role as TeamRole,
      }));

    const basePayload = {
      clubId: activity.clubId,
      ownerId: ownerId || undefined,
      title: title.trim(),
      shortDescription: shortDescription.trim(),
      description: description.trim(),
      location: location.trim(),
      startAt,
      endAt,
      allDay,
      priority,
      committee: committee ? (committee as Committee) : undefined,
      status: activity.status,
      minMembersEnabled,
      minMembersRequired:
        minMembersEnabled && minMembersRequired
          ? Number(minMembersRequired)
          : undefined,
      capacity: capacity ? Number(capacity) : undefined,
      rsvpEnabled,
      rsvpDeadline: rsvpEnabled && rsvpDeadline ? rsvpDeadline : undefined,
      selfCheckInEnabled,
      qrCheckInEnabled,
      checkInWindowMinutes: activity.checkInWindowMinutes || 180,
      volunteerHoursDefault: Number(volunteerHoursDefault) || 0,
      committeeMembers: filteredCommitteeMembers,
    };

    let inputPayload: Parameters<typeof updateActivityAction>[1];
    if (activity.kind === "MEETING") {
      inputPayload = {
        ...basePayload,
        kind: "MEETING",
        meetingType: activity.meetingType || "GENERAL_ASSEMBLY",
      };
    } else if (isProjectKind(activity.kind)) {
      const finalCustomNames = [
        ...customPartners,
        ...(customPartnerInput.trim() ? [customPartnerInput.trim()] : []),
      ];
      const combinedPartners = [
        ...selectedPartnerClubs.map((club) => ({
          name: club.name,
          role: "IMPLEMENTING_PARTNER" as const,
          sisterClubId: club.id,
        })),
        ...finalCustomNames.map((name) => ({
          name,
          role: "IMPLEMENTING_PARTNER" as const,
        })),
      ];

      if (
        activity.kind === "JOINT_PROJECT" &&
        combinedPartners.length === 0
      ) {
        setSection("GOALS");
        setError(
          "Joint Projects require at least one Twin/Friendship/Partner club or external partner organization.",
        );
        return;
      }

      const primarySisterClub = selectedPartnerClubs[0];
      inputPayload = {
        ...basePayload,
        kind: activity.kind,
        objective: objective.trim(),
        beneficiaryType: beneficiaryType.trim(),
        beneficiaryTarget: Number(beneficiaryTarget) || 0,
        fundingTarget: Number(fundingTarget) || 0,
        fundingSource: fundingSource.trim(),
        areasOfFocus: activity.projectDetails?.areasOfFocus || [],
        sdgs: activity.projectDetails?.sdgs || [],
        sisterClubId: primarySisterClub?.id,
        sisterClubName: primarySisterClub?.name,
        partners: combinedPartners,
      };
    } else {
      inputPayload = {
        ...basePayload,
        kind: activity.kind,
      };
    }

    setSaving(true);
    try {
      const res = await updateActivityAction(activity.id, inputPayload);
      if (!res.success) {
        setError(res.error || "Failed to update activity.");
        setSaving(false);
        return;
      }
      notifyToast({
        message: isProject
          ? "Project updated successfully."
          : "Activity updated successfully.",
        kind: "success",
      });
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-activity-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 p-3 backdrop-blur-xs sm:p-5"
      onClick={() => {
        if (!saving) onClose();
      }}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-[#161B26]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-slate-800 sm:px-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="edit-activity-modal-title"
                className="text-base font-bold text-slate-900 dark:text-white"
              >
                Edit {isProject ? "Project" : "Activity"}
              </h2>
              {isDirty && (
                <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-800">
                  Unsaved changes
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
              {title || activity.title} · Update details, committee roster, schedule, and attendance settings.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close modal"
            disabled={saving}
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Section Pill Tabs */}
        <div
          role="tablist"
          aria-label="Edit project sections"
          className="flex gap-1.5 overflow-x-auto border-b border-slate-100 bg-slate-50/70 px-5 py-2.5 dark:border-slate-800 dark:bg-slate-900/50 sm:px-6"
        >
          {visibleTabs.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSection(item.id)}
                className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "bg-[#0D3594] text-white shadow-xs"
                    : "text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                      active
                        ? "bg-white/20 text-white"
                        : "bg-slate-200/80 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* TAB 1: BASICS */}
            {section === "BASICS" && (
              <div className="space-y-5">
                <div>
                  <label
                    htmlFor="edit-title"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
                  >
                    Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="edit-title"
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Literacy Drive or Coastal Clean-Up"
                    className={inputClass}
                  />
                </div>

                {/* Visual Priority Selector */}
                <div>
                  <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Priority Level
                  </span>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {ACTIVITY_PRIORITIES.map((p) => {
                      const meta = ACTIVITY_PRIORITY_META[p];
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
                            className={`h-2 w-2 rounded-full ${meta.dotClass}`}
                          />
                          <span>{meta.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Roomy 2-col row: Club Avenue & Location */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="edit-committee-avenue"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
                    >
                      Club Avenue / Committee
                    </label>
                    <select
                      id="edit-committee-avenue"
                      value={committee}
                      onChange={(e) => setCommittee(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">None / Unassigned</option>
                      {COMMITTEES.map((c) => (
                        <option key={c} value={c}>
                          {formatCommitteeLabel(c)}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Primary Rotary avenue of service overseeing this activity.
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="edit-location"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
                    >
                      Location / Venue
                    </label>
                    <div className="relative mt-1.5">
                      <MapPin className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <input
                        id="edit-location"
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="e.g. San Pedro City Hall or Google Meet"
                        className="block w-full rounded-lg border border-[#DDE1EA] bg-white py-2 pl-9 pr-3 text-sm font-normal text-[#111625] outline-none focus:border-[#0D3594] focus:ring-2 focus:ring-[#0D3594]/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Physical venue address or online video call link.
                    </p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="edit-short-description"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
                    >
                      Short Description
                    </label>
                    <span className="text-[11px] text-slate-400">
                      {shortDescription.length}/280
                    </span>
                  </div>
                  <input
                    id="edit-short-description"
                    type="text"
                    maxLength={280}
                    value={shortDescription}
                    onChange={(e) => setShortDescription(e.target.value)}
                    placeholder="Brief one-line summary shown on dashboard cards"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label
                    htmlFor="edit-description"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
                  >
                    Full Description
                  </label>
                  <textarea
                    id="edit-description"
                    rows={5}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Comprehensive activity overview, agenda, reminders, and links..."
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            {/* TAB 2: COMMITTEE & TEAM */}
            {section === "TEAM" && (
              <div className="space-y-5">
                {/* Project Owner / Chair Card */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                    <UserCheck className="h-4 w-4 text-[#0D3594] dark:text-blue-400" />
                    <span>Project Owner / Chair Leadership</span>
                  </div>

                  {canReassignOwner ? (
                    <div className="mt-3">
                      <label
                        htmlFor="edit-bond-owner"
                        className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
                      >
                        Bond Project Owner
                      </label>
                      <select
                        id="edit-bond-owner"
                        value={ownerId}
                        onChange={(e) => handleOwnerChange(e.target.value)}
                        className={inputClass}
                      >
                        <option value="">Select Project Owner...</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} {m.role ? `(${m.role})` : ""} — {m.email}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1.5 text-[11px] text-slate-500">
                        As an administrator, you can bond this project to a member. The owner holds the Chair seat with full editing permissions.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900">
                      <div className="flex items-center gap-2.5">
                        <Avatar
                          name={ownerInfo.name}
                          url={ownerInfo.avatarUrl}
                          size={30}
                        />
                        <div>
                          <p className="text-xs font-semibold text-slate-900 dark:text-white">
                            {ownerInfo.name}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Only club administrators can reassign project ownership.
                          </p>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                        <Crown className="h-3 w-3" /> Chair
                      </span>
                    </div>
                  )}
                </div>

                {/* Add Committee Members Card */}
                <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/50">
                  <div>
                    <h3 className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                      <Users className="h-4 w-4 text-[#0D3594] dark:text-blue-400" />
                      Appoint Committee Members
                    </h3>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Add officers, co-chairs, or volunteers to help organize this {isProject ? "project" : "activity"}. Newly added members automatically unlock project details and receive a notification on save.
                    </p>
                  </div>

                  {/* Quick search + Role */}
                  <div className="grid gap-2.5 sm:grid-cols-[1fr_160px]">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <input
                        type="search"
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                        placeholder="Search members by name, role, or email..."
                        aria-label="Search members to add to committee"
                        className="block w-full rounded-lg border border-[#DDE1EA] bg-white py-2 pl-9 pr-3 text-sm text-[#111625] outline-none focus:border-[#0D3594] focus:ring-2 focus:ring-[#0D3594]/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      />
                    </div>
                    <select
                      aria-label="Role for new committee member"
                      value={selectedTeamRole}
                      onChange={(e) =>
                        setSelectedTeamRole(e.target.value as AppointableRole)
                      }
                      className="rounded-lg border border-[#DDE1EA] bg-white px-3 py-2 text-sm text-[#111625] outline-none focus:border-[#0D3594] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    >
                      <option value="COMMITTEE">Committee</option>
                      <option value="CO_CHAIR">Co-Chair</option>
                      <option value="VOLUNTEER">Volunteer</option>
                    </select>
                  </div>

                  {memberSearch.trim().length > 0 ? (
                    filteredQuickMembers.length > 0 ? (
                      <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-slate-50/70 dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900">
                        {filteredQuickMembers.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center justify-between gap-3 px-3 py-2"
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              <Avatar
                                name={m.name}
                                url={m.avatarUrl}
                                size={28}
                              />
                              <div className="min-w-0">
                                <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                                  {m.name}
                                </p>
                                <p className="truncate text-[11px] text-slate-500">
                                  {m.role ? `${formatRoleLabel(m.role)} · ` : ""}
                                  {m.email}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => addCommitteeMember(m.id)}
                              className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg bg-[#0D3594] px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#092569]"
                            >
                              <Plus className="h-3.5 w-3.5" /> Add
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500 dark:border-slate-700">
                        No matching available members found for &ldquo;{memberSearch}&rdquo;.
                      </p>
                    )
                  ) : (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <select
                        aria-label="Select member to appoint"
                        value={selectedMemberId}
                        onChange={(e) => setSelectedMemberId(e.target.value)}
                        className="flex-1 rounded-lg border border-[#DDE1EA] bg-white px-3 py-2 text-sm text-[#111625] outline-none focus:border-[#0D3594] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      >
                        <option value="">
                          {availableMembers.length === 0
                            ? "All club members are already assigned"
                            : "Choose a member or officer from the club..."}
                        </option>
                        {availableMembers.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}{" "}
                            {m.role ? `(${formatRoleLabel(m.role)})` : ""}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={!selectedMemberId}
                        onClick={() => addCommitteeMember(selectedMemberId)}
                        className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-[#0D3594] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#092569] disabled:opacity-45"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Member
                      </button>
                    </div>
                  )}
                </div>

                {/* Current Committee Roster */}
                <div className="space-y-2.5 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/50">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                      Project Committee Roster ({committeeMembers.length + (ownerId ? 1 : 0)})
                    </h3>
                    <span className="text-[11px] text-slate-500">
                      Co-Chairs share project management access
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100 rounded-lg border border-slate-100 dark:divide-slate-800 dark:border-slate-800">
                    {ownerId && (
                      <div className="flex items-center justify-between gap-3 bg-slate-50/70 px-3 py-2.5 dark:bg-slate-900">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Avatar
                            name={ownerInfo.name}
                            url={ownerInfo.avatarUrl}
                            size={30}
                          />
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                              {ownerInfo.name}
                            </p>
                            {ownerInfo.email && (
                              <p className="truncate text-[11px] text-slate-500">
                                {ownerInfo.email}
                              </p>
                            )}
                          </div>
                        </div>
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800 ring-1 ring-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-800">
                          <Crown className="h-3 w-3" /> CHAIR
                        </span>
                      </div>
                    )}

                    {committeeMembers.map((cm) => {
                      const info = memberLookup.get(cm.profileId);
                      const displayName = info?.name || "Club Member";
                      return (
                        <div
                          key={cm.profileId}
                          className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-2.5">
                            <Avatar
                              name={displayName}
                              url={info?.avatarUrl}
                              size={30}
                            />
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                                {displayName}
                              </p>
                              <p className="truncate text-[11px] text-slate-500">
                                {info?.clubRole
                                  ? formatRoleLabel(info.clubRole)
                                  : "Club Member"}
                                {info?.email ? ` · ${info.email}` : ""}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <select
                              aria-label={`Role for ${displayName}`}
                              value={cm.role}
                              onChange={(e) =>
                                updateCommitteeMemberRole(
                                  cm.profileId,
                                  e.target.value as AppointableRole,
                                )
                              }
                              className="rounded-lg border border-[#DDE1EA] bg-white px-2.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-[#0D3594] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                            >
                              <option value="CO_CHAIR">Co-Chair</option>
                              <option value="COMMITTEE">Committee</option>
                              <option value="VOLUNTEER">Volunteer</option>
                            </select>
                            <button
                              type="button"
                              aria-label={`Remove ${displayName}`}
                              onClick={() => removeCommitteeMember(cm.profileId)}
                              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 cursor-pointer"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {committeeMembers.length === 0 && (
                    <p className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-center text-xs text-slate-500 dark:border-slate-700">
                      No additional committee members appointed yet. Search or choose members above to build your organizing committee.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: SCHEDULE */}
            {section === "SCHEDULE" && (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="edit-start-at"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
                    >
                      Start Date &amp; Time (Asia/Manila){" "}
                      <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="edit-start-at"
                      type="datetime-local"
                      required
                      value={startAt}
                      onChange={(e) => setStartAt(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="edit-end-at"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
                    >
                      End Date &amp; Time (Asia/Manila){" "}
                      <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="edit-end-at"
                      type="datetime-local"
                      required
                      value={endAt}
                      onChange={(e) => setEndAt(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* Live Duration Badge */}
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
                  <span>Duration: {durationInfo.label}</span>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                  <ToggleSwitch
                    id="edit-allday"
                    checked={allDay}
                    onChange={setAllDay}
                    label="All-day event"
                    description="Display this as a full-day entry on the club calendar."
                  />
                </div>
              </div>
            )}

            {/* TAB 4: PROJECT GOALS & PARTNERS */}
            {section === "GOALS" && isProject && (
              <div className="space-y-5">
                <div>
                  <label
                    htmlFor="edit-objective"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
                  >
                    Project Objective
                  </label>
                  <textarea
                    id="edit-objective"
                    rows={3}
                    value={objective}
                    onChange={(e) => setObjective(e.target.value)}
                    placeholder="What does this project aim to achieve in the community?"
                    className={inputClass}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="edit-beneficiary-type"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
                    >
                      Beneficiary Type
                    </label>
                    <input
                      id="edit-beneficiary-type"
                      type="text"
                      value={beneficiaryType}
                      onChange={(e) => setBeneficiaryType(e.target.value)}
                      placeholder="e.g. Out-of-school youth, Barangay residents"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="edit-beneficiary-target"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
                    >
                      Beneficiary Target Count
                    </label>
                    <input
                      id="edit-beneficiary-target"
                      type="number"
                      min={0}
                      value={beneficiaryTarget}
                      onChange={(e) => setBeneficiaryTarget(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="edit-funding-target"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
                    >
                      Funding Target (PHP)
                    </label>
                    <div className="relative mt-1.5">
                      <span className="pointer-events-none absolute left-3 top-2 text-sm font-semibold text-slate-400">
                        ₱
                      </span>
                      <input
                        id="edit-funding-target"
                        type="number"
                        min={0}
                        value={fundingTarget}
                        onChange={(e) => setFundingTarget(e.target.value)}
                        className="block w-full rounded-lg border border-[#DDE1EA] bg-white py-2 pl-7 pr-3 text-sm font-normal text-[#111625] outline-none focus:border-[#0D3594] focus:ring-2 focus:ring-[#0D3594]/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="edit-funding-source"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
                    >
                      Funding Source
                    </label>
                    <input
                      id="edit-funding-source"
                      type="text"
                      value={fundingSource}
                      onChange={(e) => setFundingSource(e.target.value)}
                      placeholder="e.g. Club Treasury, Sponsor, District Grant"
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* Partnerships */}
                <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-100">
                      <HeartHandshake className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      Partnerships (Twin / Friendship / Partner Clubs)
                      {activity.kind === "JOINT_PROJECT" && (
                        <span className="text-rose-500">*</span>
                      )}
                    </label>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {activity.kind === "JOINT_PROJECT"
                        ? "Select one or more registered Twin, Friendship, or Partner clubs co-implementing this joint project."
                        : "Optionally link any Twin, Friendship, or Partner clubs collaborating on this project."}
                    </p>

                    {selectedPartnerClubs.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {selectedPartnerClubs.map((partner) => (
                          <div
                            key={partner.id}
                            className="inline-flex max-w-full items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100"
                          >
                            <span className="min-w-0 break-words font-medium">
                              {partner.name}
                            </span>
                            <span className="text-[10px] text-emerald-700 dark:text-emerald-300">
                              (D{partner.district})
                            </span>
                            <button
                              type="button"
                              aria-label={`Remove partner ${partner.name}`}
                              onClick={() =>
                                setSelectedPartnerIds((prev) =>
                                  prev.filter((id) => id !== partner.id),
                                )
                              }
                              className="shrink-0 cursor-pointer rounded p-0.5 text-emerald-800 hover:bg-emerald-100 dark:text-emerald-200 dark:hover:bg-emerald-900"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <select
                      aria-label="Add partnership club"
                      value={selectedPartnerDropdown}
                      disabled={
                        partnerClubs.filter(
                          (c) => !selectedPartnerIds.includes(c.id),
                        ).length === 0
                      }
                      onChange={(e) => {
                        const partnerId = e.target.value;
                        if (partnerId) {
                          setSelectedPartnerIds((prev) =>
                            prev.includes(partnerId)
                              ? prev
                              : [...prev, partnerId],
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
                            ? "+ Select a Twin / Friendship / Partner club..."
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
                            {club.name} · District {club.district},{" "}
                            {club.country}
                          </option>
                        ))}
                    </select>

                    {partnerClubs.length === 0 && (
                      <Link
                        href="/partnerships"
                        className="mt-1.5 inline-flex text-xs font-semibold text-[#0D3594] hover:underline dark:text-blue-300"
                      >
                        Register a Twin or Partner club in Partnerships &rarr;
                      </Link>
                    )}
                  </div>

                  <div className="border-t border-slate-200/80 pt-3 dark:border-slate-800">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Additional Partner Organizations
                    </label>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      External non-Rotary partners, NGOs, LGUs, schools, or corporate co-organizers.
                    </p>

                    {customPartners.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {customPartners.map((partnerName) => (
                          <span
                            key={partnerName}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          >
                            {partnerName}
                            <button
                              type="button"
                              aria-label={`Remove ${partnerName}`}
                              onClick={() =>
                                setCustomPartners((prev) =>
                                  prev.filter((name) => name !== partnerName),
                                )
                              }
                              className="cursor-pointer rounded p-0.5 text-slate-400 hover:text-rose-600"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        maxLength={200}
                        value={customPartnerInput}
                        onChange={(e) => setCustomPartnerInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddCustomPartner();
                          }
                        }}
                        placeholder="e.g. Barangay San Antonio LGU or Red Cross"
                        className={`${inputClass} mt-0 flex-1`}
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomPartner}
                        disabled={!customPartnerInput.trim()}
                        className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Partner
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: ATTENDANCE */}
            {section === "ATTENDANCE" && (
              <div className="space-y-4">
                <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                  <ToggleSwitch
                    id="edit-qr-check-in"
                    checked={qrCheckInEnabled}
                    onChange={setQrCheckInEnabled}
                    label="Enable QR Attendance Check-In"
                    description="Generate rolling time-limited QR codes for members to scan on-site."
                    icon={
                      <QrCode className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    }
                  />
                  {!qrCheckInEnabled ? (
                    <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] font-medium text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                      QR check-in is disabled. Suitable for promotional campaigns, recruitments, or digital initiatives.
                    </p>
                  ) : (
                    <p className="rounded-md border border-emerald-200 bg-emerald-50 p-2 text-[11px] text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                      QR check-in is enabled. Dynamic rolling-code sessions will be available on the Attendance dashboard.
                    </p>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="edit-volunteer-hours"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
                    >
                      Default Volunteer Hours
                    </label>
                    <input
                      id="edit-volunteer-hours"
                      type="number"
                      step="0.5"
                      min="0"
                      max="24"
                      value={volunteerHoursDefault}
                      onChange={(e) => setVolunteerHoursDefault(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="edit-capacity"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
                    >
                      Capacity (Optional)
                    </label>
                    <input
                      id="edit-capacity"
                      type="number"
                      min="1"
                      value={capacity}
                      onChange={(e) => setCapacity(e.target.value)}
                      placeholder="No limit"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <ToggleSwitch
                    id="edit-rsvp-toggle"
                    checked={rsvpEnabled}
                    onChange={setRsvpEnabled}
                    label="Enable Member RSVPs"
                    description="Allow members to indicate Going, Maybe, or Can't Go."
                  />
                  {rsvpEnabled && (
                    <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
                      <label
                        htmlFor="edit-rsvp-deadline"
                        className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
                      >
                        RSVP Deadline (Optional)
                      </label>
                      <input
                        id="edit-rsvp-deadline"
                        type="datetime-local"
                        value={rsvpDeadline}
                        onChange={(e) => setRsvpDeadline(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <ToggleSwitch
                    id="edit-self-check-in"
                    checked={selfCheckInEnabled}
                    onChange={setSelfCheckInEnabled}
                    label="Allow Self Check-In"
                    description="Allow eligible members to record attendance themselves during the check-in window."
                  />
                </div>

                <div className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <ToggleSwitch
                    id="edit-min-members-toggle"
                    checked={minMembersEnabled}
                    onChange={setMinMembersEnabled}
                    label="Minimum Members Required"
                    description="Set a minimum quorum or volunteer headcount target."
                  />
                  {minMembersEnabled && (
                    <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
                      <label
                        htmlFor="edit-min-members-count"
                        className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
                      >
                        Required Count
                      </label>
                      <input
                        id="edit-min-members-count"
                        type="number"
                        min="1"
                        value={minMembersRequired}
                        onChange={(e) => setMinMembersRequired(e.target.value)}
                        placeholder="e.g. 10"
                        className={inputClass}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sticky Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-3.5 dark:border-slate-800 dark:bg-slate-900/60 sm:px-6">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentTabIndex <= 0}
                onClick={() =>
                  currentTabIndex > 0 &&
                  setSection(visibleTabs[currentTabIndex - 1].id)
                }
                className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Previous
              </button>
              <button
                type="button"
                disabled={
                  currentTabIndex === -1 ||
                  currentTabIndex >= visibleTabs.length - 1
                }
                onClick={() =>
                  currentTabIndex >= 0 &&
                  currentTabIndex < visibleTabs.length - 1 &&
                  setSection(visibleTabs[currentTabIndex + 1].id)
                }
                className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="cursor-pointer rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#0D3594] px-5 py-2 text-xs font-semibold text-white shadow-2xs transition hover:bg-[#0b2c7a] disabled:opacity-60"
              >
                <Check className="h-3.5 w-3.5" />
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

