import fs from "fs";
import path from "path";
import {
  StoredSisterClub,
  StoredInitiative,
  InitiativeStatus,
  PartnershipType,
  ClubPartnershipStatus,
  SisterClubDTO,
} from "./partnerships-types";

export * from "./partnerships-types";

interface PartnershipsStore {
  customClubs: StoredSisterClub[];
  initiatives: StoredInitiative[];
}

const STORAGE_FILE = path.join(process.cwd(), "src", "lib", "data", "partnerships-store.json");

export const SEED_SISTER_CLUBS: StoredSisterClub[] = [
  {
    id: "sc-1",
    partnerClubName: "Rotaract Club of Manila Metro",
    district: "3810",
    country: "Philippines",
    partnershipType: "SISTER_CLUB_MOA",
    agreementSignedDate: "2024-08-15",
    renewalDate: "2027-06-30",
    liaisonOfficerName: "Bea Rodriguez (International Service Director)",
    liaisonEmail: "liaison@racmanilametro.org",
    liaisonPhone: "+63 917 888 2345",
    status: "ACTIVE",
    notes: "Active sister club agreement focusing on youth literacy and joint medical missions.",
    initiativesCount: 3,
  },
  {
    id: "sc-2",
    partnerClubName: "Rotaract Club of Taipei Diamond",
    district: "3521",
    country: "Taiwan",
    partnershipType: "SISTER_CLUB_MOA",
    agreementSignedDate: "2025-02-23",
    renewalDate: "2028-02-23",
    liaisonOfficerName: "Kevin Chen (Club President)",
    liaisonEmail: "president@ractaipeidiamond.tw",
    liaisonPhone: "+886 912 345 678",
    status: "ACTIVE",
    notes: "Cross-district sister club agreement for international cultural exchange and global grant projects.",
    initiativesCount: 2,
  },
  {
    id: "sc-3",
    partnerClubName: "Rotary Club of San Pedro East (Sponsor Club)",
    district: "3820",
    country: "Philippines",
    partnershipType: "SPONSOR_ROTARY_CLUB",
    agreementSignedDate: "2018-07-01",
    renewalDate: "Permanent Charter",
    liaisonOfficerName: "Rotarian Engr. Manuel Santos",
    liaisonEmail: "youthservice@rotarysanpedroeast.org",
    liaisonPhone: "+63 918 555 7722",
    status: "ACTIVE",
    notes: "Mother Rotary sponsor club supporting RYLA sponsorships and community water projects.",
    initiativesCount: 3,
  },
  {
    id: "sc-4",
    partnerClubName: "Rotaract Club of Bangkok South",
    district: "3350",
    country: "Thailand",
    partnershipType: "DISTRICT_TWIN_CLUB",
    agreementSignedDate: "2026-01-10",
    renewalDate: "2027-01-10",
    liaisonOfficerName: "Somchai Prasert",
    liaisonEmail: "somchai@racbkk.th",
    liaisonPhone: "+66 81 234 5678",
    status: "PENDING_MOA",
    notes: "Pending final District Governor sign-off on mutual twinning agreement.",
    initiativesCount: 1,
  },
];

export const SEED_INITIATIVES: StoredInitiative[] = [
  {
    id: "init-fallback-1",
    sisterClubId: "sc-1",
    title: "Dual-Club Coastal Mangrove Reforestation Drive",
    description: "Joint youth environmental conservation drive at Las Piñas-Parañaque Wetland Park planting 500 propagules.",
    jointVolunteers: 35,
    rotaryYear: "2026-27",
    status: "COMPLETED",
    createdAt: "2026-09-12T08:00:00Z",
  },
  {
    id: "init-fallback-2",
    sisterClubId: "sc-1",
    title: "Metro-Laguna Youth Leadership Academy (RYLA)",
    description: "Weekend leadership workshop and vocational skill sessions for 50 public high school student council leaders.",
    jointVolunteers: 20,
    rotaryYear: "2026-27",
    status: "IN_PROGRESS",
    createdAt: "2026-10-05T10:30:00Z",
  },
  {
    id: "init-fallback-3",
    sisterClubId: "sc-1",
    title: "Basic Literacy Book & School Supplies Distribution",
    description: "Donation drive targeting 300 elementary school students in underserved coastal communities.",
    jointVolunteers: 15,
    rotaryYear: "2026-27",
    status: "PROPOSED",
    createdAt: "2026-10-18T14:00:00Z",
  },
  {
    id: "init-fallback-4",
    sisterClubId: "sc-2",
    title: "Cross-Strait Virtual Cultural Exchange & Fellowship Forum",
    description: "Online forum exploring technology adoption and micro-grants in community service.",
    jointVolunteers: 40,
    rotaryYear: "2026-27",
    status: "COMPLETED",
    createdAt: "2026-07-20T11:00:00Z",
  },
  {
    id: "init-fallback-5",
    sisterClubId: "sc-2",
    title: "Global Grant Water Filtration Feasibility Study",
    description: "Joint proposal drafting for clean potable water facilities in rural Laguna communities.",
    jointVolunteers: 12,
    rotaryYear: "2026-27",
    status: "IN_PROGRESS",
    createdAt: "2026-09-28T09:15:00Z",
  },
  {
    id: "init-fallback-6",
    sisterClubId: "sc-3",
    title: "Annual End Polio Now Bike & Walkathon",
    description: "Fundraising walk for Rotary International PolioPlus fund with 150 community participants.",
    jointVolunteers: 60,
    rotaryYear: "2026-27",
    status: "COMPLETED",
    createdAt: "2026-08-10T06:00:00Z",
  },
  {
    id: "init-fallback-7",
    sisterClubId: "sc-3",
    title: "Clean Water Installation at San Antonio Elementary",
    description: "Installation of 3 multi-stage UV water dispensers for 800 elementary students.",
    jointVolunteers: 25,
    rotaryYear: "2026-27",
    status: "IN_PROGRESS",
    createdAt: "2026-10-02T13:00:00Z",
  },
  {
    id: "init-fallback-8",
    sisterClubId: "sc-3",
    title: "Vocational Career Clinic for Graduating Scholars",
    description: "Resume writing and mock interview prep conducted by Rotarian business leaders.",
    jointVolunteers: 18,
    rotaryYear: "2026-27",
    status: "PROPOSED",
    createdAt: "2026-10-15T15:30:00Z",
  },
  {
    id: "init-fallback-9",
    sisterClubId: "sc-4",
    title: "Twin Club Friendship Itinerary Alignment",
    description: "Planning bilateral club delegation visits for upcoming District 3820 DISAS.",
    jointVolunteers: 10,
    rotaryYear: "2026-27",
    status: "PROPOSED",
    createdAt: "2026-10-10T12:00:00Z",
  },
];

function ensureDirectoryExistence(filePath: string) {
  const dirname = path.dirname(filePath);
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true });
  }
}

export function readPartnershipsStore(): PartnershipsStore {
  try {
    if (!fs.existsSync(STORAGE_FILE)) {
      const initialStore: PartnershipsStore = {
        customClubs: SEED_SISTER_CLUBS,
        initiatives: SEED_INITIATIVES,
      };
      ensureDirectoryExistence(STORAGE_FILE);
      fs.writeFileSync(STORAGE_FILE, JSON.stringify(initialStore, null, 2), "utf-8");
      return initialStore;
    }

    const data = fs.readFileSync(STORAGE_FILE, "utf-8");
    const parsed = JSON.parse(data);

    let customClubs = Array.isArray(parsed.customClubs) ? parsed.customClubs : [];
    let initiatives = Array.isArray(parsed.initiatives) ? parsed.initiatives : [];

    // If file exists but customClubs is empty, seed initial clubs
    if (customClubs.length === 0) {
      customClubs = [...SEED_SISTER_CLUBS];
    }

    // If initiatives are empty, seed initial initiatives
    if (initiatives.length === 0) {
      initiatives = [...SEED_INITIATIVES];
    } else {
      initiatives = initiatives.map((init: any) => ({
        ...init,
        status: (init.status as InitiativeStatus) || "IN_PROGRESS",
      }));
    }

    return { customClubs, initiatives };
  } catch (err) {
    console.error("Failed to read partnerships store:", err);
    return {
      customClubs: SEED_SISTER_CLUBS,
      initiatives: SEED_INITIATIVES,
    };
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

// Club Mutators
export function addCustomSisterClub(club: StoredSisterClub) {
  const store = readPartnershipsStore();
  store.customClubs.unshift(club);
  writePartnershipsStore(store);
}

export function updateCustomSisterClub(
  clubId: string,
  updates: Partial<StoredSisterClub>
): StoredSisterClub | null {
  const store = readPartnershipsStore();
  const index = store.customClubs.findIndex((c) => c.id === clubId);
  if (index === -1) return null;

  store.customClubs[index] = {
    ...store.customClubs[index],
    ...updates,
  };

  writePartnershipsStore(store);
  return store.customClubs[index];
}

export function deleteCustomSisterClub(clubId: string): boolean {
  const store = readPartnershipsStore();
  const initialLength = store.customClubs.length;
  store.customClubs = store.customClubs.filter((c) => c.id !== clubId);

  // Cascade delete initiatives for this club
  store.initiatives = store.initiatives.filter((i) => i.sisterClubId !== clubId);

  if (store.customClubs.length !== initialLength) {
    writePartnershipsStore(store);
    return true;
  }
  return false;
}

// Initiative Mutators
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
