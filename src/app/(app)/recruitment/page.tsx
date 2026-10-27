import React from "react";
import { assertPageAccess } from "@/lib/auth/session";
import { getProspectsList } from "@/features/recruitment/queries";
import { RecruitmentClient } from "./recruitment-client";

export const dynamic = "force-dynamic";

export default async function RecruitmentPage() {
  await assertPageAccess("recruitment");
  const initialProspects = await getProspectsList();

  return <RecruitmentClient initialProspects={initialProspects} />;
}
