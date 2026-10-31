import { assertPageAccess } from "@/lib/auth/session";
import { listActivities } from "@/features/activities/queries";
import { getGroupTasksList } from "@/features/tasks/queries";
import { ProjectCenterClient } from "./project-center-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Project Center — Racspeed",
  description:
    "Club meetings, service projects, attendance, tasks and collaboration.",
};

export default async function ProjectCenterPage() {
  const context = await assertPageAccess("project-center");
  const clubId =
    process.env.NEXT_PUBLIC_DEFAULT_CLUB_ID ||
    "00000000-0000-0000-0000-000000000001";
  const canManageClub =
    context.isPlatformAdmin ||
    context.permissions.has("EVENT_UPDATE") ||
    context.permissions.has("PROJECT_UPDATE");
  const [activities, tasks] = await Promise.all([
    listActivities(clubId, context.user.id, { includeDrafts: canManageClub }),
    getGroupTasksList(clubId),
  ]);
  const canCreate =
    context.isPlatformAdmin ||
    context.permissions.has("EVENT_CREATE") ||
    context.permissions.has("PROJECT_CREATE");

  return (
    <ProjectCenterClient
      initialActivities={activities}
      initialTasks={tasks}
      canCreate={canCreate}
      currentUserId={context.user.id}
      currentUserName={context.user.fullName}
    />
  );
}
