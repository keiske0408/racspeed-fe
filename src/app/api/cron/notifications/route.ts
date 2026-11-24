import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import {
  processClaimedDeliveries,
  type DeliveryRow,
} from "@/lib/services/notifications/dispatch";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchNotification } from "@/lib/services/notifications/dispatch";

interface ActivityReminderRow {
  id: string;
  title: string;
  start_at: string;
  activity_rsvps: { profile_id: string; response: string }[] | null;
}

async function queueUpcomingActivityReminders() {
  const admin = createAdminClient();
  const now = new Date();
  const { data: activities, error } = await admin
    .from("activities")
    .select("id, title, start_at, activity_rsvps(profile_id, response)")
    .eq("club_id", env.NEXT_PUBLIC_DEFAULT_CLUB_ID)
    .eq("status", "PLANNED")
    .eq("is_published", true)
    .gte("start_at", now.toISOString())
    .lte("start_at", new Date(now.getTime() + 24 * 60 * 60_000).toISOString());
  if (error) throw new Error(`Could not load upcoming activities: ${error.message}`);

  let queued = 0;
  for (const activity of (activities || []) as ActivityReminderRow[]) {
    const going = new Set(
      (activity.activity_rsvps || [])
        .filter((rsvp) => rsvp.response === "GOING")
        .map((rsvp) => rsvp.profile_id),
    );
    for (const profileId of going) {
      try {
        const result = await dispatchNotification({
          profileId,
          clubId: env.NEXT_PUBLIC_DEFAULT_CLUB_ID,
          type: "ACTIVITY_REMINDER",
          title: "Upcoming activity reminder",
          message: `${activity.title} starts within the next 24 hours. Review the event details before attending.`,
          linkUrl: `/project-center/${activity.id}`,
          dedupeKey: `activity-reminder-24h:${activity.id}:${profileId}`,
          sendEmail: true,
          sendPush: true,
          sendTelegram: true,
          deferDelivery: true,
        });
        if (result.created) queued += 1;
      } catch (dispatchError) {
        console.error("Could not queue activity reminder", {
          activityId: activity.id,
          profileId,
          error: dispatchError instanceof Error ? dispatchError.message : "Unknown error",
        });
      }
    }
  }
  return queued;
}

export async function POST(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized cron execution." }, { status: 401 });
  }

  let remindersQueued: number;
  try {
    remindersQueued = await queueUpcomingActivityReminders();
  } catch (error) {
    console.error("Could not prepare scheduled activity reminders:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Could not prepare scheduled reminders." }, { status: 500 });
  }

  const { data, error } = await createAdminClient().rpc(
    "claim_notification_deliveries",
    { batch_size: 100 },
  );
  if (error) {
    console.error("Could not claim notification deliveries:", error.message);
    return NextResponse.json({ error: "Could not process notification queue." }, { status: 500 });
  }

  const deliveries = (data || []) as DeliveryRow[];
  const statuses = await processClaimedDeliveries(deliveries);
  return NextResponse.json({
    claimed: deliveries.length,
    remindersQueued,
    sent: statuses.filter((status) => status === "SENT").length,
    skipped: statuses.filter((status) => status === "SKIPPED").length,
    queued: statuses.filter((status) => status === "QUEUED").length,
    failed: statuses.filter((status) => status === "FAILED").length,
  });
}
