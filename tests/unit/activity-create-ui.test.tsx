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
import type { ActivityCreateClient as ActivityCreateClientType } from "@/app/(app)/project-center/new/activity-create-client";

const mocks = {
  createActivityAction: vi.fn(async () => ({
    success: true,
    activityId: "act-new-1",
    message: "Created.",
  })),
  push: vi.fn(),
  refresh: vi.fn(),
  notifyToast: vi.fn(),
};

let ActivityCreateClient: typeof ActivityCreateClientType;

const aliceId = "00000000-0000-4000-8000-000000000011";
const bobId = "00000000-0000-4000-8000-000000000012";

const members = [
  { id: aliceId, fullName: "Alice Reyes", role: "DIRECTOR" },
  { id: bobId, fullName: "Bob Cruz", role: "MEMBER" },
];

beforeEach(async () => {
  vi.resetModules();
  mocks.createActivityAction.mockClear();
  mocks.push.mockClear();
  mocks.refresh.mockClear();
  mocks.notifyToast.mockClear();

  vi.doMock("next/navigation", () => ({
    useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
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
    createActivityAction: mocks.createActivityAction,
  }));
  vi.doMock("@/components/shared/toast-viewport", () => ({
    notifyToast: mocks.notifyToast,
  }));

  const mod = await import("@/app/(app)/project-center/new/activity-create-client");
  ActivityCreateClient = mod.ActivityCreateClient;
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

describe("ActivityCreateClient UI/UX Creation Studio", () => {
  it("guides users from Step 1 quick-start presets into Step 2 with pre-filled scenario state", () => {
    render(
      <ActivityCreateClient
        initialKind={null}
        initialSisterClubId={null}
        initialPartnerName={null}
        canCreateEvent={true}
        canCreateProject={true}
        partnerClubs={[]}
        members={members}
      />,
    );

    expect(screen.getByText("What are you organizing?")).toBeDefined();
    expect(
      screen.getByRole("button", { name: /Generate from Text/i }),
    ).toBeDefined();

    fireEvent.click(
      screen.getByRole("button", { name: /L&D Meeting \/ Training/i }),
    );

    expect(
      screen.getByRole("heading", { name: /New Learning & Development \(L&D\)/i }),
    ).toBeDefined();
    expect(screen.getByText(/3-Step Flow · No Beneficiary Report/i)).toBeDefined();
    expect(screen.getByDisplayValue("L&D Session:")).toBeDefined();
  });

  it("updates live preview, selects Urgent priority, adds committee members, expands SDGs, and submits", async () => {
    const { container } = render(
      <ActivityCreateClient
        initialKind="SERVICE_PROJECT"
        initialSisterClubId={null}
        initialPartnerName={null}
        canCreateEvent={true}
        canCreateProject={true}
        partnerClubs={[]}
        members={members}
      />,
    );

    const titleInput = screen.getByPlaceholderText(
      /Community Literacy & Reading Corner Drive/i,
    );
    fireEvent.change(titleInput, {
      target: { value: "Brigada Eskwela Book Drive" },
    });

    // Live Card Preview reflects updated title
    expect(
      screen.getByRole("heading", { name: "Brigada Eskwela Book Drive" }),
    ).toBeDefined();

    // Visual priority pill selection
    fireEvent.click(screen.getByRole("button", { name: /Urgent/i }));

    // Search & appoint committee member, then change role inline
    fireEvent.change(
      screen.getByLabelText("Search club members for committee"),
      { target: { value: "Bob" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Add Bob Cruz to committee/i }),
    );
    fireEvent.change(screen.getByLabelText("Role for Bob Cruz"), {
      target: { value: "CO_CHAIR" },
    });

    // Expand SDGs disclosure and pick SDG 4
    fireEvent.click(screen.getByRole("button", { name: /Select SDGs \(17\)/i }));
    fireEvent.click(screen.getByLabelText(/4\. Quality Education/i));

    const form = container.querySelector("form#create-activity-form");
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    await waitFor(
      () => {
        expect(mocks.createActivityAction).toHaveBeenCalledTimes(1);
      },
      { timeout: 4000 },
    );

    expect(mocks.createActivityAction).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "SERVICE_PROJECT",
        title: "Brigada Eskwela Book Drive",
        priority: "URGENT",
        committeeMembers: [{ profileId: bobId, role: "CO_CHAIR" }],
        sdgs: [4],
      }),
    );
  });
});
