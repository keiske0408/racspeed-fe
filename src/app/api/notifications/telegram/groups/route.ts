import { createHash, randomBytes } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { getNotificationAdmin } from "@/lib/services/notifications/auth";

const clubIdSchema = z.string().uuid();
const linkSchema = z.object({ clubId: clubIdSchema });
const unlinkSchema = z.object({
  clubId: clubIdSchema,
  groupId: z.string().uuid(),
});

export async function GET(request: NextRequest) {
  const parsed = clubIdSchema.safeParse(request.nextUrl.searchParams.get("clubId"));
  if (!parsed.success) return NextResponse.json({ error: "Invalid club." }, { status: 400 });
  const session = await getNotificationAdmin(parsed.data);
  if (!session) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

  const { data: groups, error } = await session.admin
    .from("telegram_group_destinations")
    .select("id, title, enabled, linked_at")
    .eq("club_id", parsed.data)
    .order("linked_at", { ascending: false });
  if (error) {
    console.error("Could not load Telegram groups:", error.message);
    return NextResponse.json({ error: "Could not load Telegram groups." }, { status: 500 });
  }
  return NextResponse.json({ groups: groups || [] });
}

export async function POST(request: NextRequest) {
  const parsed = linkSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid club." }, { status: 400 });
  const session = await getNotificationAdmin(parsed.data.clubId);
  if (!session) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_BOT_USERNAME) {
    return NextResponse.json({ error: "Telegram group linking is not configured." }, { status: 503 });
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
  const { error } = await session.admin.from("telegram_group_link_tokens").insert({
    profile_id: session.user.id,
    club_id: parsed.data.clubId,
    token_hash: createHash("sha256").update(token).digest("hex"),
    expires_at: expiresAt,
  });
  if (error) {
    console.error("Could not store Telegram group challenge:", error.message);
    return NextResponse.json({ error: "Could not start group linking." }, { status: 500 });
  }
  return NextResponse.json({
    deepLink: `https://t.me/${env.TELEGRAM_BOT_USERNAME}?startgroup=${token}`,
    expiresAt,
  });
}

export async function DELETE(request: NextRequest) {
  const parsed = unlinkSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid group." }, { status: 400 });
  const session = await getNotificationAdmin(parsed.data.clubId);
  if (!session) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

  const { error: tokensError } = await session.admin
    .from("telegram_group_link_tokens")
    .delete()
    .eq("club_id", parsed.data.clubId);
  if (tokensError) {
    console.error("Could not invalidate Telegram group challenges:", tokensError.message);
    return NextResponse.json({ error: "Could not unlink Telegram group." }, { status: 500 });
  }

  const { error } = await session.admin
    .from("telegram_group_destinations")
    .delete()
    .eq("id", parsed.data.groupId)
    .eq("club_id", parsed.data.clubId);
  if (error) {
    console.error("Could not unlink Telegram group:", error.message);
    return NextResponse.json({ error: "Could not unlink Telegram group." }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
