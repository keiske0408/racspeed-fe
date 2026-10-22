import {
  readRolePermissionsStore,
  RoleConfigDTO,
  APP_MODULES,
  PageModuleDef,
  PermissionDefinition,
  PERMISSION_DEFINITIONS,
} from "@/lib/data/role-permissions-storage";
import { RoleKey } from "@/lib/permissions/keys";

export * from "@/lib/data/role-permissions-types";

export async function getRolePermissionsMatrix(): Promise<{
  roles: Record<RoleKey, RoleConfigDTO>;
  modules: PageModuleDef[];
  permissions: PermissionDefinition[];
}> {
  const store = readRolePermissionsStore();
  return {
    roles: store,
    modules: APP_MODULES,
    permissions: PERMISSION_DEFINITIONS,
  };
}
