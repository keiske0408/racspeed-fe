import React from "react";
import { getProspectsList } from "@/features/recruitment/queries";
import { RecruitmentClient } from "./recruitment-client";

export const dynamic = "force-dynamic";

export default async function RecruitmentPage() {
  const initialProspects = await getProspectsList();

  return <RecruitmentClient initialProspects={initialProspects} />;
}
