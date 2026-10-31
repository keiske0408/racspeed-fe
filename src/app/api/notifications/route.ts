import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function getProfileId() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("status")
    .eq("id", user.id)
    .maybeSingle();
  return profile?.status === "ACTIVE" ? { admin, profileId: user.id } : null;
}

export async function GET() {
  const session = await getProfileId();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await session.admin
    .from("notifications")
    .select("id, title, message, type, link_url, is_read, created_at")
    .eq("profile_id", session.profileId)
    .order("created_at", { ascending: false })
    .limit(25);
  if (error)
    return NextResponse.json(
      { error: "Could not load notifications." },
      { status: 500 },
    );
  return NextResponse.json({ notifications: data || [] });
}

export async function PATCH(request: NextRequest) {
  const session = await getProfileId();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = z
    .object({ notificationId: z.string().uuid() })
    .safeParse(await request.json().catch(() => null));
  if (!payload.success)
    return NextResponse.json(
      { error: "Invalid notification." },
      { status: 400 },
    );
  const { error } = await session.admin
    .from("notifications")
    .update({ is_read: true })
    .eq("id", payload.data.notificationId)
    .eq("profile_id", session.profileId);
  if (error)
    return NextResponse.json(
      { error: "Could not mark notification as read." },
      { status: 500 },
    );
  return NextResponse.json({ success: true });
}
