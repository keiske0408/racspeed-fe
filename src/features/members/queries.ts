import { createAdminClient } from "@/lib/supabase/admin";

export interface MemberDTO {
  id: string; // profile ID
  membershipId?: string;
  name: string;
  email: string;
  role: string;
  roleKey: string;
  status: "ACTIVE" | "ASPIRANT" | "PENDING" | "INACTIVE" | "PROBATIONARY" | "ALUMNI";
  joinedDate: string;
  classification: string;
  rotaryId?: string;
  isPlatformAdmin: boolean;
  crmStage?: string;
}

export async function getClubMembersList(clubId = "00000000-0000-0000-0000-000000000001"): Promise<MemberDTO[]> {
  try {
    const adminClient = createAdminClient();

    // 1. Fetch all profiles
    let { data: profiles, error: pErr } = await adminClient
      .from("profiles")
      .select("id, email, full_name, status, is_platform_admin, avatar_url")
      .order("created_at", { ascending: false });

    if (pErr || !profiles) {
      console.warn("Could not fetch profiles from database:", pErr?.message);
      profiles = [];
    }

    // 2. Auto-reconcile: check for any auth.users missing from public.profiles
    try {
      const { data: authUsersData } = await adminClient.auth.admin.listUsers();
      if (authUsersData?.users) {
        const existingProfileIds = new Set(profiles.map((p) => p.id));
        for (const u of authUsersData.users) {
          if (!existingProfileIds.has(u.id)) {
            const rawFullName = (u.user_metadata as any)?.full_name || u.email?.split("@")[0] || "Applicant";
            const { data: newProfile } = await adminClient
              .from("profiles")
              .upsert({
                id: u.id,
                email: u.email || "applicant@rotaract.local",
                full_name: rawFullName,
                status: "PENDING",
                is_platform_admin: false,
              })
              .select("id, email, full_name, status, is_platform_admin, avatar_url")
              .single();

            if (newProfile) {
              profiles.push(newProfile);
              existingProfileIds.add(newProfile.id);
            }
          }
        }
      }
    } catch (authSyncErr) {
      console.warn("Could not auto-reconcile auth users to profiles:", authSyncErr);
    }

    // 3. Fetch all club memberships with associated roles
    const { data: memberships } = await adminClient
      .from("club_memberships")
      .select(`
        id,
        profile_id,
        membership_status,
        classification,
        rotary_id,
        joined_date,
        membership_roles (
          roles (
            id,
            key,
            name
          )
        )
      `)
      .eq("club_id", clubId);

    const membershipMap = new Map((memberships || []).map((m) => [m.profile_id, m]));

    // 4. Fetch prospects to bridge CRM milestones
    const { data: prospects } = await adminClient
      .from("prospects")
      .select("email, stage")
      .eq("club_id", clubId);

    const prospectMap = new Map(
      (prospects || [])
        .filter((pr) => Boolean(pr.email))
        .map((pr) => [pr.email!.toLowerCase(), pr.stage])
    );

    // Filter profiles belonging to this club, pending applicants, or platform admin
    const clubProfiles = profiles.filter(
      (p) => membershipMap.has(p.id) || p.status === "PENDING" || Boolean(p.is_platform_admin)
    );

    return clubProfiles.map((p) => {
      const mem = membershipMap.get(p.id);
      const roleRecord = (mem?.membership_roles as any[])?.[0]?.roles;
      const roleKey = roleRecord?.key || (p.is_platform_admin ? "PRESIDENT" : "GENERAL_MEMBER");
      const roleName = roleRecord?.name || (p.is_platform_admin ? "Club President (Super Admin)" : "General Member");

      let status = (mem?.membership_status || p.status || "ACTIVE") as MemberDTO["status"];
      if (p.status === "PENDING" || (status as string) === "PROSPECTIVE") {
        status = "PENDING";
      }

      const crmStage = prospectMap.get(p.email.toLowerCase());

      return {
        id: p.id,
        membershipId: mem?.id,
        name: p.full_name || p.email.split("@")[0],
        email: p.email,
        role: roleName,
        roleKey,
        status,
        joinedDate: mem?.joined_date || new Date().toISOString().split("T")[0],
        classification: mem?.classification || "Rotaract General",
        rotaryId: mem?.rotary_id || undefined,
        isPlatformAdmin: Boolean(p.is_platform_admin),
        crmStage,
      };
    });
  } catch (err) {
    console.error("Error in getClubMembersList:", err);
    return [];
  }
}
