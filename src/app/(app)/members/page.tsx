import React from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { getClubMembersList } from "@/features/members/queries";
import { MembersClient } from "./members-client";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const currentUser = await getCurrentUser();
  const initialMembers = await getClubMembersList();

  return (
    <MembersClient
      initialMembers={initialMembers}
      currentUser={currentUser}
    />
  );
}
