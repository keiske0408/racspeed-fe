"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser, assertPermission } from "@/lib/auth/session";
import { toCentavos } from "@/lib/utils/money";

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

  const supabase = await createClient();
  const centavos = toCentavos(amountPHP);

  const { error } = await supabase.from("budget_requests").insert({
    club_id: rawClubId,
    requester_id: user.id,
    title,
    justification,
    total_requested_centavos: centavos,
    president_approved: false,
    treasurer_approved: false,
    status: "PENDING_APPROVAL",
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/budgets");
  return { success: true, message: `Budget proposal for ${title} submitted for dual approval.` };
}

export async function approveBudgetByOfficerAction(requestId: string, role: "PRESIDENT" | "TREASURER", clubId = "00000000-0000-0000-0000-000000000001") {
  const user = await requireUser();
  if (role === "PRESIDENT") {
    await assertPermission(clubId, "BUDGET_APPROVE_PRESIDENT");
  } else {
    await assertPermission(clubId, "BUDGET_APPROVE_TREASURER");
  }

  const adminClient = createAdminClient();

  // Fetch current approval status
  const { data: request, error: fetchError } = await adminClient
    .from("budget_requests")
    .select("president_approved, treasurer_approved")
    .eq("id", requestId)
    .single();

  if (fetchError || !request) {
    return { success: false, error: "Budget request not found." };
  }

  const newPresident = role === "PRESIDENT" ? true : request.president_approved;
  const newTreasurer = role === "TREASURER" ? true : request.treasurer_approved;
  const fullyApproved = newPresident && newTreasurer;

  const { error: updateError } = await adminClient
    .from("budget_requests")
    .update({
      president_approved: newPresident,
      treasurer_approved: newTreasurer,
      status: fullyApproved ? "APPROVED" : "PENDING_APPROVAL",
    })
    .eq("id", requestId);

  if (updateError) {
    return { success: false, error: updateError.message };
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
