import { redirect } from "next/navigation";
import { assertPageAccess } from "@/lib/auth/session";
import { DEFAULT_CLUB_ID } from "@/features/activities/types";
import { getSisterClubsList } from "@/features/partnerships/queries";
import { getClubMembersList } from "@/features/members/queries";
import { ActivityCreateClient } from "./activity-create-client";

export const dynamic = "force-dynamic";

export default async function NewActivityPage({
  searchParams,
}: {
  searchParams: Promise<{
    kind?: string;
    sisterClubId?: string;
    partnerClubName?: string;
  }>;
}) {
  const context = await assertPageAccess("project-center");
  const params = await searchParams;
  const canCreateEvent =
    context.isPlatformAdmin || context.permissions.has("EVENT_CREATE");
  const canCreateProject =
    context.isPlatformAdmin || context.permissions.has("PROJECT_CREATE");
  if (!canCreateEvent && !canCreateProject) redirect("/access-denied");
  const clubId = process.env.NEXT_PUBLIC_DEFAULT_CLUB_ID || DEFAULT_CLUB_ID;
  const [partnerClubs, members] = await Promise.all([
    canCreateProject ? getSisterClubsList(clubId) : Promise.resolve([]),
    getClubMembersList(clubId),
  ]);

  const requestedKind =
    params.kind &&
    [
      "MEETING",
      "SERVICE_PROJECT",
      "JOINT_PROJECT",
      "FELLOWSHIP",
      "DISTRICT_EVENT",
      "PROFESSIONAL_DEVELOPMENT",
      "FUNDRAISER",
      "OTHER",
    ].includes(params.kind)
      ? params.kind
      : null;

  return (
    <ActivityCreateClient
      clubId={clubId}
      initialKind={requestedKind}
      canCreateEvent={canCreateEvent}
      canCreateProject={canCreateProject}
      partnerClubs={partnerClubs.map((club) => ({
        id: club.id,
        name: club.partnerClubName,
        district: club.district,
        country: club.country,
      }))}
      initialSisterClubId={params.sisterClubId || null}
      initialPartnerName={params.partnerClubName || null}
      members={members.map((m) => ({
        id: m.id,
        fullName: m.name,
        role: m.role,
        avatarUrl: m.avatarUrl || null,
      }))}
    />
  );
}
