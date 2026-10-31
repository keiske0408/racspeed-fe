import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { evaluateMemberEngagement, type AttendanceRecordLike } from "@/lib/services/engagement";
import { manilaDateKey } from "@/lib/utils/dates";
import { dispatchNotification } from "@/lib/services/notifications/dispatch";

const DEFAULT_CLUB_ID = "00000000-0000-0000-0000-000000000001";

interface ActivityAttendanceRow {
  profile_id: string;
  attended: boolean;
  is_excused: boolean;
}

interface ActivityRsvpRow {
  profile_id: string;
  response: "GOING" | "MAYBE" | "NOT_GOING";
}

interface RetentionActivityRow {
  id: string;
  kind: string;
  title: string;
  meeting_type: string | null;
  start_at: string;
  end_at: string;
  status: string;
  owner_id: string | null;
  min_members_required: number | null;
  attendance_records: ActivityAttendanceRow[] | null;
  activity_rsvps: ActivityRsvpRow[] | null;
}

interface MinimumRsvpActivityRow {
  id: string;
  title: string;
  owner_id: string | null;
  min_members_required: number | null;
  activity_rsvps: { response: string }[] | null;
}

interface RetentionMembershipRow {
  profile_id: string;
  membership_status: string;
  joined_date: string | null;
  profiles: { status: string; full_name: string; email: string } | null;
  membership_roles: { roles: { key: string } | null }[] | null;
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized cron execution." }, { status: 401 });
  }

  const todayKey = manilaDateKey(new Date());
  const runKey = `retention-check-${todayKey}`;

  try {
    const adminSupabase = createAdminClient();
    const clubId = process.env.NEXT_PUBLIC_DEFAULT_CLUB_ID || DEFAULT_CLUB_ID;

    // Check idempotency: If already executed today, return immediately
    const { data: existingRun } = await adminSupabase
      .from("scheduled_job_runs")
      .select("id, status")
      .eq("run_key", runKey)
      .maybeSingle();

    if (existingRun && existingRun.status === "SUCCESS") {
      return NextResponse.json({
        message: "Job already executed successfully today. Skipped to prevent duplicate alerts.",
        runKey,
      });
    }

    // Record job start
    const { error: runStartError } = await adminSupabase.from("scheduled_job_runs").upsert({
      job_name: "retention-check",
      run_key: runKey,
      status: "RUNNING",
      started_at: new Date().toISOString(),
    }, { onConflict: "run_key" });
    if (runStartError) throw new Error(`Could not start retention job: ${runStartError.message}`);

    const now = new Date();
    const [{ data: memberships, error: memberError }, { data: activities, error: activityError }, { data: settings }, { data: upcomingMinimums, error: minimumError }] = await Promise.all([
      adminSupabase
        .from("club_memberships")
        .select("profile_id, membership_status, joined_date, profiles!inner(status, full_name, email), membership_roles(roles(key))")
        .eq("club_id", clubId)
        .in("membership_status", ["ACTIVE", "ASPIRANT"]),
      adminSupabase
        .from("activities")
        .select("id, kind, title, meeting_type, start_at, end_at, status, owner_id, min_members_required, attendance_records(profile_id, attended, is_excused), activity_rsvps(profile_id, response)")
        .eq("club_id", clubId)
        .lte("end_at", now.toISOString())
        .not("status", "in", "(CANCELLED,DRAFT)"),
      adminSupabase.from("app_settings").select("retention_consecutive_gas_threshold, retention_service_days_threshold").eq("club_id", clubId).maybeSingle(),
      adminSupabase
        .from("activities")
        .select("id, title, owner_id, min_members_required, activity_rsvps(response)")
        .eq("club_id", clubId)
        .gte("start_at", now.toISOString())
        .lte("start_at", new Date(now.getTime() + 48 * 60 * 60_000).toISOString())
        .not("min_members_required", "is", null)
        .eq("status", "PLANNED"),
    ]);
    if (memberError) throw new Error(`Could not load club members: ${memberError.message}`);
    if (activityError) throw new Error(`Could not load activity attendance: ${activityError.message}`);
    if (minimumError) throw new Error(`Could not load minimum member RSVP counts: ${minimumError.message}`);

    const completedActivities = (activities || []) as unknown as RetentionActivityRow[];
    const deliveryResults: Promise<unknown>[] = [];
    for (const activity of completedActivities) {
      if (!["PLANNED", "ONGOING"].includes(activity.status)) continue;
      const nextStatus = ["SERVICE_PROJECT", "JOINT_PROJECT"].includes(activity.kind) ? "AWAITING_REPORT" : "COMPLETED";
      const { error: statusError } = await adminSupabase
        .from("activities")
        .update({ status: nextStatus, updated_at: now.toISOString() })
        .eq("id", activity.id)
        .in("status", ["PLANNED", "ONGOING"]);
      if (statusError) throw new Error(`Could not close activity ${activity.id}: ${statusError.message}`);
      activity.status = nextStatus;
      await adminSupabase.from("activity_log").insert({
        activity_id: activity.id,
        action: "STATUS_AUTOMATED",
        details: { status: nextStatus },
      });
      if (nextStatus === "AWAITING_REPORT" && activity.owner_id) {
        deliveryResults.push(dispatchNotification({
          profileId: activity.owner_id,
          clubId,
          type: "REPORT_DUE",
          title: "Your service project is ready for its report",
          message: `Complete the service project details and photos for ${activity.title} so it can be published as accomplished.`,
          linkUrl: `/project-center/${activity.id}?tab=REPORT`,
          dedupeKey: `report-due:${activity.id}`,
        }));
      }
    }

    for (const activity of (upcomingMinimums || []) as unknown as MinimumRsvpActivityRow[]) {
      const minimum = activity.min_members_required || 0;
      const going = activity.activity_rsvps?.filter((rsvp) => rsvp.response === "GOING").length || 0;
      if (!activity.owner_id || !minimum || going >= minimum) continue;
      deliveryResults.push(dispatchNotification({
        profileId: activity.owner_id,
        clubId,
        type: "MIN_MEMBERS_ALERT",
        title: "This activity is below its member minimum",
        message: `${activity.title} has ${going} members going and needs ${minimum}. Consider inviting more members or adjusting the activity plan.`,
        linkUrl: `/project-center/${activity.id}`,
        dedupeKey: `minimum-members:${activity.id}`,
      }));
    }

    const activeMembers = ((memberships || []) as unknown as RetentionMembershipRow[])
      .filter((member) => member.profiles?.status === "ACTIVE");
    const byProfile = new Map<string, {
      profileId: string;
      name: string;
      email: string;
      joinedDate: string | null;
      records: AttendanceRecordLike[];
    }>();

    for (const member of activeMembers) {
      byProfile.set(member.profile_id, {
        profileId: member.profile_id,
        name: member.profiles?.full_name || "Club Member",
        email: member.profiles?.email || "",
        joinedDate: member.joined_date,
        records: [],
      });
    }

    for (const activity of completedActivities) {
      const eventType = getEngagementEventType(activity);
      for (const member of byProfile.values()) {
        const attendance = activity.attendance_records?.find((record) => record.profile_id === member.profileId);
        const rsvp = activity.activity_rsvps?.find((response) => response.profile_id === member.profileId);
        member.records.push({
          eventId: activity.id,
          eventType,
          eventDate: new Date(activity.start_at),
          attended: Boolean(attendance?.attended),
          isExcused: Boolean(attendance?.is_excused),
          rsvpResponse: rsvp?.response || null,
        });
      }
    }

    const flagged: { profileId: string; name: string; reasons: string[] }[] = [];
    for (const member of byProfile.values()) {
      const engagement = evaluateMemberEngagement(member.records, now, {
        consecutiveGaThreshold: settings?.retention_consecutive_gas_threshold ?? 3,
        serviceDaysThreshold: settings?.retention_service_days_threshold ?? 60,
        memberSince: member.joinedDate ? new Date(member.joinedDate) : undefined,
      });
      if (!engagement.isFlagged) continue;
      flagged.push({ profileId: member.profileId, name: member.name, reasons: engagement.reasons });
      deliveryResults.push(dispatchNotification({
        profileId: member.profileId,
        clubId,
        type: "RETENTION_NUDGE",
        title: "We would love to see you again",
        message: "It has been a while since we saw you at a club meeting or service activity. We hope you are doing well. See what is coming up and let us know how we can support your return.",
        linkUrl: "/project-center?view=calendar",
        dedupeKey: `retention:${todayKey}:${member.profileId}`,
      }));
    }

    const officers = activeMembers.filter((member) => {
      const roleKeys = member.membership_roles?.map((role) => role.roles?.key) || [];
      return roleKeys.includes("MEMBERSHIP_CHAIR") || roleKeys.includes("PRESIDENT");
    });
    if (flagged.length > 0) {
      const digestMessage = `${flagged.length} member${flagged.length === 1 ? "" : "s"} may appreciate a personal check-in: ${flagged.map((member) => member.name).join(", ")}. Please review the retention queue.`;
      for (const officer of officers) {
        deliveryResults.push(dispatchNotification({
          profileId: officer.profile_id,
          clubId,
          type: "ATTENDANCE_ALERT",
          title: "Daily member engagement review",
          message: digestMessage,
          linkUrl: "/retention-alerts",
          dedupeKey: `retention-digest:${todayKey}:${officer.profile_id}`,
        }));
      }
    }
    await Promise.all(deliveryResults);

    const { error: runCompleteError } = await adminSupabase.from("scheduled_job_runs").update({
      status: "SUCCESS",
      finished_at: new Date().toISOString(),
      records_processed: activeMembers.length,
      details: { flaggedMembers: flagged.length, completedActivities: completedActivities.length },
    }).eq("run_key", runKey);
    if (runCompleteError) throw new Error(`Could not complete retention job: ${runCompleteError.message}`);

    return NextResponse.json({
      success: true,
      job: "retention-check",
      runKey,
      membersEvaluated: activeMembers.length,
      membersFlagged: flagged.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    try {
      await createAdminClient().from("scheduled_job_runs").update({
        status: "FAILED",
        finished_at: new Date().toISOString(),
        details: { error: err instanceof Error ? err.message : "Unknown error" },
      }).eq("run_key", runKey);
    } catch (auditError) {
      console.error("Could not mark retention job failed:", auditError);
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "Cron job execution failed" }, { status: 500 });
  }
}

function getEngagementEventType(activity: RetentionActivityRow): "GENERAL_ASSEMBLY" | "SERVICE_PROJECT" | "FELLOWSHIP" | "DISTRICT" | "OTHER" {
  if (activity.kind === "MEETING" && activity.meeting_type === "GENERAL_ASSEMBLY") return "GENERAL_ASSEMBLY";
  if (["SERVICE_PROJECT", "JOINT_PROJECT"].includes(activity.kind)) return "SERVICE_PROJECT";
  if (activity.kind === "FELLOWSHIP") return "FELLOWSHIP";
  if (activity.kind === "DISTRICT_EVENT") return "DISTRICT";
  return "OTHER";
}

