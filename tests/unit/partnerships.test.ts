import { createElement } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSisterClubsList } from "@/features/partnerships/queries";
import { PartnershipsClient } from "@/app/(app)/partnerships/partnerships-client";
import { ActivityCreateClient } from "@/app/(app)/project-center/new/activity-create-client";
import { Header } from "@/components/layout/header";
import type { CreateActivityInput } from "@/features/activities/schemas";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  readStore: vi.fn(),
  createActivity: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  storageUpload: vi.fn(),
  storageRemove: vi.fn(),
  signedUrls: vi.fn(),
  participant: vi.fn(),
  mediaPage: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: mocks.from,
    storage: {
      from: () => ({
        upload: mocks.storageUpload,
        remove: mocks.storageRemove,
        createSignedUrls: mocks.signedUrls,
      }),
    },
  }),
}));
vi.mock("@/lib/data/partnerships-storage", () => ({
  readPartnershipsStore: mocks.readStore,
}));
vi.mock("@/features/partnerships/actions", () => ({
  createSisterClubAction: vi.fn(),
  updateSisterClubAction: vi.fn(),
  deleteSisterClubAction: vi.fn(),
}));
vi.mock("@/features/activities/actions", () => ({
  createActivityAction: mocks.createActivity,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));
vi.mock("@/components/layout/notification-bell", () => ({
  NotificationBell: () => null,
}));
vi.mock("@/components/shared/toast-viewport", () => ({ notifyToast: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  requireUser: async () => ({ id: "member-1" }),
  getUserAccessContext: async () => ({
    isPlatformAdmin: false,
    permissions: new Set(["PROJECT_CREATE"]),
  }),
}));
vi.mock("@/lib/services/rewards", () => ({ awardEngagementPoints: vi.fn() }));
vi.mock("@/lib/data/tasks-storage", () => ({ createTask: vi.fn() }));
vi.mock("@/features/activities/queries", () => ({
  isClubParticipant: mocks.participant,
  getActivityMediaPage: mocks.mediaPage,
  MEDIA_BUCKET: "activity-media",
}));
vi.mock("server-only", () => ({}));

afterEach(cleanup);

const clubId = "00000000-0000-0000-0000-000000000099";
const project = {
  id: "project-1",
  title: "Joint literacy project",
  status: "PLANNED",
  rotary_year: "2026-27",
  created_at: "2026-10-31T00:00:00Z",
  activity_rsvps: [{ response: "GOING" }, { response: "NOT_GOING" }],
};

beforeEach(() => {
  mocks.from.mockReset();
  mocks.storageUpload.mockReset().mockResolvedValue({ error: null });
  mocks.storageRemove.mockReset().mockResolvedValue({ error: null });
  mocks.signedUrls.mockReset();
  mocks.participant.mockReset().mockResolvedValue(true);
  mocks.mediaPage.mockReset().mockResolvedValue({ media: [], hasMore: false });
  mocks.createActivity.mockReset();
  mocks.createActivity.mockResolvedValue({
    success: true,
    activityId: "project-1",
  });
  mocks.readStore.mockReturnValue({
    customClubs: [],
    initiatives: [{ id: "legacy-local", sisterClubId: clubId }],
  });
});

function mockQueries(clubs: unknown[], partners: unknown[]) {
  const clubQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: clubs, error: null }),
  };
  const partnerQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({ data: partners, error: null }),
  };
  mocks.from.mockImplementation((table: string) =>
    table === "sister_clubs" ? clubQuery : partnerQuery,
  );
  return { clubQuery, partnerQuery };
}

describe("Partnership-bound projects", () => {
  it("shows only linked projects, deduplicates them, and excludes legacy initiatives", async () => {
    const { clubQuery, partnerQuery } = mockQueries(
      [
        {
          id: clubId,
          partner_club_name: "Partner Club",
          partnership_initiatives: [{ id: "legacy-db" }],
        },
      ],
      [
        { sister_club_id: clubId, name: "Partner Club", activities: project },
        { sister_club_id: clubId, name: "Partner Club", activities: project },
        {
          sister_club_id: "another-club",
          name: "Partner Club",
          activities: { ...project, id: "unrelated" },
        },
      ],
    );
    const clubs = await getSisterClubsList("home-club");
    expect(clubs[0].initiativesCount).toBe(1);
    expect(clubs[0].initiatives).toEqual([
      expect.objectContaining({
        activityId: "project-1",
        source: "ACTIVITY",
        status: "PROPOSED",
        jointVolunteers: 1,
      }),
    ]);
    expect(clubQuery.eq).toHaveBeenCalledWith("home_club_id", "home-club");
    expect(clubQuery.select.mock.calls[0][0]).not.toContain(
      "partnership_initiatives",
    );
    expect(partnerQuery.eq).toHaveBeenCalledWith(
      "activities.club_id",
      "home-club",
    );
    expect(partnerQuery.in).toHaveBeenCalledWith("activities.kind", [
      "JOINT_PROJECT",
      "SERVICE_PROJECT",
    ]);
  });

  it("binds local partner records by normalized name without showing stored initiatives", async () => {
    mocks.readStore.mockReturnValue({
      customClubs: [
        {
          id: "sc-local",
          partnerClubName: "Partner Club",
          initiativesCount: 4,
        },
      ],
      initiatives: [{ id: "legacy-local", sisterClubId: "sc-local" }],
    });
    mockQueries(
      [],
      [{ sister_club_id: null, name: " partner club ", activities: project }],
    );
    const clubs = await getSisterClubsList();
    expect(clubs[0].initiativesCount).toBe(1);
    expect(clubs[0].initiatives?.[0].activityId).toBe("project-1");
  });
});

describe("Partnership navigation", () => {
  const partnerClubs = [
    {
      id: clubId,
      name: "Sister Club",
      district: "3820",
      country: "Philippines",
    },
    {
      id: "sc-local",
      name: "Sponsor Club",
      district: "3830",
      country: "Philippines",
    },
  ];

  it.each([
    { initialSisterClubId: clubId, initialPartnerName: null, selected: clubId },
    {
      initialSisterClubId: null,
      initialPartnerName: "Sponsor Club",
      selected: "sc-local",
    },
  ])(
    "preselects the clicked partner and allows changing it",
    async (initial) => {
      const { container } = render(
        createElement(ActivityCreateClient, {
          initialKind: "JOINT_PROJECT",
          initialSisterClubId: initial.initialSisterClubId,
          initialPartnerName: initial.initialPartnerName,
          canCreateEvent: true,
          canCreateProject: true,
          partnerClubs,
        }),
      );
      const select = screen.getByRole("combobox", { name: "Add partnership" });
      const initialPartner = partnerClubs.find(
        (partner) => partner.id === initial.selected,
      )!;
      expect(
        screen.getByRole("button", {
          name: `Remove partner ${initialPartner.name}`,
        }),
      ).toBeInTheDocument();
      fireEvent.click(
        screen.getByRole("button", {
          name: `Remove partner ${initialPartner.name}`,
        }),
      );
      const nextPartner =
        initial.selected === clubId ? partnerClubs[1] : partnerClubs[0];
      fireEvent.change(select, { target: { value: nextPartner.id } });
      const form = container.querySelector("form");
      expect(form).not.toBeNull();
      fireEvent.submit(form!);
      await waitFor(() =>
        expect(mocks.createActivity).toHaveBeenCalledWith(
          expect.objectContaining({
            sisterClubName: nextPartner.name,
            sisterClubId: nextPartner.id === clubId ? clubId : undefined,
            partners: [
              expect.objectContaining({
                name: nextPartner.name,
                role: "IMPLEMENTING_PARTNER",
              }),
            ],
          }),
        ),
      );
    },
  );

  it.each(["JOINT_PROJECT", "SERVICE_PROJECT"])(
    "keeps multiple partners in a %s payload",
    async (kind) => {
      const { container } = render(
        createElement(ActivityCreateClient, {
          initialKind: kind,
          initialSisterClubId: clubId,
          initialPartnerName: null,
          canCreateEvent: true,
          canCreateProject: true,
          partnerClubs,
        }),
      );
      fireEvent.change(
        screen.getByRole("combobox", { name: "Add partnership" }),
        { target: { value: "sc-local" } },
      );
      expect(
        screen.getByRole("button", { name: "Remove partner Sister Club" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Remove partner Sponsor Club" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("option", { name: /Sister Club/ }),
      ).not.toBeInTheDocument();
      fireEvent.submit(container.querySelector("form")!);
      await waitFor(() =>
        expect(mocks.createActivity).toHaveBeenCalledWith(
          expect.objectContaining({
            kind,
            partners: [
              {
                name: "Sister Club",
                role: "IMPLEMENTING_PARTNER",
                sisterClubId: clubId,
              },
              { name: "Sponsor Club", role: "IMPLEMENTING_PARTNER" },
            ],
          }),
        ),
      );
    },
  );

  it("opens bound projects from partner cards and the all-projects dialog", async () => {
    mockQueries(
      [
        {
          id: clubId,
          partner_club_name: "Sister Club",
          country: "Philippines",
          status: "ACTIVE",
        },
      ],
      [{ sister_club_id: clubId, name: "Sister Club", activities: project }],
    );
    const clubs = await getSisterClubsList();
    render(createElement(PartnershipsClient, { initialSisterClubs: clubs }));
    expect(screen.getByText("Bound Projects (1)")).toBeInTheDocument();
    expect(
      screen.queryByText(/Collaborative Initiatives/i),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: project.title })).toHaveAttribute(
      "href",
      "/project-center/project-1",
    );
    const createLinks = screen.getAllByRole("link", {
      name: "New Joint Project",
    });
    expect(
      createLinks.some((link) =>
        link.getAttribute("href")?.includes(`sisterClubId=${clubId}`),
      ),
    ).toBe(true);
    fireEvent.click(
      screen.getByRole("button", { name: "View All Projects (1)" }),
    );
    expect(
      screen.getByRole("heading", { name: "All Bound Projects" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Open Project" })).toHaveLength(
      2,
    );
    expect(screen.queryByTitle("Edit Initiative")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Delete Initiative")).not.toBeInTheDocument();
  });

  it("offers My Profile to members without directory permissions", () => {
    render(
      createElement(Header, {
        userId: "member-1",
        userFullName: "Test Member",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "User profile menu" }));
    expect(screen.getByRole("link", { name: "My Profile" })).toHaveAttribute(
      "href",
      "/members/member-1",
    );
  });

  it("shows a shared project under both partners but counts it once", async () => {
    mocks.readStore.mockReturnValue({
      customClubs: partnerClubs.map((partner) => ({
        id: partner.id,
        partnerClubName: partner.name,
        status: "ACTIVE",
      })),
      initiatives: [],
    });
    mockQueries(
      [],
      [
        { sister_club_id: clubId, name: "Sister Club", activities: project },
        { sister_club_id: null, name: "Sponsor Club", activities: project },
      ],
    );
    const clubs = await getSisterClubsList();
    expect(clubs.map((club) => club.initiativesCount)).toEqual([1, 1]);
    render(createElement(PartnershipsClient, { initialSisterClubs: clubs }));
    expect(screen.getAllByText("Bound Projects (1)")).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "View All Projects (1)" }),
    ).toBeInTheDocument();
  });
});

describe("Project and media server actions", () => {
  const secondPartnerId = "00000000-0000-0000-0000-000000000098";
  const activityId = "00000000-0000-0000-0000-000000000042";
  const input: CreateActivityInput = {
    clubId: "00000000-0000-0000-0000-000000000001",
    kind: "JOINT_PROJECT",
    title: "International literacy project",
    startAt: "2026-11-07T09:00",
    endAt: "2026-11-07T12:00",
    partners: [
      { name: "Manila", sisterClubId: clubId },
      { name: "Taipei Diamond", sisterClubId: secondPartnerId },
    ],
  };

  function mockWrites(
    registeredIds: string[],
    activityOverrides: Record<string, unknown> = {},
  ) {
    function makeQuery(table: string) {
      const query = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        upsert: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn(),
        single: vi
          .fn()
          .mockResolvedValue({ data: { id: activityId }, error: null }),
        maybeSingle: vi
          .fn()
          .mockResolvedValue({
            data:
              table === "activities"
                ? {
                    id: activityId,
                    club_id: input.clubId,
                    kind: "JOINT_PROJECT",
                    owner_id: "member-1",
                    ...activityOverrides,
                  }
                : null,
            error: null,
          }),
      };
      query.in.mockImplementation(() =>
        table === "sister_clubs"
          ? Promise.resolve({
              data: registeredIds.map((id) => ({ id })),
              error: null,
            })
          : query,
      );
      return query;
    }
    const queries = new Map<string, ReturnType<typeof makeQuery>>();
    mocks.from.mockImplementation((table: string) => {
      if (!queries.has(table)) queries.set(table, makeQuery(table));
      return queries.get(table);
    });
    return queries;
  }

  it("persists each partner binding", async () => {
    const actions = await vi.importActual<
      typeof import("@/features/activities/actions")
    >("@/features/activities/actions");
    const queries = mockWrites([clubId, secondPartnerId]);
    expect(await actions.createActivityAction(input)).toMatchObject({
      success: true,
      activityId,
    });
    expect(queries.get("sister_clubs")?.eq).toHaveBeenCalledWith(
      "home_club_id",
      input.clubId,
    );
    expect(queries.get("sister_clubs")?.in).toHaveBeenCalledWith("id", [
      clubId,
      secondPartnerId,
    ]);
    expect(queries.get("activity_partners")?.insert).toHaveBeenCalledWith([
      {
        activity_id: activityId,
        name: "Manila",
        partner_role: "IMPLEMENTING_PARTNER",
        sister_club_id: clubId,
      },
      {
        activity_id: activityId,
        name: "Taipei Diamond",
        partner_role: "IMPLEMENTING_PARTNER",
        sister_club_id: secondPartnerId,
      },
    ]);
  });

  it("rejects an unregistered additional partner before creating a project", async () => {
    const actions = await vi.importActual<
      typeof import("@/features/activities/actions")
    >("@/features/activities/actions");
    const queries = mockWrites([clubId]);
    expect(
      await actions.createActivityAction({ ...input, sisterClubId: clubId }),
    ).toMatchObject({
      success: false,
      error: expect.stringContaining("not all registered"),
    });
    expect(queries.has("activities")).toBe(false);
  });

  it("rejects an unregistered additional partner before updating a project", async () => {
    const actions = await vi.importActual<
      typeof import("@/features/activities/actions")
    >("@/features/activities/actions");
    const queries = mockWrites([clubId]);
    expect(await actions.updateActivityAction(activityId, input)).toMatchObject(
      { success: false, error: expect.stringContaining("not all registered") },
    );
    expect(queries.get("activities")?.update).not.toHaveBeenCalled();
    expect(queries.has("activity_partners")).toBe(false);
  });

  it("rejects oversized photo batches before storage upload", async () => {
    const actions = await vi.importActual<
      typeof import("@/features/activities/actions")
    >("@/features/activities/actions");
    mockWrites([]);
    const data = new FormData();
    data.set("activityId", activityId);
    for (const name of ["one.webp", "two.webp"]) {
      const file = new File(["photo"], name, { type: "image/webp" });
      Object.defineProperty(file, "size", { value: 2 * 1024 * 1024 });
      data.append("files", file);
    }
    expect(await actions.uploadActivityMediaAction(data)).toMatchObject({
      success: false,
      error: expect.stringContaining("batch exceeds 3 MB"),
    });
    expect(mocks.storageUpload).not.toHaveBeenCalled();
  });

  it("removes orphaned storage files if album metadata cannot be saved", async () => {
    const actions = await vi.importActual<
      typeof import("@/features/activities/actions")
    >("@/features/activities/actions");
    mockWrites([]);
    mocks
      .from("activity_media")
      .insert.mockResolvedValue({ error: { message: "Write failed" } });
    const photo = new File(["photo"], "moment.webp", { type: "image/webp" });
    Object.defineProperty(photo, "arrayBuffer", {
      value: async () => new ArrayBuffer(5),
    });
    const data = new FormData();
    data.set("activityId", activityId);
    data.append("files", photo);
    expect(await actions.uploadActivityMediaAction(data)).toMatchObject({
      success: false,
      error: expect.stringContaining("could not be saved"),
    });
    expect(mocks.storageUpload).toHaveBeenCalledOnce();
    expect(mocks.storageRemove).toHaveBeenCalledWith([
      mocks.storageUpload.mock.calls[0][0],
    ]);
  });

  it("denies nonparticipants access to private moments", async () => {
    const actions = await vi.importActual<
      typeof import("@/features/activities/actions")
    >("@/features/activities/actions");
    mockWrites([], { owner_id: "another-member", status: "PLANNED" });
    mocks.participant.mockResolvedValue(false);
    expect(await actions.getActivityMomentsAction(activityId)).toMatchObject({
      success: false,
    });
    expect(mocks.mediaPage).not.toHaveBeenCalled();
  });

  it("denies draft moments to nonmanaging members", async () => {
    const actions = await vi.importActual<
      typeof import("@/features/activities/actions")
    >("@/features/activities/actions");
    mockWrites([], { owner_id: "another-member", status: "DRAFT" });
    expect(await actions.getActivityMomentsAction(activityId)).toMatchObject({
      success: false,
    });
    expect(mocks.mediaPage).not.toHaveBeenCalled();
  });

  it("allows club participants to load a bounded photo page", async () => {
    const actions = await vi.importActual<
      typeof import("@/features/activities/actions")
    >("@/features/activities/actions");
    mockWrites([], { owner_id: "another-member", status: "PLANNED" });
    expect(
      await actions.getActivityMomentsAction(activityId, 24),
    ).toMatchObject({ success: true });
    expect(mocks.mediaPage).toHaveBeenCalledWith(activityId, 24);
  });

  it("rejects invalid photo offsets before accessing the database", async () => {
    const actions = await vi.importActual<
      typeof import("@/features/activities/actions")
    >("@/features/activities/actions");
    expect(
      await actions.getActivityMomentsAction(activityId, -1),
    ).toMatchObject({ success: false, error: "Invalid photo page." });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("signs at most 24 photos per album query with deterministic pagination", async () => {
    const queries = await vi.importActual<
      typeof import("@/features/activities/queries")
    >("@/features/activities/queries");
    mockWrites([]);
    const rows = Array.from({ length: 25 }, (_, index) => ({
      id: `photo-${index}`,
      storage_path: `path-${index}`,
      caption: null,
      is_featured: false,
    }));
    const query = mocks.from("activity_media");
    query.range.mockResolvedValue({ data: rows, error: null });
    mocks.signedUrls.mockResolvedValue({
      data: rows.map((row) => ({
        path: row.storage_path,
        signedUrl: `/signed/${row.storage_path}`,
      })),
    });
    const result = await queries.getActivityMediaPage(activityId, 24);
    expect(result.media).toHaveLength(24);
    expect(result.hasMore).toBe(true);
    expect(query.eq).toHaveBeenCalledWith("activity_id", activityId);
    expect(query.range).toHaveBeenCalledWith(24, 48);
    expect(query.order).toHaveBeenCalledWith("id", { ascending: true });
    expect(mocks.signedUrls.mock.calls[0][0]).toHaveLength(24);
    expect(result.media[0].url).toBe("/signed/path-0");
  });
});
