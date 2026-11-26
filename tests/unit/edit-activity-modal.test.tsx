import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { ActivityDetailDTO } from "@/features/activities/types";
import type { MemberDTO } from "@/features/members/queries";
import type { EditActivityModal as EditActivityModalType } from "@/app/(app)/project-center/[activityId]/edit-activity-modal";

const mocks = {
  updateActivityAction: vi.fn(async () => ({ success: true, message: "Updated." })),
  notifyToast: vi.fn(),
};

let EditActivityModal: typeof EditActivityModalType;

const ownerId = "00000000-0000-4000-8000-000000000010";
const aliceId = "00000000-0000-4000-8000-000000000011";
const bobId = "00000000-0000-4000-8000-000000000012";
const clubId = "00000000-0000-0000-0000-000000000001";

const members: MemberDTO[] = [
  {
    id: ownerId,
    name: "President Admin",
    email: "admin@racspeed.com",
    role: "CLUB_PRESIDENT",
    roleKey: "CLUB_PRESIDENT",
    status: "ACTIVE",
    joinedDate: "2024-01-01",
    classification: "Administration",
    isPlatformAdmin: true,
  },
  {
    id: aliceId,
    name: "Alice Reyes",
    email: "alice@racspeed.com",
    role: "COMMUNITY_SERVICE_DIRECTOR",
    roleKey: "DIRECTOR",
    status: "ACTIVE",
    joinedDate: "2024-02-01",
    classification: "Education",
    isPlatformAdmin: false,
  },
  {
    id: bobId,
    name: "Bob Cruz",
    email: "bob@racspeed.com",
    role: "MEMBER",
    roleKey: "MEMBER",
    status: "ACTIVE",
    joinedDate: "2024-03-01",
    classification: "Engineering",
    isPlatformAdmin: false,
  },
];

function makeActivity(): ActivityDetailDTO {
  return {
    id: "00000000-0000-4000-8000-000000000100",
    clubId,
    kind: "SERVICE_PROJECT",
    meetingType: null,
    title: "Project ELEMENOPI",
    shortDescription: "Flagship community literacy partnership",
    description: "Detailed plan for the literacy project.",
    location: "San Pedro Hall",
    startAt: "2026-11-28T09:00:00+08:00",
    endAt: "2026-12-20T17:00:00+08:00",
    allDay: false,
    committee: "COMMUNITY_SERVICE",
    status: "PLANNED",
    priority: "MEDIUM",
    isPublished: true,
    rotaryYear: "2026-27",
    capacity: null,
    minMembersRequired: null,
    rsvpEnabled: true,
    rsvpDeadline: null,
    selfCheckInEnabled: false,
    qrCheckInEnabled: true,
    checkInWindowMinutes: 180,
    volunteerHoursDefault: 4,
    ownerId,
    ownerName: "President Admin",
    coverUrl: null,
    isArchived: false,
    archivedAt: null,
    rsvp: { going: 1, maybe: 0, notGoing: 0 },
    attendeesCount: 0,
    tasksTotal: 0,
    tasksDone: 0,
    commentsCount: 0,
    myRsvp: "GOING",
    checkedIn: false,
    mediaCount: 0,
    canManage: true,
    canManageAttendance: true,
    isFollowing: true,
    projectDetails: {
      objective: "Build neighborhood reading corners",
      inspiration: "",
      outcomesSummary: "",
      beneficiaryType: "Elementary students",
      beneficiaryCount: 120,
      volunteerMemberCount: 1,
      volunteerNonmemberCount: 0,
      totalVolunteerHours: 0,
      fundingTotal: 15000,
      fundingCurrency: "PHP",
      fundingSource: "Club Treasury",
      totalExpenses: 0,
      supportsPolio: false,
      tags: [],
      relatedLinks: [],
      spcInitiativeId: "",
      completedAt: null,
      areasOfFocus: ["BASIC_EDUCATION"],
      sdgs: [4],
      partners: [],
    },
    team: [
      {
        profileId: ownerId,
        fullName: "President Admin",
        avatarUrl: null,
        role: "CHAIR",
      },
      {
        profileId: aliceId,
        fullName: "Alice Reyes",
        avatarUrl: null,
        role: "COMMITTEE",
      },
    ],
    rsvps: [],
    attendees: [],
    media: [],
    comments: [],
    log: [],
  };
}

beforeEach(async () => {
  vi.resetModules();
  mocks.updateActivityAction.mockClear();
  mocks.notifyToast.mockClear();

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
    updateActivityAction: mocks.updateActivityAction,
  }));
  vi.doMock("@/components/shared/toast-viewport", () => ({
    notifyToast: mocks.notifyToast,
  }));

  const mod = await import("@/app/(app)/project-center/[activityId]/edit-activity-modal");
  EditActivityModal = mod.EditActivityModal;
});

afterEach(() => {
  cleanup();
});

afterAll(() => {
  vi.doUnmock("next/link");
  vi.doUnmock("@/features/activities/actions");
  vi.doUnmock("@/components/shared/toast-viewport");
  vi.resetModules();
});

describe("EditActivityModal", () => {
  it("supports searching, adding, changing roles, and removing committee members when saving", async () => {
    const onSaved = vi.fn();
    const onClose = vi.fn();

    render(
      <EditActivityModal
        activity={makeActivity()}
        members={members}
        canReassignOwner={true}
        isOpen={true}
        initialSection="TEAM"
        onClose={onClose}
        onSaved={onSaved}
      />,
    );

    expect(screen.getByText("President Admin")).toBeDefined();
    expect(screen.getByText("Alice Reyes")).toBeDefined();

    // Update Alice's role from COMMITTEE -> VOLUNTEER
    fireEvent.change(screen.getByLabelText("Role for Alice Reyes"), {
      target: { value: "VOLUNTEER" },
    });

    // Search for Bob Cruz and add as Co-Chair
    fireEvent.change(screen.getByLabelText("Role for new committee member"), {
      target: { value: "CO_CHAIR" },
    });
    fireEvent.change(
      screen.getByLabelText("Search members to add to committee"),
      { target: { value: "Bob" } },
    );
    fireEvent.click(screen.getByRole("button", { name: /^Add$/i }));

    expect(screen.getByText("Bob Cruz")).toBeDefined();

    // Remove Alice Reyes from the committee roster
    fireEvent.click(screen.getByLabelText("Remove Alice Reyes"));

    fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));

    await waitFor(() => {
      expect(mocks.updateActivityAction).toHaveBeenCalledTimes(1);
    });

    expect(mocks.updateActivityAction).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000100",
      expect.objectContaining({
        committeeMembers: [{ profileId: bobId, role: "CO_CHAIR" }],
      }),
    );
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("navigates across tabs and jumps back to Schedule when end date precedes start date", async () => {
    render(
      <EditActivityModal
        activity={makeActivity()}
        members={members}
        canReassignOwner={false}
        isOpen={true}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: /Schedule/i }));

    const endInput = screen.getByLabelText(/End Date & Time/i);
    fireEvent.change(endInput, { target: { value: "2026-11-01T10:00" } });

    // Switch back to Basics before submitting to verify validation switches tab automatically
    fireEvent.click(screen.getByRole("tab", { name: /Basics/i }));
    fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));

    expect(mocks.updateActivityAction).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain(
      "End date and time must be after the start date and time.",
    );
    expect(
      screen.getByRole("tab", { name: /Schedule/i }).getAttribute("aria-selected"),
    ).toBe("true");
  });
});

