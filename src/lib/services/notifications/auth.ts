import "server-only";
import { getCurrentUser, getUserAccessContext } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getActiveNotificationUser() {
  const user = await getCurrentUser();
  if (!user || user.status !== "ACTIVE") return null;
  return { user, admin: createAdminClient() };
}

export async function getNotificationAdmin(clubId: string) {
  const session = await getActiveNotificationUser();
  if (!session) return null;

  const access = await getUserAccessContext(clubId);
  if (!access.isPlatformAdmin && !access.permissions.has("NOTIFICATION_SEND")) {
    return null;
  }
  return { ...session, access };
}
