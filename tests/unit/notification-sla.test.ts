import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_NOTIFICATION_SLA_CONFIG,
  normalizeNotificationSlaConfig,
  type NotificationSlaConfig,
} from "@/lib/services/notifications/sla-config";
import type { GroupTaskDTO } from "@/lib/data/tasks-types";

const CLUB_ID = "00000000-0000-0000-0000-000000000001";
const USER_ACTOR = "11111111-1111-4111-8111-111111111111";
const USER_ASSIGNEE = "22222222-2222-4222-8222-222222222222";
const USER_OWNER = "33333333-3333-4333-8333-333333333333";
const USER_FOLLOWER = "44444444-4444-4444-8444-444444444444";
const PROJECT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const dispatched: Array<Record<string, unknown>> = [];
const slaStoreMock = new Map<string, NotificationSlaConfig>();

let sampleTasks: GroupTaskDTO[] = [];
let sampleActivities: Array<Record<string, unknown>> = [];
let failMissingSlaColumnOnce = false;
let lastAppSettingsUpsertPayloads: Array<Record<string, unknown>> = [];

const dispatchNotificationMock = vi.fn(async (input: Record<string, unknown>) => {
  dispatched.push(input);
  return {
    created: true,
    notificationId: `notif-${dispatched.length}`,
    deliveryCount: 1,
    deliveryStatuses: ["SENT"],
  };
});

function createAdminMock() {
  return {
    from: vi.fn((table: string) => {
      if (table === "activities") {
        const query = {
          select: vi.fn(() => query),
          eq: vi.fn(() => query),
          neq: vi.fn(async () => ({ data: sampleActivities, error: null })),
          in: vi.fn(async () => ({
            data: sampleActivities.map((a) => ({
              id: a.id,
              owner_id: a.owner_id,
            })),
            error: null,
          })),
          maybeSingle: vi.fn(async () => ({
            data: sampleActivities[0] ?? null,
            error: null,
          })),
        };
        return query;
      }

      if (table === "activity_team") {
        const query = {
          select: vi.fn(() => query),
          eq: vi.fn(() => query),
          in: vi.fn(async () => ({ data: [], error: null })),
        };
        return query;
      }

      if (table === "clubs") {
        return {
          update: vi.fn(() => ({
            eq: vi.fn(async () => ({ error: null })),
          })),
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({ data: null, error: null })),
            })),
          })),
        };
      }

      if (table === "app_settings") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({ data: null, error: null })),
            })),
          })),
          upsert: vi.fn(async (payload: Record<string, unknown>) => {
            lastAppSettingsUpsertPayloads.push(payload);
            if (
              failMissingSlaColumnOnce &&
              "notification_sla_config" in payload
            ) {
              failMissingSlaColumnOnce = false;
              return {
                error: {
                  message:
                    "Could not find the 'notification_sla_config' column of 'app_settings' in the schema cache",
                },
              };
            }
            return { error: null };
          }),
        };
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          })),
        })),
      };
    }),
  };
}

let notifyTaskAssigned: typeof import("@/lib/services/notifications/task-notifications").notifyTaskAssigned;
let notifyTaskStatusMarked: typeof import("@/lib/services/notifications/task-notifications").notifyTaskStatusMarked;
let notifyTaskChecklistMarked: typeof import("@/lib/services/notifications/task-notifications").notifyTaskChecklistMarked;
let evaluateDeadlineAndSlaNotifications: typeof import("@/lib/services/notifications/sla-reminders").evaluateDeadlineAndSlaNotifications;
let updateClubSettingsAction: typeof import("@/features/settings/actions").updateClubSettingsAction;

beforeAll(async () => {
  vi.resetModules();
  vi.doMock("server-only", () => ({}));
  vi.doMock("next/cache", () => ({
    revalidatePath: vi.fn(),
  }));
  vi.doMock("@/lib/supabase/admin", () => ({
    createAdminClient: vi.fn(() => createAdminMock()),
  }));
  vi.doMock("@/lib/auth/session", () => ({
    requireUser: vi.fn(async () => ({
      id: USER_ACTOR,
      fullName: "Gabriel Leyba",
      email: "admin@racspeed.com",
    })),
    assertPermission: vi.fn(async () => undefined),
    getUserAccessContext: vi.fn(async () => ({
      isPlatformAdmin: true,
      permissions: new Set(["SETTINGS_MANAGE", "NOTIFICATION_SEND"]),
    })),
  }));
  vi.doMock("@/lib/data/notification-sla-storage", () => ({
    readNotificationSlaStore: vi.fn((clubId: string) => slaStoreMock.get(clubId) ?? null),
    writeNotificationSlaStore: vi.fn((clubId: string, config: NotificationSlaConfig) => {
      slaStoreMock.set(clubId, config);
    }),
  }));
  vi.doMock("@/features/tasks/queries", () => ({
    getGroupTasksList: vi.fn(async () => sampleTasks),
  }));
  vi.doMock("@/lib/services/notifications/dispatch", async () => {
    const actual = await vi.importActual<
      typeof import("@/lib/services/notifications/dispatch")
    >("@/lib/services/notifications/dispatch");
    return {
      ...actual,
      dispatchNotification: dispatchNotificationMock,
    };
  });

  const taskNotifs = await import("@/lib/services/notifications/task-notifications");
  notifyTaskAssigned = taskNotifs.notifyTaskAssigned;
  notifyTaskStatusMarked = taskNotifs.notifyTaskStatusMarked;
  notifyTaskChecklistMarked = taskNotifs.notifyTaskChecklistMarked;

  const slaReminders = await import("@/lib/services/notifications/sla-reminders");
  evaluateDeadlineAndSlaNotifications =
    slaReminders.evaluateDeadlineAndSlaNotifications;

  const settingsActions = await import("@/features/settings/actions");
  updateClubSettingsAction = settingsActions.updateClubSettingsAction;
});

afterAll(() => {
  vi.doUnmock("server-only");
  vi.doUnmock("next/cache");
  vi.doUnmock("@/lib/supabase/admin");
  vi.doUnmock("@/lib/auth/session");
  vi.doUnmock("@/lib/data/notification-sla-storage");
  vi.doUnmock("@/features/tasks/queries");
  vi.doUnmock("@/lib/services/notifications/dispatch");
  vi.resetModules();
});

beforeEach(() => {
  dispatched.length = 0;
  dispatchNotificationMock.mockClear();
  slaStoreMock.clear();
  sampleTasks = [];
  sampleActivities = [];
  failMissingSlaColumnOnce = false;
  lastAppSettingsUpsertPayloads = [];
});

describe("Notification SLA configuration, task alerts, and deadline reminders", () => {
  it("normalizes and clamps NotificationSlaConfig safely", () => {
    expect(normalizeNotificationSlaConfig(null)).toEqual(
      DEFAULT_NOTIFICATION_SLA_CONFIG,
    );
    expect(
      normalizeNotificationSlaConfig({
        taskDueSoonHours: 9999,
        projectNearbyHours: 0,
        projectDeadlineHours: "12",
        draftReadinessDays: 50,
        reportDueSlaDays: -3,
        notifyOnTaskAssigned: "false",
        notifyOnTaskMarked: false,
        taskOverdueReminderEnabled: "true",
      }),
    ).toEqual({
      taskDueSoonHours: 336,
      taskOverdueReminderEnabled: true,
      projectNearbyHours: 1,
      projectDeadlineHours: 12,
      draftReadinessDays: 30,
      reportDueSlaDays: 1,
      notifyOnTaskAssigned: false,
      notifyOnTaskMarked: false,
    });
  });

  it("dispatches notifications when tasks are assigned and marked, respecting SLA toggles", async () => {
    const baseTask: GroupTaskDTO = {
      id: "task-101",
      clubId: CLUB_ID,
      title: "Secure Venue Permit",
      description: "",
      committee: "COMMUNITY_SERVICE",
      status: "TODO",
      priority: "HIGH",
      dueDate: "2026-11-28",
      assignedMemberIds: [USER_ASSIGNEE],
      assignedMemberNames: ["Kirsten Lim"],
      checklist: [{ id: "chk-1", title: "Print letter", completed: false }],
      createdAt: "2026-11-20T00:00:00Z",
      updatedAt: "2026-11-20T00:00:00Z",
      createdBy: "Gabriel Leyba",
      projectId: PROJECT_ID,
      projectTitle: "Project ELEMENOPI",
    };

    const assignedCount = await notifyTaskAssigned({
      clubId: CLUB_ID,
      task: baseTask,
      assigneeIds: [USER_ASSIGNEE, USER_ACTOR],
      actorId: USER_ACTOR,
      actorName: "Gabriel Leyba",
      slaConfig: DEFAULT_NOTIFICATION_SLA_CONFIG,
    });
    expect(assignedCount).toBe(2);
    expect(dispatched.some((d) => d.profileId === USER_ASSIGNEE && d.type === "TASK_ASSIGNED" && d.sendTelegram === true && d.isSelfAction === false)).toBe(true);
    expect(dispatched.some((d) => d.profileId === USER_ACTOR && d.type === "TASK_ASSIGNED" && d.sendEmail === false && d.sendTelegram === true && d.isSelfAction === true)).toBe(true);

    dispatched.length = 0;
    sampleActivities = [{ id: PROJECT_ID, owner_id: USER_OWNER }];

    // Auto-completed checklist item sends a unified COMPLETED status update notification
    const markedCount = await notifyTaskChecklistMarked({
      clubId: CLUB_ID,
      task: baseTask,
      itemId: "chk-1",
      itemTitle: "Print letter",
      autoCompleted: true,
      actorId: USER_ACTOR,
      actorName: "Gabriel Leyba",
      slaConfig: DEFAULT_NOTIFICATION_SLA_CONFIG,
    });
    expect(markedCount).toBe(3); // actor + assignee + project owner
    expect(
      dispatched.every(
        (d) =>
          d.type === "TASK_UPDATED" &&
          String(d.title).startsWith("Task marked as Done:"),
      ),
    ).toBe(true);

    dispatched.length = 0;

    // Respects disabled SLA toggles
    const disabledSla: NotificationSlaConfig = {
      ...DEFAULT_NOTIFICATION_SLA_CONFIG,
      notifyOnTaskAssigned: false,
      notifyOnTaskMarked: false,
    };
    expect(
      await notifyTaskAssigned({
        clubId: CLUB_ID,
        task: baseTask,
        assigneeIds: [USER_ASSIGNEE],
        actorId: USER_ACTOR,
        actorName: "Gabriel Leyba",
        slaConfig: disabledSla,
      }),
    ).toBe(0);
    expect(
      await notifyTaskStatusMarked({
        clubId: CLUB_ID,
        task: baseTask,
        previousStatus: "TODO",
        nextStatus: "COMPLETED",
        actorId: USER_ACTOR,
        actorName: "Gabriel Leyba",
        slaConfig: disabledSla,
      }),
    ).toBe(0);
    expect(dispatched).toHaveLength(0);
  });

  it("evaluates task due-soon, overdue tasks, project nearby, deadlines, drafts, and report SLA", async () => {
    const now = new Date("2026-11-26T10:00:00+08:00");
    sampleTasks = [
      {
        id: "t-soon",
        clubId: CLUB_ID,
        title: "Submit Tarpaulin Proof",
        description: "",
        committee: "PUBLIC_IMAGE",
        status: "IN_PROGRESS",
        priority: "HIGH",
        dueDate: "2026-11-27", // ~38h away -> inside 48h SLA
        assignedMemberIds: [USER_ASSIGNEE],
        assignedMemberNames: ["Kirsten Lim"],
        checklist: [],
        createdAt: "2026-11-20T00:00:00Z",
        updatedAt: "2026-11-20T00:00:00Z",
        createdBy: "Gabriel Leyba",
      },
      {
        id: "t-overdue",
        clubId: CLUB_ID,
        title: "Upload Liquidation Receipts",
        description: "",
        committee: "FINANCE",
        status: "TODO",
        priority: "URGENT",
        dueDate: "2026-11-24", // overdue
        assignedMemberIds: [USER_ASSIGNEE],
        assignedMemberNames: ["Kirsten Lim"],
        checklist: [],
        createdAt: "2026-11-20T00:00:00Z",
        updatedAt: "2026-11-20T00:00:00Z",
        createdBy: "Gabriel Leyba",
        projectId: PROJECT_ID,
        projectTitle: "Water Drive",
      },
    ];

    sampleActivities = [
      {
        id: PROJECT_ID,
        title: "Water Drive",
        kind: "SERVICE_PROJECT",
        status: "PLANNED",
        is_published: true,
        start_at: "2026-11-27T14:00:00+08:00", // 28h away -> project nearby (48h)
        end_at: "2026-11-27T18:00:00+08:00", // 32h away -> outside 24h end deadline
        rsvp_deadline: "2026-11-26T22:00:00+08:00", // 12h away -> inside 24h RSVP deadline
        owner_id: USER_OWNER,
        activity_rsvps: [{ profile_id: USER_FOLLOWER, response: "GOING" }],
        activity_team: [{ profile_id: USER_ASSIGNEE, team_role: "COMMITTEE" }],
        activity_followers: [],
      },
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        title: "Draft Charity Gala",
        kind: "JOINT_PROJECT",
        status: "DRAFT",
        is_published: false,
        start_at: "2026-11-30T09:00:00+08:00", // 4 days away -> inside 7d draft SLA
        end_at: "2026-11-30T17:00:00+08:00",
        rsvp_deadline: null,
        owner_id: USER_OWNER,
        activity_rsvps: [],
        activity_team: [],
        activity_followers: [],
      },
      {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        title: "Coastal Cleanup",
        kind: "SERVICE_PROJECT",
        status: "AWAITING_REPORT",
        is_published: true,
        start_at: "2026-11-18T06:00:00+08:00",
        end_at: "2026-11-18T11:00:00+08:00", // 8 days ago -> report SLA 7d overdue
        rsvp_deadline: null,
        owner_id: USER_OWNER,
        activity_rsvps: [],
        activity_team: [],
        activity_followers: [],
      },
    ];

    const summary = await evaluateDeadlineAndSlaNotifications(CLUB_ID, {
      now,
      slaConfig: DEFAULT_NOTIFICATION_SLA_CONFIG,
    });

    expect(summary.tasksDueSoon).toBe(1);
    expect(summary.tasksOverdue).toBe(2); // assignee + linked owner
    expect(summary.projectsNearby).toBe(3); // owner + team + going
    expect(summary.projectDeadlines).toBe(3); // RSVP deadline for owner + team + going
    expect(summary.draftsSoon).toBe(1); // draft readiness for owner
    expect(summary.reportsDue).toBe(1); // report SLA overdue for owner
    expect(summary.totalCreated).toBe(11);
  });

  it("saves SLA settings with seeded clubId and falls back cleanly if app_settings lacks notification_sla_config column", async () => {
    failMissingSlaColumnOnce = true;

    const formData = new FormData();
    formData.set("clubId", CLUB_ID);
    formData.set("clubName", "Rotaract Club of San Pedro East");
    formData.set("districtCode", "3820");
    formData.set("sponsorRotaryClub", "Rotary Club of San Pedro East");
    formData.set("currentRotaryYear", "2026-27");
    formData.set("requireRegistrationApproval", "true");
    formData.set("budgetApprovalPolicy", "PRESIDENT_AND_TREASURER");
    formData.set("retentionConsecutiveGasThreshold", "3");
    formData.set("retentionServiceDaysThreshold", "60");
    formData.set("taskDueSoonHours", "36");
    formData.set("taskOverdueReminderEnabled", "false");
    formData.set("projectNearbyHours", "72");
    formData.set("projectDeadlineHours", "18");
    formData.set("draftReadinessDays", "5");
    formData.set("reportDueSlaDays", "10");
    formData.set("notifyOnTaskAssigned", "true");
    formData.set("notifyOnTaskMarked", "false");

    const result = await updateClubSettingsAction(formData);
    expect(result.success).toBe(true);
    expect(result.notificationSla).toEqual({
      taskDueSoonHours: 36,
      taskOverdueReminderEnabled: false,
      projectNearbyHours: 72,
      projectDeadlineHours: 18,
      draftReadinessDays: 5,
      reportDueSlaDays: 10,
      notifyOnTaskAssigned: true,
      notifyOnTaskMarked: false,
    });
    expect(slaStoreMock.get(CLUB_ID)).toEqual(result.notificationSla);
    expect(lastAppSettingsUpsertPayloads).toHaveLength(2);
    expect(lastAppSettingsUpsertPayloads[0]).toHaveProperty("notification_sla_config");
    expect(lastAppSettingsUpsertPayloads[1]).not.toHaveProperty("notification_sla_config");
  });

  it("retries SLA activity loading without is_archived when column is missing in DB", async () => {
    const mockAdmin = await import("@/lib/supabase/admin");
    let queryCount = 0;
    vi.mocked(mockAdmin.createAdminClient).mockImplementationOnce(
      () =>
        ({
          from: vi.fn((table: string) => {
            if (table === "activities") {
              let hasIsArchivedFilter = false;
              const q: Record<string, unknown> = {
                select: vi.fn(() => q),
                eq: vi.fn((col: string) => {
                  if (col === "is_archived") hasIsArchivedFilter = true;
                  return q;
                }),
                neq: vi.fn(async () => {
                  queryCount += 1;
                  if (hasIsArchivedFilter) {
                    return {
                      data: null,
                      error: {
                        message: "column activities.is_archived does not exist",
                      },
                    };
                  }
                  return { data: [], error: null };
                }),
              };
              return q;
            }
            return {};
          }),
        }) as never,
    );

    const summary = await evaluateDeadlineAndSlaNotifications(CLUB_ID, {
      slaConfig: DEFAULT_NOTIFICATION_SLA_CONFIG,
    });
    expect(queryCount).toBe(2);
    expect(summary.totalCreated).toBe(0);
  });
});

