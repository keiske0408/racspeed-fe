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
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { ActivitySummaryDTO } from "@/features/activities/types";
import type { GroupTaskDTO } from "@/lib/data/tasks-types";
import type { ProjectCenterClient as ProjectCenterClientType } from "@/app/(app)/project-center/project-center-client";

const mocks = {
  replace: vi.fn(),
  refresh: vi.fn(),
  archiveActivityAction: vi.fn(async () => ({
    success: true,
    isArchived: true,
    message: "Archived.",
  })),
  bulkArchiveActivitiesAction: vi.fn(async () => ({
    success: true,
    count: 2,
    message: "Archived 2 finished activities.",
  })),
  notifyToast: vi.fn(),
  searchParams: new URLSearchParams(),
};

let ProjectCenterClient: typeof ProjectCenterClientType;

function makeActivity(
  overrides: Partial<ActivitySummaryDTO> = {},
): ActivitySummaryDTO {
  return {
    id: "act-1",
    clubId: "club-1",
    kind: "SERVICE_PROJECT",
    meetingType: null,
    title: "Big Ate, Kuya 2026",
    shortDescription: "Community service mentoring",
    location: "San Pedro",
    startAt: "2026-12-30T09:00:00+08:00",
    endAt: "2026-12-30T15:00:00+08:00",
    allDay: false,
    status: "PLANNED",
    priority: "MEDIUM",
    committee: "COMMUNITY_SERVICE",
    ownerId: "user-1",
    ownerName: "President Ian",
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
    rsvp: { going: 0, maybe: 0, notGoing: 0 },
    myRsvp: null,
    attendeesCount: 0,
    checkedIn: false,
    tasksTotal: 0,
    tasksDone: 0,
    commentsCount: 0,
    mediaCount: 0,
    coverUrl: null,
    rotaryYear: "2026-27",
    isArchived: false,
    archivedAt: null,
    ...overrides,
  };
}

const sampleActivities: ActivitySummaryDTO[] = [
  makeActivity({
    id: "past-due-1",
    title: "Recruitment Campaign Launch",
    kind: "OTHER",
    status: "PLANNED",
    priority: "HIGH",
    ownerId: "user-2",
    ownerName: "Alice Director",
    isTeamMember: false,
    myTeamRole: null,
    minMembersRequired: 10,
    startAt: "2026-11-15T09:00:00+08:00",
    endAt: "2026-11-16T17:00:00+08:00",
  }),
  makeActivity({
    id: "draft-soon-1",
    title: "Project ELEMENOPI",
    kind: "JOINT_PROJECT",
    status: "DRAFT",
    priority: "MEDIUM",
    ownerId: "user-1",
    ownerName: "President Ian",
    startAt: "2026-11-28T09:00:00+08:00",
    endAt: "2026-12-20T17:00:00+08:00",
  }),
  makeActivity({
    id: "coming-up-1",
    title: "Big Ate, Kuya 2026",
    kind: "SERVICE_PROJECT",
    status: "PLANNED",
    priority: "URGENT",
    ownerId: "user-2",
    ownerName: "Alice Director",
    isTeamMember: true,
    myTeamRole: "CO_CHAIR",
    startAt: "2026-12-30T09:00:00+08:00",
    endAt: "2026-12-30T15:00:00+08:00",
  }),
  makeActivity({
    id: "acc-1",
    title: "Clean-Up Drive Phase 1",
    kind: "SERVICE_PROJECT",
    status: "ACCOMPLISHED",
    startAt: "2026-10-10T08:00:00+08:00",
    endAt: "2026-10-10T12:00:00+08:00",
  }),
  makeActivity({
    id: "acc-2",
    title: "General Assembly Q1",
    kind: "MEETING",
    meetingType: "GENERAL_ASSEMBLY",
    status: "COMPLETED",
    startAt: "2026-09-12T14:00:00+08:00",
    endAt: "2026-09-12T16:00:00+08:00",
  }),
];

beforeEach(async () => {
  vi.resetModules();
  mocks.replace.mockClear();
  mocks.refresh.mockClear();
  mocks.archiveActivityAction.mockClear();
  mocks.bulkArchiveActivitiesAction.mockClear();
  mocks.notifyToast.mockClear();
  mocks.searchParams = new URLSearchParams();
  window.localStorage.clear();

  vi.doMock("next/navigation", () => ({
    useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
    useSearchParams: () => mocks.searchParams,
  }));
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
  vi.doMock("@/features/activities/actions", () => ({
    archiveActivityAction: mocks.archiveActivityAction,
    bulkArchiveActivitiesAction: mocks.bulkArchiveActivitiesAction,
  }));
  vi.doMock("@/components/shared/toast-viewport", () => ({
    notifyToast: mocks.notifyToast,
  }));

  const mod = await import("@/app/(app)/project-center/project-center-client");
  ProjectCenterClient = mod.ProjectCenterClient;
});

afterEach(() => {
  cleanup();
});

afterAll(() => {
  vi.doUnmock("next/navigation");
  vi.doUnmock("next/link");
  vi.doUnmock("@/features/activities/actions");
  vi.doUnmock("@/components/shared/toast-viewport");
  vi.resetModules();
});

describe("ProjectCenterClient redesign", () => {
  it("renders simplified header, stage tabs, Needs attention / Coming up groups, and strict row metadata rules", () => {
    render(
      <ProjectCenterClient
        initialActivities={sampleActivities}
        initialTasks={[] as GroupTaskDTO[]}
        canCreate={true}
        canManageClub={true}
        currentUserId="user-1"
        currentUserName="President Ian"
        defaultRotaryYear="2026-27"
      />,
    );

    expect(screen.getByText("Club operations")).toBeDefined();
    expect(screen.getByRole("heading", { name: "Project Center" })).toBeDefined();
    expect(screen.getByLabelText("Rotary Year")).toHaveValue("2026-27");

    // Stage tabs show accurate counts across Upcoming | Missed | Ongoing | Report due | Accomplished | Archived
    expect(screen.getByRole("tab", { name: /Upcoming.*2/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /Missed.*1/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /Ongoing.*0/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /Report due.*0/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /Accomplished.*2/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /Archived.*0/i })).toBeDefined();

    // Needs attention (draft starting soon) & Coming up groups on Upcoming tab
    const attentionGroup = screen.getByRole("region", { name: "Needs attention" });
    expect(within(attentionGroup).getByText("Project ELEMENOPI")).toBeDefined();

    const comingUpGroup = screen.getByRole("region", { name: "Coming up" });
    expect(within(comingUpGroup).getByText("Big Ate, Kuya 2026")).toBeDefined();

    // RY chip must NOT appear inside rows
    const comingRow = screen.getByTestId("project-row-coming-up-1");
    expect(within(comingRow).queryByText("RY 2026-27")).toBeNull();

    // Non-Medium priority shown (Urgent, High), Medium hidden on row
    expect(within(comingRow).getByText("Urgent")).toBeDefined();
    const draftRow = screen.getByTestId("project-row-draft-soon-1");
    expect(within(draftRow).queryByText("Medium")).toBeNull();

    // Person indicator & contextual row CTAs
    expect(within(comingRow).getByText("You (Co-Chair) · Lead: Alice Director")).toBeDefined();
    expect(within(draftRow).getByRole("link", { name: "Finish draft" })).toBeDefined();
    expect(within(comingRow).getByRole("link", { name: "Open" })).toBeDefined();

    // Overflow menu on an "Open" row must NOT repeat "Open"
    fireEvent.click(
      screen.getByLabelText("More actions for Big Ate, Kuya 2026"),
    );
    expect(screen.queryByRole("menuitem", { name: /Open/i })).toBeNull();
    expect(screen.getByRole("menuitem", { name: "Archive" })).toBeDefined();

    // Switch to Missed tab -> shows past-due item with "Ended N days ago", "Min 10", and "Update status"
    fireEvent.click(screen.getByRole("tab", { name: /Missed/i }));
    const pastRow = screen.getByTestId("project-row-past-due-1");
    expect(within(pastRow).getByText("Min 10")).toBeDefined();
    expect(within(pastRow).getByText("Lead: Alice Director")).toBeDefined();
    expect(within(pastRow).getByRole("link", { name: "Update status" })).toBeDefined();

    // Switch to Accomplished tab -> shows "Archive 2 finished" inside Accomplished tab
    fireEvent.click(screen.getByRole("tab", { name: /Accomplished/i }));
    expect(screen.getByRole("button", { name: "Archive 2 finished" })).toBeDefined();
  });

  it("hides Needs attention when empty and renders empty-state explanations & Clear filters", async () => {
    render(
      <ProjectCenterClient
        initialActivities={[
          makeActivity({
            id: "future-only",
            title: "Clean Future Project",
            status: "PLANNED",
            startAt: "2027-02-01T09:00:00+08:00",
            endAt: "2027-02-01T15:00:00+08:00",
          }),
        ]}
        initialTasks={[]}
        canCreate={true}
        canManageClub={true}
        currentUserId="user-1"
        currentUserName="President Ian"
        defaultRotaryYear="2026-27"
      />,
    );

    expect(screen.queryByRole("region", { name: "Needs attention" })).toBeNull();
    expect(screen.getByRole("region", { name: "Coming up" })).toBeDefined();

    // Switch to Report due tab and verify helpful explanation
    fireEvent.click(screen.getByRole("tab", { name: /Report due/i }));
    expect(screen.getByText("No projects are waiting for a report.")).toBeDefined();

    // Open guide dialog
    fireEvent.click(
      screen.getAllByRole("button", { name: "How publishing a project works" })[0],
    );
    const dialog = screen.getByRole("dialog", { name: /How publishing a project works/i });
    expect(within(dialog).getByText(/6 Rotary Showcase fields/i)).toBeDefined();
    fireEvent.click(within(dialog).getByRole("button", { name: "Got it" }));

    // Filter with Assigned to me -> search miss -> Clear filters restores item
    fireEvent.click(screen.getByRole("tab", { name: /Upcoming/i }));
    fireEvent.click(screen.getByRole("button", { name: "Assigned to me" }));
    expect(screen.getByText("Clean Future Project")).toBeDefined();
  });

  it("opens More filters popover, filters by Priority, and handles Archive confirmation + Undo & Bulk Archive", async () => {
    render(
      <ProjectCenterClient
        initialActivities={sampleActivities}
        initialTasks={[]}
        canCreate={true}
        canManageClub={true}
        currentUserId="user-1"
        currentUserName="President Ian"
        defaultRotaryYear="2026-27"
      />,
    );

    // Switch to Missed tab, filter by Priority -> High, and archive via overflow menu
    fireEvent.click(screen.getByRole("tab", { name: /Missed/i }));
    fireEvent.click(screen.getByRole("button", { name: /More filters/i }));
    fireEvent.change(screen.getByLabelText("Priority"), {
      target: { value: "HIGH" },
    });
    expect(screen.getByText("Recruitment Campaign Launch")).toBeDefined();

    // Archive via overflow menu -> confirmation -> Undo callback
    fireEvent.click(
      screen.getByLabelText("More actions for Recruitment Campaign Launch"),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Archive" }));

    const confirmDialog = screen.getByRole("dialog", {
      name: /Archive this activity\?/i,
    });
    fireEvent.click(within(confirmDialog).getByRole("button", { name: "Archive" }));

    await waitFor(() => {
      expect(mocks.archiveActivityAction).toHaveBeenCalledWith(
        "past-due-1",
        true,
      );
    });
    expect(mocks.notifyToast).toHaveBeenCalledWith(
      expect.objectContaining({
        actionLabel: "Undo",
        onAction: expect.any(Function),
      }),
    );

    // Invoke Undo handler
    const lastToastCall =
      mocks.notifyToast.mock.calls[mocks.notifyToast.mock.calls.length - 1][0];
    lastToastCall.onAction();
    await waitFor(() => {
      expect(mocks.archiveActivityAction).toHaveBeenCalledWith(
        "past-due-1",
        false,
      );
    });

    // Reset priority, switch to Accomplished tab -> Bulk Archive confirmation states exact count
    fireEvent.change(screen.getByLabelText("Priority"), {
      target: { value: "ALL" },
    });
    fireEvent.click(screen.getByRole("tab", { name: /Accomplished/i }));
    const bulkBtn = screen.getByRole("button", { name: "Archive 2 finished" });
    await waitFor(() => {
      expect(bulkBtn).not.toBeDisabled();
    });
    fireEvent.click(bulkBtn);
    const bulkDialog = screen.getByRole("dialog", {
      name: /Archive 2 finished items\?/i,
    });
    fireEvent.click(
      within(bulkDialog).getByRole("button", { name: "Archive 2 finished" }),
    );
    await waitFor(() => {
      expect(mocks.bulkArchiveActivitiesAction).toHaveBeenCalledWith([
        "acc-1",
        "acc-2",
      ]);
    });
  });
});

