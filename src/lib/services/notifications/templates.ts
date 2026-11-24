import type { NotificationType } from "./dispatch";

export type NotificationCategory =
  | "membership"
  | "activity"
  | "treasury"
  | "reporting"
  | "administration";

export interface NotificationTemplate {
  titleTemplate: string;
  messageTemplate: string;
}

export const NOTIFICATION_TYPES = [
  "INVOICE_REMINDER",
  "PAYMENT_STATUS",
  "BUDGET_ACTION",
  "REPORT_REVIEW",
  "ATTENDANCE_ALERT",
  "GENERAL",
  "ACTIVITY_REMINDER",
  "RSVP_REMINDER",
  "MIN_MEMBERS_ALERT",
  "MENTION",
  "COMMENT",
  "RETENTION_NUDGE",
  "REPORT_DUE",
  "BADGE_EARNED",
  "MEMBERSHIP_UPDATE",
  "PUBLIC_ANNOUNCEMENT",
] as const satisfies readonly NotificationType[];

const PLACEHOLDERS = new Set(["title", "message"]);

export function getNotificationCategory(
  type: NotificationType,
): NotificationCategory {
  if (type === "MEMBERSHIP_UPDATE") return "membership";
  if (
    type === "INVOICE_REMINDER" ||
    type === "PAYMENT_STATUS" ||
    type === "BUDGET_ACTION"
  ) {
    return "treasury";
  }
  if (type === "REPORT_DUE" || type === "REPORT_REVIEW") return "reporting";
  if (type === "PUBLIC_ANNOUNCEMENT") return "administration";
  return "activity";
}

export function shouldSendImmediately(type: NotificationType) {
  return [
    "MEMBERSHIP_UPDATE",
    "PAYMENT_STATUS",
    "BUDGET_ACTION",
    "REPORT_REVIEW",
  ].includes(type);
}

export function validateNotificationTemplate(template: NotificationTemplate) {
  for (const value of [template.titleTemplate, template.messageTemplate]) {
    const matches = value.matchAll(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g);
    for (const match of matches) {
      if (!PLACEHOLDERS.has(match[1])) {
        return `Unsupported template placeholder: ${match[1]}`;
      }
    }
  }
  if (template.titleTemplate.trim().length === 0) {
    return "Title template is required.";
  }
  if (template.messageTemplate.trim().length === 0) {
    return "Message template is required.";
  }
  if (template.titleTemplate.length > 120 || template.messageTemplate.length > 2000) {
    return "Template exceeds the allowed length.";
  }
  return null;
}

export function renderNotificationTemplate(
  template: NotificationTemplate | null,
  values: { title: string; message: string },
) {
  const selected = template || {
    titleTemplate: "{{title}}",
    messageTemplate: "{{message}}",
  };
  const render = (text: string) =>
    text.replace(/\{\{\s*(title|message)\s*\}\}/g, (_match, key: "title" | "message") =>
      values[key],
    );
  return {
    title: render(selected.titleTemplate).slice(0, 120),
    message: render(selected.messageTemplate).slice(0, 2000),
  };
}

export function nextManilaDigestAt(now = new Date()) {
  const manilaNow = new Date(now.getTime() + 8 * 60 * 60_000);
  const nextDigestUtc = Date.UTC(
    manilaNow.getUTCFullYear(),
    manilaNow.getUTCMonth(),
    manilaNow.getUTCDate(),
    1,
  );
  return new Date(
    nextDigestUtc <= now.getTime() ? nextDigestUtc + 24 * 60 * 60_000 : nextDigestUtc,
  ).toISOString();
}
