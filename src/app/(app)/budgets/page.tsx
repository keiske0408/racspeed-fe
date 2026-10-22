import React from "react";
import { getBudgetsList } from "@/features/budgets/queries";
import { BudgetsClient } from "./budgets-client";

export const dynamic = "force-dynamic";

export default async function BudgetsPage() {
  const initialBudgets = await getBudgetsList();

  return <BudgetsClient initialBudgets={initialBudgets} />;
}
