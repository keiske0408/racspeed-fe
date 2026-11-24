import { NotificationSettingsClient } from "@/components/settings/notification-settings-client";
import { getUserAccessContext } from "@/lib/auth/session";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function NotificationSettingsPage() {
  const clubId = env.NEXT_PUBLIC_DEFAULT_CLUB_ID;
  const access = await getUserAccessContext(clubId);
  const canManage = access.isPlatformAdmin || access.permissions.has("NOTIFICATION_SEND");
  return <NotificationSettingsClient clubId={clubId} canManage={canManage} />;
}
