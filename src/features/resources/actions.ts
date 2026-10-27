"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createResource,
  updateResource,
  deleteResource,
} from "@/lib/data/resources-storage";
import { ResourceCategory } from "./types";

const resourceSchema = z.object({
  title: z.string().min(2, "Resource title is required"),
  description: z.string().default(""),
  url: z.string().min(1, "URL or link is required").refine(
    (val) => {
      // Allow urls with or without http/https protocol
      return val.includes(".") || val.startsWith("http://") || val.startsWith("https://");
    },
    { message: "Please provide a valid website URL or link" }
  ),
  category: z.enum([
    "SOCIAL_MEDIA",
    "DISTRICT_PORTAL",
    "DRIVE_DOCUMENTS",
    "DESIGN_BRAND",
    "COMMUNITY_TOOL",
    "OTHER",
  ]),
  isPinned: z.boolean().default(false),
  clubId: z.string().default("00000000-0000-0000-0000-000000000001"),
});

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

export async function createResourceAction(formData: FormData) {
  try {
    const rawUrl = (formData.get("url") as string) || "";
    const parsed = resourceSchema.parse({
      title: formData.get("title"),
      description: formData.get("description") || "",
      url: rawUrl,
      category: formData.get("category") as ResourceCategory,
      isPinned: formData.get("isPinned") === "true" || formData.get("isPinned") === "on",
      clubId: (formData.get("clubId") as string) || "00000000-0000-0000-0000-000000000001",
    });

    const created = createResource({
      title: parsed.title,
      description: parsed.description,
      url: normalizeUrl(parsed.url),
      category: parsed.category,
      isPinned: parsed.isPinned,
    });

    try {
      const admin = createAdminClient();
      await admin.from("resources").insert({
        id: created.id,
        club_id: parsed.clubId,
        title: created.title,
        description: created.description,
        url: created.url,
        category: created.category,
        is_pinned: created.isPinned,
        created_at: created.createdAt,
        updated_at: created.updatedAt,
      });
    } catch (dbErr) {
      console.warn("Could not sync resource to Supabase:", dbErr);
    }

    revalidatePath("/resources");
    revalidatePath("/dashboard");
    return { success: true, data: created };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to create resource" };
  }
}

export async function updateResourceAction(id: string, formData: FormData) {
  try {
    const rawUrl = (formData.get("url") as string) || "";
    const parsed = resourceSchema.parse({
      title: formData.get("title"),
      description: formData.get("description") || "",
      url: rawUrl,
      category: formData.get("category") as ResourceCategory,
      isPinned: formData.get("isPinned") === "true" || formData.get("isPinned") === "on",
    });

    const updated = updateResource(id, {
      title: parsed.title,
      description: parsed.description,
      url: normalizeUrl(parsed.url),
      category: parsed.category,
      isPinned: parsed.isPinned,
    });

    if (!updated) {
      return { success: false, error: "Resource not found" };
    }

    try {
      const admin = createAdminClient();
      await admin.from("resources").update({
        title: updated.title,
        description: updated.description,
        url: updated.url,
        category: updated.category,
        is_pinned: updated.isPinned,
        updated_at: updated.updatedAt,
      }).eq("id", id);
    } catch (dbErr) {
      console.warn("Could not sync resource update to Supabase:", dbErr);
    }

    revalidatePath("/resources");
    revalidatePath("/dashboard");
    return { success: true, data: updated };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to update resource" };
  }
}

export async function deleteResourceAction(id: string) {
  try {
    const deleted = deleteResource(id);
    if (!deleted) {
      return { success: false, error: "Resource not found or already deleted" };
    }

    try {
      const admin = createAdminClient();
      await admin.from("resources").delete().eq("id", id);
    } catch (dbErr) {
      console.warn("Could not sync resource deletion to Supabase:", dbErr);
    }

    revalidatePath("/resources");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to delete resource" };
  }
}
