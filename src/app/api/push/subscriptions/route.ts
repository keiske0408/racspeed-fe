import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(20).max(256),
    auth: z.string().min(10).max(128),
  }),
  userAgent: z.string().max(500).optional(),
});

async function authenticatedProfile() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, status")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.status !== "ACTIVE") return null;
  return { admin, profileId: user.id };
}

export async function POST(request: NextRequest) {
  const session = await authenticatedProfile();
  if (!session)
    return NextResponse.json(
      { error: "Sign in to enable notifications." },
      { status: 401 },
    );

  const payload = subscriptionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!payload.success)
    return NextResponse.json(
      { error: "Invalid push subscription." },
      { status: 400 },
    );

  const { endpoint, keys, userAgent } = payload.data;
  const { error } = await session.admin.from("push_subscriptions").upsert(
    {
      profile_id: session.profileId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: userAgent || request.headers.get("user-agent"),
      last_used_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );
  if (error)
    return NextResponse.json(
      { error: "Could not save your notification subscription." },
      { status: 500 },
    );

  await session.admin.from("notification_preferences").upsert(
    {
      profile_id: session.profileId,
      push_enabled: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "profile_id" },
  );
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const session = await authenticatedProfile();
  if (!session)
    return NextResponse.json(
      { error: "Sign in to manage notifications." },
      { status: 401 },
    );
  const payload = z
    .object({ endpoint: z.string().url().max(2048) })
    .safeParse(await request.json().catch(() => null));
  if (!payload.success)
    return NextResponse.json(
      { error: "Invalid push endpoint." },
      { status: 400 },
    );

  await session.admin
    .from("push_subscriptions")
    .delete()
    .eq("profile_id", session.profileId)
    .eq("endpoint", payload.data.endpoint);
  return NextResponse.json({ success: true });
}
