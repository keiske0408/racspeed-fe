import React from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { listActivities } from "@/features/activities/queries";
import { getEngagementLeaderboard } from "@/lib/services/rewards";
import { rotaryYearFor } from "@/lib/utils/rotary-year";
import { DashboardV2Client } from "./dashboard-v2-client";

export const dynamic = "force-dynamic";

interface DashboardInvoiceRow {
  invoice_items: { amount: number | string; quantity: number | string }[] | null;
  payment_allocations: { allocated_amount: number | string }[] | null;
}

interface DashboardReportRow {
  projects: { host_club_id: string } | null;
  activities: { club_id: string } | null;
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const clubId = process.env.NEXT_PUBLIC_DEFAULT_CLUB_ID || "00000000-0000-0000-0000-000000000001";
  const now = new Date();
  const rotaryYear = rotaryYearFor(now);
  const admin = createAdminClient();

  const [activities, membersRes, duesRes, reportsRes, budgetsRes, retentionRes, leaderboard] = await Promise.all([
    listActivities(clubId, user?.id || ""),
    admin.from("club_memberships").select("id, membership_status").eq("club_id", clubId),
    user
      ? admin
          .from("invoices")
          .select("id, status, invoice_items(amount, quantity), payment_allocations(allocated_amount)")
          .eq("club_id", clubId)
          .eq("profile_id", user.id)
          .in("status", ["ISSUED", "PARTIALLY_PAID"])
      : Promise.resolve({ data: [], error: null }),
    admin.from("report_submissions").select("id, status, projects(host_club_id), activities(club_id)").in("status", ["SUBMITTED", "UNDER_REVIEW", "REVISION_REQUESTED"]),
    admin.from("budget_requests").select("id, status").eq("club_id", clubId).eq("status", "PENDING_APPROVAL"),
    admin.from("notifications").select("id").eq("club_id", clubId).eq("type", "RETENTION_NUDGE").eq("is_read", false),
    getEngagementLeaderboard(clubId, rotaryYear),
  ]);

  const upcoming = activities.filter((activity) => new Date(activity.startAt) >= now && activity.status !== "CANCELLED").slice(0, 5);
  const highlights = activities
    .filter((activity) => activity.status === "ACCOMPLISHED" && ["SERVICE_PROJECT", "JOINT_PROJECT"].includes(activity.kind))
    .sort((a, b) => b.startAt.localeCompare(a.startAt))
    .slice(0, 4);
  const reportsToReview = ((reportsRes.data || []) as unknown as DashboardReportRow[]).filter((row) =>
    (row.activities?.club_id || row.projects?.host_club_id) === clubId
  ).length;
  const memberships = membersRes.data || [];
  const activeMembers = memberships.filter((member) => member.membership_status === "ACTIVE").length;
  const aspirants = memberships.filter((member) => member.membership_status === "ASPIRANT").length;
  const invoices = (duesRes.data || []) as unknown as DashboardInvoiceRow[];
  const outstandingDues = invoices.reduce((sum, invoice) => {
    const total = (invoice.invoice_items || []).reduce((value, item) => value + Number(item.amount || 0) * Number(item.quantity || 1), 0);
    const paid = (invoice.payment_allocations || []).reduce((value, allocation) => value + Number(allocation.allocated_amount || 0), 0);
    return sum + Math.max(0, total - paid);
  }, 0);

  const metrics = {
    activeMembers,
    aspirants,
    upcomingEvents: upcoming.length,
    reportsToReview,
    pendingBudgets: (budgetsRes.data || []).length,
    retentionAlerts: (retentionRes.data || []).length,
    outstandingDues,
    myPoints: leaderboard.find((entry) => entry.profileId === user?.id)?.points || 0,
  };

  return (
    <DashboardV2Client
      user={user ? { id: user.id, fullName: user.fullName, email: user.email } : null}
      metrics={metrics}
      upcoming={upcoming}
      highlights={highlights}
      leaderboard={leaderboard}
    />
  );
}

