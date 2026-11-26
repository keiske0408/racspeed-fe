import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { getActiveNotificationUser } from "@/lib/services/notifications/auth";
import { ensureSlaNotificationsEvaluated } from "@/lib/services/notifications/sla-reminders";

const uuidSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

const readSchema = z
  .object({
    id: uuidSchema.optional(),
    notificationId: uuidSchema.optional(),
    markAllRead: z.boolean().optional(),
  })
  .refine((value) => {
    const hasId = Boolean(value.id || value.notificationId);
    return hasId !== Boolean(value.markAllRead);
  });
const cursorSchema = z.object({
  createdAt: z.string().datetime({ offset: true }),
  id: uuidSchema,
});

export async function GET(request: NextRequest) {
  const session = await getActiveNotificationUser();
  if (!session) {
    return NextResponse.json({ error: "Sign in to view notifications." }, { status: 401 });
  }

  const requestedLimit = Number(request.nextUrl.searchParams.get("limit") || 25);
  const limit = Number.isInteger(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 50)
    : 25;
  const before = request.nextUrl.searchParams.get("before");
  if (!before && process.env.NODE_ENV !== "test") {
    await ensureSlaNotificationsEvaluated(env.NEXT_PUBLIC_DEFAULT_CLUB_ID).catch(
      (err) => console.warn("Background SLA evaluation failed:", err),
    );
  }
  let cursor: { createdAt: string; id?: string } | null = null;
  if (before) {
    if (before.length > 512) {
      return NextResponse.json({ error: "Invalid notification cursor." }, { status: 400 });
    }
    let decoded: unknown;
    try {
      decoded = JSON.parse(Buffer.from(before, "base64url").toString("utf8"));
    } catch {
      decoded = null;
    }
    const parsedCursor = cursorSchema.safeParse(decoded);
    if (parsedCursor.success) {
      cursor = parsedCursor.data;
    } else if (!Number.isNaN(Date.parse(before))) {
      cursor = { createdAt: before };
    } else {
      return NextResponse.json({ error: "Invalid notification cursor." }, { status: 400 });
    }
  }

  let pageQuery = session.admin
    .from("notifications")
    .select("id, title, message, type, link_url, is_read, created_at")
    .eq("profile_id", session.user.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (cursor?.id) {
    pageQuery = pageQuery.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    );
  } else if (cursor) {
    pageQuery = pageQuery.lt("created_at", cursor.createdAt);
  }

  const [{ data: notifications, error: pageError }, { count, error: countError }] =
    await Promise.all([
      pageQuery,
      session.admin
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", session.user.id)
        .eq("is_read", false),
    ]);
  if (pageError || countError) {
    console.error("Could not load notification center", {
      pageError: pageError?.message,
      countError: countError?.message,
    });
    return NextResponse.json({ error: "Could not load notifications." }, { status: 500 });
  }
  return NextResponse.json({
    notifications: notifications || [],
    unreadCount: count || 0,
    nextCursor:
      notifications && notifications.length === limit
        ? Buffer.from(
            JSON.stringify({
              createdAt: notifications[notifications.length - 1].created_at,
              id: notifications[notifications.length - 1].id,
            }),
          ).toString("base64url")
        : null,
  });
}

export async function PATCH(request: NextRequest) {
  const session = await getActiveNotificationUser();
  if (!session) {
    return NextResponse.json({ error: "Sign in to update notifications." }, { status: 401 });
  }
  const parsed = readSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Provide one notification ID or markAllRead." },
      { status: 400 },
    );
  }

  let query = session.admin
    .from("notifications")
    .update({ is_read: true })
    .eq("profile_id", session.user.id)
    .eq("is_read", false);
  const id = parsed.data.id || parsed.data.notificationId;
  if (id) query = query.eq("id", id);
  const { error } = await query;
  if (error) {
    console.error("Could not mark notifications as read:", error.message);
    return NextResponse.json({ error: "Could not update notification status." }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
