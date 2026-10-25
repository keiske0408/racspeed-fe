import { createAdminClient } from "@/lib/supabase/admin";
import { readResourcesStore } from "@/lib/data/resources-storage";
import { ClubResource, ResourceCategory } from "./types";

export async function getClubResourcesList(filterCategory?: ResourceCategory): Promise<ClubResource[]> {
  try {
    const admin = createAdminClient();
    let query = admin
      .from("resources")
      .select("*")
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false });

    if (filterCategory) {
      query = query.eq("category", filterCategory);
    }

    const { data: rows, error } = await query;
    if (!error && rows && rows.length > 0) {
      return rows.map((r: any) => ({
        id: r.id,
        clubId: r.club_id,
        title: r.title,
        description: r.description || "",
        url: r.url,
        category: r.category as ResourceCategory,
        isPinned: !!r.is_pinned,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
    }
  } catch {
    // If Supabase table is not yet migrated, fall back seamlessly
  }

  const all = readResourcesStore();
  if (!filterCategory) return all;
  return all.filter((r) => r.category === filterCategory);
}

export async function getClubResourceById(id: string): Promise<ClubResource | null> {
  try {
    const admin = createAdminClient();
    const { data: r, error } = await admin
      .from("resources")
      .select("*")
      .eq("id", id)
      .single();

    if (!error && r) {
      return {
        id: r.id,
        clubId: r.club_id,
        title: r.title,
        description: r.description || "",
        url: r.url,
        category: r.category as ResourceCategory,
        isPinned: !!r.is_pinned,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    }
  } catch {
    // Fall back
  }

  const all = readResourcesStore();
  return all.find((r) => r.id === id) || null;
}
