import React from "react";
import { getSisterClubsList } from "@/features/partnerships/queries";
import { PartnershipsClient } from "./partnerships-client";

export const dynamic = "force-dynamic";

export default async function PartnershipsPage() {
  const sisterClubs = await getSisterClubsList();

  return <PartnershipsClient initialSisterClubs={sisterClubs} />;
}
