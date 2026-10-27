import React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { getUserAccessContext } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await getUserAccessContext();

  return (
    <AppShell
      userEmail={context.user.email}
      userFullName={context.user.fullName || "Member"}
      roleLabel={context.roleLabel}
      allowedPages={context.allowedPages}
      permissions={Array.from(context.permissions)}
      isPlatformAdmin={context.isPlatformAdmin}
    >
      {children}
    </AppShell>
  );
}
