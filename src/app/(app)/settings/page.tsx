import React from "react";
import { getClubSettings } from "@/features/settings/queries";
import { SettingsClient } from "./settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getClubSettings();

  return <SettingsClient initialSettings={settings} />;
}
