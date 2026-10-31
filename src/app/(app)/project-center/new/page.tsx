import { redirect } from "next/navigation";
import { assertPageAccess } from "@/lib/auth/session";
import { DEFAULT_CLUB_ID } from "@/features/activities/types";
import { ActivityCreateClient } from "./activity-create-client";

export const dynamic = "force-dynamic";

export default async function NewActivityPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const context = await assertPageAccess("project-center");
  const params = await searchParams;
  const canCreateEvent = context.isPlatformAdmin || context.permissions.has("EVENT_CREATE");
  const canCreateProject = context.isPlatformAdmin || context.permissions.has("PROJECT_CREATE");
  if (!canCreateEvent && !canCreateProject) redirect("/access-denied");

  const requestedKind = params.kind && [
    "MEETING", "SERVICE_PROJECT", "JOINT_PROJECT", "FELLOWSHIP", "DISTRICT_EVENT",
    "PROFESSIONAL_DEVELOPMENT", "FUNDRAISER", "OTHER",
  ].includes(params.kind) ? params.kind : null;

  return (
    <ActivityCreateClient
      clubId={process.env.NEXT_PUBLIC_DEFAULT_CLUB_ID || DEFAULT_CLUB_ID}
      initialKind={requestedKind}
      canCreateEvent={canCreateEvent}
      canCreateProject={canCreateProject}
    />
  );
}