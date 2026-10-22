import fs from "fs";
import path from "path";
import {
  StoredSisterClub,
  StoredInitiative,
  InitiativeStatus,
} from "./partnerships-types";

export * from "./partnerships-types";

interface PartnershipsStore {
  customClubs: StoredSisterClub[];
  initiatives: StoredInitiative[];
}

const STORAGE_FILE = path.join(process.cwd(), "src", "lib", "data", "partnerships-store.json");

function ensureDirectoryExistence(filePath: string) {
  const dirname = path.dirname(filePath);
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true });
  }
}

export function readPartnershipsStore(): PartnershipsStore {
  try {
    if (!fs.existsSync(STORAGE_FILE)) {
      return { customClubs: [], initiatives: [] };
    }
    const data = fs.readFileSync(STORAGE_FILE, "utf-8");
    const parsed = JSON.parse(data);

    // Normalize initiatives to ensure each has a status
    const initiatives = (parsed.initiatives || []).map((init: any) => ({
      ...init,
      status: (init.status as InitiativeStatus) || "IN_PROGRESS",
    }));

    return {
      customClubs: parsed.customClubs || [],
      initiatives,
    };
  } catch (err) {
    console.error("Failed to read partnerships store:", err);
    return { customClubs: [], initiatives: [] };
  }
}

export function writePartnershipsStore(store: PartnershipsStore) {
  try {
    ensureDirectoryExistence(STORAGE_FILE);
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(store, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to write partnerships store:", err);
  }
}

export function addCustomSisterClub(club: StoredSisterClub) {
  const store = readPartnershipsStore();
  store.customClubs.unshift(club);
  writePartnershipsStore(store);
}

export function addCustomInitiative(initiative: StoredInitiative) {
  const store = readPartnershipsStore();
  store.initiatives.unshift(initiative);
  writePartnershipsStore(store);
}

export function updateCustomInitiative(
  initiativeId: string,
  updates: Partial<StoredInitiative>
): StoredInitiative | null {
  const store = readPartnershipsStore();
  const index = store.initiatives.findIndex((i) => i.id === initiativeId);
  if (index === -1) return null;

  store.initiatives[index] = {
    ...store.initiatives[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  writePartnershipsStore(store);
  return store.initiatives[index];
}

export function deleteCustomInitiative(initiativeId: string): boolean {
  const store = readPartnershipsStore();
  const initialLength = store.initiatives.length;
  store.initiatives = store.initiatives.filter((i) => i.id !== initiativeId);

  if (store.initiatives.length !== initialLength) {
    writePartnershipsStore(store);
    return true;
  }
  return false;
}
