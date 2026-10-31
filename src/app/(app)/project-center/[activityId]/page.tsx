import { notFound, redirect } from "next/navigation";
import { assertPageAccess } from "@/lib/auth/session";
import {
  getActivityDetail,
  getActivityTasks,
  isClubParticipant,
} from "@/features/activities/queries";
import { ActivityDetailClient } from "./activity-detail-client";

export const dynamic = "force-dynamic";

export default async function ActivityDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ activityId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const context = await assertPageAccess("project-center");
  const [{ activityId }, query] = await Promise.all([params, searchParams]);
  const clubId =
    process.env.NEXT_PUBLIC_DEFAULT_CLUB_ID ||
    "00000000-0000-0000-0000-000000000001";
  const canManageClub =
    context.isPlatformAdmin ||
    context.permissions.has("EVENT_UPDATE") ||
    context.permissions.has("PROJECT_UPDATE");
  const canManageAttendance =
    context.isPlatformAdmin || context.permissions.has("ATTENDANCE_MANAGE");

  const [detail, tasks] = await Promise.all([
    getActivityDetail(activityId, context.user.id, {
      canManageClub,
      canManageAttendance,
    }),
    getActivityTasks(clubId, activityId),
  ]);
  if (!detail) notFound();
  if (!detail.isPublished && !detail.canManage && !context.isPlatformAdmin)
    notFound();
  if (
    !context.isPlatformAdmin &&
    !(await isClubParticipant(detail.clubId, context.user.id))
  )
    redirect("/access-denied");

  return (
    <ActivityDetailClient
      initialActivity={detail}
      initialTasks={tasks}
      initialTab={query.tab}
      currentUserId={context.user.id}
      canCreateTasks={canManageClub || detail.canManage}
      canManageClub={canManageClub || detail.canManage}
    />
  );
}
