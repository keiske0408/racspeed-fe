import React from "react";
import { getCertificatesData } from "@/features/certificates/queries";
import { getClubMembersList } from "@/features/members/queries";
import { CertificatesClient } from "./certificates-client";

export const dynamic = "force-dynamic";

export default async function CertificatesPage() {
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
