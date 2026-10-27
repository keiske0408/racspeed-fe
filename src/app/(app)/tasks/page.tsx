import React from "react";
import { assertPageAccess } from "@/lib/auth/session";
import { getGroupTasksList, getTaskStats } from "@/features/tasks/queries";
import { getClubMembersList } from "@/features/members/queries";
import { getProjectsList } from "@/features/projects/queries";
import { TasksClient } from "./tasks-client";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const context = await assertPageAccess("tasks");

  const [tasks, stats, members, projects] = await Promise.all([
    getGroupTasksList(),
    getTaskStats(),
    getClubMembersList(),
    getProjectsList(),
  ]);

  const isAdmin =
    context.isPlatformAdmin ||
    context.permissions.has("ROLE_ASSIGN") ||
    context.permissions.has("SETTINGS_MANAGE");

  return (
    <TasksClient
      initialTasks={tasks}
      stats={stats}
      members={members}
      projects={projects}
      currentUser={context.user}
      isAdmin={isAdmin}
    />
  );
}
