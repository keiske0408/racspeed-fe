"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser, assertPermission } from "@/lib/auth/session";

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
  clubId = "00000000-0000-0000-0000-000000000001"
) {
  const user = await requireUser();
  if (role === "PRESIDENT") {
    await assertPermission(clubId, "BUDGET_APPROVE_PRESIDENT");
  } else {
    await assertPermission(clubId, "BUDGET_APPROVE_TREASURER");
  }

  const adminClient = createAdminClient();

  // 1. Record the officer approval
  await adminClient.from("budget_approvals").upsert({
    request_id: requestId,
    approver_id: user.id,
    role_at_decision: role,
    approved: true,
    comments: `${role} signed and approved via platform portal`,
  }, { onConflict: "request_id,role_at_decision" });

  // 2. Check if both President and Treasurer have approved
  const { data: approvals } = await adminClient
    .from("budget_approvals")
    .select("role_at_decision, approved")
    .eq("request_id", requestId);

  const hasPres = approvals?.some((a) => a.role_at_decision === "PRESIDENT" && a.approved);
  const hasTreas = approvals?.some((a) => a.role_at_decision === "TREASURER" && a.approved);
  const fullyApproved = hasPres && hasTreas;

  if (fullyApproved) {
    await adminClient
      .from("budget_requests")
      .update({ status: "APPROVED" })
      .eq("id", requestId);
  }

  revalidatePath("/budgets");
  revalidatePath("/dashboard");
  return {
    success: true,
    message: fullyApproved
      ? "Budget proposal fully approved by President and Treasurer!"
      : `${role} approval recorded. Awaiting second officer sign-off.`,
  };
}
