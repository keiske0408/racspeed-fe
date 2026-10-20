import React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <AppShell
      userEmail={user?.email}
      userFullName={user?.fullName || "Member"}
    >
      {children}
    </AppShell>
  );
}
