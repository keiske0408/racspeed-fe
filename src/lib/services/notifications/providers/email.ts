import "server-only";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import {
  NotificationProviderError,
  type NotificationDeliveryMessage,
  type NotificationProvider,
} from "./provider";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[char] ?? char;
  });
}

async function writeDeliveryLog(
  admin: ReturnType<typeof createAdminClient>,
  record: Record<string, unknown>,
) {
  try {
    const { error } = await admin.from("email_delivery_logs").insert(record);
    if (error) console.warn("Could not write email delivery log:", error.message);
  } catch (error) {
    console.warn(
      "Could not write email delivery log:",
      error instanceof Error ? error.message : "Unknown storage error",
    );
  }
}

export class EmailProvider implements NotificationProvider {
  async send(input: NotificationDeliveryMessage) {
    const admin = createAdminClient();
    const recipient = env.EMAIL_TEST_RECIPIENT || input.targetId;
    if (!env.RESEND_API_KEY) {
      await writeDeliveryLog(admin, {
        recipient_email: input.targetId,
        subject: input.title,
        status: "SKIPPED_PREVIEW",
        error_details: "RESEND_API_KEY is not configured",
      });
      return { skipped: "SKIPPED_PREVIEW" as const };
    }

    let absoluteLink: string | null = null;
    if (input.linkUrl) {
      try {
        absoluteLink = new URL(input.linkUrl, env.NEXT_PUBLIC_APP_URL).toString();
      } catch {
        throw new NotificationProviderError("Notification link is invalid.", {
          code: "INVALID_LINK",
          retryable: false,
        });
      }
    }

    const resend = new Resend(env.RESEND_API_KEY);
    let result: Awaited<ReturnType<typeof resend.emails.send>>;
    try {
      result = await resend.emails.send({
        from: env.EMAIL_FROM,
        to: recipient,
        subject: input.title,
        text: `${input.message}${absoluteLink ? `\n\nOpen: ${absoluteLink}` : ""}`,
        html: `<main style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#172033"><h1 style="font-size:20px">${escapeHtml(input.title)}</h1><p style="line-height:1.6">${escapeHtml(input.message)}</p>${absoluteLink ? `<p><a href="${escapeHtml(absoluteLink)}" style="display:inline-block;padding:10px 14px;background:#0d3594;color:white;text-decoration:none;border-radius:6px">Open RacSpeed</a></p>` : ""}</main>`,
      });
    } catch {
      const message = "Email delivery failed.";
      await writeDeliveryLog(admin, {
        recipient_email: recipient,
        subject: input.title,
        status: "FAILED",
        error_details: message,
      });
      throw new NotificationProviderError(message, {
        code: "RESEND_NETWORK_ERROR",
        retryable: true,
      });
    }

    if (result.error) {
      const providerError = new NotificationProviderError(
        "Email provider rejected the message.",
        { code: "RESEND_ERROR", retryable: true },
      );
      await writeDeliveryLog(admin, {
        recipient_email: recipient,
        subject: input.title,
        status: "FAILED",
        error_details: providerError.message,
      });
      throw providerError;
    }

    await writeDeliveryLog(admin, {
      recipient_email: recipient,
      subject: input.title,
      provider: "RESEND",
      provider_id: result.data?.id || null,
      status: "SENT",
    });
    return { messageId: result.data?.id };
  }
}
