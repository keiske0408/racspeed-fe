import { describe, it, expect } from "vitest";
import { canTransitionReport } from "@/lib/services/workflows/report";
import { evaluateBudgetApprovals, canRecordBudgetDecision } from "@/lib/services/workflows/budget";
import { canTransitionLiquidation } from "@/lib/services/workflows/liquidation";
import { evaluateInductionReadiness } from "@/lib/services/workflows/onboarding";

describe("Workflow State Machines", () => {
  describe("Project Report Workflow", () => {
    it("allows author to submit DRAFT", () => {
      const res = canTransitionReport({
        currentStatus: "DRAFT",
        targetStatus: "SUBMITTED",
        hasApprovePermission: false,
        isProjectChairOrAuthor: true,
      });
      expect(res.allowed).toBe(true);
    });

    it("rejects non-author without permission from submitting DRAFT", () => {
      const res = canTransitionReport({
        currentStatus: "DRAFT",
        targetStatus: "SUBMITTED",
        hasApprovePermission: false,
        isProjectChairOrAuthor: false,
      });
      expect(res.allowed).toBe(false);
    });

    it("requires review notes when requesting revisions", () => {
      const resWithoutNotes = canTransitionReport({
        currentStatus: "UNDER_REVIEW",
        targetStatus: "REVISION_REQUESTED",
        hasApprovePermission: true,
        isProjectChairOrAuthor: false,
        notes: "",
      });
      expect(resWithoutNotes.allowed).toBe(false);

      const resWithNotes = canTransitionReport({
        currentStatus: "UNDER_REVIEW",
        targetStatus: "REVISION_REQUESTED",
        hasApprovePermission: true,
        isProjectChairOrAuthor: false,
        notes: "Please add attendance headcount breakdown.",
      });
      expect(resWithNotes.allowed).toBe(true);
    });
  });

  describe("Budget Request Approval Policy", () => {
    it("requires both President and Treasurer when policy is PRESIDENT_AND_TREASURER", () => {
      const partial = evaluateBudgetApprovals({
        currentStatus: "PENDING_APPROVAL",
        requesterId: "user_chair",
        approvals: [
          { role: "PRESIDENT", approverId: "user_pres", approved: true, decidedAt: new Date().toISOString() },
        ],
        policy: "PRESIDENT_AND_TREASURER",
      });
      expect(partial.isFullyApproved).toBe(false);
      expect(partial.nextStatus).toBe("PENDING_APPROVAL");
      expect(partial.missingApprovals).toEqual(["TREASURER"]);

      const full = evaluateBudgetApprovals({
        currentStatus: "PENDING_APPROVAL",
        requesterId: "user_chair",
        approvals: [
          { role: "PRESIDENT", approverId: "user_pres", approved: true, decidedAt: new Date().toISOString() },
          { role: "TREASURER", approverId: "user_treas", approved: true, decidedAt: new Date().toISOString() },
        ],
        policy: "PRESIDENT_AND_TREASURER",
      });
      expect(full.isFullyApproved).toBe(true);
      expect(full.nextStatus).toBe("APPROVED");
      expect(full.missingApprovals).toEqual([]);
    });

    it("prevents self-approval by requester when allowSelfApproval is false", () => {
      const decision = canRecordBudgetDecision(
        {
          currentStatus: "PENDING_APPROVAL",
          requesterId: "user_officer",
          approvals: [],
          policy: "PRESIDENT_ONLY",
          allowSelfApproval: false,
        },
        "user_officer", // officer approving is also the requester!
        "PRESIDENT",
      );
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain("Self-approval");
    });
  });

  describe("Liquidation Workflow", () => {
    it("allows submitter to submit DRAFT liquidation", () => {
      const res = canTransitionLiquidation({
        currentStatus: "DRAFT",
        targetStatus: "SUBMITTED",
        isSubmitter: true,
        hasVerifyPermission: false,
      });
      expect(res.allowed).toBe(true);
    });

    it("requires verify permission to approve liquidation", () => {
      const unauth = canTransitionLiquidation({
        currentStatus: "SUBMITTED",
        targetStatus: "APPROVED",
        isSubmitter: true,
        hasVerifyPermission: false,
      });
      expect(unauth.allowed).toBe(false);

      const auth = canTransitionLiquidation({
        currentStatus: "SUBMITTED",
        targetStatus: "APPROVED",
        isSubmitter: false,
        hasVerifyPermission: true,
      });
      expect(auth.allowed).toBe(true);
    });
  });

  describe("Recruitment & Induction Readiness", () => {
    it("flags missing requirements accurately", () => {
      const incomplete = evaluateInductionReadiness({
        hasOrientation: true,
        hasFirstServiceProject: false,
        hasGeneralAssembly: true,
        hasContactInfo: true,
        hasConsent: true,
      });
      expect(incomplete.isReady).toBe(false);
      expect(incomplete.missingRequirements).toContain("Participation in at least one service project required");

      const complete = evaluateInductionReadiness({
        hasOrientation: true,
        hasFirstServiceProject: true,
        hasGeneralAssembly: true,
        hasContactInfo: true,
        hasConsent: true,
      });
      expect(complete.isReady).toBe(true);
      expect(complete.missingRequirements).toHaveLength(0);
    });
  });
});
