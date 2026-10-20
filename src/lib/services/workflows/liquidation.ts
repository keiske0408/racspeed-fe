export const LIQUIDATION_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REVISION_REQUESTED",
  "REJECTED",
] as const;

export type LiquidationStatus = (typeof LIQUIDATION_STATUSES)[number];

export interface LiquidationTransitionContext {
  currentStatus: LiquidationStatus;
  targetStatus: LiquidationStatus;
  isSubmitter: boolean;
  hasVerifyPermission: boolean;
  notes?: string;
}

export function canTransitionLiquidation(ctx: LiquidationTransitionContext): { allowed: boolean; reason?: string } {
  const { currentStatus, targetStatus, isSubmitter, hasVerifyPermission, notes } = ctx;

  if (currentStatus === targetStatus) {
    return { allowed: false, reason: "Liquidation is already in this status." };
  }

  switch (currentStatus) {
    case "DRAFT":
      if (targetStatus === "SUBMITTED") {
        if (!isSubmitter && !hasVerifyPermission) {
          return { allowed: false, reason: "Only the submitter or an authorized officer can submit a liquidation." };
        }
        return { allowed: true };
      }
      return { allowed: false, reason: "Draft liquidations can only be transitioned to SUBMITTED." };

    case "SUBMITTED":
      if (targetStatus === "UNDER_REVIEW" || targetStatus === "APPROVED" || targetStatus === "REJECTED") {
        if (!hasVerifyPermission) {
          return { allowed: false, reason: "Only authorized treasury officers can review or decide on liquidations." };
        }
        return { allowed: true };
      }
      if (targetStatus === "REVISION_REQUESTED") {
        if (!hasVerifyPermission) {
          return { allowed: false, reason: "Only authorized treasury officers can request revisions." };
        }
        if (!notes || notes.trim().length === 0) {
          return { allowed: false, reason: "Notes are required when requesting revisions." };
        }
        return { allowed: true };
      }
      return { allowed: false, reason: "Invalid target status from SUBMITTED." };

    case "UNDER_REVIEW":
      if (targetStatus === "APPROVED" || targetStatus === "REJECTED") {
        if (!hasVerifyPermission) {
          return { allowed: false, reason: "Only authorized treasury officers can approve or reject liquidations." };
        }
        return { allowed: true };
      }
      if (targetStatus === "REVISION_REQUESTED") {
        if (!hasVerifyPermission) {
          return { allowed: false, reason: "Only authorized treasury officers can request revisions." };
        }
        if (!notes || notes.trim().length === 0) {
          return { allowed: false, reason: "Notes are required when requesting revisions." };
        }
        return { allowed: true };
      }
      return { allowed: false, reason: "Under-review liquidations can only be APPROVED, REVISION_REQUESTED, or REJECTED." };

    case "REVISION_REQUESTED":
      if (targetStatus === "SUBMITTED") {
        if (!isSubmitter && !hasVerifyPermission) {
          return { allowed: false, reason: "Only the submitter or authorized officer can re-submit after revisions." };
        }
        return { allowed: true };
      }
      return { allowed: false, reason: "Must re-submit liquidation before another review." };

    case "APPROVED":
    case "REJECTED":
      return { allowed: false, reason: `Terminal status '${currentStatus}' cannot be altered without judicial override.` };

    default:
      return { allowed: false, reason: "Unknown status." };
  }
}
