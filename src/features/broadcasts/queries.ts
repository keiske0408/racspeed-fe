import { getEventsList, EventDTO } from "@/features/events/queries";
import { getProjectsList, ProjectDTO } from "@/features/projects/queries";

export interface BroadcastSourceItem {
  id: string;
  type: "event" | "project";
  title: string;
  category: string;
  dateStr: string;
  timeStr: string;
  callTimeStr: string;
  venue: string;
  volunteerHours: number;
  volunteersConfirmed: number;
  description: string;
}

export async function getBroadcastSourceItems(): Promise<BroadcastSourceItem[]> {
  try {
    const [events, projects] = await Promise.all([
      getEventsList().catch(() => [] as EventDTO[]),
      getProjectsList().catch(() => [] as ProjectDTO[]),
    ]);

    const items: BroadcastSourceItem[] = [];

    // Map Events
    for (const ev of events) {
      let dateStr = "Upcoming Date TBA";
      let timeStr = "8:00 AM – 12:00 PM";
      let callTimeStr = "7:15 AM (Assembly & Briefing)";

      if (ev.startTime) {
        try {
          const d = new Date(ev.startTime);
          dateStr = d.toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            timeZone: "Asia/Manila",
          });
          const startFormatted = d.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
            timeZone: "Asia/Manila",
          });
          const endFormatted = ev.endTime
            ? new Date(ev.endTime).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
                timeZone: "Asia/Manila",
              })
            : "12:00 PM";
          timeStr = `${startFormatted} – ${endFormatted}`;

          // Calculate call time 45 mins earlier
          const callTimeDate = new Date(d.getTime() - 45 * 60 * 1000);
          callTimeStr = `${callTimeDate.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
            timeZone: "Asia/Manila",
          })} (Assembly)`;
        } catch {
          // Keep defaults
        }
      }

      items.push({
        id: ev.id,
        type: "event",
        title: ev.title,
        category: ev.category,
        dateStr,
        timeStr,
        callTimeStr,
        venue: ev.location,
        volunteerHours: ev.volunteerHours,
        volunteersConfirmed: ev.attendeesCount,
        description: ev.description || "",
      });
    }

    // Map Projects
    for (const pr of projects) {
      items.push({
        id: pr.id,
        type: "project",
        title: pr.title,
        category: pr.category,
        dateStr: "Saturday, November 28, 2026",
        timeStr: "8:00 AM – 1:00 PM",
        callTimeStr: "7:15 AM (Pre-briefing)",
        venue: pr.venue || "San Pedro City, Laguna",
        volunteerHours: pr.volunteerHours || 4.0,
        volunteersConfirmed: 8,
        description: pr.summary || "",
      });
    }

    // Fallback items if none found
    if (items.length === 0) {
      items.push(
        {
          id: "demo-event-1",
          type: "event",
          title: "Project Busog Lusog: Community Feeding & Outreach",
          category: "Community Service",
          dateStr: "Saturday, November 14, 2026",
          timeStr: "8:00 AM – 12:00 PM",
          callTimeStr: "7:00 AM (Assembly at Club HQ)",
          venue: "Barangay Cuyab Covered Court, San Pedro City",
          volunteerHours: 4.0,
          volunteersConfirmed: 12,
          description: "Community feeding outreach serving warm meals and gift packs to 150 children.",
        },
        {
          id: "demo-event-2",
          type: "event",
          title: "Project Berdeng Bukas: Watershed Tree Planting",
          category: "Environment",
          dateStr: "Sunday, November 22, 2026",
          timeStr: "6:00 AM – 10:30 AM",
          callTimeStr: "5:30 AM Sharp (Assembly at City Hall)",
          venue: "Mount Banahaw Watershed & Eco-Park",
          volunteerHours: 4.5,
          volunteersConfirmed: 18,
          description: "Tree planting activity with the environment team to reforest local watershed areas.",
        }
      );
    }

    return items;
  } catch (err) {
    console.error("Error loading broadcast sources:", err);
    return [];
  }
}
