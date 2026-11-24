import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { getActiveNotificationUser, getNotificationAdmin } from "@/lib/services/notifications/auth";
import { dispatchNotification } from "@/lib/services/notifications/dispatch";

const broadcastSchema = z.object({
  platform: z.literal("telegram"),
  content: z.string().trim().min(1).max(4000),
  eventTitle: z.string().trim().max(120).optional(),
});

export async function POST(request: NextRequest) {
  const user = await getActiveNotificationUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to send a club announcement." }, { status: 401 });
  }

  const parsed = broadcastSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Only Telegram group announcements are supported; message content is required." },
      { status: 400 },
    );
  }

  const clubId = env.NEXT_PUBLIC_DEFAULT_CLUB_ID;
  const session = await getNotificationAdmin(clubId);
  if (!session) {
    return NextResponse.json({ error: "You do not have permission to send club announcements." }, { status: 403 });
  }

  const { count, error: groupError } = await session.admin
    .from("telegram_group_destinations")
    .select("id", { count: "exact", head: true })
    .eq("club_id", clubId)
    .eq("enabled", true);
  if (groupError) {
    console.error("Could not check Telegram destinations:", groupError.message);
    return NextResponse.json({ error: "Could not check Telegram destinations." }, { status: 500 });
  }
  if (!count) {
    return NextResponse.json({ error: "No Telegram groups are configured for this club." }, { status: 409 });
  }

  try {
    const result = await dispatchNotification({
      profileId: user.user.id,
      clubId,
      type: "PUBLIC_ANNOUNCEMENT",
      title: parsed.data.eventTitle || "Club announcement",
      message: parsed.data.content,
      sendEmail: false,
      sendPush: false,
      sendTelegram: false,
      sendToGroups: true,
    });
    const queued = result.deliveryCount || 0;
    return NextResponse.json({
      success: true,
      platform: "telegram",
      queued,
      failed: result.deliveryStatuses.filter((status) => status === "FAILED").length,
      dispatchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Could not queue Telegram club announcement:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Could not queue the Telegram announcement." }, { status: 500 });
  }
}
