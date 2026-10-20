import "server-only";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Permission, hasPermission, PermissionMap } from "@/lib/permissions/keys";

export interface CurrentUserContext {
  id: string;
  email: string;
  fullName: string;
  status: "PENDING" | "ACTIVE" | "SUSPENDED" | "REJECTED";
  isPlatformAdmin: boolean;
  avatarUrl?: string | null;
}

export async function getCurrentUser(): Promise<CurrentUserContext | null> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, status, is_platform_admin, avatar_url")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return null;
  }

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    status: profile.status as any,
    isPlatformAdmin: profile.is_platform_admin,
    avatarUrl: profile.avatar_url,
  };
}

export async function requireUser(): Promise<CurrentUserContext> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (user.status === "PENDING") {
    redirect("/pending-approval");
  }
  if (user.status === "SUSPENDED" || user.status === "REJECTED") {
    redirect("/access-denied");
  }
  return user;
}

export async function getClubPermissions(clubId: string): Promise<Set<Permission>> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return new Set();
  if (user.isPlatformAdmin) {
    // Platform admin has all permissions
    return new Set<Permission>([
      "MEMBER_VIEW", "MEMBER_CREATE", "MEMBER_UPDATE", "MEMBER_APPROVE", "MEMBER_SUSPEND",
      "MEMBER_SENSITIVE_VIEW", "ROLE_ASSIGN", "RECRUITMENT_MANAGE", "EVENT_VIEW", "EVENT_CREATE",
      "EVENT_UPDATE", "ATTENDANCE_MANAGE", "RETENTION_ALERT_VIEW", "PROJECT_CREATE",
      "PROJECT_UPDATE", "PROJECT_SUBMIT_REPORT", "REPORT_APPROVE", "REPORT_TEMPLATE_MANAGE",
      "CERTIFICATE_GENERATE", "TREASURY_VIEW", "INVOICE_CREATE", "PAYMENT_SUBMIT",
      "PAYMENT_VERIFY", "LEDGER_ADJUST", "BUDGET_REQUEST", "BUDGET_APPROVE_PRESIDENT",
      "BUDGET_APPROVE_TREASURER", "DISBURSEMENT_RECORD", "LIQUIDATION_SUBMIT", "LIQUIDATION_VERIFY",
      "NOTIFICATION_SEND", "AUDIT_LOG_VIEW", "SETTINGS_MANAGE", "DATA_EXPORT"
    ]);
  }

  const { data: membership } = await supabase
    .from("club_memberships")
    .select(`
      id,
      membership_roles (
        roles (
          role_permissions (
            permissions ( key )
          )
        )
      )
    `)
    .eq("club_id", clubId)
    .eq("profile_id", user.id)
    .eq("membership_status", "ACTIVE")
    .single();

  const perms = new Set<Permission>();
  if (!membership) return perms;

  const roles = (membership as any).membership_roles || [];
  for (const mr of roles) {
    const role = mr.roles;
    if (!role) continue;
    const rps = role.role_permissions || [];
    for (const rp of rps) {
      if (rp.permissions?.key) {
        perms.add(rp.permissions.key as Permission);
      }
    }
  }

  return perms;
}

export async function assertPermission(clubId: string, permission: Permission): Promise<void> {
  const perms = await getClubPermissions(clubId);
  const user = await getCurrentUser();
  if (!user || (!user.isPlatformAdmin && !perms.has(permission))) {
    throw new Error(`Unauthorized: User lacks required permission '${permission}' for this club.`);
  }
}
