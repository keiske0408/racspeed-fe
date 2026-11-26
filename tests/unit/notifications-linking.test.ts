import { createHash } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/services/notifications/auth", () => ({
  getActiveNotificationUser: vi.fn(),
  getNotificationAdmin: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

const seededClubId = "00000000-0000-0000-0000-000000000001";
const profileId = "00000000-0000-4000-8000-000000000001";

function createAdminMock() {
  const inserts: { table: string; value: Record<string, unknown> }[] = [];
  const upserts: { table: string; value: Record<string, unknown> }[] = [];
  const rpc = vi.fn(async () => ({ data: profileId, error: null }));
  const from = vi.fn((table: string) => {
    const deleteQuery = {
      error: null,
      eq: vi.fn(() => deleteQuery),
      is: vi.fn(async () => ({ error: null })),
    };
    const selectQuery = {
      eq: vi.fn(() => selectQuery),
      order: vi.fn(async () => ({ data: [], error: null })),
    };
    return {
      select: vi.fn(() => selectQuery),
      delete: vi.fn(() => deleteQuery),
      insert: vi.fn(async (value: Record<string, unknown>) => {
        inserts.push({ table, value });
        return { error: null };
      }),
      upsert: vi.fn(async (value: Record<string, unknown>) => {
        upserts.push({ table, value });
        return { error: null };
      }),
    };
  });
  return { admin: { from, rpc }, from, inserts, upserts, rpc };
}

describe("Telegram account linking routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-bot-token");
    vi.stubEnv("TELEGRAM_BOT_USERNAME", "racspeed_test_bot");
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "test_webhook_secret_1234567890123456");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("creates a short-lived link challenge while storing only its hash", async () => {
    const mock = createAdminMock();
    const auth = await import("@/lib/services/notifications/auth");
    vi.mocked(auth.getActiveNotificationUser).mockResolvedValue({
      user: { id: profileId },
      admin: mock.admin,
    } as never);
    const { POST } = await import("@/app/api/notifications/telegram/link/route");

    const response = await POST();
    const body = await response.json();
    const token = new URL(body.deepLink).searchParams.get("start");
    const storedToken = mock.inserts.find((entry) => entry.table === "telegram_link_tokens");
    if (!token) throw new Error("The generated Telegram link does not contain a token.");

    expect(response.status).toBe(200);
    expect(token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(storedToken?.value.token_hash).toBe(
      createHash("sha256").update(token).digest("hex"),
    );
    expect(storedToken?.value.token_hash).not.toBe(token);
    expect(Date.parse(String(storedToken?.value.expires_at)) - Date.now())
      .toBeGreaterThan(14 * 60_000);
  });

  it("validates the webhook secret and consumes a hashed account-link token", async () => {
    const mock = createAdminMock();
    const adminModule = await import("@/lib/supabase/admin");
    vi.mocked(adminModule.createAdminClient).mockReturnValue(mock.admin as never);
    const { POST } = await import("@/app/api/telegram/webhook/route");
    const token = "one-time-link-token-0123456789";
    const request = new Request("https://racspeed.example/api/telegram/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-telegram-bot-api-secret-token": "test_webhook_secret_1234567890123456",
      },
      body: JSON.stringify({
        update_id: 123,
        message: {
          text: `/start ${token}`,
          from: { id: 456, username: "club_member" },
          chat: { id: 456, type: "private" },
        },
      }),
    });

    const response = await POST(request as never);

    expect(response.status).toBe(200);
    expect(mock.rpc).toHaveBeenCalledWith("consume_telegram_link_token", {
      p_token_hash: createHash("sha256").update(token).digest("hex"),
      p_chat_id: "456",
      p_username: "club_member",
    });
  });

  it("disconnects Telegram and disables future direct-message delivery", async () => {
    const mock = createAdminMock();
    const auth = await import("@/lib/services/notifications/auth");
    vi.mocked(auth.getActiveNotificationUser).mockResolvedValue({
      user: { id: profileId },
      admin: mock.admin,
    } as never);
    const { DELETE } = await import("@/app/api/notifications/telegram/disconnect/route");

    const response = await DELETE();

    expect(response.status).toBe(200);
    expect(mock.from).toHaveBeenCalledWith("telegram_link_tokens");
    expect(mock.from).toHaveBeenCalledWith("telegram_connections");
    expect(mock.upserts).toEqual([
      {
        table: "notification_preferences",
        value: expect.objectContaining({
          profile_id: profileId,
          telegram_enabled: false,
        }),
      },
    ]);
  });

  it("accepts seeded non-RFC4122 clubId UUIDs for groups and templates and rejects malformed clubIds", async () => {
    const mock = createAdminMock();
    const auth = await import("@/lib/services/notifications/auth");
    vi.mocked(auth.getNotificationAdmin).mockResolvedValue({
      user: { id: profileId },
      admin: mock.admin,
    } as never);
    const { NextRequest } = await import("next/server");
    const { GET: getGroups } = await import("@/app/api/notifications/telegram/groups/route");
    const { GET: getTemplates } = await import("@/app/api/notifications/templates/route");

    const groupsRes = await getGroups(
      new NextRequest(`https://racspeed.example/api/notifications/telegram/groups?clubId=${seededClubId}`),
    );
    expect(groupsRes.status).toBe(200);
    expect(await groupsRes.json()).toEqual({ groups: [] });

    const templatesRes = await getTemplates(
      new NextRequest(`https://racspeed.example/api/notifications/templates?clubId=${seededClubId}`),
    );
    expect(templatesRes.status).toBe(200);
    expect(await templatesRes.json()).toEqual({ templates: [] });

    const badGroupsRes = await getGroups(
      new NextRequest("https://racspeed.example/api/notifications/telegram/groups?clubId=not-a-uuid"),
    );
    expect(badGroupsRes.status).toBe(400);
    expect(await badGroupsRes.json()).toEqual({ error: "Invalid club." });

    const badTemplatesRes = await getTemplates(
      new NextRequest("https://racspeed.example/api/notifications/templates?clubId=not-a-uuid"),
    );
    expect(badTemplatesRes.status).toBe(400);
    expect(await badTemplatesRes.json()).toEqual({ error: "Invalid club." });
  });
});
