import { describe, expect, it } from "vitest";
import {
  createActivitySchema,
  resolveMinMembers,
} from "@/features/activities/schemas";
import {
  allowedTransitions,
  canTransition,
  compareByPriority,
  decodeSketchCommentBody,
  deduplicateActivityLog,
  encodeSketchCommentBody,
  evaluateReportReadiness,
  evaluateRsvp,
  evaluateSelfCheckIn,
  formatActivityLogEntry,
  getLifecycleStages,
  isQrCheckInApplicable,
  minMembersStatus,
  resolveActivityPriority,
  resolveArchiveState,
} from "@/features/activities/rules";
import {
  DEFAULT_REWARD_POINTS,
  earnedBadgeKeys,
  rewardPoints,
} from "@/lib/services/rewards-core";

const base = {
  clubId: "00000000-0000-0000-0000-000000000001",
  title: "Community health screening",
  shortDescription: "Health checks for families in the barangay",
  description: "A community activity.",
  location: "San Pedro",
  startAt: "2026-11-07T09:00",
  endAt: "2026-11-07T12:00",
  allDay: false,
  status: "PLANNED" as const,
  minMembersEnabled: false,
  rsvpEnabled: true,
  selfCheckInEnabled: false,
  checkInWindowMinutes: 180,
  volunteerHoursDefault: 3,
};

describe("Project Center activity creation", () => {
  it("accepts a meeting with a meeting subtype", () => {
    expect(
      createActivitySchema.safeParse({
        ...base,
        kind: "MEETING",
        meetingType: "GENERAL_ASSEMBLY",
      }).success,
    ).toBe(true);
  });

  it("requires a minimum when its toggle is enabled and clears it when disabled", () => {
    const invalid = createActivitySchema.safeParse({
      ...base,
      kind: "FELLOWSHIP",
      minMembersEnabled: true,
    });
    expect(invalid.success).toBe(false);

    const parsed = createActivitySchema.parse({
      ...base,
      kind: "FELLOWSHIP",
      minMembersEnabled: true,
      minMembersRequired: 12,
      capacity: 20,
    });
    expect(resolveMinMembers(parsed)).toBe(12);

    const disabled = createActivitySchema.parse({
      ...base,
      kind: "FELLOWSHIP",
      minMembersRequired: 12,
    });
    expect(resolveMinMembers(disabled)).toBeNull();
  });

  it("accepts project-specific fields only for a service project", () => {
    const project = createActivitySchema.safeParse({
      ...base,
      kind: "SERVICE_PROJECT",
      objective: "Improve access to maternal health services.",
      beneficiaryType: "Mothers and children",
      beneficiaryTarget: 100,
      fundingTarget: 5000,
      fundingSource: "Club and sponsor",
      areasOfFocus: ["MATERNAL_CHILD_HEALTH"],
      sdgs: [3],
      partners: [
        { name: "Community Health Center", role: "IMPLEMENTING_PARTNER" },
      ],
    });
    expect(project.success).toBe(true);
  });

  it("requires a partner link for Joint Projects", () => {
    const jointProject = {
      ...base,
      kind: "JOINT_PROJECT",
      objective: "Improve literacy access for local students.",
      beneficiaryType: "Elementary students",
      beneficiaryTarget: 100,
      fundingTarget: 5000,
      fundingSource: "Club and sponsor",
      areasOfFocus: ["BASIC_EDUCATION"],
      sdgs: [4],
      partners: [],
    };

    expect(createActivitySchema.safeParse(jointProject).success).toBe(false);
    expect(
      createActivitySchema.safeParse({
        ...jointProject,
        sisterClubId: "00000000-0000-0000-0000-000000000099",
      }).success,
    ).toBe(true);
    expect(
      createActivitySchema.safeParse({
        ...jointProject,
        sisterClubName: "Rotaract Club of Manila Metro",
      }).success,
    ).toBe(true);
  });

  it("rejects an end time before the start time", () => {
    const result = createActivitySchema.safeParse({
      ...base,
      kind: "OTHER",
      endAt: "2026-11-07T08:00",
    });
    expect(result.success).toBe(false);
  });

  it("accepts multiple partners without a singular Joint Project binding", () => {
    const parsed = createActivitySchema.parse({
      ...base,
      kind: "JOINT_PROJECT",
      partners: [
        {
          name: "Manila",
          sisterClubId: "00000000-0000-0000-0000-000000000099",
        },
        {
          name: "Taipei Diamond",
          sisterClubId: "00000000-0000-0000-0000-000000000098",
        },
      ],
    });
    expect("partners" in parsed && parsed.partners).toHaveLength(2);
  });

  it("limits project partners to 20", () => {
    expect(
      createActivitySchema.safeParse({
        ...base,
        kind: "JOINT_PROJECT",
        partners: Array.from({ length: 21 }, (_, index) => ({
          name: `Partner ${index}`,
        })),
      }).success,
    ).toBe(false);
  });
});

describe("RSVP and self check-in rules", () => {
  it("tracks the shortfall against a configured minimum", () => {
    expect(minMembersStatus(8, 12)).toEqual({
      required: 12,
      confirmed: 8,
      shortfall: 4,
      met: false,
    });
    expect(minMembersStatus(8, null).met).toBe(true);
  });

  it("blocks RSVP when capacity is full, without blocking an existing going response", () => {
    const common = {
      status: "PLANNED" as const,
      rsvpEnabled: true,
      rsvpDeadline: null,
      startAt: "2026-11-07T09:00:00.000Z",
      capacity: 10,
      goingCount: 10,
      isParticipant: true,
      now: new Date("2026-11-01T00:00:00Z"),
    };
    expect(
      evaluateRsvp({ ...common, currentResponse: null, nextResponse: "GOING" })
        .allowed,
    ).toBe(false);
    expect(
      evaluateRsvp({
        ...common,
        currentResponse: "GOING",
        nextResponse: "GOING",
      }).allowed,
    ).toBe(true);
  });

  it("allows enabled self check-in in-window for a participant and rejects an early attempt", () => {
    const activity = {
      status: "PLANNED" as const,
      selfCheckInEnabled: true,
      startAt: "2026-11-07T09:00:00.000Z",
      endAt: "2026-11-07T12:00:00.000Z",
      checkInWindowMinutes: 180,
    };
    expect(
      evaluateSelfCheckIn({
        activity,
        now: new Date("2026-11-07T08:45:00.000Z"),
        isParticipant: true,
        alreadyCheckedIn: false,
      }).allowed,
    ).toBe(true);
    expect(
      evaluateSelfCheckIn({
        activity,
        now: new Date("2026-11-07T07:00:00.000Z"),
        isParticipant: true,
        alreadyCheckedIn: false,
      }).allowed,
    ).toBe(false);
  });

  it("closes self check-in when the activity ends even if the configured window is longer", () => {
    expect(
      evaluateSelfCheckIn({
        activity: {
          status: "PLANNED",
          selfCheckInEnabled: true,
          startAt: "2026-11-07T09:00:00.000Z",
          endAt: "2026-11-07T10:00:00.000Z",
          checkInWindowMinutes: 360,
        },
        now: new Date("2026-11-07T10:05:00.000Z"),
        isParticipant: true,
        alreadyCheckedIn: false,
      }).allowed,
    ).toBe(false);
  });
});

describe("Member engagement rewards", () => {
  it("uses the configured points value and falls back to defaults", () => {
    expect(rewardPoints("CHECK_IN")).toBe(10);
    expect(rewardPoints("SERVICE_CHECK_IN")).toBe(20);
    expect(rewardPoints("TASK_COMPLETED", { TASK_COMPLETED: 8.5 })).toBe(8);
    expect(rewardPoints("NO_SHOW", { NO_SHOW: "invalid" })).toBe(-3);
    expect(DEFAULT_REWARD_POINTS.RSVP_HONORED).toBe(2);
  });

  it("awards one-time badges at their activity thresholds", () => {
    expect(
      earnedBadgeKeys({ checkIns: 1, serviceCheckIns: 0, completedTasks: 0 }),
    ).toContain("FIRST_CHECK_IN");
    expect(
      earnedBadgeKeys({
        checkIns: 10,
        serviceCheckIns: 10,
        completedTasks: 10,
      }),
    ).toEqual([
      "FIRST_CHECK_IN",
      "FIRST_SERVICE",
      "SERVICE_10",
      "TASK_FINISHER",
    ]);
  });
});

describe("QR attendance applicability and toggle", () => {
  it("defaults qrCheckInEnabled to true when omitted", () => {
    const parsed = createActivitySchema.safeParse({
      ...base,
      kind: "MEETING",
      meetingType: "GENERAL_ASSEMBLY",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.qrCheckInEnabled).toBe(true);
    }
  });

  it("allows setting qrCheckInEnabled to false for promotional and campaign projects", () => {
    const parsed = createActivitySchema.safeParse({
      ...base,
      kind: "SERVICE_PROJECT",
      title: "Recruitment and PR Drive",
      qrCheckInEnabled: false,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.qrCheckInEnabled).toBe(false);
    }
  });

  it("correctly identifies promotional / recruitment activities as not requiring QR", () => {
    expect(
      isQrCheckInApplicable({
        title: "Rotaract Social Media Promotions and Content Blast",
        category: "PROMOTIONS",
      })
    ).toBe(false);

    expect(
      isQrCheckInApplicable({
        title: "Campus Membership Recruitment Week",
        category: "RECRUITMENT",
      })
    ).toBe(false);

    expect(
      isQrCheckInApplicable({
        title: "Community Feeding Program",
        category: "SERVICE PROJECT",
      })
    ).toBe(true);
  });
  it("accepts an explicit ownerId and permits statuses like ONGOING or COMPLETED", () => {
    const parsed = createActivitySchema.safeParse({
      ...base,
      kind: "SERVICE_PROJECT",
      ownerId: "00000000-0000-0000-0000-000000000099",
      status: "ONGOING",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.ownerId).toBe("00000000-0000-0000-0000-000000000099");
      expect(parsed.data.status).toBe("ONGOING");
    }
  });
  it("resolves archive state from explicit columns or activity_log audit trail and blocks RSVP/check-in when archived", () => {
    expect(
      resolveArchiveState({
        is_archived: true,
        archived_at: "2026-11-05T10:00:00Z",
      }),
    ).toEqual({
      isArchived: true,
      archivedAt: "2026-11-05T10:00:00Z",
    });

    expect(
      resolveArchiveState({
        activity_log: [
          { action: "CREATED", created_at: "2026-10-01T08:00:00Z" },
          { action: "ARCHIVED", created_at: "2026-11-01T09:00:00Z" },
        ],
      }),
    ).toEqual({
      isArchived: true,
      archivedAt: "2026-11-01T09:00:00Z",
    });

    expect(
      resolveArchiveState({
        activity_log: [
          { action: "ARCHIVED", created_at: "2026-11-01T09:00:00Z" },
          { action: "UNARCHIVED", created_at: "2026-11-02T12:00:00Z" },
        ],
      }),
    ).toEqual({
      isArchived: false,
      archivedAt: null,
    });

    expect(
      evaluateRsvp({
        status: "PLANNED",
        isArchived: true,
        rsvpEnabled: true,
        rsvpDeadline: null,
        startAt: "2026-11-07T09:00:00.000Z",
        capacity: 10,
        goingCount: 2,
        currentResponse: null,
        nextResponse: "GOING",
        isParticipant: true,
        now: new Date("2026-11-01T00:00:00Z"),
      }).allowed,
    ).toBe(false);

    expect(
      evaluateSelfCheckIn({
        activity: {
          status: "PLANNED",
          isArchived: true,
          selfCheckInEnabled: true,
          startAt: "2026-11-07T09:00:00.000Z",
          endAt: "2026-11-07T12:00:00.000Z",
          checkInWindowMinutes: 180,
        },
        now: new Date("2026-11-07T09:15:00.000Z"),
        isParticipant: true,
        alreadyCheckedIn: false,
      }).allowed,
    ).toBe(false);
  });

  it("enforces that hard delete is only permitted for archived activities", () => {
    // Active project must not be eligible for hard deletion
    const activeProject = {
      is_archived: false,
      archived_at: null,
    };
    expect(resolveArchiveState(activeProject).isArchived).toBe(false);

    // Explicitly archived project is eligible for permanent hard deletion
    const archivedProject = {
      is_archived: true,
      archived_at: "2026-11-05T12:00:00Z",
    };
    expect(resolveArchiveState(archivedProject).isArchived).toBe(true);

    // Audit trail archived project is eligible for permanent hard deletion
    const auditArchivedProject = {
      activity_log: [
        { action: "ARCHIVED", created_at: "2026-11-05T12:00:00Z" },
      ],
    };
    expect(resolveArchiveState(auditArchivedProject).isArchived).toBe(true);
  });
});

describe("Project Lifecycle & Accomplishment Report Readiness", () => {
  it("guides service projects through 4 stages: PLANNED -> ONGOING -> AWAITING_REPORT -> ACCOMPLISHED", () => {
    const ongoingStages = getLifecycleStages("ONGOING", true);
    expect(ongoingStages).toHaveLength(4);
    expect(ongoingStages.map((s) => [s.status, s.state])).toEqual([
      ["PLANNED", "completed"],
      ["ONGOING", "current"],
      ["AWAITING_REPORT", "upcoming"],
      ["ACCOMPLISHED", "upcoming"],
    ]);

    const accomplishedStages = getLifecycleStages("ACCOMPLISHED", true);
    expect(accomplishedStages.every((s) => s.state === "completed")).toBe(true);
  });

  it("guides non-project activities through 3 stages: PLANNED -> ONGOING -> COMPLETED", () => {
    const stages = getLifecycleStages("ONGOING", false);
    expect(stages).toHaveLength(3);
    expect(stages.map((s) => [s.status, s.state])).toEqual([
      ["PLANNED", "completed"],
      ["ONGOING", "current"],
      ["COMPLETED", "upcoming"],
    ]);
  });

  it("restricts manual status transitions for service projects to AWAITING_REPORT instead of COMPLETED", () => {
    expect(canTransition("ONGOING", "COMPLETED", true).allowed).toBe(false);
    expect(canTransition("ONGOING", "AWAITING_REPORT", true).allowed).toBe(true);
    expect(allowedTransitions("ONGOING", true)).toContain("AWAITING_REPORT");
    expect(allowedTransitions("ONGOING", true)).not.toContain("COMPLETED");
  });

  it("evaluates accomplishment report readiness and pinpoints missing requirements", () => {
    const incomplete = evaluateReportReadiness({
      detailedDescription: "Too short",
      inspiration: "Short",
      objective: "Short",
      outcomesSummary: "Short",
      beneficiaryType: "Families",
      mediaCount: 0,
    });
    expect(incomplete.ready).toBe(false);
    expect(incomplete.completedCount).toBe(1); // beneficiaryType >= 2 chars
    expect(incomplete.totalCount).toBe(6);
    expect(incomplete.missingLabels).toEqual([
      "Detailed description",
      "Project inspiration",
      "Project objective",
      "Outcomes & measurement",
      "Documentation photo",
    ]);

    const complete = evaluateReportReadiness({
      detailedDescription:
        "Distributed 150 hygiene kits and conducted dental education for families in Barangay San Antonio.",
      inspiration:
        "Local barangay health workers identified a high rate of preventable dental issues.",
      objective:
        "Provide 150 families with dental kits and preventive care instruction.",
      outcomesSummary:
        "Improved oral health awareness and provided 3-month supply of essentials to 150 households.",
      beneficiaryType: "Children & families in Brgy. San Antonio",
      mediaCount: 3,
    });
    expect(complete.ready).toBe(true);
    expect(complete.completedCount).toBe(6);
    expect(complete.percent).toBe(100);
    expect(complete.missingLabels).toHaveLength(0);
  });

  it("formats technical activity log codes into human-friendly milestones and collapses duplicates", () => {
    const published = formatActivityLogEntry("REPORT_PUBLISHED", {
      submissionId: "sub-1",
    });
    expect(published.tone).toBe("emerald");
    expect(published.isMilestone).toBe(true);
    expect(published.title).toContain("Accomplished");

    const statusOngoing = formatActivityLogEntry("STATUS_CHANGED", {
      status: "ONGOING",
    });
    expect(statusOngoing.title).toContain("Ongoing");

    const deduped = deduplicateActivityLog([
      { action: "REPORT_PUBLISHED", details: {} },
      { action: "STATUS_CHANGED", details: { status: "ONGOING" } },
      { action: "STATUS_CHANGED", details: { status: "ONGOING" } },
      { action: "QR_GENERATED", details: {} },
      { action: "QR_GENERATED", details: {} },
      { action: "UPDATED", details: {} },
    ]);
    expect(deduped).toHaveLength(4);
  });

  it("supports creating L&D and Meeting activities without beneficiaries alongside initial tasks", () => {
    const lndParsed = createActivitySchema.safeParse({
      ...base,
      kind: "PROFESSIONAL_DEVELOPMENT",
      title: "L&D Session: Leadership & Public Speaking",
      initialTasks: [
        {
          title: "Prepare slide deck and handouts",
          dueDate: "2026-11-06",
          priority: "HIGH",
          assigneeId: "00000000-0000-0000-0000-000000000099",
        },
      ],
    });
    expect(lndParsed.success).toBe(true);
    if (lndParsed.success) {
      expect(lndParsed.data.initialTasks).toHaveLength(1);
      expect(lndParsed.data.initialTasks[0]?.title).toBe(
        "Prepare slide deck and handouts",
      );
    }
  });

  it("validates priority values on creation and falls back cleanly for legacy activities", () => {
    const urgentParsed = createActivitySchema.safeParse({
      ...base,
      kind: "SERVICE_PROJECT",
      objective: "Improve literacy access for local students.",
      beneficiaryType: "Elementary students",
      areasOfFocus: ["BASIC_EDUCATION"],
      sdgs: [4],
      partners: [],
      priority: "URGENT",
    });
    expect(urgentParsed.success).toBe(true);
    if (urgentParsed.success) {
      expect(urgentParsed.data.priority).toBe("URGENT");
    }

    const defaultParsed = createActivitySchema.safeParse({
      ...base,
      kind: "FELLOWSHIP",
    });
    expect(defaultParsed.success).toBe(true);
    if (defaultParsed.success) {
      expect(defaultParsed.data.priority).toBe("MEDIUM");
    }

    expect(resolveActivityPriority({ priority: "HIGH" })).toBe("HIGH");
    expect(resolveActivityPriority({ priority: "UNKNOWN" })).toBe("MEDIUM");
    expect(resolveActivityPriority({ priority: null })).toBe("MEDIUM");
    expect(
      resolveActivityPriority({
        priority: null,
        activity_log: [
          {
            action: "PRIORITY_CHANGED",
            details: { priority: "URGENT" },
            created_at: "2026-11-01T10:00:00Z",
          },
        ],
      }),
    ).toBe("URGENT");

    const ordered = (
      [
        { priority: "LOW" },
        { priority: "URGENT" },
        { priority: "MEDIUM" },
        { priority: "HIGH" },
      ] as const
    )
      .slice()
      .sort((a, b) => compareByPriority(a, b))
      .map((item) => item.priority);
    expect(ordered).toEqual(["URGENT", "HIGH", "MEDIUM", "LOW"]);
  });

  it("encodes and decodes discussion paint sketch bodies cleanly", () => {
    const encoded = encodeSketchCommentBody({
      title: "Venue Layout & Registration Table",
      storagePath: "club-1/act-1/discussion-sketches/sketch-123.png",
      summary: "Place registration booth near the main hall entrance.",
    });

    const decoded = decodeSketchCommentBody(encoded);
    expect(decoded.sketch).toEqual({
      title: "Venue Layout & Registration Table",
      storagePath: "club-1/act-1/discussion-sketches/sketch-123.png",
    });
    expect(decoded.text).toBe(
      "Place registration booth near the main hall entrance.",
    );

    const plain = decodeSketchCommentBody("Normal discussion reply without sketch");
    expect(plain.sketch).toBeNull();
    expect(plain.text).toBe("Normal discussion reply without sketch");
  });
});
