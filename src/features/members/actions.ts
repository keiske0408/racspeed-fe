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

  // Sync with Recruitment CRM: automatically advance matching prospect to INDUCTED
  const { data: prof } = await adminClient.from("profiles").select("email").eq("id", profileId).single();
  if (prof?.email) {
    await adminClient.from("prospects").update({ stage: "INDUCTED" }).eq("email", prof.email);
  }

  revalidatePath("/members");
  revalidatePath("/recruitment");
  revalidatePath("/dashboard");
  return { success: true, message: "Member account approved, activated, and linked to Recruitment CRM!" };
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

export async function updateMemberRoleAction(formData: FormData) {
  const user = await requireUser();
  const rawClubId = (formData.get("clubId") as string) || "00000000-0000-0000-0000-000000000001";
  await assertPermission(rawClubId, "ROLE_ASSIGN");

  const memberId = formData.get("memberId") as string;
  const roleKey = formData.get("roleKey") as string;
  const rawStatus = (formData.get("status") as string) || "ACTIVE";
  const fullName = formData.get("fullName") as string;
  const classification = formData.get("classification") as string;
  const rotaryId = formData.get("rotaryId") as string;
  const isPlatformAdminParam = formData.get("isPlatformAdmin");

  if (!memberId || !roleKey) {
    return { success: false, error: "Member ID and Role are required." };
  }

  // Map to DB constraints
  // club_memberships allows: 'ACTIVE', 'SUSPENDED', 'RESIGNED', 'ALUMNI', 'HONORARY', 'PROSPECTIVE'
  let membershipStatus = "ACTIVE";
  if (rawStatus === "PENDING" || rawStatus === "PROSPECTIVE" || rawStatus === "PROBATIONARY") {
    membershipStatus = "PROSPECTIVE";
  } else if (rawStatus === "INACTIVE" || rawStatus === "SUSPENDED") {
    membershipStatus = "SUSPENDED";
  } else if (rawStatus === "ALUMNI") {
    membershipStatus = "ALUMNI";
  }

  // profiles allows: 'PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED'
  let profileStatus = "ACTIVE";
  if (rawStatus === "PENDING") {
    profileStatus = "PENDING";
  } else if (rawStatus === "INACTIVE" || rawStatus === "SUSPENDED") {
    profileStatus = "SUSPENDED";
  }

  const adminClient = createAdminClient();

  // 1. Update Profile
  const profileUpdates: Record<string, any> = {
    status: profileStatus,
  };
  if (fullName && fullName.trim()) {
    profileUpdates.full_name = fullName.trim();
  }
  // Only super admins can grant/revoke platform admin rights
  if (user.isPlatformAdmin && isPlatformAdminParam !== null) {
    profileUpdates.is_platform_admin = isPlatformAdminParam === "true";
  }

  await adminClient.from("profiles").update(profileUpdates).eq("id", memberId);

  // 2. Find or create membership
  let { data: membership } = await adminClient
    .from("club_memberships")
    .select("id")
    .eq("club_id", rawClubId)
    .eq("profile_id", memberId)
    .maybeSingle();

  if (!membership) {
    const { data: newMem } = await adminClient
      .from("club_memberships")
      .upsert({
        club_id: rawClubId,
        profile_id: memberId,
        membership_status: membershipStatus as any,
        classification: classification || "Rotaract General",
        rotary_id: rotaryId || null,
      }, { onConflict: "club_id,profile_id" })
      .select("id")
      .single();
    membership = newMem;
  } else {
    const memUpdates: Record<string, any> = {
      membership_status: membershipStatus,
    };
    if (classification) memUpdates.classification = classification;
    if (rotaryId !== undefined) memUpdates.rotary_id = rotaryId || null;

    await adminClient
      .from("club_memberships")
      .update(memUpdates)
      .eq("id", membership.id);
  }

  // 3. Assign role
  if (membership) {
    const { data: roleRecord } = await adminClient
      .from("roles")
      .select("id")
      .eq("key", roleKey)
      .maybeSingle();

    if (roleRecord) {
      await adminClient
        .from("membership_roles")
        .delete()
        .eq("membership_id", membership.id);

      await adminClient
        .from("membership_roles")
        .insert({
          membership_id: membership.id,
          role_id: roleRecord.id,
        });
    }
  }

  revalidatePath("/members");
  revalidatePath("/dashboard");
  return {
    success: true,
    message: `Member ${fullName || "record"} updated: Role set to ${roleKey.replace(/_/g, " ")} (${membershipStatus}).`,
  };
}
