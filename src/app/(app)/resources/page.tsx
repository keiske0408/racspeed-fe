import React from "react";
import { getClubResourcesList } from "@/features/resources/queries";
import { ResourcesClient } from "./resources-client";

export const dynamic = "force-dynamic";

export default async function ResourcesPage() {
  const initialResources = await getClubResourcesList();

  return <ResourcesClient initialResources={initialResources} />;
}
