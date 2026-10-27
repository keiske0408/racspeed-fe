import React from "react";
import { assertPageAccess } from "@/lib/auth/session";
import { getClubMembersList } from "@/features/members/queries";
import { MembersClient } from "./members-client";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const context = await assertPageAccess("members");
  const initialMembers = await getClubMembersList();

  return (
    <MembersClient
      initialMembers={initialMembers}
      currentUser={context.user}
      permissions={{
        canApprove: context.isPlatformAdmin || context.permissions.has("MEMBER_APPROVE"),
        canCreate: context.isPlatformAdmin || context.permissions.has("MEMBER_CREATE"),
        canUpdate: context.isPlatformAdmin || context.permissions.has("MEMBER_UPDATE"),
        canAssignRole: context.isPlatformAdmin || context.permissions.has("ROLE_ASSIGN"),
        canSuspend: context.isPlatformAdmin || context.permissions.has("MEMBER_SUSPEND"),
        canManageSettings: context.isPlatformAdmin || context.permissions.has("SETTINGS_MANAGE"),
      }}
    />
  );
}
