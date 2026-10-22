import { createAdminClient } from "@/lib/supabase/admin";
import {
  readPartnershipsStore,
  StoredInitiative,
  StoredSisterClub,
  InitiativeStatus,
  SisterClubDTO,
} from "@/lib/data/partnerships-storage";

export * from "@/lib/data/partnerships-types";

export async function getSisterClubsList(
  clubId = "00000000-0000-0000-0000-000000000001"
): Promise<SisterClubDTO[]> {
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
    // If Supabase query fails, proceed with persistent store
  }

  // If no Supabase records found, use persistent store customClubs
  if (baseClubs.length === 0) {
    baseClubs = store.customClubs.map((c) => ({
      ...c,
      initiatives: [],
    }));
  } else {
    // Merge any store custom clubs that are not in Supabase
    for (const custom of store.customClubs) {
      if (!baseClubs.some((c) => c.id === custom.id)) {
        baseClubs.unshift({
          ...custom,
          initiatives: [],
        });
      }
    }
  }

  // Attach all initiatives from persistent store to each club
  return baseClubs.map((club) => {
    const clubStoreInitiatives = store.initiatives.filter((i) => i.sisterClubId === club.id);
    const existingInitiatives = club.initiatives || [];

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
