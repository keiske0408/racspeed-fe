import React from "react";
import { assertPageAccess } from "@/lib/auth/session";
import { getBroadcastSourceItems } from "@/features/broadcasts/queries";
import { BroadcastsClient } from "./broadcasts-client";

export const dynamic = "force-dynamic";

interface BroadcastsPageProps {
  searchParams: Promise<{ eventId?: string }>;
}

export default async function BroadcastsPage({ searchParams }: BroadcastsPageProps) {
  await assertPageAccess("broadcasts");
  const resolvedSearchParams = await searchParams;
  const sources = await getBroadcastSourceItems();

  return (
    <BroadcastsClient
      sources={sources}
      initialSelectedEventId={resolvedSearchParams.eventId}
    />
  );
}
