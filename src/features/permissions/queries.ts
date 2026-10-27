import {
  readRolePermissionsStore,
  RoleConfigDTO,
  APP_MODULES,
  PageModuleDef,
  PermissionDefinition,
  PERMISSION_DEFINITIONS,
  DEFAULT_ROLE_PAGES,
} from "@/lib/data/role-permissions-storage";
import { RoleKey, Permission } from "@/lib/permissions/keys";
import { createAdminClient } from "@/lib/supabase/admin";

export * from "@/lib/data/role-permissions-types";

export async function getRolePermissionsMatrix(): Promise<{
  roles: Record<RoleKey, RoleConfigDTO>;
  modules: PageModuleDef[];
  permissions: PermissionDefinition[];
}> {
  const store = readRolePermissionsStore();

  try {
    const admin = createAdminClient();
    const { data: rolesData, error: rolesErr } = await admin
      .from("roles")
      .select("id, key, name, description, role_permissions(permissions(key))");

    if (!rolesErr && rolesData && rolesData.length > 0) {
      for (const r of rolesData) {
        const key = r.key as RoleKey;
        if (!key) continue;

        const dbPermissions = (r.role_permissions || [])
          .map((rp: any) => rp.permissions?.key as Permission)
          .filter(Boolean);

        const currentConfig = store[key] || {
          roleKey: key,
          roleLabel: r.name || key,
          description: r.description || "",
          allowedPages: DEFAULT_ROLE_PAGES[key] || ["dashboard", "events"],
          allowedPermissions: [],
        };

        store[key] = {
          ...currentConfig,
          roleLabel: r.name || currentConfig.roleLabel,
          description: r.description || currentConfig.description,
          allowedPermissions: dbPermissions,
        };
      }
    }
  } catch (err) {
    console.warn("Could not query role permissions from Supabase, using local store:", err);
  }

  return {
    roles: store,
    modules: APP_MODULES,
    permissions: PERMISSION_DEFINITIONS,
  };
}
