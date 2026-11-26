import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { env, getAppBaseUrl } from "@/lib/env";
import { getActiveNotificationUser } from "@/lib/services/notifications/auth";

const settingsSchema = z
  .object({
    telegramEnabled: z.boolean().optional(),
    telegramFrequency: z.enum(["IMMEDIATE", "DAILY_DIGEST"]).optional(),
    telegramMembershipUpdates: z.boolean().optional(),
    telegramActivityUpdates: z.boolean().optional(),
    telegramTreasuryUpdates: z.boolean().optional(),
    telegramReportingUpdates: z.boolean().optional(),
    telegramAdminUpdates: z.boolean().optional(),
    telegramSelfActions: z.boolean().optional(),
    pushEnabled: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

export async function GET() {
  const session = await getActiveNotificationUser();
  if (!session) {
    return NextResponse.json({ error: "Sign in to manage notification settings." }, { status: 401 });
  }

  const [{ data: preferences, error: preferenceError }, { data: connection, error: connectionError }] =
    await Promise.all([
      session.admin
        .from("notification_preferences")
        .select("*")
        .eq("profile_id", session.user.id)
        .maybeSingle(),
      session.admin
        .from("telegram_connections")
        .select("username, connected_at")
        .eq("profile_id", session.user.id)
        .maybeSingle(),
    ]);
  if (preferenceError || connectionError) {
    console.error("Could not load notification settings", {
      preferenceError: preferenceError?.message,
      connectionError: connectionError?.message,
    });
    return NextResponse.json({ error: "Could not load notification settings." }, { status: 500 });
  }

  return NextResponse.json({
    preferences: preferences || {},
    appBaseUrl: getAppBaseUrl(),
    telegram: {
      connected: Boolean(connection),
      username: connection?.username || null,
      connectedAt: connection?.connected_at || null,
      botUsername: env.TELEGRAM_BOT_USERNAME || null,
    },
  });
}

export async function PATCH(request: NextRequest) {
  const session = await getActiveNotificationUser();
  if (!session) {
    return NextResponse.json({ error: "Sign in to manage notification settings." }, { status: 401 });
  }

  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid notification settings." }, { status: 400 });
  }
  const values = parsed.data;

  if (values.telegramEnabled) {
    const { data: connection, error } = await session.admin
      .from("telegram_connections")
      .select("profile_id")
      .eq("profile_id", session.user.id)
      .maybeSingle();
    if (error) {
      console.error("Could not verify Telegram connection:", error.message);
      return NextResponse.json({ error: "Could not verify Telegram connection." }, { status: 500 });
    }
    if (!connection) {
      return NextResponse.json(
        { error: "Connect a Telegram account before enabling Telegram notifications." },
        { status: 409 },
      );
    }
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (values.telegramEnabled !== undefined) updates.telegram_enabled = values.telegramEnabled;
  if (values.telegramFrequency !== undefined) updates.telegram_frequency = values.telegramFrequency;
  if (values.telegramMembershipUpdates !== undefined) {
    updates.telegram_membership_updates = values.telegramMembershipUpdates;
  }
  if (values.telegramActivityUpdates !== undefined) {
    updates.telegram_activity_updates = values.telegramActivityUpdates;
  }
  if (values.telegramTreasuryUpdates !== undefined) {
    updates.telegram_treasury_updates = values.telegramTreasuryUpdates;
  }
  if (values.telegramReportingUpdates !== undefined) {
    updates.telegram_reporting_updates = values.telegramReportingUpdates;
  }
  if (values.telegramAdminUpdates !== undefined) {
    updates.telegram_admin_updates = values.telegramAdminUpdates;
  }
  if (values.telegramSelfActions !== undefined) {
    updates.telegram_self_actions = values.telegramSelfActions;
  }
  if (values.pushEnabled !== undefined) updates.push_enabled = values.pushEnabled;

  let { error } = await session.admin
    .from("notification_preferences")
    .upsert({ profile_id: session.user.id, ...updates }, { onConflict: "profile_id" });

  if (
    error &&
    error.message?.includes("telegram_self_actions") &&
    "telegram_self_actions" in updates
  ) {
    const fallbackUpdates = { ...updates };
    delete fallbackUpdates.telegram_self_actions;
    const retry = await session.admin
      .from("notification_preferences")
      .upsert(
        { profile_id: session.user.id, ...fallbackUpdates },
        { onConflict: "profile_id" },
      );
    error = retry.error;
  }

  if (error) {
    console.error("Could not save notification settings:", error.message);
    return NextResponse.json({ error: "Could not save notification settings." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
