import "server-only";
import { env } from "@/lib/env";
import {
  NotificationProviderError,
  type NotificationDeliveryMessage,
  type NotificationProvider,
} from "./provider";

interface TelegramResponse {
  ok?: boolean;
  result?: { message_id?: number };
  description?: string;
  error_code?: number;
  parameters?: { retry_after?: number };
}

function escapeTelegramHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function isTelegramButtonUrl(url: string | null): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname !== "localhost" &&
      parsed.hostname !== "127.0.0.1"
    );
  } catch {
    return false;
  }
}

export class TelegramProvider implements NotificationProvider {
  async send(input: NotificationDeliveryMessage) {
    if (!env.TELEGRAM_BOT_TOKEN) {
      throw new NotificationProviderError(
        "Telegram delivery is not configured.",
        { code: "NOT_CONFIGURED", retryable: false },
      );
    }

    const targetId = input.targetId;
    if (!/^-?\d+$/.test(targetId)) {
      throw new NotificationProviderError("Invalid Telegram chat identifier.", {
        code: "INVALID_CHAT_ID",
        retryable: false,
      });
    }

    const useInlineButton = isTelegramButtonUrl(input.linkUrl);
    const formattedText = [
      `<b>${escapeTelegramHtml(input.title)}</b>`,
      escapeTelegramHtml(input.message),
      !useInlineButton && input.linkUrl
        ? escapeTelegramHtml(input.linkUrl)
        : null,
    ]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 4096);

    const payload: Record<string, unknown> = {
      chat_id: targetId,
      text: formattedText,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
    };
    if (useInlineButton && input.linkUrl) {
      payload.reply_markup = {
        inline_keyboard: [[{ text: "Open in RacSpeed", url: input.linkUrl }]],
      };
    }

    let response: Response;
    try {
      response = await fetch(
        `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
          cache: "no-store",
          signal: AbortSignal.timeout(10_000),
        },
      );
    } catch {
      throw new NotificationProviderError("Telegram request failed.", {
        code: "NETWORK_ERROR",
        retryable: true,
      });
    }

    let result: TelegramResponse;
    try {
      result = (await response.json()) as TelegramResponse;
    } catch {
      throw new NotificationProviderError("Telegram returned an invalid response.", {
        code: "INVALID_RESPONSE",
        retryable: response.status >= 500,
      });
    }

    if (!response.ok || result.ok !== true) {
      const errorCode = result.error_code ?? response.status;
      const retryAfterSeconds = result.parameters?.retry_after;
      throw new NotificationProviderError(
        errorCode === 403
          ? "Telegram bot was blocked or cannot message this chat."
          : errorCode === 400
            ? "Telegram rejected the message or chat."
            : errorCode === 429
              ? "Telegram rate limit reached."
              : "Telegram delivery failed.",
        {
          code: String(errorCode),
          retryable: errorCode === 429 || errorCode >= 500,
          retryAfterSeconds,
        },
      );
    }

    return {
      messageId: result.result?.message_id
        ? String(result.result.message_id)
        : undefined,
    };
  }
}
