import {
  ACTIVITY_PRIORITIES,
  ACTIVITY_PRIORITY_META,
  type ActivityPriority,
  type ActivityStatus,
  type RsvpResponse,
} from "./types";

export const SELF_CHECK_IN_OPENS_BEFORE_MINUTES = 30;

export interface RuleResult {
  allowed: boolean;
  reason?: string;
}

interface CheckInActivity {
  status: ActivityStatus;
  isArchived?: boolean;
  selfCheckInEnabled: boolean;
  startAt: string;
  endAt: string;
  checkInWindowMinutes: number;
}

/** Check-in window: opens shortly before start; closes after the window (or at the end when window is 0). */
export function checkInWindow(
  activity: Pick<CheckInActivity, "startAt" | "endAt" | "checkInWindowMinutes">,
) {
  const start = new Date(activity.startAt).getTime();
  const end = new Date(activity.endAt).getTime();
  const opensAt = new Date(start - SELF_CHECK_IN_OPENS_BEFORE_MINUTES * 60_000);
  const closesAt = new Date(
    activity.checkInWindowMinutes > 0
      ? Math.min(end, start + activity.checkInWindowMinutes * 60_000)
      : end,
  );
  return { opensAt, closesAt };
}

export function evaluateSelfCheckIn(input: {
  activity: CheckInActivity;
  now: Date;
  isParticipant: boolean;
  alreadyCheckedIn: boolean;
}): RuleResult {
  const { activity, now, isParticipant, alreadyCheckedIn } = input;
  if (!isParticipant)
    return {
      allowed: false,
      reason: "Only active members and aspirants can check in.",
    };
  if (!activity.selfCheckInEnabled)
    return {
      allowed: false,
      reason:
        "Self check-in is turned off for this activity. Scan the QR code instead.",
    };
  if (activity.isArchived) {
    return { allowed: false, reason: "This activity is archived." };
  }
  if (activity.status === "CANCELLED" || activity.status === "DRAFT") {
    return {
      allowed: false,
      reason: "This activity is not open for check-in.",
    };
  }
  if (alreadyCheckedIn)
    return { allowed: false, reason: "You are already checked in." };

  const { opensAt, closesAt } = checkInWindow(activity);
  if (now < opensAt)
    return { allowed: false, reason: "Check-in has not opened yet." };
  if (now > closesAt)
    return { allowed: false, reason: "The check-in window has closed." };
  return { allowed: true };
}

export function minMembersStatus(
  goingCount: number,
  minRequired: number | null,
) {
  if (!minRequired)
    return { required: null, confirmed: goingCount, shortfall: 0, met: true };
  const shortfall = Math.max(0, minRequired - goingCount);
  return {
    required: minRequired,
    confirmed: goingCount,
    shortfall,
    met: shortfall === 0,
  };
}

export function evaluateRsvp(input: {
  status: ActivityStatus;
  isArchived?: boolean;
  rsvpEnabled: boolean;
  rsvpDeadline: string | null;
  startAt: string;
  capacity: number | null;
  goingCount: number;
  currentResponse: RsvpResponse | null;
  nextResponse: RsvpResponse;
  isParticipant: boolean;
  now: Date;
}): RuleResult {
  if (!input.isParticipant)
    return {
      allowed: false,
      reason: "Only active members and aspirants can RSVP.",
    };
  if (input.isArchived)
    return { allowed: false, reason: "This activity is archived." };
  if (!input.rsvpEnabled)
    return { allowed: false, reason: "RSVP is not enabled for this activity." };
  if (!["PLANNED", "ONGOING"].includes(input.status)) {
    return { allowed: false, reason: "RSVP is closed for this activity." };
  }
  const deadline = input.rsvpDeadline
    ? new Date(input.rsvpDeadline)
    : new Date(input.startAt);
  if (input.now > deadline)
    return { allowed: false, reason: "The RSVP deadline has passed." };

  const joiningGoing =
    input.nextResponse === "GOING" && input.currentResponse !== "GOING";
  if (joiningGoing && input.capacity && input.goingCount >= input.capacity) {
    return { allowed: false, reason: "This activity is already full." };
  }
  return { allowed: true };
}

const STATUS_TRANSITIONS: Record<ActivityStatus, ActivityStatus[]> = {
  DRAFT: ["PLANNED", "CANCELLED"],
  PLANNED: ["DRAFT", "ONGOING", "COMPLETED", "AWAITING_REPORT", "CANCELLED"],
  ONGOING: ["COMPLETED", "AWAITING_REPORT", "CANCELLED"],
  COMPLETED: ["ONGOING"],
  AWAITING_REPORT: ["ONGOING"],
  // Reached only through the report publishing flow
  ACCOMPLISHED: [],
  CANCELLED: ["PLANNED"],
};

export function canTransition(
  from: ActivityStatus,
  to: ActivityStatus,
  isProject: boolean,
): RuleResult {
  if (!STATUS_TRANSITIONS[from].includes(to)) {
    return { allowed: false, reason: `Cannot move from ${from} to ${to}.` };
  }
  if (isProject && to === "COMPLETED") {
    return {
      allowed: false,
      reason:
        "Projects finish as 'Awaiting report' until the chair publishes the report.",
    };
  }
  if (!isProject && to === "AWAITING_REPORT") {
    return {
      allowed: false,
      reason: "Only projects require an accomplishment report.",
    };
  }
  return { allowed: true };
}

export function allowedTransitions(
  from: ActivityStatus,
  isProject: boolean,
): ActivityStatus[] {
  return STATUS_TRANSITIONS[from].filter(
    (to) => canTransition(from, to, isProject).allowed,
  );
}

export interface LifecycleStage {
  status: ActivityStatus;
  stepNumber: number;
  label: string;
  shortLabel: string;
  description: string;
  state: "completed" | "current" | "upcoming";
}

export function getLifecycleStages(
  currentStatus: ActivityStatus,
  isProject: boolean,
): LifecycleStage[] {
  const definitions: Omit<LifecycleStage, "stepNumber" | "state">[] = isProject
    ? [
        {
          status: "PLANNED",
          label: "Plan & Mobilize",
          shortLabel: "Planned",
          description: "Schedule, committee & member RSVPs",
        },
        {
          status: "ONGOING",
          label: "Ongoing Execution",
          shortLabel: "Ongoing",
          description: "Attendance check-in, tasks & photos",
        },
        {
          status: "AWAITING_REPORT",
          label: "Wrap-Up & Report",
          shortLabel: "Awaiting Report",
          description: "Complete impact & narrative details",
        },
        {
          status: "ACCOMPLISHED",
          label: "Accomplished",
          shortLabel: "Accomplished",
          description: "Published to District & Showcase records",
        },
      ]
    : [
        {
          status: "PLANNED",
          label: "Planned",
          shortLabel: "Planned",
          description: "Schedule & member RSVPs",
        },
        {
          status: "ONGOING",
          label: "In Progress",
          shortLabel: "Ongoing",
          description: "Attendance check-in & execution",
        },
        {
          status: "COMPLETED",
          label: "Completed",
          shortLabel: "Completed",
          description: "Activity finished & logged",
        },
      ];

  const normalizedCurrent: ActivityStatus =
    currentStatus === "DRAFT"
      ? "PLANNED"
      : !isProject && currentStatus === "ACCOMPLISHED"
        ? "COMPLETED"
        : isProject && currentStatus === "COMPLETED"
          ? "AWAITING_REPORT"
          : currentStatus;

  const activeIndex = definitions.findIndex(
    (d) => d.status === normalizedCurrent,
  );
  const isTerminalFinished =
    currentStatus === "ACCOMPLISHED" ||
    (!isProject && currentStatus === "COMPLETED");

  return definitions.map((def, idx) => {
    let state: LifecycleStage["state"] = "upcoming";
    if (isTerminalFinished) {
      state = "completed";
    } else if (activeIndex === -1) {
      state = "upcoming";
    } else if (idx < activeIndex) {
      state = "completed";
    } else if (idx === activeIndex) {
      state = "current";
    }
    return {
      ...def,
      stepNumber: idx + 1,
      state,
    };
  });
}

export interface ReportChecklistItem {
  key:
    | "description"
    | "inspiration"
    | "objective"
    | "outcomes"
    | "beneficiaries"
    | "photo";
  label: string;
  hint: string;
  minChars?: number;
  currentChars?: number;
  done: boolean;
  targetTab: "REPORT" | "MEDIA";
  fieldName?: string;
}

export interface ReportReadinessInput {
  detailedDescription?: string | null;
  inspiration?: string | null;
  objective?: string | null;
  outcomesSummary?: string | null;
  beneficiaryType?: string | null;
  mediaCount: number;
}

export interface ReportReadinessResult {
  items: ReportChecklistItem[];
  completedCount: number;
  totalCount: number;
  percent: number;
  ready: boolean;
  missingLabels: string[];
}

export function evaluateReportReadiness(
  input: ReportReadinessInput,
): ReportReadinessResult {
  const descLen = (input.detailedDescription || "").trim().length;
  const inspLen = (input.inspiration || "").trim().length;
  const objLen = (input.objective || "").trim().length;
  const outLen = (input.outcomesSummary || "").trim().length;
  const benLen = (input.beneficiaryType || "").trim().length;
  const mediaCount = Math.max(0, Number(input.mediaCount || 0));

  const items: ReportChecklistItem[] = [
    {
      key: "description",
      label: "Detailed description",
      hint: "At least 30 characters describing work delivered",
      minChars: 30,
      currentChars: descLen,
      done: descLen >= 30,
      targetTab: "REPORT",
      fieldName: "detailedDescription",
    },
    {
      key: "inspiration",
      label: "Project inspiration",
      hint: "At least 20 characters on community need",
      minChars: 20,
      currentChars: inspLen,
      done: inspLen >= 20,
      targetTab: "REPORT",
      fieldName: "inspiration",
    },
    {
      key: "objective",
      label: "Project objective",
      hint: "At least 10 characters on intended change",
      minChars: 10,
      currentChars: objLen,
      done: objLen >= 10,
      targetTab: "REPORT",
      fieldName: "objective",
    },
    {
      key: "outcomes",
      label: "Outcomes & measurement",
      hint: "At least 20 characters on measurable results",
      minChars: 20,
      currentChars: outLen,
      done: outLen >= 20,
      targetTab: "REPORT",
      fieldName: "outcomesSummary",
    },
    {
      key: "beneficiaries",
      label: "Beneficiary group",
      hint: "Who benefited (e.g., students, households)",
      minChars: 2,
      currentChars: benLen,
      done: benLen >= 2,
      targetTab: "REPORT",
      fieldName: "beneficiaryType",
    },
    {
      key: "photo",
      label: "Documentation photo",
      hint:
        mediaCount > 0
          ? `${mediaCount} photo${mediaCount === 1 ? "" : "s"} uploaded`
          : "Upload at least 1 photo in Media or Report",
      done: mediaCount > 0,
      targetTab: "MEDIA",
    },
  ];

  const completedCount = items.filter((item) => item.done).length;
  const totalCount = items.length;
  const percent = Math.round((completedCount / totalCount) * 100);
  const missingLabels = items
    .filter((item) => !item.done)
    .map((item) => item.label);

  return {
    items,
    completedCount,
    totalCount,
    percent,
    ready: completedCount === totalCount,
    missingLabels,
  };
}

export interface FormattedLogEntry {
  title: string;
  subtitle?: string;
  tone: "emerald" | "blue" | "amber" | "violet" | "rose" | "slate";
  isMilestone: boolean;
}

const HUMAN_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PLANNED: "Planned (Step 1)",
  ONGOING: "Ongoing Execution (Step 2)",
  AWAITING_REPORT: "Wrap-Up & Report (Step 3)",
  ACCOMPLISHED: "Accomplished ✓ (Step 4)",
  COMPLETED: "Completed ✓",
  CANCELLED: "Cancelled",
};

/**
 * Translates raw database activity_log action codes into friendly,
 * non-technical plain English for Project Managers and Club Officers.
 */
export function formatActivityLogEntry(
  action: string,
  details: Record<string, unknown> = {},
): FormattedLogEntry {
  const code = (action || "").trim().toUpperCase();
  const nextStatus =
    typeof details.status === "string"
      ? details.status.trim().toUpperCase()
      : typeof details.to === "string"
        ? details.to.trim().toUpperCase()
        : "";

  switch (code) {
    case "REPORT_PUBLISHED":
      return {
        title: "Accomplishment Report published — Project Accomplished!",
        subtitle: "Official impact report submitted to club & District records",
        tone: "emerald",
        isMilestone: true,
      };
    case "REPORT_DRAFT_SAVED":
      return {
        title: "Saved progress on Accomplishment Report draft",
        subtitle:
          nextStatus === "AWAITING_REPORT"
            ? "Moved to Wrap-Up & Report stage"
            : undefined,
        tone: "amber",
        isMilestone: false,
      };
    case "STATUS_CHANGED": {
      if (nextStatus === "ACCOMPLISHED") {
        return {
          title: "Project marked as Accomplished",
          tone: "emerald",
          isMilestone: true,
        };
      }
      if (nextStatus === "COMPLETED") {
        return {
          title: "Activity marked as Completed",
          tone: "emerald",
          isMilestone: true,
        };
      }
      if (nextStatus === "AWAITING_REPORT") {
        return {
          title: "Moved to Wrap-Up & Accomplishment Report stage",
          tone: "amber",
          isMilestone: true,
        };
      }
      if (nextStatus === "ONGOING") {
        return {
          title: "Started execution (Marked as Ongoing)",
          tone: "blue",
          isMilestone: true,
        };
      }
      if (nextStatus === "PLANNED") {
        return {
          title: "Moved stage to Planned",
          tone: "blue",
          isMilestone: false,
        };
      }
      if (nextStatus === "CANCELLED") {
        return {
          title: "Activity was cancelled",
          tone: "rose",
          isMilestone: false,
        };
      }
      const friendlyStatus = HUMAN_STATUS_LABELS[nextStatus];
      return {
        title: friendlyStatus
          ? `Stage updated to ${friendlyStatus}`
          : "Project stage updated",
        tone: "blue",
        isMilestone: false,
      };
    }
    case "CREATED":
      return {
        title: "Activity created & scheduled",
        tone: "blue",
        isMilestone: true,
      };
    case "UPDATED":
      return {
        title: "Updated activity details & schedule",
        tone: "slate",
        isMilestone: false,
      };
    case "QR_GENERATED":
      return {
        title: "Opened QR check-in code for attendance",
        tone: "violet",
        isMilestone: false,
      };
    case "MEDIA_UPLOADED": {
      const count = Number(details.count || 1);
      return {
        title: `Uploaded ${count} documentation photo${count === 1 ? "" : "s"}`,
        tone: "emerald",
        isMilestone: false,
      };
    }
    case "TASK_CREATED": {
      const taskTitle =
        typeof details.title === "string" && details.title.trim()
          ? `"${details.title.trim()}"`
          : "a new task";
      return {
        title: `Added task: ${taskTitle}`,
        tone: "blue",
        isMilestone: false,
      };
    }
    case "TEAM_UPDATED": {
      const role =
        typeof details.role === "string"
          ? details.role.replaceAll("_", " ").toLowerCase()
          : "committee member";
      return {
        title: `Appointed ${role} to the organizing team`,
        tone: "blue",
        isMilestone: false,
      };
    }
    case "PRIORITY_CHANGED": {
      const rawPriority =
        typeof details.priority === "string"
          ? details.priority.trim().toUpperCase()
          : "";
      const meta = (ACTIVITY_PRIORITIES as readonly string[]).includes(
        rawPriority,
      )
        ? ACTIVITY_PRIORITY_META[rawPriority as ActivityPriority]
        : null;
      return {
        title: meta
          ? `Updated priority to ${meta.label}`
          : "Updated project priority",
        tone: rawPriority === "URGENT" ? "rose" : rawPriority === "HIGH" ? "amber" : "blue",
        isMilestone: false,
      };
    }
    case "SKETCH_POSTED": {
      const sketchTitle =
        typeof details.title === "string" && details.title.trim()
          ? `"${details.title.trim()}"`
          : "a visual sketch";
      return {
        title: `Posted visual summary sketch ${sketchTitle}`,
        tone: "violet",
        isMilestone: false,
      };
    }
    case "ARCHIVED":
      return {
        title: "Moved to historical archive",
        tone: "slate",
        isMilestone: false,
      };
    case "UNARCHIVED":
      return {
        title: "Restored to active workspace",
        tone: "emerald",
        isMilestone: false,
      };
    default: {
      const cleaned = code
        .toLowerCase()
        .replaceAll("_", " ")
        .replace(/^\w/, (c) => c.toUpperCase());
      return {
        title: cleaned || "Activity updated",
        tone: "slate",
        isMilestone: false,
      };
    }
  }
}

/**
 * Collapses consecutive duplicate noisy log entries (such as repeated QR_GENERATED or
 * identical STATUS_CHANGED events within a row) so the timeline reads cleanly.
 */
export function deduplicateActivityLog<
  T extends { action: string; details?: Record<string, unknown> },
>(entries: T[]): T[] {
  const result: T[] = [];
  for (const entry of entries) {
    const prev = result[result.length - 1];
    if (prev && prev.action === entry.action) {
      const prevStatus = prev.details?.status;
      const currStatus = entry.details?.status;
      if (
        entry.action === "QR_GENERATED" ||
        entry.action === "UPDATED" ||
        (entry.action === "STATUS_CHANGED" && prevStatus === currStatus)
      ) {
        continue;
      }
    }
    result.push(entry);
  }
  return result;
}

export function isQrCheckInApplicable(input: {
  qrCheckInEnabled?: boolean | null;
  qr_check_in_enabled?: boolean | null;
  kind?: string | null;
  meetingType?: string | null;
  category?: string | null;
  title?: string | null;
  committee?: string | null;
}): boolean {
  if (input.qrCheckInEnabled !== undefined && input.qrCheckInEnabled !== null) {
    return Boolean(input.qrCheckInEnabled);
  }
  if (input.qr_check_in_enabled !== undefined && input.qr_check_in_enabled !== null) {
    return Boolean(input.qr_check_in_enabled);
  }
  const text = (
    (input.title || "") + " " +
    (input.category || "") + " " +
    (input.meetingType || "") + " " +
    (input.committee || "")
  ).toLowerCase();
  if (
    text.includes("promotion") ||
    text.includes("recruitment") ||
    text.includes("marketing") ||
    text.includes("social media") ||
    text.includes("public relations") ||
    text.includes("campaign")
  ) {
    return false;
  }
  return true;
}

export function resolveArchiveState(input: {
  is_archived?: boolean | null;
  archived_at?: string | null;
  activity_log?: { action: string; created_at: string }[] | null;
}): { isArchived: boolean; archivedAt: string | null } {
  const archiveEvents = (input.activity_log || [])
    .filter((entry) => entry.action === "ARCHIVED" || entry.action === "UNARCHIVED")
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

  if (archiveEvents.length > 0) {
    const latest = archiveEvents[0];
    if (latest.action === "ARCHIVED") {
      return {
        isArchived: true,
        archivedAt: input.archived_at || latest.created_at || null,
      };
    }
    return { isArchived: false, archivedAt: null };
  }

  if (input.is_archived !== undefined && input.is_archived !== null) {
    return {
      isArchived: Boolean(input.is_archived),
      archivedAt: input.is_archived ? input.archived_at || null : null,
    };
  }

  return { isArchived: false, archivedAt: null };
}

/**
 * Resolves an activity's priority from its explicit column or audit log fallback,
 * defaulting to MEDIUM when unset.
 */
export function resolveActivityPriority(input: {
  priority?: string | null;
  activity_log?:
    | {
        action: string;
        details?: Record<string, unknown> | null;
        created_at: string;
      }[]
    | null;
}): ActivityPriority {
  const explicit =
    typeof input.priority === "string"
      ? input.priority.trim().toUpperCase()
      : "";
  if ((ACTIVITY_PRIORITIES as readonly string[]).includes(explicit)) {
    return explicit as ActivityPriority;
  }

  const priorityEvents = (input.activity_log || [])
    .filter(
      (entry) =>
        (entry.action === "PRIORITY_CHANGED" || entry.action === "CREATED") &&
        typeof entry.details?.priority === "string",
    )
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

  for (const ev of priorityEvents) {
    const candidate = String(ev.details?.priority || "")
      .trim()
      .toUpperCase();
    if ((ACTIVITY_PRIORITIES as readonly string[]).includes(candidate)) {
      return candidate as ActivityPriority;
    }
  }

  return "MEDIUM";
}

/**
 * Compares two activities by priority weight descending (URGENT -> LOW),
 * tie-breaking by startAt ascending.
 */
export function compareByPriority(
  a: { priority?: ActivityPriority | null; startAt?: string | null },
  b: { priority?: ActivityPriority | null; startAt?: string | null },
): number {
  const wa =
    ACTIVITY_PRIORITY_META[a.priority || "MEDIUM"]?.weight ??
    ACTIVITY_PRIORITY_META.MEDIUM.weight;
  const wb =
    ACTIVITY_PRIORITY_META[b.priority || "MEDIUM"]?.weight ??
    ACTIVITY_PRIORITY_META.MEDIUM.weight;
  if (wb !== wa) return wb - wa;
  return (a.startAt || "").localeCompare(b.startAt || "");
}

const SKETCH_MARKER_RE = /^\[\[SKETCH:([^|\]]+)\|([^\]]*)\]\]\r?\n?([\s\S]*)$/;

/**
 * Encodes an uploaded discussion sketch PNG + summary into a structured
 * `activity_comments.body` string so existing reactions and deletes work seamlessly.
 */
export function encodeSketchCommentBody({
  storagePath,
  title,
  summary,
}: {
  storagePath: string;
  title: string;
  summary: string;
}): string {
  const safePath = storagePath.replace(/[|\]]/g, "").trim();
  const safeTitle =
    title
      .replace(/[|\]]/g, "-")
      .trim()
      .slice(0, 120) || "Visual Summary Sketch";
  const cleanSummary = summary.trim();
  const header = `[[SKETCH:${safePath}|${safeTitle}]]`;
  return cleanSummary ? `${header}\n${cleanSummary}` : header;
}

/**
 * Decodes a discussion comment body, extracting structured sketch metadata
 * when present while keeping plain-text comments untouched.
 */
export function decodeSketchCommentBody(body: string): {
  sketch: { storagePath: string; title: string } | null;
  text: string;
} {
  if (!body) return { sketch: null, text: "" };
  const match = body.match(SKETCH_MARKER_RE);
  if (!match) return { sketch: null, text: body };
  return {
    sketch: {
      storagePath: match[1].trim(),
      title: match[2].trim() || "Visual Summary Sketch",
    },
    text: (match[3] || "").trim(),
  };
}

export const DEFAULT_QR_EXPIRATION_MINUTES =
  Number(process.env.NEXT_PUBLIC_QR_DEFAULT_EXPIRATION_MINUTES || 20) || 20;

export const QR_EXPIRATION_OPTIONS = [5, 10, 15, 20, 30, 60] as const;
export type QrExpirationOption = (typeof QR_EXPIRATION_OPTIONS)[number];

export const QR_SESSION_STATUSES = [
  "DRAFT",
  "SCHEDULED",
  "ACTIVE",
  "PAUSED",
  "CLOSED",
  "EXPIRED",
  "REVOKED",
] as const;
export type QrSessionLifecycleStatus = (typeof QR_SESSION_STATUSES)[number];
export type QrSessionStatus = QrSessionLifecycleStatus;

export function normalizeQrDurationMinutes(raw?: number | null): number {
  const num = Number(raw);
  if (!Number.isFinite(num) || num <= 0) {
    return DEFAULT_QR_EXPIRATION_MINUTES;
  }
  return Math.min(Math.max(Math.round(num), 1), 1440);
}

export interface SessionSecretMeta {
  hash: string;
  lifecycleStatus?: QrSessionLifecycleStatus;
  durationMinutes?: number;
  opensAt?: string | null;
  closesAt?: string | null;
  sessionDate?: string | null;
  label?: string | null;
}

/**
 * Encodes session metadata alongside the token hash inside `secret_hash`
 * so lifecycle states (REVOKED, PAUSED, SCHEDULED, DRAFT) and duration are
 * preserved even if migration 0014 has not yet been applied to the remote DB.
 */
export function encodeSessionSecretMeta(meta: SessionSecretMeta): string {
  const parts = [`h=${meta.hash}`];
  if (meta.lifecycleStatus) parts.push(`st=${meta.lifecycleStatus}`);
  if (meta.durationMinutes) parts.push(`dur=${meta.durationMinutes}`);
  if (meta.opensAt) parts.push(`op=${encodeURIComponent(meta.opensAt)}`);
  if (meta.closesAt) parts.push(`cl=${encodeURIComponent(meta.closesAt)}`);
  if (meta.sessionDate) parts.push(`dt=${encodeURIComponent(meta.sessionDate)}`);
  if (meta.label) parts.push(`lbl=${encodeURIComponent(meta.label)}`);
  return `v2|${parts.join("|")}`;
}

export function decodeSessionSecretMeta(
  secretHash?: string | null,
): SessionSecretMeta {
  if (!secretHash) return { hash: "" };
  if (!secretHash.startsWith("v2|")) {
    return { hash: secretHash };
  }
  const out: SessionSecretMeta = { hash: "" };
  const segments = secretHash.slice(3).split("|");
  for (const seg of segments) {
    const eqIdx = seg.indexOf("=");
    if (eqIdx === -1) continue;
    const k = seg.slice(0, eqIdx);
    const v = seg.slice(eqIdx + 1);
    if (k === "h") out.hash = v;
    else if (
      k === "st" &&
      (QR_SESSION_STATUSES as readonly string[]).includes(v)
    ) {
      out.lifecycleStatus = v as QrSessionLifecycleStatus;
    } else if (k === "dur") {
      const parsed = Number(v);
      if (Number.isFinite(parsed) && parsed > 0) out.durationMinutes = parsed;
    } else if (k === "op") out.opensAt = decodeURIComponent(v);
    else if (k === "cl") out.closesAt = decodeURIComponent(v);
    else if (k === "dt") out.sessionDate = decodeURIComponent(v);
    else if (k === "lbl") out.label = decodeURIComponent(v);
  }
  return out;
}

export function resolveQrSessionLifecycle(input: {
  dbStatus?: string | null;
  secretHash?: string | null;
  expiresAt: string;
  opensAt?: string | null;
  closesAt?: string | null;
  activityEndAt?: string | null;
  now?: Date;
}): {
  status: QrSessionLifecycleStatus;
  durationMinutes: number;
  opensAt: string | null;
  closesAt: string | null;
} {
  const nowMs = (input.now ?? new Date()).getTime();
  const meta = decodeSessionSecretMeta(input.secretHash);
  const rawStatus = (
    meta.lifecycleStatus ||
    input.dbStatus ||
    "ACTIVE"
  ).toUpperCase();
  const opensAt = input.opensAt ?? meta.opensAt ?? null;
  const closesAt = input.closesAt ?? meta.closesAt ?? null;
  const durationMinutes = normalizeQrDurationMinutes(meta.durationMinutes);

  if (rawStatus === "REVOKED") {
    return { status: "REVOKED", durationMinutes, opensAt, closesAt };
  }
  if (rawStatus === "CLOSED") {
    return { status: "CLOSED", durationMinutes, opensAt, closesAt };
  }
  if (rawStatus === "PAUSED") {
    return { status: "PAUSED", durationMinutes, opensAt, closesAt };
  }
  if (rawStatus === "DRAFT") {
    return { status: "DRAFT", durationMinutes, opensAt, closesAt };
  }

  // Check session closing boundary or activity end boundary
  const effectiveClosesAt = closesAt || input.activityEndAt || null;
  if (effectiveClosesAt && new Date(effectiveClosesAt).getTime() < nowMs) {
    return { status: "CLOSED", durationMinutes, opensAt, closesAt };
  }

  // Check scheduled opening time
  if (opensAt && new Date(opensAt).getTime() > nowMs) {
    return { status: "SCHEDULED", durationMinutes, opensAt, closesAt };
  }

  // Check QR token expiration timestamp
  if (
    rawStatus === "EXPIRED" ||
    new Date(input.expiresAt).getTime() <= nowMs
  ) {
    return { status: "EXPIRED", durationMinutes, opensAt, closesAt };
  }

  return { status: "ACTIVE", durationMinutes, opensAt, closesAt };
}

export type QrScanCheckInCode =
  | "OK"
  | "TOKEN_EXPIRED"
  | "TOKEN_REVOKED"
  | "SESSION_CLOSED"
  | "NOT_ELIGIBLE"
  | "ALREADY_CHECKED_IN";

export interface QrScanRuleResult {
  allowed: boolean;
  code: QrScanCheckInCode;
  reason?: string;
}

export function evaluateQrScanCheckIn(input: {
  sessionLifecycle: QrSessionLifecycleStatus;
  activityStatus?: ActivityStatus | string | null;
  isArchived?: boolean;
  qrCheckInEnabled?: boolean;
  isParticipant: boolean;
  alreadyCheckedIn: boolean;
}): QrScanRuleResult {
  if (input.qrCheckInEnabled === false) {
    return {
      allowed: false,
      code: "SESSION_CLOSED",
      reason: "Attendance check-in is currently closed.",
    };
  }
  if (
    input.isArchived ||
    input.activityStatus === "CANCELLED" ||
    input.activityStatus === "DRAFT"
  ) {
    return {
      allowed: false,
      code: "SESSION_CLOSED",
      reason: "Attendance check-in is currently closed.",
    };
  }
  if (input.sessionLifecycle === "REVOKED") {
    return {
      allowed: false,
      code: "TOKEN_REVOKED",
      reason:
        "This QR code has been revoked. Please ask the event administrator to display the current attendance QR code.",
    };
  }
  if (input.sessionLifecycle === "EXPIRED") {
    return {
      allowed: false,
      code: "TOKEN_EXPIRED",
      reason:
        "This QR code has expired. Please ask the event administrator to generate a new attendance QR code.",
    };
  }
  if (
    input.sessionLifecycle === "CLOSED" ||
    input.sessionLifecycle === "PAUSED" ||
    input.sessionLifecycle === "SCHEDULED" ||
    input.sessionLifecycle === "DRAFT"
  ) {
    return {
      allowed: false,
      code: "SESSION_CLOSED",
      reason: "Attendance check-in is currently closed.",
    };
  }
  if (!input.isParticipant) {
    return {
      allowed: false,
      code: "NOT_ELIGIBLE",
      reason:
        "You are not authorized or registered to attend this event. Only active club members and aspirants are eligible.",
    };
  }
  if (input.alreadyCheckedIn) {
    return {
      allowed: false,
      code: "ALREADY_CHECKED_IN",
      reason: "You are already checked in for this event.",
    };
  }
  return { allowed: true, code: "OK" };
}

