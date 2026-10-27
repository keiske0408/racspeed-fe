import React from "react";
import { assertPageAccess } from "@/lib/auth/session";
import { getCertificatesData } from "@/features/certificates/queries";
import { getClubMembersList } from "@/features/members/queries";
import { CertificatesClient } from "./certificates-client";

export const dynamic = "force-dynamic";

export default async function CertificatesPage() {
  await assertPageAccess("certificates");
  const [{ templates, issuedCerts }, members] = await Promise.all([
    getCertificatesData(),
    getClubMembersList(),
  ]);

  return (
    <CertificatesClient
      initialTemplates={templates}
      initialIssuedCerts={issuedCerts}
      members={members}
    />
  );
}
