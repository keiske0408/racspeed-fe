import React from "react";
import { assertPageAccess } from "@/lib/auth/session";
import { getEventsList } from "@/features/events/queries";
import { EventsClient } from "./events-client";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  await assertPageAccess("events");
  const initialEvents = await getEventsList();

  return <EventsClient initialEvents={initialEvents} />;
}
