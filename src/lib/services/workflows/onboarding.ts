export const ONBOARDING_STAGES = [
  "PROSPECT",
  "ATTENDED_ORIENTATION",
  "ATTENDED_FIRST_SERVICE_PROJECT",
  "ATTENDED_GENERAL_ASSEMBLY",
  "READY_FOR_INDUCTION",
  "INDUCTED",
  "DECLINED",
  "INACTIVE",
] as const;

export type OnboardingStage = (typeof ONBOARDING_STAGES)[number];

export const ONBOARDING_STAGE_LABELS: Record<OnboardingStage, string> = {
  PROSPECT: "Prospect",
  ATTENDED_ORIENTATION: "Attended Orientation",
  ATTENDED_FIRST_SERVICE_PROJECT: "1st Service Project",
  ATTENDED_GENERAL_ASSEMBLY: "General Assembly",
  READY_FOR_INDUCTION: "Ready for Induction",
  INDUCTED: "Inducted Member",
  DECLINED: "Declined",
  INACTIVE: "Inactive",
};

export interface ReadinessCheck {
  hasOrientation: boolean;
  hasFirstServiceProject: boolean;
  hasGeneralAssembly: boolean;
  hasContactInfo: boolean;
  hasConsent: boolean;
}

export function evaluateInductionReadiness(checks: ReadinessCheck): {
  isReady: boolean;
  missingRequirements: string[];
} {
  const missing: string[] = [];
  if (!checks.hasOrientation) missing.push("Orientation attendance required");
  if (!checks.hasFirstServiceProject) missing.push("Participation in at least one service project required");
  if (!checks.hasGeneralAssembly) missing.push("Attendance in at least one General Assembly required");
  if (!checks.hasContactInfo) missing.push("Valid contact information required");
  if (!checks.hasConsent) missing.push("Data privacy consent required");

  return {
    isReady: missing.length === 0,
    missingRequirements: missing,
  };
}
