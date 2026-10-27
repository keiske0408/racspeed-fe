import React from "react";
import { assertPageAccess } from "@/lib/auth/session";
import { getEventsList } from "@/features/events/queries";
import { getGroupTasksList } from "@/features/tasks/queries";
import { CalendarClient } from "./calendar-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Master Operations & Activity Calendar — Racspeed",
  description:
    "Unified operational calendar monitoring Rotaract Club of San Pedro East events, service projects, and committee task milestones.",
};

export default async function CalendarPage() {
  const context = await assertPageAccess("calendar");

  const [events, tasks] = await Promise.all([
    getEventsList(),
    getGroupTasksList(),
  ]);

  const canCreateEvent =
    context.isPlatformAdmin || context.permissions.has("EVENT_CREATE");
  const canCreateTask =
    context.isPlatformAdmin ||
    context.permissions.has("ROLE_ASSIGN") ||
    context.permissions.has("SETTINGS_MANAGE");

  return (
    <CalendarClient
      initialEvents={events}
      initialTasks={tasks}
      canCreateEvent={canCreateEvent}
      canCreateTask={canCreateTask}
    />
  );
}
