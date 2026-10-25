import fs from "fs";
import path from "path";
import { ClubResource, ResourceCategory } from "@/features/resources/types";

const STORAGE_FILE = path.join(process.cwd(), "src", "lib", "data", "resources-store.json");

const DEFAULT_RESOURCES: ClubResource[] = [
  {
    id: "res-001",
    clubId: "00000000-0000-0000-0000-000000000001",
    title: "Rotaract Club of San Pedro East — Official Facebook Page",
    description: "Primary public Facebook page for general announcements, project highlights, recruitment drives, and community outreach photos.",
    url: "https://facebook.com/rotaractsanpedroeast",
    category: "SOCIAL_MEDIA",
    isPinned: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "res-002",
    clubId: "00000000-0000-0000-0000-000000000001",
    title: "Rotary International District 3820 Official Portal",
    description: "District guidelines, District Governor monthly letters, event calendars, and district assembly directives.",
    url: "https://rotary3820.org",
    category: "DISTRICT_PORTAL",
    isPinned: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "res-003",
    clubId: "00000000-0000-0000-0000-000000000001",
    title: "MyRotary & Club Central Portal",
    description: "Rotary International global database for club citation goals, officer appointments, and Rotary Foundation contributions.",
    url: "https://my.rotary.org",
    category: "DISTRICT_PORTAL",
    isPinned: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "res-004",
    clubId: "00000000-0000-0000-0000-000000000001",
    title: "Rotary Brand Center & Visual Guidelines",
    description: "Official Rotaract logos, lockups, color palettes, and flyer design templates adhering to RI visual standards.",
    url: "https://brandcenter.rotary.org",
    category: "DESIGN_BRAND",
    isPinned: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "res-005",
    clubId: "00000000-0000-0000-0000-000000000001",
    title: "District 3820 Monthly Reporting Google Drive",
    description: "Central cloud repository for project completion reports, attendance sheets, and liquidation vouchers.",
    url: "https://drive.google.com",
    category: "DRIVE_DOCUMENTS",
    isPinned: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

let inMemoryResources: ClubResource[] = [...DEFAULT_RESOURCES];

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

export function readResourcesStore(): ClubResource[] {
  try {
    if (!fs.existsSync(STORAGE_FILE)) {
      writeResourcesStore(DEFAULT_RESOURCES);
      return inMemoryResources;
    }
    const data = fs.readFileSync(STORAGE_FILE, "utf-8");
    const parsed = JSON.parse(data);
    inMemoryResources = Array.isArray(parsed) ? parsed : [...DEFAULT_RESOURCES];
    return inMemoryResources;
  } catch (err) {
    console.warn("Failed to read resources store from filesystem, using defaults:", err);
    return inMemoryResources;
  }
}

export function writeResourcesStore(resources: ClubResource[]) {
  inMemoryResources = resources;
  try {
    ensureDirectoryExistence(STORAGE_FILE);
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(resources, null, 2), "utf-8");
  } catch (err) {
    console.warn("Serverless filesystem write ignored, cached in-memory:", err);
  }
}

export function createResource(data: {
  title: string;
  description: string;
  url: string;
  category: ResourceCategory;
  isPinned?: boolean;
}): ClubResource {
  const resources = readResourcesStore();
  const newResource: ClubResource = {
    id: `res-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    clubId: "00000000-0000-0000-0000-000000000001",
    title: data.title.trim(),
    description: data.description.trim(),
    url: data.url.trim(),
    category: data.category,
    isPinned: !!data.isPinned,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  resources.unshift(newResource);
  writeResourcesStore(resources);
  return newResource;
}

export function updateResource(
  id: string,
  data: Partial<Pick<ClubResource, "title" | "description" | "url" | "category" | "isPinned">>
): ClubResource | null {
  const resources = readResourcesStore();
  const index = resources.findIndex((r) => r.id === id);
  if (index === -1) return null;

  resources[index] = {
    ...resources[index],
    ...data,
    updatedAt: new Date().toISOString(),
  };

  writeResourcesStore(resources);
  return resources[index];
}

export function deleteResource(id: string): boolean {
  const resources = readResourcesStore();
  const filtered = resources.filter((r) => r.id !== id);
  if (filtered.length === resources.length) return false;

  writeResourcesStore(filtered);
  return true;
}
