import { NextResponse } from "next/server";
import { getActiveNotificationUser } from "@/lib/services/notifications/auth";

export async function DELETE() {
  const session = await getActiveNotificationUser();
  if (!session) {
    return NextResponse.json({ error: "Sign in to disconnect Telegram." }, { status: 401 });
  }

  const { error: tokenError } = await session.admin
    .from("telegram_link_tokens")
    .delete()
    .eq("profile_id", session.user.id);
  if (tokenError) {
    console.error("Could not invalidate Telegram link challenges:", tokenError.message);
    return NextResponse.json({ error: "Could not disconnect Telegram." }, { status: 500 });
  }

  const { error: connectionError } = await session.admin
    .from("telegram_connections")
    .delete()
    .eq("profile_id", session.user.id);
  if (connectionError) {
    console.error("Could not disconnect Telegram account:", connectionError.message);
    return NextResponse.json({ error: "Could not disconnect Telegram." }, { status: 500 });
  }

  const { error: preferenceError } = await session.admin
    .from("notification_preferences")
    .upsert(
      {
        profile_id: session.user.id,
        telegram_enabled: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "profile_id" },
    );
  if (preferenceError) {
    console.error("Could not disable Telegram notifications:", preferenceError.message);
    return NextResponse.json(
      { error: "Telegram was disconnected, but its notification preference could not be updated." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
