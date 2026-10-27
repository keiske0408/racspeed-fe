import React from "react";
import { assertPageAccess } from "@/lib/auth/session";
import { getGroupTasksList, getTaskStats } from "@/features/tasks/queries";
import { getClubMembersList } from "@/features/members/queries";
import { TasksClient } from "./tasks-client";

export default async function TasksPage() {
  await assertPageAccess("tasks");

  const [tasks, stats, members] = await Promise.all([
    getGroupTasksList(),
    getTaskStats(),
    getClubMembersList(),
  ]);

  return <TasksClient initialTasks={tasks} stats={stats} members={members} />;
}
