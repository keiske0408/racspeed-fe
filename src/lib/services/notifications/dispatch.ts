import "server-only";
import { createHash } from "crypto";
import { Resend } from "resend";
import webPush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

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
  | "MEMBERSHIP_UPDATE";

export interface NotificationInput {
  profileId: string;
  clubId: string;
  title: string;
  message: string;
  type: NotificationType;
  linkUrl?: string;
  dedupeKey: string;
  sendEmail?: boolean;
  sendPush?: boolean;
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char] || char,
  );
}

function emailEnabled(
  type: NotificationType,
  preferences: Record<string, boolean> | null,
) {
  if (!preferences) return true;
  if (type === "RETENTION_NUDGE")
    return preferences.email_retention_nudges !== false;
  if (type === "MENTION") return preferences.email_mentions !== false;
  if (
    ["ACTIVITY_REMINDER", "RSVP_REMINDER", "MIN_MEMBERS_ALERT"].includes(type)
  ) {
    return (
      preferences.email_activity_updates !== false &&
      preferences.email_event_reminders !== false
    );
  }
  if (type === "INVOICE_REMINDER")
    return preferences.email_dues_reminders !== false;
  if (type === "MEMBERSHIP_UPDATE")
    return preferences.email_approval_updates !== false;
  return true;
}

export async function dispatchNotification(input: NotificationInput) {
  const admin = createAdminClient();
  const { data: notification, error: insertError } = await admin
    .from("notifications")
    .insert({
      profile_id: input.profileId,
      club_id: input.clubId,
      title: input.title,
      message: input.message,
      type: input.type,
      link_url: input.linkUrl || null,
      dedupe_key: input.dedupeKey,
    })
    .select("id")
    .maybeSingle();

  if (insertError?.code === "23505")
    return { created: false, email: "SKIPPED", push: "SKIPPED" } as const;
  if (insertError || !notification) {
    console.warn("Could not create in-app notification:", insertError?.message);
    return { created: false, email: "FAILED", push: "FAILED" } as const;
  }

  const [{ data: profile }, { data: preference }, { data: subscriptions }] =
    await Promise.all([
      admin
        .from("profiles")
        .select("email, full_name")
        .eq("id", input.profileId)
        .maybeSingle(),
      admin
        .from("notification_preferences")
        .select("*")
        .eq("profile_id", input.profileId)
        .maybeSingle(),
      admin
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("profile_id", input.profileId),
    ]);

  let emailStatus: "SENT" | "FAILED" | "SKIPPED_PREVIEW" | "SKIPPED" =
    "SKIPPED";
  if (
    input.sendEmail !== false &&
    profile?.email &&
    emailEnabled(input.type, preference as Record<string, boolean> | null)
  ) {
    if (!env.RESEND_API_KEY) {
      emailStatus = "SKIPPED_PREVIEW";
      await admin.from("email_delivery_logs").insert({
        recipient_email: profile.email,
        subject: input.title,
        status: emailStatus,
        error_details: "RESEND_API_KEY is not configured",
      });
    } else {
      const recipient = env.EMAIL_TEST_RECIPIENT || profile.email;
      try {
        const resend = new Resend(env.RESEND_API_KEY);
        const result = await resend.emails.send({
          from: env.EMAIL_FROM,
          to: recipient,
          subject: input.title,
          text: `${input.message}${input.linkUrl ? `\n\nOpen: ${new URL(input.linkUrl, env.NEXT_PUBLIC_APP_URL).toString()}` : ""}`,
          html: `<main style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#172033"><h1 style="font-size:20px">${escapeHtml(input.title)}</h1><p style="line-height:1.6">${escapeHtml(input.message)}</p>${input.linkUrl ? `<p><a href="${escapeHtml(new URL(input.linkUrl, env.NEXT_PUBLIC_APP_URL).toString())}" style="display:inline-block;padding:10px 14px;background:#0d3594;color:white;text-decoration:none;border-radius:6px">Open RacSpeed</a></p>` : ""}</main>`,
        });
        emailStatus = result.error ? "FAILED" : "SENT";
        await admin.from("email_delivery_logs").insert({
          recipient_email: recipient,
          subject: input.title,
          provider: "RESEND",
          provider_id: result.data?.id || null,
          status: emailStatus,
          error_details: result.error?.message || null,
        });
      } catch (error) {
        emailStatus = "FAILED";
        await admin.from("email_delivery_logs").insert({
          recipient_email: recipient,
          subject: input.title,
          status: emailStatus,
          error_details:
            error instanceof Error ? error.message : "Email delivery failed",
        });
      }
    }
  }

  let pushStatus: "SENT" | "FAILED" | "SKIPPED" = "SKIPPED";
  if (
    input.sendPush !== false &&
    preference?.push_enabled !== false &&
    subscriptions?.length
  ) {
    const hasVapidKeys = Boolean(
      env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY,
    );
    if (!hasVapidKeys) {
      pushStatus = "SKIPPED";
      await Promise.all(
        subscriptions.map((sub) =>
          admin.from("push_delivery_logs").insert({
            profile_id: input.profileId,
            notification_id: notification.id,
            endpoint_hash: createHash("sha256")
              .update(sub.endpoint)
              .digest("hex"),
            status: "SKIPPED",
            error_details: "VAPID keys are not configured",
          }),
        ),
      );
    } else {
      webPush.setVapidDetails(
        env.VAPID_SUBJECT,
        env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
        env.VAPID_PRIVATE_KEY!,
      );
      const results = await Promise.all(
        subscriptions.map(async (subscription) => {
          const endpointHash = createHash("sha256")
            .update(subscription.endpoint)
            .digest("hex");
          try {
            const response = await webPush.sendNotification(
              {
                endpoint: subscription.endpoint,
                keys: { p256dh: subscription.p256dh, auth: subscription.auth },
              },
              JSON.stringify({
                title: input.title,
                body: input.message,
                url: input.linkUrl || "/dashboard",
              }),
            );
            await admin
              .from("push_subscriptions")
              .update({ last_used_at: new Date().toISOString() })
              .eq("endpoint", subscription.endpoint);
            await admin.from("push_delivery_logs").insert({
              profile_id: input.profileId,
              notification_id: notification.id,
              endpoint_hash: endpointHash,
              status: "SENT",
              provider_status_code: response.statusCode,
            });
            return "SENT" as const;
          } catch (error) {
            const statusCode =
              typeof error === "object" &&
              error !== null &&
              "statusCode" in error
                ? Number(error.statusCode)
                : null;
            if (statusCode === 404 || statusCode === 410) {
              await admin
                .from("push_subscriptions")
                .delete()
                .eq("endpoint", subscription.endpoint);
            }
            await admin.from("push_delivery_logs").insert({
              profile_id: input.profileId,
              notification_id: notification.id,
              endpoint_hash: endpointHash,
              status: "FAILED",
              provider_status_code: statusCode,
              error_details:
                error instanceof Error
                  ? error.message.slice(0, 1000)
                  : "Web push failed",
            });
            return "FAILED" as const;
          }
        }),
      );
      pushStatus = results.includes("SENT") ? "SENT" : "FAILED";
    }
  }

  return {
    created: true,
    notificationId: notification.id,
    email: emailStatus,
    push: pushStatus,
  };
}
