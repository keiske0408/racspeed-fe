import { daysBetween } from "@/lib/utils/dates";

export interface AttendanceRecordLike {
  eventId: string;
  eventType: "GENERAL_ASSEMBLY" | "SERVICE_PROJECT" | "FELLOWSHIP" | "DISTRICT" | "OTHER";
  eventDate: Date;
  attended: boolean;
  isExcused?: boolean;
  rsvpResponse?: "GOING" | "MAYBE" | "NOT_GOING" | null;
}

export interface EngagementCheckConfig {
  consecutiveGaThreshold?: number; // default 3
  serviceDaysThreshold?: number; // default 60
  rsvpNoShowThreshold?: number;
  memberSince?: Date;
}

export interface EngagementResult {
  isFlagged: boolean;
  reasons: string[];
  rulesTriggered: {
    rule: "MISSED_CONSECUTIVE_GAS" | "SERVICE_INACTIVITY" | "RSVP_NO_SHOWS";
    description: string;
    supportingDates: string[];
  }[];
  totalVolunteerHours: number;
}

/**
 * Deterministic engagement score and retention alert calculation.
 * Never penalizes excused absences as missed GAs.
 * Flags:
 * 1. Missing >= consecutiveGaThreshold consecutive General Assemblies.
 * 2. No attended service project in >= serviceDaysThreshold days relative to referenceDate.
 */
export function evaluateMemberEngagement(
  records: AttendanceRecordLike[],
  referenceDate: Date = new Date(),
  config: EngagementCheckConfig = {},
): EngagementResult {
  const gaThreshold = config.consecutiveGaThreshold ?? 3;
  const serviceThreshold = config.serviceDaysThreshold ?? 60;
  const noShowThreshold = config.rsvpNoShowThreshold ?? 2;

  const reasons: string[] = [];
  const rulesTriggered: EngagementResult["rulesTriggered"] = [];

  // Filter GAs sorted by date descending (most recent first)
  const gaRecords = records
    .filter((r) => r.eventType === "GENERAL_ASSEMBLY")
    .sort((a, b) => b.eventDate.getTime() - a.eventDate.getTime());

  // Count consecutive unexcused misses from the most recent GA backward
  let consecutiveMissed = 0;
  const missedDates: string[] = [];

  for (const ga of gaRecords) {
    if (ga.attended) {
      break; // Streak broken by attendance
    } else if (ga.isExcused) {
      continue; // Excused absence does NOT increment missed count, nor does it break the streak
    } else {
      consecutiveMissed++;
      missedDates.push(ga.eventDate.toISOString());
    }
  }

  if (consecutiveMissed >= gaThreshold) {
    const desc = `Missed ${consecutiveMissed} consecutive General Assemblies without an approved excuse.`;
    reasons.push(desc);
    rulesTriggered.push({
      rule: "MISSED_CONSECUTIVE_GAS",
      description: desc,
      supportingDates: missedDates,
    });
  }

  // Check service project activity
  const attendedServiceProjects = records
    .filter((r) => r.eventType === "SERVICE_PROJECT" && r.attended)
    .sort((a, b) => b.eventDate.getTime() - a.eventDate.getTime());

  if (attendedServiceProjects.length === 0) {
    const membershipDays = config.memberSince ? daysBetween(config.memberSince, referenceDate) : serviceThreshold;
    if (membershipDays >= serviceThreshold) {
      const desc = `No attended service projects recorded in the last ${membershipDays} days.`;
      reasons.push(desc);
      rulesTriggered.push({
        rule: "SERVICE_INACTIVITY",
        description: desc,
        supportingDates: [],
      });
    }
  } else {
    const lastProject = attendedServiceProjects[0];
    const daysSince = daysBetween(lastProject.eventDate, referenceDate);
    if (daysSince >= serviceThreshold) {
      const desc = `No qualifying service project attendance in the last ${daysSince} days (threshold: ${serviceThreshold} days).`;
      reasons.push(desc);
      rulesTriggered.push({
        rule: "SERVICE_INACTIVITY",
        description: desc,
        supportingDates: [lastProject.eventDate.toISOString()],
      });
    }
  }

  const missedRsvps = records
    .filter((record) => record.eventType === "SERVICE_PROJECT" && record.rsvpResponse === "GOING" && !record.attended)
    .sort((a, b) => b.eventDate.getTime() - a.eventDate.getTime());
  if (missedRsvps.length >= noShowThreshold) {
    const supportingDates = missedRsvps.slice(0, noShowThreshold).map((record) => record.eventDate.toISOString());
    const description = `Missed ${missedRsvps.length} service projects after RSVPing Going.`;
    reasons.push(description);
    rulesTriggered.push({ rule: "RSVP_NO_SHOWS", description, supportingDates });
  }

  return {
    isFlagged: rulesTriggered.length > 0,
    reasons,
    rulesTriggered,
    totalVolunteerHours: 0, // Computed by database aggregation in production
  };
}
