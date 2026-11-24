import "server-only";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { EmailProvider } from "./providers/email";
import {
  NotificationProviderError,
  type NotificationDeliveryMessage,
  type NotificationProvider,
  type NotificationProviderKey,
  type NotificationTargetType,
} from "./providers/provider";
import { TelegramProvider } from "./providers/telegram";
import { WebPushProvider } from "./providers/web-push";
import {
  getNotificationCategory,
  nextManilaDigestAt,
  renderNotificationTemplate,
  shouldSendImmediately,
  type NotificationCategory,
} from "./templates";

export type NotificationType =
  | "INVOICE_REMINDER"
  | "PAYMENT_STATUS"
  | "BUDGET_ACTION"
  | "REPORT_REVIEW"
  | "ATTENDANCE_ALERT"
  | "GENERAL"
  | "ACTIVITY_REMINDER"
  | "RSVP_REMINDER"
  | "MIN_MEMBERS_ALERT"
  | "MENTION"
  | "COMMENT"
  | "RETENTION_NUDGE"
  | "REPORT_DUE"
  | "BADGE_EARNED"
  | "MEMBERSHIP_UPDATE"
  | "PUBLIC_ANNOUNCEMENT";

export interface NotificationDispatchInput {
  profileId: string;
  clubId: string;
  title: string;
  message: string;
  type: NotificationType;
  linkUrl?: string | null;
  dedupeKey?: string | null;
  sendEmail?: boolean;
  sendPush?: boolean;
  sendTelegram?: boolean;
  sendToGroups?: boolean;
  deferDelivery?: boolean;
}

export interface DeliveryRow {
  id: string;
  notification_id: string;
  profile_id: string | null;
  provider: NotificationProviderKey;
  target_type: NotificationTargetType;
  target_id: string;
  delivery_mode: "IMMEDIATE" | "DAILY_DIGEST";
  attempt_count: number;
}

interface NotificationRow {
  id: string;
  profile_id: string;
  club_id: string;
  title: string;
  message: string;
  type: string;
  link_url: string | null;
}

const MAX_ATTEMPTS = 5;
const TELEGRAM_CATEGORY_COLUMNS = {
  membership: "telegram_membership_updates",
  activity: "telegram_activity_updates",
  treasury: "telegram_treasury_updates",
  reporting: "telegram_reporting_updates",
  administration: "telegram_admin_updates",
} as const satisfies Record<NotificationCategory, string>;

const EMAIL_CATEGORY_COLUMNS = {
  membership: "email_approval_updates",
  activity: "email_event_reminders",
  treasury: "email_dues_reminders",
  reporting: "email_approval_updates",
  administration: "email_approval_updates",
} as const satisfies Record<NotificationCategory, string>;

function getProvider(provider: NotificationProviderKey): NotificationProvider {
  if (provider === "TELEGRAM") return new TelegramProvider();
  if (provider === "EMAIL") return new EmailProvider();
  return new WebPushProvider();
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected provider error";
}

async function setDeliveryStatus(
  id: string,
  values: Record<string, unknown>,
) {
  const { error } = await createAdminClient()
    .from("notification_deliveries")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("Could not update notification delivery state", {
      deliveryId: id,
      error: error.message,
    });
  }
}

async function recordDeliveryFailure(delivery: DeliveryRow, error: unknown) {
  const providerError =
    error instanceof NotificationProviderError ? error : null;
  const retryable = providerError?.options.retryable !== false;
  const shouldRetry = retryable && delivery.attempt_count < MAX_ATTEMPTS;
  const retrySeconds =
    providerError?.options.retryAfterSeconds ??
    Math.min(60 * 2 ** Math.max(delivery.attempt_count - 1, 0), 3600);

  console.error("Notification provider delivery failed", {
    deliveryId: delivery.id,
    provider: delivery.provider,
    code: providerError?.options.code || "UNKNOWN",
    retrying: shouldRetry,
  });
  await setDeliveryStatus(delivery.id, {
    status: shouldRetry ? "PENDING" : "FAILED",
    locked_until: null,
    next_attempt_at: shouldRetry
      ? new Date(Date.now() + retrySeconds * 1000).toISOString()
      : new Date().toISOString(),
    error_code: providerError?.options.code || "UNKNOWN",
    error_details: (providerError?.message || "Unexpected provider error").slice(0, 1000),
  });
  return shouldRetry ? ("QUEUED" as const) : ("FAILED" as const);
}

async function loadNotification(delivery: DeliveryRow) {
  const { data, error } = await createAdminClient()
    .from("notifications")
    .select("id, profile_id, club_id, title, message, type, link_url")
    .eq("id", delivery.notification_id)
    .maybeSingle();
  if (error) throw new Error(`Could not load notification: ${error.message}`);
  return data as NotificationRow | null;
}

async function isDeliveryEligible(
  delivery: DeliveryRow,
  notification: NotificationRow,
) {
  const admin = createAdminClient();
  if (delivery.target_type === "TELEGRAM_GROUP") {
    const { data, error } = await admin
      .from("telegram_group_destinations")
      .select("id")
      .eq("club_id", notification.club_id)
      .eq("chat_id", delivery.target_id)
      .eq("enabled", true)
      .maybeSingle();
    if (error) throw new Error(`Could not check Telegram group: ${error.message}`);
    return Boolean(data) && notification.type === "PUBLIC_ANNOUNCEMENT";
  }

  if (!delivery.profile_id) return false;
  if (delivery.provider === "TELEGRAM") {
    const [{ data, error: preferenceError }, { data: connection, error: connectionError }] =
      await Promise.all([
        admin
          .from("notification_preferences")
          .select("telegram_enabled, telegram_membership_updates, telegram_activity_updates, telegram_treasury_updates, telegram_reporting_updates, telegram_admin_updates")
          .eq("profile_id", delivery.profile_id)
          .maybeSingle(),
        admin
          .from("telegram_connections")
          .select("chat_id")
          .eq("profile_id", delivery.profile_id)
          .maybeSingle(),
      ]);
    if (preferenceError) throw new Error(`Could not check Telegram preference: ${preferenceError.message}`);
    if (connectionError) throw new Error(`Could not check Telegram connection: ${connectionError.message}`);
    const preference = data as Record<string, boolean> | null;
    if (
      !connection ||
      connection.chat_id !== delivery.target_id ||
      preference?.telegram_enabled !== true
    ) {
      return false;
    }
    return (
      preference[TELEGRAM_CATEGORY_COLUMNS[getNotificationCategory(notification.type as NotificationType)]] !==
      false
    );
  }

  if (delivery.provider === "EMAIL") {
    const { data, error } = await admin
      .from("notification_preferences")
      .select("*")
      .eq("profile_id", delivery.profile_id)
      .maybeSingle();
    if (error) throw new Error(`Could not check email preference: ${error.message}`);
    const category = getNotificationCategory(notification.type as NotificationType);
    const column = EMAIL_CATEGORY_COLUMNS[category];
    if (notification.type === "RETENTION_NUDGE") {
      return data?.email_retention_nudges !== false;
    }
    if (notification.type === "MENTION") return data?.email_mentions !== false;
    if (
      category === "activity" &&
      !["ACTIVITY_REMINDER", "RSVP_REMINDER", "ATTENDANCE_ALERT"].includes(notification.type)
    ) {
      return data?.email_activity_updates !== false;
    }
    return data?.[column] !== false;
  }

  const { data, error } = await admin
    .from("notification_preferences")
    .select("push_enabled")
    .eq("profile_id", delivery.profile_id)
    .maybeSingle();
  if (error) throw new Error(`Could not check push preference: ${error.message}`);
  return data?.push_enabled !== false;
}

async function sendClaimedDelivery(delivery: DeliveryRow) {
  let notification: NotificationRow | null;
  try {
    notification = await loadNotification(delivery);
    if (notification && !(await isDeliveryEligible(delivery, notification))) {
      await setDeliveryStatus(delivery.id, {
        status: "SKIPPED",
        locked_until: null,
        error_details: "Delivery is no longer enabled or eligible.",
      });
      return "SKIPPED" as const;
    }
  } catch (error) {
    console.error("Could not prepare notification delivery", {
      deliveryId: delivery.id,
      error: errorMessage(error),
    });
    await setDeliveryStatus(delivery.id, {
      status: "PENDING",
      locked_until: null,
      next_attempt_at: new Date(Date.now() + 60_000).toISOString(),
      error_details: errorMessage(error).slice(0, 1000),
    });
    return "QUEUED" as const;
  }

  if (!notification) {
    await setDeliveryStatus(delivery.id, {
      status: "FAILED",
      locked_until: null,
      error_details: "The notification record no longer exists.",
    });
    return "FAILED" as const;
  }

  try {
    const linkUrl = notification.link_url
      ? new URL(notification.link_url, env.NEXT_PUBLIC_APP_URL).toString()
      : null;
    const message: NotificationDeliveryMessage = {
      notificationId: notification.id,
      profileId: delivery.profile_id,
      clubId: notification.club_id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      linkUrl,
      targetType: delivery.target_type,
      targetId: delivery.target_id,
    };
    const result = await getProvider(delivery.provider).send(message);
    if (result.skipped) {
      await setDeliveryStatus(delivery.id, {
        status: "SKIPPED",
        locked_until: null,
        error_details: null,
      });
      return "SKIPPED" as const;
    }
    await setDeliveryStatus(delivery.id, {
      status: "SENT",
      locked_until: null,
      sent_at: new Date().toISOString(),
      provider_message_id: result.messageId || null,
      error_code: null,
      error_details: null,
    });
    return "SENT" as const;
  } catch (error) {
    return recordDeliveryFailure(delivery, error);
  }
}

function addDelivery(
  rows: Record<string, unknown>[],
  input: {
    notificationId: string;
    profileId: string | null;
    provider: NotificationProviderKey;
    targetType: NotificationTargetType;
    targetId: string;
    deliveryMode?: "IMMEDIATE" | "DAILY_DIGEST";
    nextAttemptAt?: string;
  },
) {
  rows.push({
    notification_id: input.notificationId,
    profile_id: input.profileId,
    provider: input.provider,
    target_type: input.targetType,
    target_id: input.targetId,
    delivery_mode: input.deliveryMode || "IMMEDIATE",
    next_attempt_at: input.nextAttemptAt || new Date().toISOString(),
  });
}

export async function dispatchNotification(input: NotificationDispatchInput) {
  if (input.sendToGroups && input.type !== "PUBLIC_ANNOUNCEMENT") {
    throw new Error("Telegram groups may only receive public announcements.");
  }

  const admin = createAdminClient();
  if (input.dedupeKey) {
    const { data: existing, error } = await admin
      .from("notifications")
      .select("id")
      .eq("dedupe_key", input.dedupeKey)
      .maybeSingle();
    if (error) throw new Error(`Could not check notification duplicate: ${error.message}`);
    if (existing) {
      return { created: false, notificationId: existing.id, deliveryStatuses: [] };
    }
  }

  const [profileResult, preferenceResult, templateResult] = await Promise.all([
    admin.from("profiles").select("email").eq("id", input.profileId).maybeSingle(),
    admin
      .from("notification_preferences")
      .select("*")
      .eq("profile_id", input.profileId)
      .maybeSingle(),
    admin
      .from("notification_templates")
      .select("title_template, message_template")
      .eq("club_id", input.clubId)
      .eq("type", input.type)
      .maybeSingle(),
  ]);
  if (profileResult.error) throw new Error(`Could not load notification recipient: ${profileResult.error.message}`);
  if (preferenceResult.error) throw new Error(`Could not load notification preferences: ${preferenceResult.error.message}`);
  if (templateResult.error) throw new Error(`Could not load notification template: ${templateResult.error.message}`);

  const rendered = renderNotificationTemplate(
    templateResult.data
      ? {
          titleTemplate: templateResult.data.title_template,
          messageTemplate: templateResult.data.message_template,
        }
      : null,
    { title: input.title, message: input.message },
  );
  const { data: notification, error: notificationError } = await admin
    .from("notifications")
    .insert({
      profile_id: input.profileId,
      club_id: input.clubId,
      title: rendered.title,
      message: rendered.message,
      type: input.type,
      link_url: input.linkUrl || null,
      dedupe_key: input.dedupeKey || null,
    })
    .select("id")
    .maybeSingle();
  if (notificationError) {
    if (notificationError.code === "23505" && input.dedupeKey) {
      return { created: false, notificationId: null, deliveryStatuses: [] };
    }
    throw new Error(`Could not create in-app notification: ${notificationError.message}`);
  }
  if (!notification) throw new Error("The in-app notification was not created.");

  const preferences = preferenceResult.data;
  const deliveries: Record<string, unknown>[] = [];
  const shouldSendEmail =
    input.sendEmail !== false && Boolean(profileResult.data?.email);
  if (shouldSendEmail && profileResult.data?.email) {
    addDelivery(deliveries, {
      notificationId: notification.id,
      profileId: input.profileId,
      provider: "EMAIL",
      targetType: "PROFILE",
      targetId: env.EMAIL_TEST_RECIPIENT || profileResult.data.email,
    });
  }

  if (input.sendPush !== false && preferences?.push_enabled !== false) {
    const { data: subscriptions, error } = await admin
      .from("push_subscriptions")
      .select("endpoint")
      .eq("profile_id", input.profileId);
    if (error) throw new Error(`Could not load push subscriptions: ${error.message}`);
    for (const subscription of subscriptions || []) {
      addDelivery(deliveries, {
        notificationId: notification.id,
        profileId: input.profileId,
        provider: "WEB_PUSH",
        targetType: "PUSH_SUBSCRIPTION",
        targetId: subscription.endpoint,
      });
    }
  }

  if (input.sendTelegram && preferences?.telegram_enabled === true) {
    const category = getNotificationCategory(input.type);
    if (preferences[TELEGRAM_CATEGORY_COLUMNS[category]] !== false) {
      const { data: connection, error } = await admin
        .from("telegram_connections")
        .select("chat_id")
        .eq("profile_id", input.profileId)
        .maybeSingle();
      if (error) throw new Error(`Could not load Telegram connection: ${error.message}`);
      if (connection?.chat_id) {
        const isDigest =
          preferences.telegram_frequency === "DAILY_DIGEST" &&
          !shouldSendImmediately(input.type);
        addDelivery(deliveries, {
          notificationId: notification.id,
          profileId: input.profileId,
          provider: "TELEGRAM",
          targetType: "PROFILE",
          targetId: connection.chat_id,
          deliveryMode: isDigest ? "DAILY_DIGEST" : "IMMEDIATE",
          nextAttemptAt: isDigest ? nextManilaDigestAt() : undefined,
        });
      }
    }
  }

  if (input.sendToGroups) {
    const { data: groups, error } = await admin
      .from("telegram_group_destinations")
      .select("chat_id")
      .eq("club_id", input.clubId)
      .eq("enabled", true);
    if (error) throw new Error(`Could not load Telegram group destinations: ${error.message}`);
    for (const group of groups || []) {
      addDelivery(deliveries, {
        notificationId: notification.id,
        profileId: null,
        provider: "TELEGRAM",
        targetType: "TELEGRAM_GROUP",
        targetId: group.chat_id,
      });
    }
  }

  if (deliveries.length === 0) {
    return {
      created: true,
      notificationId: notification.id,
      deliveryCount: 0,
      deliveryStatuses: [],
    };
  }

  const { data: queued, error: queueError } = await admin
    .from("notification_deliveries")
    .upsert(deliveries, {
      onConflict: "notification_id,provider,target_type,target_id",
      ignoreDuplicates: true,
    })
    .select("*");
  if (queueError) {
    const { error: cleanupError } = await admin
      .from("notifications")
      .delete()
      .eq("id", notification.id);
    if (cleanupError) {
      console.error("Could not roll back notification without delivery rows:", cleanupError.message);
    }
    throw new Error(`Could not queue notification delivery: ${queueError.message}`);
  }

  const immediateDeliveries = ((queued || []) as DeliveryRow[])
    .filter((delivery) => delivery.delivery_mode === "IMMEDIATE");
  if (input.deferDelivery) {
    return {
      created: true,
      notificationId: notification.id,
      deliveryCount: queued?.length || 0,
      deliveryStatuses: immediateDeliveries.map(() => "QUEUED" as const),
    };
  }

  const statuses = await Promise.all(
    immediateDeliveries
      .map(async (delivery) => {
        const { data: claimed, error } = await admin
          .from("notification_deliveries")
          .update({
            status: "PROCESSING",
            attempt_count: delivery.attempt_count + 1,
            locked_until: new Date(Date.now() + 120_000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", delivery.id)
          .eq("status", "PENDING")
          .select("*")
          .maybeSingle();
        if (error) {
          console.error("Could not claim immediate notification", {
            deliveryId: delivery.id,
            error: error.message,
          });
          return "QUEUED" as const;
        }
        return claimed ? sendClaimedDelivery(claimed as DeliveryRow) : ("QUEUED" as const);
      }),
  );

  return {
    created: true,
    notificationId: notification.id,
    deliveryCount: queued?.length || 0,
    deliveryStatuses: statuses,
  };
}

export async function processClaimedDeliveries(deliveries: DeliveryRow[]) {
  const digestDeliveries = new Map<string, DeliveryRow[]>();
  const immediate: DeliveryRow[] = [];
  for (const delivery of deliveries) {
    if (
      delivery.provider === "TELEGRAM" &&
      delivery.delivery_mode === "DAILY_DIGEST" &&
      delivery.target_type === "PROFILE" &&
      delivery.profile_id
    ) {
      const key = `${delivery.profile_id}:${delivery.target_id}`;
      digestDeliveries.set(key, [...(digestDeliveries.get(key) || []), delivery]);
    } else {
      immediate.push(delivery);
    }
  }

  const results = await Promise.all(immediate.map(sendClaimedDelivery));
  for (const batch of digestDeliveries.values()) {
    const prepared: { delivery: DeliveryRow; notification: NotificationRow }[] = [];
    for (const delivery of batch) {
      try {
        const notification = await loadNotification(delivery);
        if (!notification) {
          await setDeliveryStatus(delivery.id, {
            status: "FAILED",
            locked_until: null,
            error_details: "The notification record no longer exists.",
          });
        } else if (!(await isDeliveryEligible(delivery, notification))) {
          await setDeliveryStatus(delivery.id, {
            status: "SKIPPED",
            locked_until: null,
            error_details: "Delivery is no longer enabled or eligible.",
          });
        } else {
          prepared.push({ delivery, notification });
        }
      } catch (error) {
        results.push(
          await recordDeliveryFailure(delivery, error),
        );
      }
    }
    if (prepared.length === 0) continue;

    try {
      const first = prepared[0].notification;
      const items: string[] = [];
      let remaining = 3800;
      for (const { notification } of prepared) {
        const link = notification.link_url
          ? new URL(notification.link_url, env.NEXT_PUBLIC_APP_URL).toString()
          : "";
        const item = [
          `- ${notification.title}`,
          notification.message,
          link,
        ]
          .filter(Boolean)
          .join("\n");
        if (item.length > remaining) break;
        items.push(item);
        remaining -= item.length + 2;
      }
      const omitted = prepared.length - items.length;
      const body = [
        ...items,
        omitted > 0 ? `${omitted} more notification(s) are available in the app.` : "",
      ]
        .filter(Boolean)
        .join("\n\n")
        .slice(0, 3900);
      const digest: NotificationDeliveryMessage = {
        notificationId: first.id,
        profileId: prepared[0].delivery.profile_id,
        clubId: first.club_id,
        type: "DAILY_DIGEST",
        title: "Your daily RacSpeed notifications",
        message: body,
        linkUrl: null,
        targetType: "PROFILE",
        targetId: prepared[0].delivery.target_id,
      };
      const result = await new TelegramProvider().send(digest);
      for (const { delivery } of prepared) {
        await setDeliveryStatus(delivery.id, {
          status: "SENT",
          locked_until: null,
          sent_at: new Date().toISOString(),
          provider_message_id: result.messageId || null,
          error_code: null,
          error_details: null,
        });
        results.push("SENT");
      }
    } catch (error) {
      for (const { delivery } of prepared) {
        results.push(await recordDeliveryFailure(delivery, error));
      }
    }
  }
  return results;
}
