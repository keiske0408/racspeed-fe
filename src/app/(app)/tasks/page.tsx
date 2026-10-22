import React from "react";
import { requireUser } from "@/lib/auth/session";
import { getGroupTasksList, getTaskStats } from "@/features/tasks/queries";
import { getClubMembersList } from "@/features/members/queries";
import { TasksClient } from "./tasks-client";

export default async function TasksPage() {
  await requireUser();

  const [tasks, stats, members] = await Promise.all([
    getGroupTasksList(),
    getTaskStats(),
    getClubMembersList(),
  ]);

  return <TasksClient initialTasks={tasks} stats={stats} members={members} />;
}
