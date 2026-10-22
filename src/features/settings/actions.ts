"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser, assertPermission } from "@/lib/auth/session";

const updateClubSettingsSchema = z.object({
  clubId: z.string().uuid().default("00000000-0000-0000-0000-000000000001"),
  clubName: z.string().min(3, "Club name is required"),
  districtCode: z.string().min(1, "District code is required"),
  sponsorRotaryClub: z.string().min(3, "Sponsor Rotary Club name is required"),
  currentRotaryYear: z.string().min(4, "Rotary Year is required"),
  requireRegistrationApproval: z.boolean().default(true),
  budgetApprovalPolicy: z.enum([
    "PRESIDENT_AND_TREASURER",
    "PRESIDENT_ONLY",
    "TREASURER_ONLY",
    "EITHER",
  ]).default("PRESIDENT_AND_TREASURER"),
  retentionConsecutiveGasThreshold: z.number().int().min(1).max(10).default(3),
  retentionServiceDaysThreshold: z.number().int().min(15).max(365).default(60),
});

export async function updateClubSettingsAction(formData: FormData) {
  const user = await requireUser();
  const clubId = (formData.get("clubId") as string) || "00000000-0000-0000-0000-000000000001";
  await assertPermission(clubId, "SETTINGS_MANAGE");

  const validated = updateClubSettingsSchema.safeParse({
    clubId,
    clubName: formData.get("clubName"),
    districtCode: formData.get("districtCode"),
    sponsorRotaryClub: formData.get("sponsorRotaryClub"),
    currentRotaryYear: formData.get("currentRotaryYear"),
    requireRegistrationApproval: formData.get("requireRegistrationApproval") === "true",
    budgetApprovalPolicy: formData.get("budgetApprovalPolicy"),
    retentionConsecutiveGasThreshold: Number(formData.get("retentionConsecutiveGasThreshold") || 3),
    retentionServiceDaysThreshold: Number(formData.get("retentionServiceDaysThreshold") || 60),
  });

  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message || "Invalid settings input." };
  }

  const {
    clubName,
    districtCode,
    sponsorRotaryClub,
    currentRotaryYear,
    requireRegistrationApproval,
    budgetApprovalPolicy,
    retentionConsecutiveGasThreshold,
    retentionServiceDaysThreshold,
  } = validated.data;

  try {
    const admin = createAdminClient();

    // 1. Update clubs table
    const { error: clubErr } = await admin
      .from("clubs")
      .update({
        name: clubName,
        district_code: districtCode,
        sponsor_rotary_club: sponsorRotaryClub,
        updated_at: new Date().toISOString(),
      })
      .eq("id", clubId);

    if (clubErr) {
      console.warn("Could not update clubs table:", clubErr.message);
    }

    // 2. Update or upsert app_settings table
    const { error: settingsErr } = await admin
      .from("app_settings")
      .upsert({
        club_id: clubId,
        current_rotary_year: currentRotaryYear,
        require_registration_approval: requireRegistrationApproval,
        budget_approval_policy: budgetApprovalPolicy,
        retention_consecutive_gas_threshold: retentionConsecutiveGasThreshold,
        retention_service_days_threshold: retentionServiceDaysThreshold,
        updated_at: new Date().toISOString(),
      }, { onConflict: "club_id" });

    if (settingsErr) {
      return { success: false, error: `Failed to update club settings: ${settingsErr.message}` };
    }

    revalidatePath("/settings");
    revalidatePath("/dashboard");
    revalidatePath("/members");
    revalidatePath("/budgets");
    revalidatePath("/retention-alerts");

    return {
      success: true,
      message: `Club governance settings successfully updated and saved to Supabase!`,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to update settings" };
  }
}
