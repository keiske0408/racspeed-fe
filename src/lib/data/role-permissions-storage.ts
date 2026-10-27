import fs from "fs";
import path from "path";
import { RoleKey, Permission } from "@/lib/permissions/keys";
import {
  RoleConfigDTO,
  getDefaultRoleConfigs,
} from "./role-permissions-types";

export * from "./role-permissions-types";

const STORAGE_FILE = path.join(process.cwd(), "src", "lib", "data", "role-permissions-store.json");

let inMemoryRoles: Record<RoleKey, RoleConfigDTO> = getDefaultRoleConfigs();

function ensureDirectoryExistence(filePath: string) {
  try {
    const dirname = path.dirname(filePath);
    if (!fs.existsSync(dirname)) {
      fs.mkdirSync(dirname, { recursive: true });
    }
  } catch {
    // Read-only filesystem in serverless environments
  }
}

export function readRolePermissionsStore(): Record<RoleKey, RoleConfigDTO> {
  try {
    if (!fs.existsSync(STORAGE_FILE)) {
      ensureDirectoryExistence(STORAGE_FILE);
      try {
        fs.writeFileSync(STORAGE_FILE, JSON.stringify(inMemoryRoles, null, 2), "utf-8");
      } catch {
        // Ephemeral in-memory fallback
      }
      return inMemoryRoles;
    }
    const data = fs.readFileSync(STORAGE_FILE, "utf-8");
    const parsed = JSON.parse(data);
    inMemoryRoles = { ...getDefaultRoleConfigs(), ...parsed };
    return inMemoryRoles;
  } catch (err) {
    console.warn("Failed to read role permissions store from filesystem, using defaults:", err);
    return inMemoryRoles;
  }
}

export function writeRolePermissionsStore(store: Record<RoleKey, RoleConfigDTO>) {
  inMemoryRoles = store;
  try {
    ensureDirectoryExistence(STORAGE_FILE);
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(store, null, 2), "utf-8");
  } catch (err) {
    console.warn("Serverless filesystem write ignored, cached in-memory:", err);
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
