import React from "react";
import { assertPageAccess } from "@/lib/auth/session";
import { getClubMembersList } from "@/features/members/queries";
import { RetentionClient } from "./retention-client";

export const dynamic = "force-dynamic";

export default async function RetentionAlertsPage() {
  await assertPageAccess("retention");
  const members = await getClubMembersList();

  return <RetentionClient members={members} />;
}
