"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser, assertPermission } from "@/lib/auth/session";

const createMemberSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  roleKey: z.enum([
    "PRESIDENT",
    "VICE_PRESIDENT",
    "SECRETARY",
    "TREASURER",
    "PROJECT_CHAIR",
    "MEMBERSHIP_CHAIR",
    "BOARD_OFFICER",
    "GENERAL_MEMBER",
    "AUDITOR",
  ]).default("GENERAL_MEMBER"),
  classification: z.string().min(2, "Classification is required"),
  rotaryId: z.string().optional(),
  clubId: z.string().uuid().default("00000000-0000-0000-0000-000000000001"),
});

export async function createMemberAction(formData: FormData) {
  const user = await requireUser();
  const rawClubId = (formData.get("clubId") as string) || "00000000-0000-0000-0000-000000000001";
  await assertPermission(rawClubId, "MEMBER_CREATE");

  const validated = createMemberSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    roleKey: formData.get("roleKey"),
    classification: formData.get("classification"),
    rotaryId: formData.get("rotaryId") || undefined,
    clubId: rawClubId,
  });

  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message || "Invalid member data" };
  }

  const { fullName, email, roleKey, classification, rotaryId, clubId } = validated.data;
  const adminClient = createAdminClient();

  // Create or retrieve auth user
  const { data: userData, error: createAuthError } = await adminClient.auth.admin.createUser({
    email,
    password: `Welcome${new Date().getFullYear()}!`,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  let targetUserId = userData?.user?.id;
  if (createAuthError) {
    // If user already exists in auth, find existing ID
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existing = existingUsers.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (existing) {
      targetUserId = existing.id;
    } else {
      return { success: false, error: `Failed to create auth credentials: ${createAuthError.message}` };
    }
  }

  if (!targetUserId) {
    return { success: false, error: "Unable to allocate user account ID." };
  }

  // Create or activate profile
  const { error: profileError } = await adminClient.from("profiles").upsert({
    id: targetUserId,
    email,
    full_name: fullName,
    status: "ACTIVE",
    is_platform_admin: false,
  });

  if (profileError) {
    return { success: false, error: `Failed to create profile: ${profileError.message}` };
  }

  // Create active club membership
  const { data: membership, error: memberError } = await adminClient
    .from("club_memberships")
    .upsert({
      club_id: clubId,
      profile_id: targetUserId,
      membership_status: "ACTIVE",
      classification,
      rotary_id: rotaryId || null,
      joined_date: new Date().toISOString().split("T")[0],
    }, { onConflict: "club_id,profile_id" })
    .select()
    .single();

  if (memberError) {
    return { success: false, error: `Failed to record membership: ${memberError.message}` };
  }

  // Assign designated role
  const { data: roleRecord } = await adminClient.from("roles").select("id").eq("key", roleKey).single();
  if (roleRecord && membership) {
    await adminClient.from("membership_roles").upsert({
      membership_id: membership.id,
      role_id: roleRecord.id,
    }, { onConflict: "membership_id,role_id" });
  }

  revalidatePath("/members");
  revalidatePath("/dashboard");
  return { success: true, message: `Member account created for ${fullName} (${email}).` };
}

export async function approveMemberAction(profileId: string, clubId = "00000000-0000-0000-0000-000000000001") {
  await requireUser();
  await assertPermission(clubId, "MEMBER_APPROVE");

  const adminClient = createAdminClient();

  // Activate profile
  const { error: profileError } = await adminClient
    .from("profiles")
    .update({ status: "ACTIVE" })
    .eq("id", profileId);

  if (profileError) {
    return { success: false, error: profileError.message };
  }

  // Ensure active club membership exists
  await adminClient.from("club_memberships").upsert({
    club_id: clubId,
    profile_id: profileId,
    membership_status: "ACTIVE",
  }, { onConflict: "club_id,profile_id" });

  revalidatePath("/members");
  revalidatePath("/dashboard");
  return { success: true, message: "Member account approved and activated successfully." };
}

export async function rejectMemberAction(profileId: string, clubId = "00000000-0000-0000-0000-000000000001") {
  await requireUser();
  await assertPermission(clubId, "MEMBER_APPROVE");

  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("profiles")
    .update({ status: "REJECTED" })
    .eq("id", profileId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/members");
  revalidatePath("/dashboard");
  return { success: true, message: "Account request declined." };
}
