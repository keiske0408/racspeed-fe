export const BUDGET_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "DISBURSED",
] as const;

export type BudgetStatus = (typeof BUDGET_STATUSES)[number];

export type ApprovalPolicy = "PRESIDENT_AND_TREASURER" | "PRESIDENT_ONLY" | "TREASURER_ONLY" | "EITHER";

export interface BudgetApprovalRecord {
  role: "PRESIDENT" | "TREASURER";
  approverId: string;
  approved: boolean;
  decidedAt: string;
  comments?: string;
}

export interface BudgetApprovalState {
  currentStatus: BudgetStatus;
  requesterId: string;
  approvals: BudgetApprovalRecord[];
  policy: ApprovalPolicy;
  allowSelfApproval?: boolean;
}

export interface EvaluateBudgetResult {
  nextStatus: BudgetStatus;
  isFullyApproved: boolean;
  isRejected: boolean;
  missingApprovals: ("PRESIDENT" | "TREASURER")[];
}

/**
 * Pure function to evaluate if a budget request meets the club's approval policy.
 */
export function evaluateBudgetApprovals(state: BudgetApprovalState): EvaluateBudgetResult {
  const { approvals, policy } = state;

  // Any rejection results in REJECTED status
  const hasRejection = approvals.some((a) => !a.approved);
  if (hasRejection) {
    return {
      nextStatus: "REJECTED",
      isFullyApproved: false,
      isRejected: true,
      missingApprovals: [],
    };
  }

  const presidentApproved = approvals.some((a) => a.role === "PRESIDENT" && a.approved);
  const treasurerApproved = approvals.some((a) => a.role === "TREASURER" && a.approved);

  const missing: ("PRESIDENT" | "TREASURER")[] = [];

  switch (policy) {
    case "PRESIDENT_AND_TREASURER":
      if (!presidentApproved) missing.push("PRESIDENT");
      if (!treasurerApproved) missing.push("TREASURER");
      break;
    case "PRESIDENT_ONLY":
      if (!presidentApproved) missing.push("PRESIDENT");
      break;
    case "TREASURER_ONLY":
      if (!treasurerApproved) missing.push("TREASURER");
      break;
    case "EITHER":
      if (!presidentApproved && !treasurerApproved) {
        missing.push("PRESIDENT", "TREASURER");
      }
      break;
  }

  const isFullyApproved = missing.length === 0;

  return {
    nextStatus: isFullyApproved ? "APPROVED" : "PENDING_APPROVAL",
    isFullyApproved,
    isRejected: false,
    missingApprovals: missing,
  };
}

/**
 * Validates whether an officer is eligible to submit an approval/rejection decision.
 */
export function canRecordBudgetDecision(
  state: BudgetApprovalState,
  officerId: string,
  role: "PRESIDENT" | "TREASURER",
): { allowed: boolean; reason?: string } {
  if (state.currentStatus !== "PENDING_APPROVAL" && state.currentStatus !== "SUBMITTED") {
    return { allowed: false, reason: `Cannot approve or reject a budget in '${state.currentStatus}' status.` };
  }

  if (state.requesterId === officerId && !state.allowSelfApproval) {
    return { allowed: false, reason: "Self-approval is forbidden by club financial policies." };
  }

  const existing = state.approvals.find((a) => a.role === role);
  if (existing) {
    return { allowed: false, reason: `An approval decision for ${role} has already been recorded.` };
  }

  return { allowed: true };
}
