import React from "react";
import { requireUser } from "@/lib/auth/session";
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
  await requireUser();

  const [events, tasks] = await Promise.all([
    getEventsList(),
    getGroupTasksList(),
  ]);

  return <CalendarClient initialEvents={events} initialTasks={tasks} />;
}
