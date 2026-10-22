import { createAdminClient } from "@/lib/supabase/admin";

export interface EventDTO {
  id: string;
  title: string;
  category: string;
  location: string;
  startTime: string;
  endTime: string;
  volunteerHours: number;
  attendeesCount: number;
  description?: string;
}

export async function getEventsList(clubId = "00000000-0000-0000-0000-000000000001"): Promise<EventDTO[]> {
  try {
    const adminClient = createAdminClient();
    const { data: events, error } = await adminClient
      .from("events")
      .select(`
        id,
        title,
        description,
        event_category,
        location,
        start_time,
        end_time,
        volunteer_hours_default,
        attendance_records (count)
      `)
      .eq("host_club_id", clubId)
      .order("start_time", { ascending: true });

    if (error || !events) {
      console.warn("Could not query events from Supabase:", error?.message);
      return [];
    }

    return events.map((ev) => {
      const records = (ev.attendance_records as any[]) || [];
      const attendees = records[0]?.count ?? 0;
      return {
        id: ev.id,
        title: ev.title,
        category: (ev.event_category || "SERVICE_PROJECT").replace(/_/g, " "),
        location: ev.location || "Venue TBA",
        startTime: ev.start_time,
        endTime: ev.end_time,
        volunteerHours: Number(ev.volunteer_hours_default || 3.0),
        attendeesCount: attendees,
        description: ev.description || undefined,
      };
    });
  } catch (err) {
    console.error("Error in getEventsList:", err);
    return [];
  }
}
