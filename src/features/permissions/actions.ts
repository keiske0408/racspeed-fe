"use server";

import { revalidatePath } from "next/cache";
import { requireUser, assertPermission } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { RoleKey, Permission } from "@/lib/permissions/keys";
import {
  updateRoleConfig,
  resetRoleToDefaults,
} from "@/lib/data/role-permissions-storage";

export async function saveRolePermissionsAction(
  roleKey: RoleKey,
  allowedPages: string[],
  allowedPermissions: Permission[],
  clubId = "00000000-0000-0000-0000-000000000001"
) {
  const user = await requireUser();
  await assertPermission(clubId, "SETTINGS_MANAGE");

  try {
    // 1. Update persistent local configuration
    const updated = updateRoleConfig(roleKey, allowedPages, allowedPermissions);

    // 2. Sync to Supabase role_permissions table if available
    try {
      const admin = createAdminClient();

      // Find role
      const { data: roleData } = await admin
        .from("roles")
        .select("id")
        .eq("key", roleKey)
        .single();

      if (roleData?.id && allowedPermissions.length > 0) {
        // Find permission IDs
        const { data: permsData } = await admin
          .from("permissions")
          .select("id, key")
          .in("key", allowedPermissions);

        if (permsData && permsData.length > 0) {
          // Delete existing bindings
          await admin
            .from("role_permissions")
            .delete()
            .eq("role_id", roleData.id);

          // Insert new bindings
          const rowsToInsert = permsData.map((p) => ({
            role_id: roleData.id,
            permission_id: p.id,
          }));

          await admin.from("role_permissions").insert(rowsToInsert);
        }
      }
    } catch (dbErr) {
      console.warn("Could not sync permissions to Supabase DB, local store active:", dbErr);
    }

    revalidatePath("/settings");
    revalidatePath("/settings/permissions");
    revalidatePath("/members");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `Permissions and page access for ${updated.roleLabel} successfully saved!`,
      config: updated,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to save role permissions.",
    };
  }
}

export async function resetRolePermissionsAction(roleKey: RoleKey) {
  const user = await requireUser();

  try {
    const reset = resetRoleToDefaults(roleKey);

    revalidatePath("/settings");
    revalidatePath("/settings/permissions");

    return {
      success: true,
      message: `${reset.roleLabel} restored to default District 3820 constitutional permissions.`,
      config: reset,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to reset role permissions.",
    };
  }
}
