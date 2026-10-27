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

const DEFAULT_EVENTS: EventDTO[] = [
  {
    id: "evt-001",
    title: "Youth Leadership & Public Speaking Boot Camp",
    category: "PROFESSIONAL DEVELOPMENT",
    location: "San Pedro City Hall Auditorium",
    startTime: "2026-10-28T09:00:00Z",
    endTime: "2026-10-28T13:00:00Z",
    volunteerHours: 4.0,
    attendeesCount: 28,
    description: "Interactive workshop for high school and collegiate youth leaders on parliamentary procedure and community mobilization.",
  },
  {
    id: "evt-002",
    title: "Executive Board Strategic Planning Session",
    category: "BOARD MEETING",
    location: "Club Secretariat HQ / Google Meet",
    startTime: "2026-10-30T19:00:00Z",
    endTime: "2026-10-30T21:00:00Z",
    volunteerHours: 2.0,
    attendeesCount: 12,
    description: "Monthly board review evaluating Q2 project liquidations and membership retention intervention plans.",
  },
  {
    id: "evt-003",
    title: "District 3820 Coastal Clean-Up & Mangrove Planting",
    category: "SERVICE PROJECT",
    location: "Brgy. San Antonio Coast, Laguna Bay Area",
    startTime: "2026-11-07T07:00:00Z",
    endTime: "2026-11-07T12:00:00Z",
    volunteerHours: 5.0,
    attendeesCount: 42,
    description: "Joint environmental stewardship action planting 500 mangrove saplings and conducting shoreline waste auditing.",
  },
  {
    id: "evt-004",
    title: "November General Assembly & Fellowship Night",
    category: "GENERAL ASSEMBLY",
    location: "Pacita Complex Activity Hall",
    startTime: "2026-11-14T14:00:00Z",
    endTime: "2026-11-14T18:00:00Z",
    volunteerHours: 3.0,
    attendeesCount: 35,
    description: "Regular club assembly featuring committee reports, induction of 5 new members, and guest speaker on maternal health.",
  },
  {
    id: "evt-005",
    title: "RY 2026-27 Grand Induction & Handover Ball",
    category: "FELLOWSHIP",
    location: "The Monochrome Events Place, Nuvali",
    startTime: "2026-11-21T18:00:00Z",
    endTime: "2026-11-21T23:00:00Z",
    volunteerHours: 3.0,
    attendeesCount: 65,
    description: "Formal gala ceremony charging newly inducted officers and honoring sponsor Rotary Club of San Pedro East partners.",
  },
  {
    id: "evt-006",
    title: "Community Blood Letting Drive (Red Cross San Pedro)",
    category: "SERVICE PROJECT",
    location: "Pacita Complex 1 Covered Court",
    startTime: "2026-11-28T08:00:00Z",
    endTime: "2026-11-28T14:00:00Z",
    volunteerHours: 6.0,
    attendeesCount: 50,
    description: "Annual blood donation campaign in partnership with Philippine Red Cross Laguna Chapter targeting 100 bags.",
  },
  {
    id: "evt-007",
    title: "District Governor Official Club Visit & Citation Review",
    category: "BOARD MEETING",
    location: "San Pedro East Rotary Clubhouse",
    startTime: "2026-12-05T13:00:00Z",
    endTime: "2026-12-05T17:00:00Z",
    volunteerHours: 3.0,
    attendeesCount: 20,
    description: "Official evaluation and presentation of club achievements to District Governor 3820 leadership.",
  },
];

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
      console.warn("Could not query events from Supabase, using defaults:", error?.message);
      return DEFAULT_EVENTS;
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
    console.warn("Using fallback events:", err);
    return DEFAULT_EVENTS;
  }
}
