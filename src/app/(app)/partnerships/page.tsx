import React from "react";
import { assertPageAccess } from "@/lib/auth/session";
import { getSisterClubsList } from "@/features/partnerships/queries";
import { PartnershipsClient } from "./partnerships-client";

export const dynamic = "force-dynamic";

export default async function PartnershipsPage() {
  await assertPageAccess("partnerships");
  const sisterClubs = await getSisterClubsList();

  return <PartnershipsClient initialSisterClubs={sisterClubs} />;
}
