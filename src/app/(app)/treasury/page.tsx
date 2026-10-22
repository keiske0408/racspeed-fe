import React from "react";
import { getTreasuryData } from "@/features/treasury/queries";
import { TreasuryClient } from "./treasury-client";

export const dynamic = "force-dynamic";

export default async function TreasuryPage() {
  const initialData = await getTreasuryData();

  return <TreasuryClient initialData={initialData} />;
}
