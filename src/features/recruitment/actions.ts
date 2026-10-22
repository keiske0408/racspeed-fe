"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
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

export async function updateProspectStageAction(prospectId: string, newStage: OnboardingStage, clubId = "00000000-0000-0000-0000-000000000001") {
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
