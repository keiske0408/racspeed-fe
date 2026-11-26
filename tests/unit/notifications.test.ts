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
      parse_mode: "HTML",
      text: "<b>Test title</b>\n\nTest message",
    });
  });

  it("renders HTTPS links as Telegram inline buttons, escapes HTML, and keeps localhost links in text", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, result: { message_id: 43 } }), {
        status: 200,
      }),
    );

    await new TelegramProvider().send({
      ...delivery,
      title: "Task <Urgent> & Due",
      message: "Check <b>budget</b> > 500",
      linkUrl: "https://racspeed-fe.vercel.app/project-center/123?tab=tasks",
    });

    const httpsBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(httpsBody.text).toBe(
      "<b>Task &lt;Urgent&gt; &amp; Due</b>\n\nCheck &lt;b&gt;budget&lt;/b&gt; &gt; 500",
    );
    expect(httpsBody.reply_markup).toEqual({
      inline_keyboard: [
        [
          {
            text: "Open in RacSpeed",
            url: "https://racspeed-fe.vercel.app/project-center/123?tab=tasks",
          },
        ],
      ],
    });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, result: { message_id: 44 } }), {
        status: 200,
      }),
    );
    await new TelegramProvider().send({
      ...delivery,
      linkUrl: "http://localhost:3000/project-center/123?tab=tasks",
    });
    const localBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(localBody.reply_markup).toBeUndefined();
    expect(localBody.text).toContain("http://localhost:3000/project-center/123?tab=tasks");
  });

  it("resolves getAppBaseUrl with Vercel production fallback over stale or local URLs", async () => {
    const { getAppBaseUrl } = await import("@/lib/env");

    expect(
      getAppBaseUrl({
        NEXT_PUBLIC_APP_URL: "https://racspeed.vercel.app",
        VERCEL_PROJECT_PRODUCTION_URL: "racspeed-fe.vercel.app",
      }),
    ).toBe("https://racspeed-fe.vercel.app");

    expect(
      getAppBaseUrl({
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
        VERCEL_PROJECT_PRODUCTION_URL: "racspeed-fe.vercel.app",
      }),
    ).toBe("https://racspeed-fe.vercel.app");

    expect(
      getAppBaseUrl({
        NEXT_PUBLIC_APP_URL: "https://custom.racspeed.org",
        VERCEL_PROJECT_PRODUCTION_URL: "racspeed-fe.vercel.app",
      }),
    ).toBe("https://custom.racspeed.org");

    expect(
      getAppBaseUrl({
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      }),
    ).toBe("http://localhost:3000");
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
