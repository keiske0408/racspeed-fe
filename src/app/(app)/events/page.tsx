import React from "react";
import { assertPageAccess } from "@/lib/auth/session";
import { getEventsList } from "@/features/events/queries";
import { EventsClient } from "./events-client";

export const dynamic = "force-dynamic";

interface EventsPageProps {
  searchParams?: Promise<{ token?: string; sessionToken?: string; checkInToken?: string }>;
}

export default async function EventsPage({ searchParams }: EventsPageProps) {
  await assertPageAccess("events");
  const initialEvents = await getEventsList();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const initialToken =
    resolvedSearchParams.token ||
    resolvedSearchParams.sessionToken ||
    resolvedSearchParams.checkInToken;

  return <EventsClient initialEvents={initialEvents} initialToken={initialToken} />;
}

