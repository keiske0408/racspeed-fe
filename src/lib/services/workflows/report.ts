export const REPORT_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "REVISION_REQUESTED",
  "APPROVED",
] as const;

export type ReportStatus = (typeof REPORT_STATUSES)[number];

export interface ReportTransitionContext {
  currentStatus: ReportStatus;
  targetStatus: ReportStatus;
  userRole?: string;
  hasApprovePermission: boolean;
  isProjectChairOrAuthor: boolean;
  notes?: string;
}

export interface TransitionResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Validates state transitions for Project Accomplishment Reports.
 * Workflow:
 * DRAFT -> SUBMITTED (by Project Chair/Author or Board Officer)
 * SUBMITTED -> UNDER_REVIEW (by Reviewer/Secretary/President)
 * SUBMITTED -> APPROVED (direct approval by authorized officer)
 * UNDER_REVIEW -> REVISION_REQUESTED (with review notes)
 * UNDER_REVIEW -> APPROVED (by authorized officer)
 * REVISION_REQUESTED -> SUBMITTED (after fixes by author)
 */
export function canTransitionReport(ctx: ReportTransitionContext): TransitionResult {
  const { currentStatus, targetStatus, hasApprovePermission, isProjectChairOrAuthor, notes } = ctx;

  if (currentStatus === targetStatus) {
    return { allowed: false, reason: "Report is already in the requested status." };
  }

  switch (currentStatus) {
    case "DRAFT":
      if (targetStatus === "SUBMITTED") {
        if (!isProjectChairOrAuthor && !hasApprovePermission) {
          return { allowed: false, reason: "Only the project chair, author, or authorized officer can submit a report." };
        }
        return { allowed: true };
      }
      return { allowed: false, reason: "Draft reports can only be transitioned to SUBMITTED." };

    case "SUBMITTED":
      if (targetStatus === "UNDER_REVIEW") {
        if (!hasApprovePermission) {
          return { allowed: false, reason: "Only authorized reviewers can mark a report as under review." };
        }
        return { allowed: true };
      }
      if (targetStatus === "APPROVED") {
        if (!hasApprovePermission) {
          return { allowed: false, reason: "Only authorized reviewers can approve a report." };
        }
        return { allowed: true };
      }
      if (targetStatus === "REVISION_REQUESTED") {
        if (!hasApprovePermission) {
          return { allowed: false, reason: "Only authorized reviewers can request revisions." };
        }
        if (!notes || notes.trim().length === 0) {
          return { allowed: false, reason: "Notes are required when requesting revisions." };
        }
        return { allowed: true };
      }
      return { allowed: false, reason: "Invalid target status from SUBMITTED." };

    case "UNDER_REVIEW":
      if (targetStatus === "APPROVED") {
        if (!hasApprovePermission) {
          return { allowed: false, reason: "Only authorized reviewers can approve a report." };
        }
        return { allowed: true };
      }
      if (targetStatus === "REVISION_REQUESTED") {
        if (!hasApprovePermission) {
          return { allowed: false, reason: "Only authorized reviewers can request revisions." };
        }
        if (!notes || notes.trim().length === 0) {
          return { allowed: false, reason: "Notes are required when requesting revisions." };
        }
        return { allowed: true };
      }
      return { allowed: false, reason: "Under-review reports can only be APPROVED or sent for REVISION_REQUESTED." };

    case "REVISION_REQUESTED":
      if (targetStatus === "SUBMITTED") {
        if (!isProjectChairOrAuthor && !hasApprovePermission) {
          return { allowed: false, reason: "Only the project chair or author can re-submit after revision." };
        }
        return { allowed: true };
      }
      return { allowed: false, reason: "A report with requested revisions must be re-SUBMITTED first." };

    case "APPROVED":
      return { allowed: false, reason: "Approved reports cannot change status without administrative unapproval." };

    default:
      return { allowed: false, reason: "Unknown report status." };
  }
}
