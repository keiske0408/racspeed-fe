export type NotificationProviderKey = "EMAIL" | "WEB_PUSH" | "TELEGRAM";

export type NotificationTargetType =
  | "PROFILE"
  | "PUSH_SUBSCRIPTION"
  | "TELEGRAM_GROUP";

export interface NotificationDeliveryMessage {
  notificationId: string;
  profileId: string | null;
  clubId: string;
  type: string;
  title: string;
  message: string;
  linkUrl: string | null;
  targetType: NotificationTargetType;
  targetId: string;
}

export interface NotificationProviderResult {
  messageId?: string;
  skipped?: "SKIPPED_PREVIEW";
}

export interface NotificationProvider {
  send(input: NotificationDeliveryMessage): Promise<NotificationProviderResult>;
}

export class NotificationProviderError extends Error {
  constructor(
    message: string,
    readonly options: {
      code?: string;
      retryable: boolean;
      retryAfterSeconds?: number;
    },
  ) {
    super(message);
    this.name = "NotificationProviderError";
  }
}
