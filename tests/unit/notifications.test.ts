import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  nextManilaDigestAt,
  renderNotificationTemplate,
  validateNotificationTemplate,
} from "@/lib/services/notifications/templates";
import type { NotificationDeliveryMessage } from "@/lib/services/notifications/providers/provider";

type TelegramProviderType =
  (typeof import("@/lib/services/notifications/providers/telegram"))["TelegramProvider"];
let TelegramProvider: TelegramProviderType;
const fetchMock = vi.fn();

const delivery: NotificationDeliveryMessage = {
  notificationId: "notification-1",
  profileId: "profile-1",
  clubId: "club-1",
  type: "GENERAL",
  title: "Test title",
  message: "Test message",
  linkUrl: null,
  targetType: "PROFILE",
  targetId: "123456",
};

describe("notification templates", () => {
  it("renders supported placeholders and defaults", () => {
    expect(
      renderNotificationTemplate(
        { titleTemplate: "Update: {{title}}", messageTemplate: "{{message}}" },
        { title: "Event", message: "Starts soon" },
      ),
    ).toEqual({ title: "Update: Event", message: "Starts soon" });

    expect(renderNotificationTemplate(null, { title: "Event", message: "Starts soon" }))
      .toEqual({ title: "Event", message: "Starts soon" });
  });

  it("rejects unsupported placeholders and empty content", () => {
    expect(
      validateNotificationTemplate({
        titleTemplate: "{{name}}",
        messageTemplate: "{{message}}",
      }),
    ).toBe("Unsupported template placeholder: name");
    expect(
      validateNotificationTemplate({ titleTemplate: " ", messageTemplate: "Body" }),
    ).toBe("Title template is required.");
  });

  it("schedules the next digest at 9 AM Manila time", () => {
    expect(nextManilaDigestAt(new Date("2026-03-03T00:59:00.000Z")))
      .toBe("2026-03-03T01:00:00.000Z");
    expect(nextManilaDigestAt(new Date("2026-03-03T01:00:00.000Z")))
      .toBe("2026-03-04T01:00:00.000Z");
  });
});

describe("Telegram notification provider", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-bot-token");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    ({ TelegramProvider } = await import("@/lib/services/notifications/providers/telegram"));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sends a message and returns Telegram's message ID", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, result: { message_id: 42 } }), {
        status: 200,
      }),
    );

    await expect(new TelegramProvider().send(delivery)).resolves.toEqual({
      messageId: "42",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.telegram.org/bottest-bot-token/sendMessage",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      chat_id: "123456",
      text: "Test title\n\nTest message",
    });
  });

  it("classifies rate limits as retryable and non-deliverable chats as permanent", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: false,
          error_code: 429,
          parameters: { retry_after: 30 },
        }),
        { status: 429 },
      ),
    );
    await expect(new TelegramProvider().send(delivery)).rejects.toMatchObject({
      options: { code: "429", retryable: true, retryAfterSeconds: 30 },
    });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false, error_code: 403 }), { status: 403 }),
    );
    await expect(new TelegramProvider().send(delivery)).rejects.toMatchObject({
      options: { code: "403", retryable: false },
    });
  });

  it("classifies network failures as retryable", async () => {
    fetchMock.mockRejectedValue(new Error("network unavailable"));

    await expect(new TelegramProvider().send(delivery)).rejects.toMatchObject({
      options: { code: "NETWORK_ERROR", retryable: true },
    });
  });
});
