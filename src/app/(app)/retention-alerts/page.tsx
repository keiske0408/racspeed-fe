import React from "react";
import { getClubMembersList } from "@/features/members/queries";
import { RetentionClient } from "./retention-client";

export const dynamic = "force-dynamic";

export default async function RetentionAlertsPage() {
  const members = await getClubMembersList();

  return <RetentionClient members={members} />;
}
