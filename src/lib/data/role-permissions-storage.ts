import fs from "fs";
import path from "path";
import { RoleKey, Permission } from "@/lib/permissions/keys";
import {
  RoleConfigDTO,
  getDefaultRoleConfigs,
} from "./role-permissions-types";

export * from "./role-permissions-types";

const STORAGE_FILE = path.join(process.cwd(), "src", "lib", "data", "role-permissions-store.json");

function ensureDirectoryExistence(filePath: string) {
  const dirname = path.dirname(filePath);
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true });
  }
}

export function readRolePermissionsStore(): Record<RoleKey, RoleConfigDTO> {
  try {
    if (!fs.existsSync(STORAGE_FILE)) {
      const defaults = getDefaultRoleConfigs();
      ensureDirectoryExistence(STORAGE_FILE);
      fs.writeFileSync(STORAGE_FILE, JSON.stringify(defaults, null, 2), "utf-8");
      return defaults;
    }
    const data = fs.readFileSync(STORAGE_FILE, "utf-8");
    const parsed = JSON.parse(data);
    return { ...getDefaultRoleConfigs(), ...parsed };
  } catch (err) {
    console.error("Failed to read role permissions store:", err);
    return getDefaultRoleConfigs();
  }
}

export function writeRolePermissionsStore(store: Record<RoleKey, RoleConfigDTO>) {
  try {
    ensureDirectoryExistence(STORAGE_FILE);
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(store, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to write role permissions store:", err);
  }
}

export function updateRoleConfig(
  roleKey: RoleKey,
  allowedPages: string[],
  allowedPermissions: Permission[]
): RoleConfigDTO {
  const store = readRolePermissionsStore();
  const current = store[roleKey] || {
    roleKey,
    roleLabel: roleKey,
    description: "",
    allowedPages: [],
    allowedPermissions: [],
  };

  store[roleKey] = {
    ...current,
    allowedPages,
    allowedPermissions,
  };

  writeRolePermissionsStore(store);
  return store[roleKey];
}

export function resetRoleToDefaults(roleKey: RoleKey): RoleConfigDTO {
  const defaults = getDefaultRoleConfigs();
  const store = readRolePermissionsStore();
  store[roleKey] = defaults[roleKey];
  writeRolePermissionsStore(store);
  return store[roleKey];
}
