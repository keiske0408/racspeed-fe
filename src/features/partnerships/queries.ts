import { createAdminClient } from "@/lib/supabase/admin";
import {
  readPartnershipsStore,
  StoredInitiative,
  InitiativeStatus,
  SisterClubDTO,
} from "@/lib/data/partnerships-storage";

export * from "@/lib/data/partnerships-types";

export async function getSisterClubsList(
  clubId = "00000000-0000-0000-0000-000000000001",
): Promise<SisterClubDTO[]> {
  const store = readPartnershipsStore();
  let baseClubs: SisterClubDTO[] = [];
  let linkedActivityInitiatives: StoredInitiative[] = [];

  try {
    const admin = createAdminClient();

    const { data: rows, error } = await admin
      .from("sister_clubs")
      .select(
        `
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
        notes
      `,
      )
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
        initiativesCount: 0,
        initiatives: [],
      }));
    }

    const { data: linkedProjects } = await admin
      .from("activity_partners")
      .select(
        `
        sister_club_id,
        name,
        activities!inner(
          id,
          title,
          short_description,
          status,
          rotary_year,
          created_at,
          activity_rsvps(response)
        )
      `,
      )
      .eq("activities.club_id", clubId)
      .in("activities.kind", ["JOINT_PROJECT", "SERVICE_PROJECT"]);

    if (linkedProjects?.length) {
      linkedActivityInitiatives = linkedProjects.map((row: any) => {
        const activity = row.activities;
        const status: InitiativeStatus =
          activity.status === "ACCOMPLISHED" || activity.status === "COMPLETED"
            ? "COMPLETED"
            : activity.status === "CANCELLED"
              ? "CANCELLED"
              : activity.status === "DRAFT" || activity.status === "PLANNED"
                ? "PROPOSED"
                : "IN_PROGRESS";
        return {
          id: activity.id,
          activityId: activity.id,
          sisterClubId: row.sister_club_id || "",
          partnerName: row.name,
          source: "ACTIVITY" as const,
          title: activity.title,
          description: activity.short_description || "",
          jointVolunteers: (activity.activity_rsvps || []).filter(
            (rsvp: { response: string }) => rsvp.response === "GOING",
          ).length,
          rotaryYear: activity.rotary_year || "2026-27",
          status,
          createdAt: activity.created_at,
        } satisfies StoredInitiative;
      });
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

  return baseClubs.map((club) => {
    const clubActivities = linkedActivityInitiatives.filter(
      (activity) =>
        activity.sisterClubId === club.id ||
        (!activity.sisterClubId &&
          activity.partnerName?.trim().toLowerCase() ===
            club.partnerClubName.trim().toLowerCase()),
    );
    const initiatives = clubActivities.filter(
      (initiative, index, all) =>
        all.findIndex((candidate) => candidate.id === initiative.id) === index,
    );
    return { ...club, initiatives, initiativesCount: initiatives.length };
  });

}
