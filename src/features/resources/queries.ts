import { readResourcesStore } from "@/lib/data/resources-storage";
import { ClubResource, ResourceCategory } from "./types";

export async function getClubResourcesList(filterCategory?: ResourceCategory): Promise<ClubResource[]> {
  const all = readResourcesStore();
  if (!filterCategory) return all;
  return all.filter((r) => r.category === filterCategory);
}

export async function getClubResourceById(id: string): Promise<ClubResource | null> {
  const all = readResourcesStore();
  return all.find((r) => r.id === id) || null;
}
