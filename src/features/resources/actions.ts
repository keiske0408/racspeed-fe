"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
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
    });

    const created = createResource({
      title: parsed.title,
      description: parsed.description,
      url: normalizeUrl(parsed.url),
      category: parsed.category,
      isPinned: parsed.isPinned,
    });

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

    revalidatePath("/resources");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to delete resource" };
  }
}
