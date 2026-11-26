import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import {
  processClaimedDeliveries,
  type DeliveryRow,
} from "@/lib/services/notifications/dispatch";
import {
  evaluateDeadlineAndSlaNotifications,
  type SlaEvaluationSummary,
} from "@/lib/services/notifications/sla-reminders";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized cron execution." }, { status: 401 });
  }

  let slaBreakdown: SlaEvaluationSummary;
  try {
    slaBreakdown = await evaluateDeadlineAndSlaNotifications(
      env.NEXT_PUBLIC_DEFAULT_CLUB_ID,
      { deferDelivery: true },
    );
  } catch (error) {
    console.error("Could not prepare scheduled SLA & deadline reminders:", error instanceof Error ? error.message : "Unknown error");
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
    remindersQueued: slaBreakdown.totalCreated,
    slaBreakdown,
    sent: statuses.filter((status) => status === "SENT").length,
    skipped: statuses.filter((status) => status === "SKIPPED").length,
    queued: statuses.filter((status) => status === "QUEUED").length,
    failed: statuses.filter((status) => status === "FAILED").length,
  });
}
