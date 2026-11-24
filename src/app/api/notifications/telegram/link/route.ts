import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getActiveNotificationUser } from "@/lib/services/notifications/auth";

export async function POST() {
  const session = await getActiveNotificationUser();
  if (!session) {
    return NextResponse.json({ error: "Sign in to connect Telegram." }, { status: 401 });
  }
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_BOT_USERNAME) {
    return NextResponse.json({ error: "Telegram linking is not configured." }, { status: 503 });
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
  const { error: clearError } = await session.admin
    .from("telegram_link_tokens")
    .delete()
    .eq("profile_id", session.user.id)
    .is("consumed_at", null);
  if (clearError) {
    console.error("Could not replace Telegram link challenge:", clearError.message);
    return NextResponse.json({ error: "Could not start Telegram linking." }, { status: 500 });
  }

  const { error } = await session.admin.from("telegram_link_tokens").insert({
    profile_id: session.user.id,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });
  if (error) {
    console.error("Could not store Telegram link challenge:", error.message);
    return NextResponse.json({ error: "Could not start Telegram linking." }, { status: 500 });
  }

  return NextResponse.json({
    deepLink: `https://t.me/${env.TELEGRAM_BOT_USERNAME}?start=${token}`,
    expiresAt,
  });
}
