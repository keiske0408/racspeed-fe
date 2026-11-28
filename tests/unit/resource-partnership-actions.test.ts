import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPartnershipInitiativeAction,
  deletePartnershipInitiativeAction,
  updatePartnershipInitiativeAction,
} from "@/features/partnerships/actions";
import {
  createResourceAction,
  deleteResourceAction,
  updateResourceAction,
} from "@/features/resources/actions";

const mocks = vi.hoisted(() => ({
  assertPermission: vi.fn(),
  permissions: new Set<string>(),
  createResource: vi.fn(),
  updateResource: vi.fn(),
  deleteResource: vi.fn(),
  addCustomInitiative: vi.fn(),
  updateCustomInitiative: vi.fn(),
  deleteCustomInitiative: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  requireUser: vi.fn().mockResolvedValue({ id: "member-1" }),
  assertPermission: mocks.assertPermission,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mocks.from }),
}));
vi.mock("@/lib/data/resources-storage", () => ({
  createResource: mocks.createResource,
  updateResource: mocks.updateResource,
  deleteResource: mocks.deleteResource,
}));
vi.mock("@/lib/data/partnerships-storage", () => ({
  addCustomInitiative: mocks.addCustomInitiative,
  updateCustomInitiative: mocks.updateCustomInitiative,
  deleteCustomInitiative: mocks.deleteCustomInitiative,
  normalizeSisterClubId: (id: string) => id,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("server-only", () => ({}));

const DEFAULT_CLUB_ID = "00000000-0000-0000-0000-000000000001";
const resource = {
  id: "resource-1",
  clubId: DEFAULT_CLUB_ID,
  title: "Club handbook",
  description: "",
  url: "https://example.org",
  category: "OTHER" as const,
  isPinned: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function resourceForm() {
  const formData = new FormData();
  formData.set("title", "Club handbook");
  formData.set("url", "https://example.org");
  formData.set("category", "OTHER");
  return formData;
}

function initiativeForm() {
  const formData = new FormData();
  formData.set("sisterClubId", "00000000-0000-0000-0001-000000000001");
  formData.set("initiativeId", "initiative-1");
  formData.set("title", "Community literacy day");
  formData.set("jointVolunteers", "5");
  return formData;
}

beforeEach(() => {
  mocks.permissions.clear();
  mocks.assertPermission.mockReset().mockImplementation(
    async (_clubId: string, permission: string) => {
      if (!mocks.permissions.has(permission)) {
        throw new Error(`Unauthorized: missing ${permission}`);
      }
    },
  );
  mocks.createResource.mockReset().mockReturnValue(resource);
  mocks.updateResource.mockReset().mockReturnValue(resource);
  mocks.deleteResource.mockReset().mockReturnValue(true);
  mocks.addCustomInitiative.mockReset();
  mocks.updateCustomInitiative.mockReset().mockReturnValue(null);
  mocks.deleteCustomInitiative.mockReset();
  mocks.from.mockReset().mockImplementation(() => ({
    insert: vi.fn().mockResolvedValue({ error: null }),
    update: vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })),
    delete: vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })),
  }));
});

describe("resource mutation authorization", () => {
  it("denies members without RESOURCE_MANAGE before changing resources", async () => {
    expect(await createResourceAction(resourceForm())).toMatchObject({
      success: false,
    });
    expect(await updateResourceAction("resource-1", resourceForm())).toMatchObject({
      success: false,
    });
    expect(await deleteResourceAction("resource-1")).toMatchObject({
      success: false,
    });
    expect(mocks.createResource).not.toHaveBeenCalled();
    expect(mocks.updateResource).not.toHaveBeenCalled();
    expect(mocks.deleteResource).not.toHaveBeenCalled();
  });

  it("allows RESOURCE_MANAGE holders to perform each resource mutation", async () => {
    mocks.permissions.add("RESOURCE_MANAGE");

    expect(await createResourceAction(resourceForm())).toMatchObject({
      success: true,
    });
    expect(await updateResourceAction("resource-1", resourceForm())).toMatchObject({
      success: true,
    });
    expect(await deleteResourceAction("resource-1")).toMatchObject({
      success: true,
    });
    expect(mocks.assertPermission).toHaveBeenCalledTimes(3);
    for (const [clubId, permission] of mocks.assertPermission.mock.calls) {
      expect(clubId).toBe(DEFAULT_CLUB_ID);
      expect(permission).toBe("RESOURCE_MANAGE");
    }
  });
});

describe("partnership initiative mutation authorization", () => {
  it("denies members without PARTNERSHIP_MANAGE before changing initiatives", async () => {
    await expect(
      createPartnershipInitiativeAction(initiativeForm()),
    ).rejects.toThrow("Unauthorized");
    await expect(
      updatePartnershipInitiativeAction(initiativeForm()),
    ).rejects.toThrow("Unauthorized");
    await expect(
      deletePartnershipInitiativeAction("initiative-1"),
    ).rejects.toThrow("Unauthorized");
    expect(mocks.addCustomInitiative).not.toHaveBeenCalled();
    expect(mocks.updateCustomInitiative).not.toHaveBeenCalled();
    expect(mocks.deleteCustomInitiative).not.toHaveBeenCalled();
  });

  it("allows PARTNERSHIP_MANAGE holders to perform each initiative mutation", async () => {
    mocks.permissions.add("PARTNERSHIP_MANAGE");

    expect(
      await createPartnershipInitiativeAction(initiativeForm()),
    ).toMatchObject({ success: true });
    expect(
      await updatePartnershipInitiativeAction(initiativeForm()),
    ).toMatchObject({ success: true });
    expect(
      await deletePartnershipInitiativeAction("initiative-1"),
    ).toMatchObject({ success: true });
    expect(mocks.assertPermission).toHaveBeenCalledTimes(3);
    for (const [clubId, permission] of mocks.assertPermission.mock.calls) {
      expect(clubId).toBe(DEFAULT_CLUB_ID);
      expect(permission).toBe("PARTNERSHIP_MANAGE");
    }
  });
});
