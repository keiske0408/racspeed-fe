import React from "react";
import { assertPageAccess } from "@/lib/auth/session";
import { getBudgetsList } from "@/features/budgets/queries";
import { BudgetsClient } from "./budgets-client";

export const dynamic = "force-dynamic";

export default async function BudgetsPage() {
  await assertPageAccess("budgets");
  const initialBudgets = await getBudgetsList();

  return <BudgetsClient initialBudgets={initialBudgets} />;
}
