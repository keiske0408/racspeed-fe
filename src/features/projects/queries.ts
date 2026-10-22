import { createAdminClient } from "@/lib/supabase/admin";

export interface ProjectDTO {
  id: string;
  title: string;
  category: string;
  areasOfFocus: string[];
  sdgs: number[];
  beneficiaries: number;
  volunteerHours: number;
  fundsRaised: number;
  status: "APPROVED" | "ONGOING" | "COMPLETED" | "DRAFT";
  summary?: string;
  venue?: string;
}

export async function getProjectsList(clubId = "00000000-0000-0000-0000-000000000001"): Promise<ProjectDTO[]> {
  try {
    const adminClient = createAdminClient();

    const { data: rawProjects, error } = await adminClient
      .from("projects")
      .select(`
        id,
        title,
        summary,
        venue,
        beneficiary_count,
        total_volunteer_hours,
        funds_raised,
        status
      `)
      .eq("host_club_id", clubId)
      .order("created_at", { ascending: false });

    if (error || !rawProjects) {
      console.warn("Could not query projects from Supabase:", error?.message);
      return [];
    }

    return rawProjects.map((p) => {
      let status: ProjectDTO["status"] = "APPROVED";
      if (p.status === "ONGOING") status = "ONGOING";
      else if (p.status === "COMPLETED") status = "COMPLETED";
      else if (p.status === "DRAFT") status = "DRAFT";

      return {
        id: p.id,
        title: p.title,
        category: "Community Service",
        areasOfFocus: ["Community Economic Development", "Water, Sanitation & Hygiene"],
        sdgs: [1, 6, 8],
        beneficiaries: Number(p.beneficiary_count || 0),
        volunteerHours: Number(p.total_volunteer_hours || 0),
        fundsRaised: Number(p.funds_raised || 0),
        status,
        summary: p.summary || undefined,
        venue: p.venue || undefined,
      };
    });
  } catch (err) {
    console.error("Error in getProjectsList:", err);
    return [];
  }
}
