import { createAdminClient } from "@/lib/supabase/admin";
import { readTasksStore } from "@/lib/data/tasks-storage";

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
  verifiedHours?: number;
  verifiedAttendees?: number;
  linkedTasksCount?: number;
  completedTasksCount?: number;
}

export async function getProjectsList(clubId = "00000000-0000-0000-0000-000000000001"): Promise<ProjectDTO[]> {
  try {
    const adminClient = createAdminClient();

    const [projectsRes, eventsRes] = await Promise.all([
      adminClient
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
        .order("created_at", { ascending: false }),
      adminClient
        .from("events")
        .select(`
          id,
          title,
          event_category,
          volunteer_hours_default,
          attendance_records (
            id,
            volunteer_hours,
            attended
          )
        `)
        .eq("host_club_id", clubId),
    ]);

    const rawProjects = projectsRes.data;
    if (projectsRes.error || !rawProjects) {
      console.warn("Could not query projects from Supabase:", projectsRes.error?.message);
      return [];
    }

    const events = eventsRes.data || [];
    let tasks: any[] = [];
    try {
      tasks = readTasksStore();
    } catch {}

    return rawProjects.map((p) => {
      let status: ProjectDTO["status"] = "APPROVED";
      if (p.status === "ONGOING") status = "ONGOING";
      else if (p.status === "COMPLETED") status = "COMPLETED";
      else if (p.status === "DRAFT") status = "DRAFT";

      // Match linked events by keyword or direct connection
      const pKeywords = p.title.toLowerCase().split(/\s+/).filter((w: string) => w.length > 4);
      const matchingEvents = events.filter((ev: any) => {
        const evTitle = ev.title.toLowerCase();
        return pKeywords.some((kw: string) => evTitle.includes(kw));
      });

      let verifiedHours = 0;
      let verifiedAttendees = 0;
      for (const ev of matchingEvents) {
        const recs = (ev.attendance_records as any[]) || [];
        verifiedAttendees += recs.filter((r) => r.attended).length;
        verifiedHours += recs.reduce(
          (sum, r) => sum + Number(r.volunteer_hours || ev.volunteer_hours_default || 0),
          0
        );
      }

      // Match linked tasks from Task Center
      const linkedTasks = tasks.filter(
        (t) =>
          (t.projectId && t.projectId === p.id) ||
          (t.projectTitle && t.projectTitle.toLowerCase().includes(p.title.toLowerCase().slice(0, 15)))
      );
      const completedTasks = linkedTasks.filter((t) => t.status === "COMPLETED");

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
        verifiedHours: verifiedHours > 0 ? verifiedHours : undefined,
        verifiedAttendees: verifiedAttendees > 0 ? verifiedAttendees : undefined,
        linkedTasksCount: linkedTasks.length > 0 ? linkedTasks.length : undefined,
        completedTasksCount: linkedTasks.length > 0 ? completedTasks.length : undefined,
      };
    });
  } catch (err) {
    console.error("Error in getProjectsList:", err);
    return [];
  }
}
