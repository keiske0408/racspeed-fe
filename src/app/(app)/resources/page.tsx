import React from "react";
import { assertPageAccess } from "@/lib/auth/session";
import { getClubResourcesList } from "@/features/resources/queries";
import { ResourcesClient } from "./resources-client";

export const dynamic = "force-dynamic";

export default async function ResourcesPage() {
  await assertPageAccess("resources");
  const initialResources = await getClubResourcesList();

  return <ResourcesClient initialResources={initialResources} />;
}
