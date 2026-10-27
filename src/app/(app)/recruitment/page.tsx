import React from "react";
import { assertPageAccess } from "@/lib/auth/session";
import { getProspectsList } from "@/features/recruitment/queries";
import { RecruitmentClient } from "./recruitment-client";

export const dynamic = "force-dynamic";

export default async function RecruitmentPage() {
  const context = await assertPageAccess("recruitment");
  const initialProspects = await getProspectsList();
  const canManage = context.isPlatformAdmin || context.permissions.has("RECRUITMENT_MANAGE");

  return <RecruitmentClient initialProspects={initialProspects} canManage={canManage} />;
}
