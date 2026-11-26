import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { ActivityDetailDTO } from "@/features/activities/types";
import type { GroupTaskDTO } from "@/lib/data/tasks-types";
import type { MemberDTO } from "@/features/members/queries";
import type { ProjectTasksBoard as ProjectTasksBoardType } from "@/app/(app)/project-center/[activityId]/project-tasks-board";

const mocks = {
  createActivityTaskAction: vi.fn(async () => ({
    success: true,
    message: "Task added.",
  })),
  updateActivityTaskAction: vi.fn(async () => ({
    success: true,
    message: "Task updated.",
  })),
  deleteActivityTaskAction: vi.fn(async () => ({
    success: true,
    message: "Task deleted.",
  })),
  updateTaskStatusAction: vi.fn(async () => ({
    success: true,
    message: "Task moved to In Progress.",
  })),
  toggleChecklistItemAction: vi.fn(async () => ({
    success: true,
  })),
  notifyToast: vi.fn(),
};

let ProjectTasksBoard: typeof ProjectTasksBoardType;

const sampleActivity: ActivityDetailDTO = {
  id: "11111111-1111-4111-8111-111111111111",
  clubId: "00000000-0000-0000-0000-000000000001",
  kind: "JOINT_PROJECT",
  meetingType: null,
  title: "Project ELEMENOPI",
  shortDescription: "Joint community project",
  description: "Full project plan",
  location: "San Pedro",
  startAt: "2026-12-10T09:00:00+08:00",
  endAt: "2026-12-10T17:00:00+08:00",
  allDay: false,
  status: "PLANNED",
  priority: "MEDIUM",
  committee: "COMMUNITY_SERVICE",
  ownerId: "user-1",
  ownerName: "Gabriel Leyba",
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
  rsvp: { going: 1, maybe: 0, notGoing: 0 },
  myRsvp: "GOING",
  attendeesCount: 0,
  checkedIn: false,
  tasksTotal: 3,
  tasksDone: 1,
  commentsCount: 0,
  mediaCount: 0,
  coverUrl: null,
  rotaryYear: "2026-27",
  isArchived: false,
  archivedAt: null,
  isPublished: true,
  projectDetails: null,
  team: [
    {
      profileId: "user-1",
      fullName: "Gabriel Leyba",
      avatarUrl: null,
      role: "CHAIR",
    },
    {
      profileId: "user-2",
      fullName: "Kirsten Lim",
      avatarUrl: null,
      role: "COMMITTEE",
    },
  ],
  rsvps: [],
  attendees: [],
  media: [],
  comments: [],
  log: [
    {
      id: "log-1",
      actorName: "Gabriel Leyba",
      action: "TASK_STATUS_UPDATED",
      details: { title: "Prepare Budget", status: "COMPLETED" },
      createdAt: "2026-11-26T02:00:00Z",
    },
  ],
  isFollowing: true,
  canManage: true,
  canManageAttendance: true,
};

const sampleMembers: MemberDTO[] = [
  {
    id: "user-1",
    name: "Gabriel Leyba",
    email: "admin@racspeed.com",
    rotaryId: "R-1",
    classification: "Tech",
    status: "ACTIVE",
    role: "President",
    roleKey: "PRESIDENT",
    isPlatformAdmin: true,
    joinedDate: "2025-07-01",
  },
  {
    id: "user-2",
    name: "Kirsten Lim",
    email: "kirsten@racspeed.com",
    rotaryId: "R-2",
    classification: "Community",
    status: "ACTIVE",
    role: "Director",
    roleKey: "DIRECTOR",
    isPlatformAdmin: false,
    joinedDate: "2025-07-01",
  },
];

const sampleTasks: GroupTaskDTO[] = [
  {
    id: "task-ready-1",
    clubId: "00000000-0000-0000-0000-000000000001",
    title: "Communicate Decision to RAC Nuvali",
    description: "Confirm final scope and date with partner club",
    committee: "COMMUNITY_SERVICE",
    status: "TODO",
    priority: "HIGH",
    dueDate: "2026-12-16",
    assignedMemberIds: ["user-1"],
    assignedMemberNames: ["Gabriel Leyba"],
    checklist: [],
    createdAt: "2026-11-20T00:00:00Z",
    updatedAt: "2026-11-20T00:00:00Z",
    createdBy: "Gabriel Leyba",
    projectId: sampleActivity.id,
    projectTitle: sampleActivity.title,
  },
  {
    id: "task-review-1",
    clubId: "00000000-0000-0000-0000-000000000001",
    title: "Design Partnership Primer",
    description: "Draft visual brief for club social channels",
    committee: "PUBLIC_IMAGE",
    status: "IN_REVIEW",
    priority: "MEDIUM",
    dueDate: "2026-12-08",
    assignedMemberIds: ["user-2"],
    assignedMemberNames: ["Kirsten Lim"],
    checklist: [],
    createdAt: "2026-11-20T00:00:00Z",
    updatedAt: "2026-11-20T00:00:00Z",
    createdBy: "Gabriel Leyba",
    projectId: sampleActivity.id,
    projectTitle: sampleActivity.title,
  },
  {
    id: "task-done-1",
    clubId: "00000000-0000-0000-0000-000000000001",
    title: "Prepare Budget",
    description: "Draft line items for seed funding",
    committee: "FINANCE",
    status: "COMPLETED",
    priority: "LOW",
    dueDate: "2026-12-01",
    assignedMemberIds: ["user-2"],
    assignedMemberNames: ["Kirsten Lim"],
    checklist: [],
    createdAt: "2026-11-20T00:00:00Z",
    updatedAt: "2026-11-20T00:00:00Z",
    createdBy: "Gabriel Leyba",
    projectId: sampleActivity.id,
    projectTitle: sampleActivity.title,
  },
];

beforeAll(async () => {
  vi.resetModules();
  vi.doMock("@/features/activities/actions", () => ({
    createActivityTaskAction: mocks.createActivityTaskAction,
    updateActivityTaskAction: mocks.updateActivityTaskAction,
    deleteActivityTaskAction: mocks.deleteActivityTaskAction,
  }));
  vi.doMock("@/features/tasks/actions", () => ({
    updateTaskStatusAction: mocks.updateTaskStatusAction,
    toggleChecklistItemAction: mocks.toggleChecklistItemAction,
  }));
  vi.doMock("@/components/shared/toast-viewport", () => ({
    notifyToast: mocks.notifyToast,
  }));

  ({ ProjectTasksBoard } = await import(
    "@/app/(app)/project-center/[activityId]/project-tasks-board"
  ));
});

afterAll(() => {
  vi.doUnmock("@/features/activities/actions");
  vi.doUnmock("@/features/tasks/actions");
  vi.doUnmock("@/components/shared/toast-viewport");
  vi.resetModules();
});

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("ProjectTasksBoard redesigned Kanban UI", () => {
  it("renders all 4 Kanban columns, committee Task Progress sidebar, and Recent Activity feed", () => {
    render(
      <ProjectTasksBoard
        activity={sampleActivity}
        tasks={sampleTasks}
        canCreate
        currentUserId="user-1"
        members={sampleMembers}
        onTaskCreated={vi.fn()}
      />,
    );

    expect(screen.getByTestId("task-lane-TODO")).toBeTruthy();
    expect(screen.getByTestId("task-lane-IN_PROGRESS")).toBeTruthy();
    expect(screen.getByTestId("task-lane-IN_REVIEW")).toBeTruthy();
    expect(screen.getByTestId("task-lane-COMPLETED")).toBeTruthy();

    expect(screen.getByText("1 of 3 done")).toBeTruthy();
    expect(screen.getByText("Task Progress")).toBeTruthy();
    expect(screen.getByText("Recent Activity")).toBeTruthy();
    expect(screen.getByText(/completed task "Prepare Budget"/i)).toBeTruthy();

    // Verify cards appear in correct lanes
    const readyLane = screen.getByTestId("task-lane-TODO");
    expect(within(readyLane).getByText("Communicate Decision to RAC Nuvali")).toBeTruthy();

    const reviewLane = screen.getByTestId("task-lane-IN_REVIEW");
    expect(within(reviewLane).getByText("Design Partnership Primer")).toBeTruthy();
  });

  it("supports inline Create New Card in any lane and optimistic stage move", async () => {
    const onTaskCreated = vi.fn();
    render(
      <ProjectTasksBoard
        activity={sampleActivity}
        tasks={sampleTasks}
        canCreate
        currentUserId="user-1"
        members={sampleMembers}
        onTaskCreated={onTaskCreated}
      />,
    );

    // Open inline composer directly inside Needs Review lane
    const reviewLane = screen.getByTestId("task-lane-IN_REVIEW");
    fireEvent.click(within(reviewLane).getByRole("button", { name: /^Add Card$/ }));

    const titleBox = within(reviewLane).getByPlaceholderText("What is the task?");
    fireEvent.change(titleBox, { target: { value: "Review Sponsor Letter" } });
    fireEvent.click(within(reviewLane).getByRole("button", { name: "Add card" }));

    await waitFor(() => {
      expect(mocks.createActivityTaskAction).toHaveBeenCalledWith(
        expect.objectContaining({
          activityId: sampleActivity.id,
          title: "Review Sponsor Letter",
          status: "IN_REVIEW",
        }),
      );
      expect(onTaskCreated).toHaveBeenCalled();
    });

    // Move "Communicate Decision to RAC Nuvali" from Task Ready to In Progress via quick button
    const readyLane = screen.getByTestId("task-lane-TODO");
    fireEvent.click(within(readyLane).getByRole("button", { name: /start/i }));

    await waitFor(() => {
      expect(mocks.updateTaskStatusAction).toHaveBeenCalledWith(
        "task-ready-1",
        "IN_PROGRESS",
      );
    });

    const inProgressLane = screen.getByTestId("task-lane-IN_PROGRESS");
    expect(
      within(inProgressLane).getByText("Communicate Decision to RAC Nuvali"),
    ).toBeTruthy();
  });

  it("filters cards by Assigned to me and search query", () => {
    render(
      <ProjectTasksBoard
        activity={sampleActivity}
        tasks={sampleTasks}
        canCreate
        currentUserId="user-1"
        members={sampleMembers}
        onTaskCreated={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /assigned to me/i }));
    expect(screen.getByText("Communicate Decision to RAC Nuvali")).toBeTruthy();
    expect(screen.queryByText("Design Partnership Primer")).toBeNull();
    expect(screen.queryByText("Prepare Budget")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByText("Design Partnership Primer")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Search project tasks"), {
      target: { value: "Primer" },
    });
    expect(screen.getByText("Design Partnership Primer")).toBeTruthy();
    expect(screen.queryByText("Communicate Decision to RAC Nuvali")).toBeNull();
  });
});

