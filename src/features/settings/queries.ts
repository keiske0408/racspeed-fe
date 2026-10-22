import { createAdminClient } from "@/lib/supabase/admin";

export interface ClubSettingsDTO {
  clubId: string;
  clubName: string;
  districtCode: string;
  sponsorRotaryClub: string;
  currentRotaryYear: string;
  requireRegistrationApproval: boolean;
  budgetApprovalPolicy: "PRESIDENT_AND_TREASURER" | "PRESIDENT_ONLY" | "TREASURER_ONLY" | "EITHER";
  retentionConsecutiveGasThreshold: number;
  retentionServiceDaysThreshold: number;
}

export const DEFAULT_CLUB_SETTINGS: ClubSettingsDTO = {
  clubId: "00000000-0000-0000-0000-000000000001",
  clubName: "Rotaract Club of San Pedro East",
  districtCode: "3820",
  sponsorRotaryClub: "Rotary Club of San Pedro East",
  currentRotaryYear: "2026-27",
  requireRegistrationApproval: true,
  budgetApprovalPolicy: "PRESIDENT_AND_TREASURER",
  retentionConsecutiveGasThreshold: 3,
  retentionServiceDaysThreshold: 60,
};

export async function getClubSettings(clubId = "00000000-0000-0000-0000-000000000001"): Promise<ClubSettingsDTO> {
  try {
    const admin = createAdminClient();

    const [clubRes, settingsRes] = await Promise.all([
      admin.from("clubs").select("name, district_code, sponsor_rotary_club").eq("id", clubId).single(),
      admin.from("app_settings").select("*").eq("club_id", clubId).single(),
    ]);

    const club = clubRes.data;
    const settings = settingsRes.data;

    return {
      clubId,
      clubName: club?.name || DEFAULT_CLUB_SETTINGS.clubName,
      districtCode: club?.district_code || DEFAULT_CLUB_SETTINGS.districtCode,
      sponsorRotaryClub: club?.sponsor_rotary_club || DEFAULT_CLUB_SETTINGS.sponsorRotaryClub,
      currentRotaryYear: settings?.current_rotary_year || DEFAULT_CLUB_SETTINGS.currentRotaryYear,
      requireRegistrationApproval: settings?.require_registration_approval ?? DEFAULT_CLUB_SETTINGS.requireRegistrationApproval,
      budgetApprovalPolicy: settings?.budget_approval_policy || DEFAULT_CLUB_SETTINGS.budgetApprovalPolicy,
      retentionConsecutiveGasThreshold: Number(settings?.retention_consecutive_gas_threshold ?? DEFAULT_CLUB_SETTINGS.retentionConsecutiveGasThreshold),
      retentionServiceDaysThreshold: Number(settings?.retention_service_days_threshold ?? DEFAULT_CLUB_SETTINGS.retentionServiceDaysThreshold),
    };
  } catch (err) {
    console.warn("Could not query club settings from Supabase, using defaults:", err);
    return DEFAULT_CLUB_SETTINGS;
  }
}
