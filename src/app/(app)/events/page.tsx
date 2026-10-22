import React from "react";
import { getEventsList } from "@/features/events/queries";
import { EventsClient } from "./events-client";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const initialEvents = await getEventsList();

  return <EventsClient initialEvents={initialEvents} />;
}
