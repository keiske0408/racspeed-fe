import React from "react";
import { assertPageAccess } from "@/lib/auth/session";
import { getEventsList, getUserCheckedInEventIds } from "@/features/events/queries";
import { EventsClient } from "./events-client";

export const dynamic = "force-dynamic";

interface EventsPageProps {
  searchParams?: Promise<{
    token?: string;
    sessionToken?: string;
    checkInToken?: string;
    action?: string;
  }>;
}

export default async function EventsPage({ searchParams }: EventsPageProps) {
  const context = await assertPageAccess("events");
  const initialEvents = await getEventsList();
  const initialCheckedInEventIds = await getUserCheckedInEventIds(context.user.id);
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const initialToken =
    resolvedSearchParams.token ||
    resolvedSearchParams.sessionToken ||
    resolvedSearchParams.checkInToken;

  const canCreate = context.isPlatformAdmin || context.permissions.has("EVENT_CREATE");
  const canManageAttendance =
    context.isPlatformAdmin || context.permissions.has("ATTENDANCE_MANAGE");

  return (
    <EventsClient
      initialEvents={initialEvents}
      initialToken={initialToken}
      initialCheckedInEventIds={initialCheckedInEventIds}
      currentUserId={context.user.id}
      canCreate={canCreate}
      canManageAttendance={canManageAttendance}
      initialAction={resolvedSearchParams.action}
    />
  );
}

