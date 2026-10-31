import type { ActivityStatus, RsvpResponse } from "./types";

export const SELF_CHECK_IN_OPENS_BEFORE_MINUTES = 30;

export interface RuleResult {
  allowed: boolean;
  reason?: string;
}

interface CheckInActivity {
  status: ActivityStatus;
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
