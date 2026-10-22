import { createAdminClient } from "@/lib/supabase/admin";
import {
  readPartnershipsStore,
  StoredInitiative,
  InitiativeStatus,
} from "@/lib/data/partnerships-storage";

export * from "@/lib/data/partnerships-types";

export interface SisterClubDTO {
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
  initiatives?: StoredInitiative[];
}

export const FALLBACK_SISTER_CLUBS: SisterClubDTO[] = [
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
    initiatives: [
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
    ],
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
    initiatives: [
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
    ],
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
    initiatives: [
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
    ],
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
    initiatives: [
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
    ],
  },
];

export async function getSisterClubsList(clubId = "00000000-0000-0000-0000-000000000001"): Promise<SisterClubDTO[]> {
  const store = readPartnershipsStore();
  let baseClubs: SisterClubDTO[] = [];

  try {
    const admin = createAdminClient();

    const { data: rows, error } = await admin
      .from("sister_clubs")
      .select(`
        id,
        partner_club_name,
        district,
        country,
        partnership_type,
        agreement_signed_date,
        renewal_date,
        liaison_officer_name,
        liaison_email,
        liaison_phone,
        status,
        notes,
        partnership_initiatives ( id, title, description, joint_volunteer_count, created_at, status )
      `)
      .eq("home_club_id", clubId)
      .order("created_at", { ascending: false });

    if (!error && rows && rows.length > 0) {
      baseClubs = rows.map((r: any) => ({
        id: r.id,
        partnerClubName: r.partner_club_name,
        district: r.district,
        country: r.country,
        partnershipType: r.partnership_type,
        agreementSignedDate: r.agreement_signed_date || "",
        renewalDate: r.renewal_date || "",
        liaisonOfficerName: r.liaison_officer_name || "",
        liaisonEmail: r.liaison_email || "",
        liaisonPhone: r.liaison_phone || "",
        status: r.status,
        notes: r.notes || "",
        initiativesCount: Array.isArray(r.partnership_initiatives) ? r.partnership_initiatives.length : 0,
        initiatives: Array.isArray(r.partnership_initiatives)
          ? r.partnership_initiatives.map((i: any) => ({
              id: i.id,
              sisterClubId: r.id,
              title: i.title,
              description: i.description || "",
              jointVolunteers: i.joint_volunteer_count || 0,
              rotaryYear: "2026-27",
              status: (i.status as InitiativeStatus) || "IN_PROGRESS",
              createdAt: i.created_at,
            }))
          : [],
      }));
    }
  } catch {
    // If Supabase query fails, proceed with fallback
  }

  // If no Supabase records found, use fallback
  if (baseClubs.length === 0) {
    baseClubs = [...FALLBACK_SISTER_CLUBS];
  }

  // Merge with custom clubs from store
  for (const custom of store.customClubs) {
    if (!baseClubs.some((c) => c.id === custom.id)) {
      baseClubs.unshift({
        ...custom,
        initiatives: [],
      });
    }
  }

  // Merge custom initiatives from store into clubs
  return baseClubs.map((club) => {
    const clubStoreInitiatives = store.initiatives.filter((i) => i.sisterClubId === club.id);
    const existingInitiatives = club.initiatives || [];

    // Filter out duplicates if any
    const uniqueStoreInitiatives = clubStoreInitiatives.filter(
      (si) => !existingInitiatives.some((ei) => ei.id === si.id)
    );

    const combinedInitiatives = [...uniqueStoreInitiatives, ...existingInitiatives];

    return {
      ...club,
      initiativesCount: combinedInitiatives.length,
      initiatives: combinedInitiatives,
    };
  });
}
