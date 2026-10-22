import fs from "fs";
import path from "path";
export interface StoredSisterClub {
  id: string;
  partnerClubName: string;
  district: string;
  country: string;
  partnershipType: "SISTER_CLUB_MOA" | "DISTRICT_TWIN_CLUB" | "PROJECT_PARTNER" | "SPONSOR_ROTARY_CLUB";
  agreementSignedDate: string;
  renewalDate: string;
  liaisonOfficerName: string;
  liaisonEmail: string;
  liaisonPhone: string;
  status: "ACTIVE" | "PENDING_MOA" | "INACTIVE";
  notes: string;
  initiativesCount: number;
}

export interface StoredInitiative {
  id: string;
  sisterClubId: string;
  title: string;
  description: string;
  jointVolunteers: number;
  rotaryYear: string;
  createdAt: string;
}

interface PartnershipsStore {
  customClubs: StoredSisterClub[];
  initiatives: StoredInitiative[];
}

const STORAGE_FILE = path.join(process.cwd(), "src", "lib", "data", "partnerships-store.json");

function ensureDirectoryExistence(filePath: string) {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  fs.mkdirSync(dirname, { recursive: true });
}

export function readPartnershipsStore(): PartnershipsStore {
  try {
    if (!fs.existsSync(STORAGE_FILE)) {
      return { customClubs: [], initiatives: [] };
    }
    const data = fs.readFileSync(STORAGE_FILE, "utf-8");
    return JSON.parse(data);
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
