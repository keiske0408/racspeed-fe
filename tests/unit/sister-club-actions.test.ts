import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteSisterClubAction, updateSisterClubAction } from "@/features/partnerships/actions";

const mocks = vi.hoisted(() => ({
  owner: "",
  allowedClub: "",
  missing: false,
  readError: false,
  mutationMissing: false,
  update: vi.fn(),
  delete: vi.fn(),
  eq: vi.fn(),
  updateLocal: vi.fn(),
  deleteLocal: vi.fn(),
  access: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  requireUser: vi.fn().mockResolvedValue({ id: "officer-1" }),
  assertPermission: vi.fn().mockResolvedValue(undefined),
  getUserAccessContext: mocks.access,
}));
vi.mock("@/lib/data/partnerships-storage", () => ({
  updateCustomSisterClub: mocks.updateLocal,
  deleteCustomSisterClub: mocks.deleteLocal,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      let mutation = false;
      const query = {
        select: vi.fn().mockReturnThis(),
        eq: mocks.eq.mockImplementation(() => query),
        maybeSingle: vi.fn(async () => ({
          data: mutation
            ? (mocks.mutationMissing ? null : { id: TARGET })
            : (mocks.missing ? null : { id: TARGET, home_club_id: mocks.owner }),
          error: mocks.readError ? { message: "Database unavailable" } : null,
        })),
        update: mocks.update.mockImplementation(() => { mutation = true; return query; }),
        delete: mocks.delete.mockImplementation(() => { mutation = true; return query; }),
      };
      return query;
    },
  }),
}));

const CLUB_A = "00000000-0000-0000-0000-000000000001";
const CLUB_B = "00000000-0000-0000-0000-000000000002";
const TARGET = "00000000-0000-0000-0001-000000000001";
function updateForm() {
  const form = new FormData();
  form.set("clubId", TARGET);
  form.set("homeClubId", CLUB_A);
  form.set("partnerClubName", "Partner club");
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.owner = CLUB_A;
  mocks.allowedClub = CLUB_A;
  mocks.missing = false;
  mocks.readError = false;
  mocks.mutationMissing = false;
  mocks.access.mockImplementation(async (clubId: string) => ({
    isPlatformAdmin: false,
    permissions: new Set(clubId === mocks.allowedClub ? ["SETTINGS_MANAGE"] : []),
  }));
});

describe("sister-club ownership", () => {
  it.each(["update", "delete"])("rejects a club A officer targeting club B during %s", async (operation) => {
    mocks.owner = CLUB_B;
    const result = operation === "update"
      ? await updateSisterClubAction(updateForm())
      : await deleteSisterClubAction(TARGET);
    expect(result).toMatchObject({ success: false, error: "Partner club not found or access denied." });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.delete).not.toHaveBeenCalled();
    expect(mocks.updateLocal).not.toHaveBeenCalled();
    expect(mocks.deleteLocal).not.toHaveBeenCalled();
  });

  it.each(["update", "delete"])("scopes an authorized %s to the record and owner", async (operation) => {
    const result = operation === "update"
      ? await updateSisterClubAction(updateForm())
      : await deleteSisterClubAction(TARGET);
    expect(result).toMatchObject({ success: true });
    expect(mocks.access).toHaveBeenCalledWith(CLUB_A);
    expect(mocks.eq).toHaveBeenCalledWith("home_club_id", CLUB_A);
    expect(mocks.eq).toHaveBeenCalledWith("id", TARGET);
  });

  it("does not disclose whether an inaccessible record exists", async () => {
    mocks.missing = true;
    const missing = await deleteSisterClubAction(TARGET);
    mocks.missing = false;
    mocks.owner = CLUB_B;
    expect(await deleteSisterClubAction(TARGET)).toEqual(missing);
  });

  it("does not use local fallback when ownership lookup fails", async () => {
    mocks.readError = true;
    expect(await deleteSisterClubAction(TARGET)).toMatchObject({ success: false });
    expect(mocks.deleteLocal).not.toHaveBeenCalled();
  });

  it("does not change local data if the scoped database mutation matched no row", async () => {
    mocks.mutationMissing = true;
    expect(await updateSisterClubAction(updateForm())).toMatchObject({ success: false });
    expect(mocks.updateLocal).not.toHaveBeenCalled();
  });
});
