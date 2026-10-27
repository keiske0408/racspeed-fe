import React from "react";
import { assertPageAccess } from "@/lib/auth/session";
import { getTreasuryData } from "@/features/treasury/queries";
import { TreasuryClient } from "./treasury-client";

export const dynamic = "force-dynamic";

export default async function TreasuryPage() {
  await assertPageAccess("treasury");
  const initialData = await getTreasuryData();

  return <TreasuryClient initialData={initialData} />;
}
