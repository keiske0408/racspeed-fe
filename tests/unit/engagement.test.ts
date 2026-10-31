import { describe, it, expect } from "vitest";
import { evaluateMemberEngagement, AttendanceRecordLike } from "@/lib/services/engagement";

describe("Engagement Scoring and Retention Rules", () => {
  const refDate = new Date("2026-10-20T12:00:00Z");

  it("flags a member who missed 3 consecutive General Assemblies", () => {
    const records: AttendanceRecordLike[] = [
      {
        eventId: "ga-1",
        eventType: "GENERAL_ASSEMBLY",
        eventDate: new Date("2026-10-15T00:00:00Z"),
        attended: false,
      },
      {
        eventId: "ga-2",
        eventType: "GENERAL_ASSEMBLY",
        eventDate: new Date("2026-10-01T00:00:00Z"),
        attended: false,
      },
      {
        eventId: "ga-3",
        eventType: "GENERAL_ASSEMBLY",
        eventDate: new Date("2026-09-15T00:00:00Z"),
        attended: false,
      },
      {
        eventId: "ga-4",
        eventType: "GENERAL_ASSEMBLY",
        eventDate: new Date("2026-09-01T00:00:00Z"),
        attended: true, // past attended GA
      },
      {
        eventId: "sp-1",
        eventType: "SERVICE_PROJECT",
        eventDate: new Date("2026-10-10T00:00:00Z"),
        attended: true,
      },
    ];

    const result = evaluateMemberEngagement(records, refDate);
    expect(result.isFlagged).toBe(true);
    expect(result.rulesTriggered.some((r) => r.rule === "MISSED_CONSECUTIVE_GAS")).toBe(true);
    expect(result.rulesTriggered.find((r) => r.rule === "MISSED_CONSECUTIVE_GAS")?.supportingDates).toHaveLength(3);
  });

  it("does not count excused absences as missed GAs", () => {
    const records: AttendanceRecordLike[] = [
      {
        eventId: "ga-1",
        eventType: "GENERAL_ASSEMBLY",
        eventDate: new Date("2026-10-15T00:00:00Z"),
        attended: false,
        isExcused: true, // Excused!
      },
      {
        eventId: "ga-2",
        eventType: "GENERAL_ASSEMBLY",
        eventDate: new Date("2026-10-01T00:00:00Z"),
        attended: false,
      },
      {
        eventId: "ga-3",
        eventType: "GENERAL_ASSEMBLY",
        eventDate: new Date("2026-09-15T00:00:00Z"),
        attended: false,
      },
      {
        eventId: "ga-4",
        eventType: "GENERAL_ASSEMBLY",
        eventDate: new Date("2026-09-01T00:00:00Z"),
        attended: true,
      },
      {
        eventId: "sp-1",
        eventType: "SERVICE_PROJECT",
        eventDate: new Date("2026-10-10T00:00:00Z"),
        attended: true,
      },
    ];

    const result = evaluateMemberEngagement(records, refDate);
    // Only 2 unexcused misses, so not flagged for consecutive misses
    expect(result.rulesTriggered.some((r) => r.rule === "MISSED_CONSECUTIVE_GAS")).toBe(false);
  });

  it("flags member with no qualifying service project in >60 days", () => {
    const records: AttendanceRecordLike[] = [
      {
        eventId: "ga-1",
        eventType: "GENERAL_ASSEMBLY",
        eventDate: new Date("2026-10-15T00:00:00Z"),
        attended: true,
      },
      {
        eventId: "sp-old",
        eventType: "SERVICE_PROJECT",
        eventDate: new Date("2026-07-01T00:00:00Z"), // >110 days ago
        attended: true,
      },
    ];

    const result = evaluateMemberEngagement(records, refDate);
    expect(result.isFlagged).toBe(true);
    expect(result.rulesTriggered.some((r) => r.rule === "SERVICE_INACTIVITY")).toBe(true);
  });

  it("flags repeated service project no-shows after an RSVP marked Going", () => {
    const records: AttendanceRecordLike[] = [
      {
        eventId: "sp-1",
        eventType: "SERVICE_PROJECT",
        eventDate: new Date("2026-10-10T00:00:00Z"),
        attended: false,
        rsvpResponse: "GOING",
      },
      {
        eventId: "sp-2",
        eventType: "SERVICE_PROJECT",
        eventDate: new Date("2026-10-01T00:00:00Z"),
        attended: false,
        rsvpResponse: "GOING",
      },
    ];

    const result = evaluateMemberEngagement(records, refDate);
    expect(result.rulesTriggered.some((rule) => rule.rule === "RSVP_NO_SHOWS")).toBe(true);
  });
});
