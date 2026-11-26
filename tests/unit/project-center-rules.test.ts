import { describe, expect, it } from "vitest";
import {
  formatCompactWhenManila,
  formatRelativeWhenManila,
  getActivityStepProgress,
  getAssignmentInfo,
  getContextualRowAction,
  getProjectStageTab,
  isDraftStartingSoon,
  isPastDue,
  needsAttention,
} from "@/features/activities/project-center-rules";

// Reference point: 2026-11-26 10:00 Asia/Manila
const NOW = new Date("2026-11-26T10:00:00+08:00");

describe("Project Center lifecycle, attention & Manila date rules", () => {
  it("flags Draft or Planned items whose end date passed as past due, but not Ongoing or Accomplished", () => {
    expect(
      isPastDue(
        { status: "PLANNED", endAt: "2026-11-21T12:00:00+08:00" },
        NOW,
      ),
    ).toBe(true);
    expect(
      isPastDue(
        { status: "DRAFT", endAt: "2026-11-21T12:00:00+08:00" },
        NOW,
      ),
    ).toBe(true);
    expect(
      isPastDue(
        { status: "ONGOING", endAt: "2026-11-21T12:00:00+08:00" },
        NOW,
      ),
    ).toBe(false);
    expect(
      isPastDue(
        { status: "ACCOMPLISHED", endAt: "2026-11-21T12:00:00+08:00" },
        NOW,
      ),
    ).toBe(false);
    expect(
      isPastDue(
        { status: "PLANNED", endAt: "2026-11-30T12:00:00+08:00" },
        NOW,
      ),
    ).toBe(false);
  });

  it("flags drafts starting within 7 days in Asia/Manila as starting soon", () => {
    expect(
      isDraftStartingSoon(
        {
          status: "DRAFT",
          startAt: "2026-11-28T09:00:00+08:00",
          endAt: "2026-12-20T17:00:00+08:00",
        },
        NOW,
      ),
    ).toBe(true);
    expect(
      isDraftStartingSoon(
        {
          status: "DRAFT",
          startAt: "2026-12-03T09:00:00+08:00",
          endAt: "2026-12-03T17:00:00+08:00",
        },
        NOW,
      ),
    ).toBe(true);
    expect(
      isDraftStartingSoon(
        {
          status: "DRAFT",
          startAt: "2026-12-04T09:00:00+08:00",
          endAt: "2026-12-04T17:00:00+08:00",
        },
        NOW,
      ),
    ).toBe(false);
    expect(
      needsAttention(
        {
          status: "PLANNED",
          startAt: "2026-11-28T09:00:00+08:00",
          endAt: "2026-12-20T17:00:00+08:00",
        },
        NOW,
      ),
    ).toBe(false);
  });

  it("derives consistent Step X of Y counts for Draft and Planned across 3-step and 4-step tracks", () => {
    expect(getActivityStepProgress("JOINT_PROJECT", "DRAFT")).toEqual({
      step: 1,
      total: 4,
      segments: ["current", "upcoming", "upcoming", "upcoming"],
    });
    expect(getActivityStepProgress("SERVICE_PROJECT", "PLANNED")).toEqual({
      step: 1,
      total: 4,
      segments: ["current", "upcoming", "upcoming", "upcoming"],
    });
    expect(getActivityStepProgress("MEETING", "DRAFT")).toEqual({
      step: 1,
      total: 3,
      segments: ["current", "upcoming", "upcoming"],
    });
    expect(getActivityStepProgress("MEETING", "PLANNED")).toEqual({
      step: 1,
      total: 3,
      segments: ["current", "upcoming", "upcoming"],
    });
    expect(getActivityStepProgress("SERVICE_PROJECT", "AWAITING_REPORT").step).toBe(3);
    expect(getActivityStepProgress("SERVICE_PROJECT", "ACCOMPLISHED").step).toBe(4);
    expect(getActivityStepProgress("MEETING", "COMPLETED")).toEqual({
      step: 3,
      total: 3,
      segments: ["done", "done", "done"],
    });
  });

  it("formats compact Manila dates and relative timing (ended ago, today, tomorrow, in N days, in N months)", () => {
    expect(
      formatCompactWhenManila({
        startAt: "2026-11-21T05:00:00+08:00",
        endAt: "2026-11-21T12:00:00+08:00",
        allDay: false,
      }),
    ).toBe("Sat, Nov 21 · 5 AM – 12 PM");

    expect(
      formatRelativeWhenManila(
        {
          status: "PLANNED",
          startAt: "2026-11-21T05:00:00+08:00",
          endAt: "2026-11-21T12:00:00+08:00",
        },
        NOW,
      ),
    ).toBe("Ended 5 days ago");

    expect(
      formatRelativeWhenManila(
        {
          status: "DRAFT",
          startAt: "2026-11-28T00:00:00+08:00",
          endAt: "2026-12-20T00:00:00+08:00",
        },
        NOW,
      ),
    ).toBe("Starts in 2 days");

    expect(
      formatRelativeWhenManila(
        {
          status: "PLANNED",
          startAt: "2026-12-12T09:00:00+08:00",
          endAt: "2026-12-13T12:00:00+08:00",
        },
        NOW,
      ),
    ).toBe("In 16 days");

    expect(
      formatRelativeWhenManila(
        {
          status: "PLANNED",
          startAt: "2027-02-26T09:00:00+08:00",
          endAt: "2027-02-28T17:00:00+08:00",
        },
        NOW,
      ),
    ).toBe("In 3 months");
  });

  it("returns exact contextual button labels and routes per status", () => {
    expect(
      getContextualRowAction(
        {
          id: "a1",
          kind: "OTHER",
          status: "PLANNED",
          endAt: "2026-11-16T12:00:00+08:00",
        },
        NOW,
      ),
    ).toEqual({
      label: "Update status",
      href: "/project-center/a1",
      tone: "attention",
    });
    expect(
      getContextualRowAction(
        {
          id: "a2",
          kind: "JOINT_PROJECT",
          status: "DRAFT",
          endAt: "2026-12-20T12:00:00+08:00",
        },
        NOW,
      ).label,
    ).toBe("Finish draft");
    expect(
      getContextualRowAction(
        {
          id: "a3",
          kind: "SERVICE_PROJECT",
          status: "AWAITING_REPORT",
          endAt: "2026-11-25T12:00:00+08:00",
        },
        NOW,
      ),
    ).toEqual({
      label: "Write report",
      href: "/project-center/a3?tab=REPORT",
      tone: "primary",
    });
    expect(
      getContextualRowAction(
        {
          id: "a4",
          kind: "SERVICE_PROJECT",
          status: "ACCOMPLISHED",
          endAt: "2026-11-10T12:00:00+08:00",
        },
        NOW,
      ),
    ).toEqual({
      label: "View report",
      href: "/project-center/a4?tab=REPORT",
      tone: "default",
    });
  });

  it("identifies person assignments across owner, team member, and task assignee", () => {
    expect(
      getAssignmentInfo(
        { id: "p1", ownerId: "u1", ownerName: "Ian", isTeamMember: true, myTeamRole: "CHAIR" },
        "u1",
      ),
    ).toEqual({ isAssignedToMe: true, myLabel: "You (Lead)", leadName: "Ian" });

    expect(
      getAssignmentInfo(
        {
          id: "p2",
          ownerId: "u2",
          ownerName: "Alice",
          isTeamMember: true,
          myTeamRole: "CO_CHAIR",
        },
        "u1",
      ),
    ).toEqual({
      isAssignedToMe: true,
      myLabel: "You (Co-Chair)",
      leadName: "Alice",
    });

    expect(
      getAssignmentInfo(
        { id: "p3", ownerId: "u2", ownerName: "Alice" },
        "u1",
        new Set(["p3"]),
      ),
    ).toEqual({
      isAssignedToMe: true,
      myLabel: "You (Task assigned)",
      leadName: "Alice",
    });

    expect(
      getProjectStageTab({
        status: "AWAITING_REPORT",
        endAt: "2026-12-01T12:00:00+08:00",
        isArchived: false,
      }),
    ).toBe("REPORT_DUE");
    expect(
      getProjectStageTab(
        {
          status: "PLANNED",
          endAt: "2026-11-21T12:00:00+08:00",
          isArchived: false,
        },
        NOW,
      ),
    ).toBe("MISSED");
    expect(
      getProjectStageTab(
        {
          status: "ACCOMPLISHED",
          endAt: "2026-11-21T12:00:00+08:00",
          isArchived: true,
        },
        NOW,
      ),
    ).toBe("ARCHIVED");
  });
});

