import { createAdminClient } from "@/lib/supabase/admin";
import { readPartnershipsStore, StoredInitiative } from "@/lib/data/partnerships-storage";

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
    initiativesCount: 5,
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
        partnership_initiatives ( id, title, description, joint_volunteer_count, created_at )
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

  // Merge with custom clubs from store (prepend if not duplicate)
  for (const custom of store.customClubs) {
    if (!baseClubs.some((c) => c.id === custom.id)) {
      baseClubs.unshift(custom);
    }
  }

  // Merge any initiatives recorded in store
  return baseClubs.map((club) => {
    const clubStoreInitiatives = store.initiatives.filter((i) => i.sisterClubId === club.id);
    const existingInitiatives = club.initiatives || [];
    const combinedInitiatives = [...clubStoreInitiatives, ...existingInitiatives];

    return {
      ...club,
      initiativesCount: Math.max(club.initiativesCount, club.initiativesCount + clubStoreInitiatives.length),
      initiatives: combinedInitiatives,
    };
  });
}
