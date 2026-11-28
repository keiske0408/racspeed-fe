import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  MAX_RECURRENCE_OCCURRENCES,
  computeSeriesBoundsLocal,
  expandActivityOccurrences,
  formatRecurrenceSummary,
  getNextActivityOccurrence,
} from "@/features/activities/recurrence";
import {
  mapAiDraftToFormDraft,
  sanitizeAndValidateAiDraft,
} from "@/features/activities/ai-draft-schema";
import { createActivitySchema } from "@/features/activities/schemas";
import { isoToManilaLocal } from "@/lib/utils/dates";
import { DEFAULT_CLUB_ID, type ActivitySummaryDTO } from "@/features/activities/types";
import type { ActivityCalendar as ActivityCalendarType } from "@/app/(app)/project-center/_components/activity-calendar";

let ActivityCalendar: typeof ActivityCalendarType;

function makeSummary(
  overrides: Partial<ActivitySummaryDTO> = {},
): ActivitySummaryDTO {
  return {
    id: "act-rec-1",
    clubId: DEFAULT_CLUB_ID,
    kind: "JOINT_PROJECT",
    meetingType: null,
    title: "Project ELEMENOPI",
    shortDescription: "Flagship partnership project",
    location: "Nuvali / Calamba",
    startAt: "2026-11-28T09:00:00+08:00",
    endAt: "2026-12-20T17:00:00+08:00",
    allDay: false,
    status: "PLANNED",
    priority: "MEDIUM",
    committee: "COMMUNITY_SERVICE",
    ownerId: "user-1",
    ownerName: "Pres Glenn",
    isTeamMember: true,
    myTeamRole: "CHAIR",
    teamMembers: [],
    minMembersRequired: null,
    capacity: null,
    rsvpEnabled: true,
    rsvpDeadline: null,
    selfCheckInEnabled: false,
    qrCheckInEnabled: true,
    checkInWindowMinutes: 180,
    volunteerHoursDefault: 4,
    rsvp: { going: 5, maybe: 0, notGoing: 0 },
    myRsvp: "GOING",
    attendeesCount: 0,
    checkedIn: false,
    tasksTotal: 0,
    tasksDone: 0,
    commentsCount: 0,
    coverUrl: null,
    recurrence: null,
    ...overrides,
  };
}

describe("Activity Recurrence Engine", () => {
  beforeAll(async () => {
    vi.resetModules();
    vi.doMock("server-only", () => ({}));
    vi.doMock("next/link", () => ({
      default: ({
        href,
        children,
        ...props
      }: {
        href: string;
        children: React.ReactNode;
        [key: string]: unknown;
      }) => (
        <a href={href} {...props}>
          {children}
        </a>
      ),
    }));
    const mod = await import(
      "@/app/(app)/project-center/_components/activity-calendar"
    );
    ActivityCalendar = mod.ActivityCalendar;
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  afterAll(() => {
    vi.doUnmock("server-only");
    vi.doUnmock("next/link");
    vi.resetModules();
  });

  it("expands CUSTOM_DATES to only exact dates without filling gaps in between", () => {
    const occurrences = expandActivityOccurrences({
      startAt: "2026-11-28T09:00:00+08:00",
      endAt: "2026-12-20T17:00:00+08:00",
      recurrence: {
        frequency: "CUSTOM_DATES",
        dates: ["2026-12-20", "2026-11-28", "2026-11-28"],
        sessionEndTime: "17:00",
      },
    });

    expect(occurrences.map((o) => o.dateKey)).toEqual([
      "2026-11-28",
      "2026-12-20",
    ]);
    expect(occurrences[0]).toMatchObject({
      dateKey: "2026-11-28",
      index: 1,
      total: 2,
    });
    expect(isoToManilaLocal(occurrences[0].endAt)).toBe("2026-11-28T17:00");
    expect(isoToManilaLocal(occurrences[1].startAt)).toBe("2026-12-20T09:00");
    expect(isoToManilaLocal(occurrences[1].endAt)).toBe("2026-12-20T17:00");
  });

  it("preserves contiguous single-event multi-day expansion when recurrence is null or NONE", () => {
    const single = expandActivityOccurrences({
      startAt: "2026-11-28T09:00:00+08:00",
      endAt: "2026-11-30T17:00:00+08:00",
      recurrence: null,
    });
    expect(single.map((o) => o.dateKey)).toEqual([
      "2026-11-28",
      "2026-11-29",
      "2026-11-30",
    ]);
  });

  it("expands WEEKLY, BIWEEKLY, MONTHLY series and caps at MAX_RECURRENCE_OCCURRENCES", () => {
    const weekly = expandActivityOccurrences({
      startAt: "2026-11-07T08:00:00+08:00",
      endAt: "2026-11-28T11:00:00+08:00",
      recurrence: {
        frequency: "WEEKLY",
        until: "2026-11-28",
        sessionEndTime: "11:00",
      },
    });
    expect(weekly.map((o) => o.dateKey)).toEqual([
      "2026-11-07",
      "2026-11-14",
      "2026-11-21",
      "2026-11-28",
    ]);

    const biweekly = expandActivityOccurrences({
      startAt: "2026-11-07T08:00:00+08:00",
      endAt: "2026-12-05T11:00:00+08:00",
      recurrence: {
        frequency: "BIWEEKLY",
        until: "2026-12-05",
        sessionEndTime: "11:00",
      },
    });
    expect(biweekly.map((o) => o.dateKey)).toEqual([
      "2026-11-07",
      "2026-11-21",
      "2026-12-05",
    ]);

    const monthlyEndOfMonth = expandActivityOccurrences({
      startAt: "2027-01-31T18:00:00+08:00",
      endAt: "2027-03-31T20:00:00+08:00",
      recurrence: {
        frequency: "MONTHLY",
        until: "2027-03-31",
        sessionEndTime: "20:00",
      },
    });
    expect(monthlyEndOfMonth.map((o) => o.dateKey)).toEqual([
      "2027-01-31",
      "2027-02-28",
      "2027-03-31",
    ]);

    const capped = expandActivityOccurrences({
      startAt: "2026-01-03T09:00:00+08:00",
      endAt: "2028-12-30T11:00:00+08:00",
      recurrence: {
        frequency: "WEEKLY",
        until: "2028-12-30",
        sessionEndTime: "11:00",
      },
    });
    expect(capped).toHaveLength(MAX_RECURRENCE_OCCURRENCES);
  });

  it("computes series bounds, readable summary, and next upcoming occurrence", () => {
    const bounds = computeSeriesBoundsLocal({
      startAtLocal: "2026-11-28T09:00",
      endAtLocal: "2026-11-28T17:00",
      recurrence: {
        frequency: "CUSTOM_DATES",
        dates: ["2026-12-20", "2026-11-28"],
        sessionEndTime: "16:30",
      },
    });
    expect(bounds.startAtLocal).toBe("2026-11-28T09:00");
    expect(bounds.endAtLocal).toBe("2026-12-20T16:30");

    const summary = formatRecurrenceSummary(
      bounds.recurrence,
      "2026-11-28T09:00:00+08:00",
      "2026-12-20T16:30:00+08:00",
    );
    expect(summary).toContain("2 sessions");
    expect(summary).toContain("Nov 28");
    expect(summary).toContain("Dec 20");

    const next = getNextActivityOccurrence(
      {
        startAt: "2026-11-28T09:00:00+08:00",
        endAt: "2026-12-20T16:30:00+08:00",
        recurrence: bounds.recurrence,
      },
      new Date("2026-12-01T00:00:00+08:00"),
    );
    expect(next?.dateKey).toBe("2026-12-20");
    expect(next?.index).toBe(2);
  });

  it("auto-detects CUSTOM_DATES recurrence in AI draft mapping and validates via Zod", () => {
    const validated = sanitizeAndValidateAiDraft(
      {
        project: {
          kind: "JOINT_PROJECT",
          title: "Project ELEMENOPI",
          shortDescription: "Flagship long-term project on Nov 28 and Dec 20",
          description: "Join us on Nov 28 and/or Dec 20.",
          startAt: "Nov 28",
          endAt: "Dec 20",
          allDay: false,
          status: "DRAFT",
          dates_mentioned: [
            { date: "Nov 28", label: "Session 1" },
            { date: "Dec 20", label: "Session 2" },
          ],
        },
        activities: [
          {
            title: "Coordinate joint project dates with RAC Nuvali",
            description: "Confirm logistics for Nov 28 and Dec 20.",
            dueDate: "2026-11-26",
            priority: "HIGH",
            status: "TODO",
            order: 1,
          },
        ],
        missing_info: [],
      },
      "2026-11-24",
    );
    expect(validated.success).toBe(true);
    if (!validated.success) return;

    const mapped = mapAiDraftToFormDraft(validated.data, {
      todayIso: "2026-11-24",
      partnerClubs: [],
    });

    expect(mapped.form.recurrence).toEqual({
      frequency: "CUSTOM_DATES",
      dates: ["2026-11-28", "2026-12-20"],
      sessionEndTime: "17:00",
    });

    const parsed = createActivitySchema.safeParse({
      clubId: DEFAULT_CLUB_ID,
      kind: mapped.form.kind,
      title: mapped.form.title,
      shortDescription: mapped.form.shortDescription,
      description: mapped.form.description,
      location: mapped.form.location,
      startAt: mapped.form.startAt,
      endAt: mapped.form.endAt,
      allDay: mapped.form.allDay,
      status: mapped.form.status,
      recurrence: mapped.form.recurrence,
      partners: [{ name: "RAC Nuvali", role: "IMPLEMENTING_PARTNER" }],
    });
    expect(parsed.success).toBe(true);
  });

  it("renders recurring custom-date sessions cleanly in ActivityCalendar without painting gap days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-28T04:00:00Z"));

    const activity = makeSummary({
      recurrence: {
        frequency: "CUSTOM_DATES",
        dates: ["2026-11-28", "2026-12-20"],
        sessionEndTime: "17:00",
      },
    });

    render(<ActivityCalendar activities={[activity]} tasks={[]} />);

    // Only Nov 28 is plotted once (Session 1/2); gap dates stay empty
    const novMatches = screen.getAllByTitle("Project ELEMENOPI (Session 1/2)");
    expect(novMatches).toHaveLength(1);
    expect(screen.queryByTitle("Project ELEMENOPI")).toBeNull();

    // Navigate to December 2026 and check Session 2/2 + Agenda view
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(
      screen.getAllByTitle("Project ELEMENOPI (Session 2/2)"),
    ).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Agenda" }));
    expect(screen.getByText("Session 2/2")).toBeInTheDocument();
  });
});

