import { NextResponse } from "next/server";
import { env, getAppBaseUrl } from "@/lib/env";
import { getActiveNotificationUser } from "@/lib/services/notifications/auth";
import { dispatchNotification } from "@/lib/services/notifications/dispatch";

export async function POST() {
  const session = await getActiveNotificationUser();
  if (!session) {
    return NextResponse.json(
      { error: "Sign in to send a test notification." },
      { status: 401 },
    );
  }

  const appBaseUrl = getAppBaseUrl();
  const result = await dispatchNotification({
    profileId: session.user.id,
    clubId: env.NEXT_PUBLIC_DEFAULT_CLUB_ID,
    type: "GENERAL",
    title: "RacSpeed test notification",
    message:
      "Your in-app, Web Push, and Telegram notification links are active and verified.",
    linkUrl: "/settings/notifications",
    sendPush: true,
    sendTelegram: true,
    sendEmail: false,
    isSelfAction: false,
  });

  return NextResponse.json({
    success: true,
    appBaseUrl,
    deliveryCount: result.deliveryCount,
    deliveryStatuses: result.deliveryStatuses,
  });
}

