import { createAdminClient } from "@/lib/supabase/admin";
import { OnboardingStage } from "@/lib/services/workflows/onboarding";

export interface ProspectDTO {
  id: string;
  name: string;
  email: string;
  phone: string;
  stage: OnboardingStage;
  recruiter: string;
  notes: string;
}

export async function getProspectsList(clubId = "00000000-0000-0000-0000-000000000001"): Promise<ProspectDTO[]> {
  try {
    const adminClient = createAdminClient();

    const { data: rawProspects, error } = await adminClient
      .from("prospects")
      .select(`
        id,
        full_name,
        email,
        phone,
        stage,
        notes,
        profiles!prospects_recruiter_id_fkey (
          full_name,
          email
        )
      `)
      .eq("club_id", clubId)
      .order("created_at", { ascending: false });

    if (error || !rawProspects) {
      console.warn("Could not query prospects from Supabase:", error?.message);
      return [];
    }

    return rawProspects.map((p) => {
      const recruiter = p.profiles as any;
      let stage: OnboardingStage = "PROSPECT";
      if (p.stage === "ATTENDED_ORIENTATION") stage = "ATTENDED_ORIENTATION";
      else if (p.stage === "ATTENDED_FIRST_SERVICE_PROJECT") stage = "ATTENDED_FIRST_SERVICE_PROJECT";
      else if (p.stage === "READY_FOR_INDUCTION") stage = "READY_FOR_INDUCTION";

      return {
        id: p.id,
        name: p.full_name,
        email: p.email || "",
        phone: p.phone || "",
        stage,
        recruiter: recruiter?.full_name || "Club Officer",
        notes: p.notes || "",
      };
    });
  } catch (err) {
    console.error("Error in getProspectsList:", err);
    return [];
  }
}
