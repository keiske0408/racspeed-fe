import { notFound, redirect } from "next/navigation";
import { getUserAccessContext } from "@/lib/auth/session";
import { getClubMembersList } from "@/features/members/queries";
import { getMemberRewardsProfile } from "@/lib/services/rewards";
import { MemberProfileClient } from "./member-profile-client";

export const dynamic = "force-dynamic";

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const [{ memberId }, context] = await Promise.all([
    params,
    getUserAccessContext(),
  ]);
  const canViewOthers =
    context.isPlatformAdmin || context.permissions.has("MEMBER_VIEW");
  if (memberId !== context.user.id && !canViewOthers)
    redirect("/access-denied");

  const clubId =
    process.env.NEXT_PUBLIC_DEFAULT_CLUB_ID ||
    "00000000-0000-0000-0000-000000000001";
  const [members, rewards] = await Promise.all([
    getClubMembersList(clubId),
    getMemberRewardsProfile(clubId, memberId),
  ]);
  const member = members.find((candidate) => candidate.id === memberId);
  if (!member) notFound();

  return (
    <MemberProfileClient
      member={member}
      rewards={rewards}
      isSelf={memberId === context.user.id}
    />
  );
}
