import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import {
  Permission,
  hasPermission,
  PermissionMap,
  RoleKey,
  ROLE_LABELS,
  PERMISSIONS,
} from "@/lib/permissions/keys";
import {
  readRolePermissionsStore,
  DEFAULT_ROLE_PAGES,
  APP_MODULES,
  isModuleAllowed,
} from "@/lib/data/role-permissions-storage";

export interface CurrentUserContext {
  id: string;
  email: string;
  fullName: string;
  status: "PENDING" | "ACTIVE" | "SUSPENDED" | "REJECTED";
  isPlatformAdmin: boolean;
  avatarUrl?: string | null;
}

export interface UserAccessContext {
  user: CurrentUserContext;
  roleKey: RoleKey | "PLATFORM_ADMIN";
  roleLabel: string;
  allowedPages: string[];
  permissions: Set<Permission>;
  isPlatformAdmin: boolean;
}

export const getCurrentUser = cache(
  async function getCurrentUser(): Promise<CurrentUserContext | null> {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

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
      status: profile.status as CurrentUserContext["status"],
      isPlatformAdmin: profile.is_platform_admin,
      avatarUrl: profile.avatar_url,
    };
  },
);

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

export const getUserAccessContext = cache(async function getUserAccessContext(
  clubId = process.env.NEXT_PUBLIC_DEFAULT_CLUB_ID ||
    "00000000-0000-0000-0000-000000000001",
): Promise<UserAccessContext> {
  const user = await requireUser();

  if (user.isPlatformAdmin) {
    return {
      user,
      roleKey: "PLATFORM_ADMIN",
      roleLabel: "Platform Administrator",
      allowedPages: APP_MODULES.map((m) => m.key),
      permissions: new Set<Permission>(PERMISSIONS),
      isPlatformAdmin: true,
    };
  }

  const perms = new Set<Permission>();
  let roleKey: RoleKey = "GENERAL_MEMBER";
  let roleLabel = "General Member";

  try {
    const admin = createAdminClient();
    const { data: membership } = await admin
      .from("club_memberships")
      .select(
        `
        id,
        membership_roles (
          roles (
            key,
            name,
            role_permissions (
              permissions ( key )
            )
          )
        )
      `,
      )
      .eq("club_id", clubId)
      .eq("profile_id", user.id)
      .eq("membership_status", "ACTIVE")
      .maybeSingle();

    const memRoles = (membership as any)?.membership_roles || [];
    if (memRoles.length > 0 && memRoles[0].roles) {
      roleKey = (memRoles[0].roles.key as RoleKey) || "GENERAL_MEMBER";
      roleLabel = memRoles[0].roles.name || ROLE_LABELS[roleKey] || "Member";
    }

    for (const mr of memRoles) {
      const rps = mr.roles?.role_permissions || [];
      for (const rp of rps) {
        if (rp.permissions?.key) {
          perms.add(rp.permissions.key as Permission);
        }
      }
    }
  } catch (err) {
    console.warn("Could not query membership roles:", err);
  }

  const store = readRolePermissionsStore();
  const roleConfig = store[roleKey];
  const allowedPages = roleConfig?.allowedPages ||
    DEFAULT_ROLE_PAGES[roleKey] || ["dashboard", "events"];

  return {
    user,
    roleKey,
    roleLabel,
    allowedPages,
    permissions: perms,
    isPlatformAdmin: false,
  };
});

export async function getClubPermissions(
  clubId: string,
): Promise<Set<Permission>> {
  const context = await getUserAccessContext(clubId);
  return context.permissions;
}

export async function assertPermission(
  clubId: string,
  permission: Permission,
): Promise<void> {
  const perms = await getClubPermissions(clubId);
  const user = await getCurrentUser();
  if (!user || (!user.isPlatformAdmin && !perms.has(permission))) {
    throw new Error(
      `Unauthorized: User lacks required permission '${permission}' for this club.`,
    );
  }
}

export async function assertPageAccess(
  moduleKey: string,
  clubId = process.env.NEXT_PUBLIC_DEFAULT_CLUB_ID ||
    "00000000-0000-0000-0000-000000000001",
): Promise<UserAccessContext> {
  const context = await getUserAccessContext(clubId);
  if (context.isPlatformAdmin) {
    return context;
  }
  if (!isModuleAllowed(context.allowedPages, moduleKey)) {
    redirect("/access-denied");
  }
  return context;
}
