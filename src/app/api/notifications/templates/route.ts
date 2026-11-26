import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getNotificationAdmin } from "@/lib/services/notifications/auth";
import {
  NOTIFICATION_TYPES,
  validateNotificationTemplate,
} from "@/lib/services/notifications/templates";

const clubIdSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const templateSchema = z.object({
  clubId: clubIdSchema,
  type: z.enum(NOTIFICATION_TYPES),
  titleTemplate: z.string().trim().min(1).max(120),
  messageTemplate: z.string().trim().min(1).max(2000),
});
const resetSchema = z.object({
  clubId: clubIdSchema,
  type: z.enum(NOTIFICATION_TYPES),
});

export async function GET(request: NextRequest) {
  const parsed = clubIdSchema.safeParse(request.nextUrl.searchParams.get("clubId"));
  if (!parsed.success) return NextResponse.json({ error: "Invalid club." }, { status: 400 });
  const session = await getNotificationAdmin(parsed.data);
  if (!session) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

  const { data: templates, error } = await session.admin
    .from("notification_templates")
    .select("type, title_template, message_template, updated_at")
    .eq("club_id", parsed.data)
    .order("type");
  if (error) {
    console.error("Could not load notification templates:", error.message);
    return NextResponse.json({ error: "Could not load notification templates." }, { status: 500 });
  }
  return NextResponse.json({ templates: templates || [] });
}

export async function PUT(request: NextRequest) {
  const parsed = templateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid notification template." }, { status: 400 });
  const session = await getNotificationAdmin(parsed.data.clubId);
  if (!session) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

  const template = {
    titleTemplate: parsed.data.titleTemplate,
    messageTemplate: parsed.data.messageTemplate,
  };
  const validationError = validateNotificationTemplate(template);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  const { error } = await session.admin.from("notification_templates").upsert(
    {
      club_id: parsed.data.clubId,
      type: parsed.data.type,
      title_template: template.titleTemplate,
      message_template: template.messageTemplate,
      updated_by: session.user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "club_id,type" },
  );
  if (error) {
    console.error("Could not save notification template:", error.message);
    return NextResponse.json({ error: "Could not save notification template." }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const parsed = resetSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid notification template." }, { status: 400 });
  const session = await getNotificationAdmin(parsed.data.clubId);
  if (!session) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

  const { error } = await session.admin
    .from("notification_templates")
    .delete()
    .eq("club_id", parsed.data.clubId)
    .eq("type", parsed.data.type);
  if (error) {
    console.error("Could not reset notification template:", error.message);
    return NextResponse.json({ error: "Could not reset notification template." }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
