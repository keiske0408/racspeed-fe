import { createAdminClient } from "@/lib/supabase/admin";

export interface BudgetRequestDTO {
  id: string;
  projectTitle: string;
  requesterName: string;
  justification: string;
  amount: number;
  presidentApproved: boolean;
  treasurerApproved: boolean;
  status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
}

export async function getBudgetsList(): Promise<BudgetRequestDTO[]> {
  try {
    const adminClient = createAdminClient();

    const { data: rawBudgets, error } = await adminClient
      .from("budget_requests")
      .select(`
        id,
        title,
        justification,
        total_requested_amount,
        status,
        profiles!budget_requests_requester_id_fkey (
          full_name,
          email
        ),
        budget_approvals (
          role_at_decision,
          approved
        )
      `)
      .order("created_at", { ascending: false });

    if (error || !rawBudgets) {
      console.warn("Could not query budgets from Supabase:", error?.message);
      return [];
    }

    return rawBudgets.map((b) => {
      const p = b.profiles as any;
      const approvals = (b.budget_approvals as any[]) || [];
      const presApp = approvals.some((a) => a.role_at_decision === "PRESIDENT" && a.approved);
      const treasApp = approvals.some((a) => a.role_at_decision === "TREASURER" && a.approved);

      let status: BudgetRequestDTO["status"] = "PENDING_APPROVAL";
      if (b.status === "APPROVED" || (presApp && treasApp)) {
        status = "APPROVED";
      } else if (b.status === "REJECTED") {
        status = "REJECTED";
      }

      return {
        id: b.id,
        projectTitle: b.title,
        requesterName: p?.full_name || p?.email || "Club Officer",
        justification: b.justification,
        amount: Number(b.total_requested_amount || 0),
        presidentApproved: presApp,
        treasurerApproved: treasApp,
        status,
      };
    });
  } catch (err) {
    console.error("Error in getBudgetsList:", err);
    return [];
  }
}
