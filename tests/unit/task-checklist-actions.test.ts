import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addChecklistItemAction,
  toggleChecklistItemAction,
} from "@/features/tasks/actions";
import type { GroupTaskDTO } from "@/lib/data/tasks-types";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  assertPermission: vi.fn(),
  getGroupTasksList: vi.fn(),
  toggleChecklistItem: vi.fn(),
  addChecklistItem: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  requireUser: mocks.requireUser,
  assertPermission: mocks.assertPermission,
  getUserAccessContext: vi.fn(),
}));
vi.mock("@/features/tasks/queries", () => ({
  getGroupTasksList: mocks.getGroupTasksList,
}));
vi.mock("@/lib/data/tasks-storage", () => ({
  toggleChecklistItem: mocks.toggleChecklistItem,
  addChecklistItem: mocks.addChecklistItem,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mocks.from }),
}));
vi.mock("@/lib/services/rewards", () => ({
  awardEngagementPoints: vi.fn(),
}));
vi.mock("@/lib/services/notifications/task-notifications", () => ({
  notifyTaskAssigned: vi.fn(),
  notifyTaskChecklistMarked: vi.fn(),
  notifyTaskStatusMarked: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("server-only", () => ({}));

const task: GroupTaskDTO = {
  id: "task-1",
  clubId: "club-1",
  title: "Community event",
  description: "",
  committee: "COMMUNITY_SERVICE",
  status: "IN_PROGRESS",
  priority: "MEDIUM",
  dueDate: "2026-12-01",
  assignedMemberIds: ["assignee-1"],
  assignedMemberNames: ["Assigned Member"],
  checklist: [{ id: "item-1", title: "Prepare materials", completed: false }],
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
  createdBy: "creator-1",
};

const updatedTask = {
  ...task,
  checklist: [
    { id: "item-1", title: "Prepare materials", completed: false },
    { id: "item-2", title: "Print schedules", completed: false },
  ],
};

beforeEach(() => {
  mocks.requireUser.mockReset().mockResolvedValue({
    id: "member-1",
    email: "member@example.org",
    fullName: "Member",
  });
  mocks.assertPermission.mockReset().mockRejectedValue(
    new Error("Unauthorized: missing TASK_MANAGE"),
  );
  mocks.getGroupTasksList.mockReset().mockResolvedValue([task]);
  mocks.toggleChecklistItem.mockReset().mockReturnValue(updatedTask);
  mocks.addChecklistItem.mockReset().mockReturnValue(updatedTask);
  mocks.from.mockReset().mockImplementation(() => ({
    update: vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })),
  }));
});

describe("task checklist authorization", () => {
  it.each([
    ["toggle", () => toggleChecklistItemAction("task-1", "item-1")],
    ["add", () => addChecklistItemAction("task-1", "Print schedules")],
  ])("rejects unassigned members who cannot manage tasks when they %s", async (_name, run) => {
    const result = await run();

    expect(result).toMatchObject({ success: false });
    expect(mocks.assertPermission).toHaveBeenCalledWith(
      task.clubId,
      "TASK_MANAGE",
    );
    expect(mocks.toggleChecklistItem).not.toHaveBeenCalled();
    expect(mocks.addChecklistItem).not.toHaveBeenCalled();
  });

  it("allows an assigned member to update their task checklist", async () => {
    mocks.requireUser.mockResolvedValue({
      id: "assignee-1",
      email: "assignee@example.org",
      fullName: "Assigned Member",
    });

    expect(
      await toggleChecklistItemAction("task-1", "item-1"),
    ).toMatchObject({ success: true });
    expect(
      await addChecklistItemAction("task-1", "Print schedules"),
    ).toMatchObject({ success: true });
    expect(mocks.assertPermission).not.toHaveBeenCalled();
    expect(mocks.toggleChecklistItem).toHaveBeenCalledWith(
      "task-1",
      "item-1",
      undefined,
    );
    expect(mocks.addChecklistItem).toHaveBeenCalledWith(
      "task-1",
      "Print schedules",
      undefined,
    );
  });

  it("allows a TASK_MANAGE holder to update another member's task", async () => {
    mocks.assertPermission.mockResolvedValue(undefined);

    expect(
      await toggleChecklistItemAction("task-1", "item-1"),
    ).toMatchObject({ success: true });
    expect(
      await addChecklistItemAction("task-1", "Print schedules"),
    ).toMatchObject({ success: true });
    expect(mocks.assertPermission).toHaveBeenCalledTimes(2);
    expect(mocks.assertPermission).toHaveBeenNthCalledWith(
      1,
      task.clubId,
      "TASK_MANAGE",
    );
    expect(mocks.assertPermission).toHaveBeenNthCalledWith(
      2,
      task.clubId,
      "TASK_MANAGE",
    );
  });

  it("does not mutate an unknown task or checklist item", async () => {
    mocks.getGroupTasksList.mockResolvedValueOnce([]);
    expect(
      await toggleChecklistItemAction("unknown-task", "item-1"),
    ).toMatchObject({ success: false });
    expect(mocks.toggleChecklistItem).not.toHaveBeenCalled();

    expect(
      await toggleChecklistItemAction("task-1", "unknown-item"),
    ).toMatchObject({ success: false });
    expect(mocks.toggleChecklistItem).not.toHaveBeenCalled();

    mocks.getGroupTasksList.mockResolvedValueOnce([]);
    expect(
      await addChecklistItemAction("unknown-task", "Print schedules"),
    ).toMatchObject({ success: false });
    expect(mocks.addChecklistItem).not.toHaveBeenCalled();
  });
});
