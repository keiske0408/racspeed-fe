import React from "react";
import { assertPageAccess } from "@/lib/auth/session";
import { getClubSettings } from "@/features/settings/queries";
import { getRolePermissionsMatrix } from "@/features/permissions/queries";
import { SettingsClient } from "./settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await assertPageAccess("settings");
  const [settings, permissionMatrix] = await Promise.all([
    getClubSettings(),
    getRolePermissionsMatrix(),
  ]);

  return (
    <SettingsClient
      initialSettings={settings}
      initialPermissions={permissionMatrix}
    />
  );
}
