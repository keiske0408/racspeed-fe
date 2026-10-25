"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser, assertPermission } from "@/lib/auth/session";
import {
  evaluateBudgetApprovals,
  canRecordBudgetDecision,
  BudgetApprovalState,
  BudgetApprovalRecord,
  BudgetStatus,
} from "@/lib/services/workflows/budget";

export async function createBudgetRequestAction(formData: FormData) {
  const user = await requireUser();
  const rawClubId = (formData.get("clubId") as string) || "00000000-0000-0000-0000-000000000001";
  await assertPermission(rawClubId, "BUDGET_REQUEST");

  const title = (formData.get("title") as string) || "";
  const justification = (formData.get("justification") as string) || "";
  const amountPHP = Number(formData.get("amountPHP") || 0);

  if (!title || !justification || amountPHP <= 0) {
    return { success: false, error: "Please enter a valid title, justification, and amount." };
  }

  const adminClient = createAdminClient();

  const { error } = await adminClient.from("budget_requests").insert({
    requester_id: user.id,
    title,
    justification,
    total_requested_amount: amountPHP,
    status: "PENDING_APPROVAL",
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/budgets");
  return { success: true, message: `Budget proposal for ${title} submitted for dual approval.` };
}

export async function approveBudgetByOfficerAction(
  requestId: string,
  role: "PRESIDENT" | "TREASURER",
  comments?: string,
  clubId = "00000000-0000-0000-0000-000000000001"
) {
  const user = await requireUser();
  if (role === "PRESIDENT") {
    await assertPermission(clubId, "BUDGET_APPROVE_PRESIDENT");
  } else {
    await assertPermission(clubId, "BUDGET_APPROVE_TREASURER");
  }

  const adminClient = createAdminClient();

  // 1. Fetch budget request
  const { data: request, error: reqError } = await adminClient
    .from("budget_requests")
    .select("id, requester_id, status")
    .eq("id", requestId)
    .single();

  if (reqError || !request) {
    return { success: false, error: "Budget request not found." };
  }

  // 2. Fetch existing approvals
  const { data: rawApprovals } = await adminClient
    .from("budget_approvals")
    .select("role_at_decision, approver_id, approved, created_at, comments")
    .eq("request_id", requestId);

  const existingApprovals: BudgetApprovalRecord[] = (rawApprovals || []).map((a) => ({
    role: a.role_at_decision as "PRESIDENT" | "TREASURER",
    approverId: a.approver_id,
    approved: a.approved,
    decidedAt: a.created_at,
    comments: a.comments,
  }));

  // 3. Construct approval state and enforce governance state machine
  const approvalState: BudgetApprovalState = {
    currentStatus: (request.status as BudgetStatus) || "PENDING_APPROVAL",
    requesterId: request.requester_id,
    approvals: existingApprovals,
    policy: "PRESIDENT_AND_TREASURER",
    allowSelfApproval: false,
  };

  const eligibility = canRecordBudgetDecision(approvalState, user.id, role);
  if (!eligibility.allowed) {
    return {
      success: false,
      error: eligibility.reason || "You are not eligible to approve this budget proposal.",
    };
  }

  // 4. Record the officer approval
  await adminClient.from("budget_approvals").upsert(
    {
      request_id: requestId,
      approver_id: user.id,
      role_at_decision: role,
      approved: true,
      comments: comments || `${role} signed and approved via platform portal`,
    },
    { onConflict: "request_id,role_at_decision" }
  );

  // 5. Evaluate state transition
  const updatedApprovals: BudgetApprovalRecord[] = [
    ...existingApprovals.filter((a) => a.role !== role),
    { role, approverId: user.id, approved: true, decidedAt: new Date().toISOString() },
  ];

  const evalResult = evaluateBudgetApprovals({
    ...approvalState,
    approvals: updatedApprovals,
  });

  if (evalResult.nextStatus !== request.status) {
    await adminClient
      .from("budget_requests")
      .update({ status: evalResult.nextStatus })
      .eq("id", requestId);
  }

  revalidatePath("/budgets");
  revalidatePath("/dashboard");
  return {
    success: true,
    message: evalResult.isFullyApproved
      ? "Budget proposal fully approved by President and Treasurer!"
      : `${role} approval recorded. Awaiting second officer sign-off.`,
  };
}

export async function rejectBudgetByOfficerAction(
  requestId: string,
  role: "PRESIDENT" | "TREASURER",
  reason: string,
  clubId = "00000000-0000-0000-0000-000000000001"
) {
  const user = await requireUser();
  if (role === "PRESIDENT") {
    await assertPermission(clubId, "BUDGET_APPROVE_PRESIDENT");
  } else {
    await assertPermission(clubId, "BUDGET_APPROVE_TREASURER");
  }

  const adminClient = createAdminClient();

  const { data: request, error: reqError } = await adminClient
    .from("budget_requests")
    .select("id, requester_id, status")
    .eq("id", requestId)
    .single();

  if (reqError || !request) {
    return { success: false, error: "Budget request not found." };
  }

  // Record rejection decision
  await adminClient.from("budget_approvals").upsert(
    {
      request_id: requestId,
      approver_id: user.id,
      role_at_decision: role,
      approved: false,
      comments: reason || `${role} rejected proposal`,
    },
    { onConflict: "request_id,role_at_decision" }
  );

  await adminClient
    .from("budget_requests")
    .update({ status: "REJECTED" })
    .eq("id", requestId);

  revalidatePath("/budgets");
  revalidatePath("/dashboard");
  return {
    success: true,
    message: `Budget proposal rejected by ${role}.`,
  };
}
