"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser, assertPermission } from "@/lib/auth/session";
import { OnboardingStage } from "@/lib/services/workflows/onboarding";

export async function createProspectAction(formData: FormData) {
  const user = await requireUser();
  const rawClubId = (formData.get("clubId") as string) || "00000000-0000-0000-0000-000000000001";
  await assertPermission(rawClubId, "RECRUITMENT_MANAGE");

  const name = (formData.get("name") as string) || "";
  const email = (formData.get("email") as string) || "";
  const phone = (formData.get("phone") as string) || "";
  const notes = (formData.get("notes") as string) || "";

  if (!name.trim()) {
    return { success: false, error: "Prospect name is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("prospects").insert({
    club_id: rawClubId,
    full_name: name,
    email: email || null,
    phone: phone || null,
    stage: "PROSPECT",
    recruiter_id: user.id,
    has_privacy_consent: true,
    notes: notes || null,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/recruitment");
  return { success: true, message: `Prospect ${name} registered in pipeline!` };
}

export async function updateProspectStageAction(
  prospectId: string,
  newStage: OnboardingStage,
  clubId = "00000000-0000-0000-0000-000000000001"
) {
  await requireUser();
  await assertPermission(clubId, "RECRUITMENT_MANAGE");

  const supabase = await createClient();
  const { error } = await supabase
    .from("prospects")
    .update({ stage: newStage })
    .eq("id", prospectId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/recruitment");
  return { success: true, message: `Prospect moved to stage: ${newStage}` };
}

export async function inductProspectToMemberAction(
  prospectId: string,
  clubId = "00000000-0000-0000-0000-000000000001"
) {
  const user = await requireUser();
  await assertPermission(clubId, "MEMBER_APPROVE");

  const adminClient = createAdminClient();

  // 1. Fetch prospect details
  const { data: prospect, error: pErr } = await adminClient
    .from("prospects")
    .select("id, full_name, email, phone")
    .eq("id", prospectId)
    .single();

  if (pErr || !prospect) {
    return { success: false, error: "Prospect record not found." };
  }

  // 2. Advance prospect stage to INDUCTED in CRM
  await adminClient
    .from("prospects")
    .update({ stage: "INDUCTED" })
    .eq("id", prospectId);

  // 3. Find or create user profile
  let profileId: string | null = null;
  if (prospect.email) {
    const { data: existingProfile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("email", prospect.email)
      .maybeSingle();

    if (existingProfile) {
      profileId = existingProfile.id;
    }
  }

  if (!profileId) {
    const { data: newProfile, error: profErr } = await adminClient
      .from("profiles")
      .insert({
        email: prospect.email || `member.${Date.now()}@rotaract.local`,
        full_name: prospect.full_name,
        status: "ACTIVE",
      })
      .select("id")
      .single();

    if (profErr || !newProfile) {
      return { success: false, error: `Could not create member profile: ${profErr?.message}` };
    }
    profileId = newProfile.id;
  } else {
    await adminClient
      .from("profiles")
      .update({ status: "ACTIVE" })
      .eq("id", profileId);
  }

  // 4. Upsert club_memberships as an ACTIVE club member
  await adminClient
    .from("club_memberships")
    .upsert(
      {
        club_id: clubId,
        profile_id: profileId,
        membership_status: "ACTIVE",
        joined_date: new Date().toISOString().split("T")[0],
        classification: "Rotaract General",
      },
      { onConflict: "club_id,profile_id" }
    );

  revalidatePath("/recruitment");
  revalidatePath("/members");
  revalidatePath("/dashboard");

  return {
    success: true,
    message: `Congratulations! ${prospect.full_name} has been officially inducted and their active Member Account is now live in the Members Directory!`,
  };
}
