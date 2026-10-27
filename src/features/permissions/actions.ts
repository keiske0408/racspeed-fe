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
  try {
    const user = await requireUser();
    await assertPermission(clubId, "SETTINGS_MANAGE");

    // 1. Update persistent local configuration
    const updated = updateRoleConfig(roleKey, allowedPages, allowedPermissions);

    // 2. Sync to Supabase role_permissions table
    try {
      const admin = createAdminClient();

      // Find role
      const { data: roleData } = await admin
        .from("roles")
        .select("id")
        .eq("key", roleKey)
        .single();

      if (roleData?.id) {
        // ALWAYS delete existing role_permissions bindings for this role first
        await admin
          .from("role_permissions")
          .delete()
          .eq("role_id", roleData.id);

        if (allowedPermissions.length > 0) {
          // Find permission IDs
          const { data: permsData } = await admin
            .from("permissions")
            .select("id, key")
            .in("key", allowedPermissions);

          if (permsData && permsData.length > 0) {
            // Insert new bindings
            const rowsToInsert = permsData.map((p) => ({
              role_id: roleData.id,
              permission_id: p.id,
            }));

            const { error: insertErr } = await admin.from("role_permissions").insert(rowsToInsert);
            if (insertErr) {
              console.warn("Could not insert updated role_permissions in Supabase:", insertErr);
            }
          }
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

export async function resetRolePermissionsAction(
  roleKey: RoleKey,
  clubId = "00000000-0000-0000-0000-000000000001"
) {
  try {
    const user = await requireUser();
    await assertPermission(clubId, "SETTINGS_MANAGE");

    const reset = resetRoleToDefaults(roleKey);

    // Sync reset to Supabase
    try {
      const admin = createAdminClient();
      const { data: roleData } = await admin
        .from("roles")
        .select("id")
        .eq("key", roleKey)
        .single();

      if (roleData?.id) {
        await admin
          .from("role_permissions")
          .delete()
          .eq("role_id", roleData.id);

        if (reset.allowedPermissions.length > 0) {
          const { data: permsData } = await admin
            .from("permissions")
            .select("id, key")
            .in("key", reset.allowedPermissions);

          if (permsData && permsData.length > 0) {
            const rowsToInsert = permsData.map((p) => ({
              role_id: roleData.id,
              permission_id: p.id,
            }));
            await admin.from("role_permissions").insert(rowsToInsert);
          }
        }
      }
    } catch (dbErr) {
      console.warn("Could not sync reset to Supabase DB:", dbErr);
    }

    revalidatePath("/settings");
    revalidatePath("/settings/permissions");
    revalidatePath("/members");
    revalidatePath("/dashboard");

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
