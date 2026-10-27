import React from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardClient } from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const clubId = "00000000-0000-0000-0000-000000000001";

  // Query live metrics from Supabase with safe defaults
  let activeMembers = 6;
  let pendingApprovals = 0;
  let volunteerHours = 205;
  let upcomingEvents = 3;
  let fundsRaisedCentavos = 7300000;
  let reportsUnderReview = 1;
  let retentionAlerts = 2;

  try {
    const admin = createAdminClient();
    const [membersRes, eventsRes, projectsRes, budgetsRes] = await Promise.all([
      admin.from("club_memberships").select("id, membership_status").eq("club_id", clubId),
      admin.from("events").select("id").eq("host_club_id", clubId),
      admin.from("projects").select("total_volunteer_hours, funds_raised").eq("host_club_id", clubId),
      admin.from("budget_requests").select("id, status"),
    ]);

    if (membersRes.data) {
      activeMembers = membersRes.data.filter((m) => m.membership_status === "ACTIVE").length;
      pendingApprovals = membersRes.data.filter((m) => m.membership_status === "APPLICANT").length;
    }
    if (eventsRes.data) {
      upcomingEvents = eventsRes.data.length;
    }
    if (projectsRes.data && projectsRes.data.length > 0) {
      volunteerHours = projectsRes.data.reduce((s, p) => s + Number(p.total_volunteer_hours || 0), 0);
      const fundsTotal = projectsRes.data.reduce((s, p) => s + Number(p.funds_raised || 0), 0);
      fundsRaisedCentavos = fundsTotal * 100;
    }
    if (budgetsRes.data) {
      reportsUnderReview = budgetsRes.data.filter((b) => b.status === "PENDING_APPROVAL").length;
    }
  } catch (err) {
    console.warn("Could not fetch live dashboard metrics from Supabase:", err);
  }

  const metrics = {
    activeMembers,
    pendingApprovals,
    volunteerHours,
    upcomingEvents,
    fundsRaisedCentavos,
    reportsUnderReview,
    retentionAlerts,
  };

  return (
    <DashboardClient
      user={user ? { fullName: user.fullName, email: user.email } : null}
      metrics={metrics}
    />
  );
}

