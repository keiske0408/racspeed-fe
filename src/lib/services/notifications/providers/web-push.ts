import "server-only";
import { createHash } from "crypto";
import webPush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import {
  NotificationProviderError,
  type NotificationDeliveryMessage,
  type NotificationProvider,
} from "./provider";

interface PushSubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

async function writePushLog(
  admin: ReturnType<typeof createAdminClient>,
  record: Record<string, unknown>,
) {
  try {
    const { error } = await admin.from("push_delivery_logs").insert(record);
    if (error) console.warn("Could not write push delivery log:", error.message);
  } catch (error) {
    console.warn(
      "Could not write push delivery log:",
      error instanceof Error ? error.message : "Unknown storage error",
    );
  }
}

export class WebPushProvider implements NotificationProvider {
  async send(input: NotificationDeliveryMessage) {
    const admin = createAdminClient();
    const { data: subscription, error: subscriptionError } = await admin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("endpoint", input.targetId)
      .eq("profile_id", input.profileId)
      .maybeSingle();

    if (subscriptionError) {
      throw new NotificationProviderError("Could not load push subscription.", {
        code: "SUBSCRIPTION_LOOKUP_FAILED",
        retryable: true,
      });
    }
    if (!subscription) {
      throw new NotificationProviderError("Push subscription no longer exists.", {
        code: "SUBSCRIPTION_MISSING",
        retryable: false,
      });
    }

    if (!env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
      throw new NotificationProviderError("Web Push is not configured.", {
        code: "NOT_CONFIGURED",
        retryable: false,
      });
    }

    const row = subscription as PushSubscriptionRow;
    webPush.setVapidDetails(
      env.VAPID_SUBJECT,
      env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      env.VAPID_PRIVATE_KEY,
    );

    let response: Awaited<ReturnType<typeof webPush.sendNotification>>;
    try {
      response = await webPush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        JSON.stringify({
          title: input.title,
          body: input.message,
          url: input.linkUrl || "/notifications",
        }),
      );
    } catch (error) {
      const statusCode =
        typeof error === "object" && error !== null && "statusCode" in error
          ? Number(error.statusCode)
          : null;
      if (statusCode === 404 || statusCode === 410) {
        try {
          const { error: deleteError } = await admin
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", row.endpoint)
            .eq("profile_id", input.profileId);
          if (deleteError) console.warn("Could not remove expired push subscription:", deleteError.message);
        } catch (deleteError) {
          console.warn(
            "Could not remove expired push subscription:",
            deleteError instanceof Error ? deleteError.message : "Unknown storage error",
          );
        }
      }
      await writePushLog(admin, {
        profile_id: input.profileId,
        notification_id: input.notificationId,
        endpoint_hash: createHash("sha256").update(row.endpoint).digest("hex"),
        status: "FAILED",
        provider_status_code: statusCode,
        error_details: "Web Push delivery failed.",
      });
      throw new NotificationProviderError("Web Push delivery failed.", {
        code: statusCode ? String(statusCode) : "PUSH_ERROR",
        retryable: statusCode !== 404 && statusCode !== 410,
      });
    }

    try {
      const { error } = await admin
        .from("push_subscriptions")
        .update({ last_used_at: new Date().toISOString() })
        .eq("endpoint", row.endpoint)
        .eq("profile_id", input.profileId);
      if (error) console.warn("Could not update push subscription use time:", error.message);
    } catch (error) {
      console.warn(
        "Could not update push subscription use time:",
        error instanceof Error ? error.message : "Unknown storage error",
      );
    }
    await writePushLog(admin, {
      profile_id: input.profileId,
      notification_id: input.notificationId,
      endpoint_hash: createHash("sha256").update(row.endpoint).digest("hex"),
      status: "SENT",
      provider_status_code: response.statusCode,
    });
    return { messageId: String(response.statusCode) };
  }
}
