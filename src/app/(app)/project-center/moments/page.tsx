import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { assertPageAccess } from "@/lib/auth/session";
import { listActivities } from "@/features/activities/queries";
import { ActivityMoments } from "../_components/activity-moments";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Project Moments — Racspeed",
  description: "Photo documentation across club projects and activities.",
};

export default async function ProjectMomentsPage() {
  const context = await assertPageAccess("project-center");
  const clubId =
    process.env.NEXT_PUBLIC_DEFAULT_CLUB_ID ||
    "00000000-0000-0000-0000-000000000001";
  const canManageClub =
    context.isPlatformAdmin ||
    context.permissions.has("EVENT_UPDATE") ||
    context.permissions.has("PROJECT_UPDATE");

  const activities = await listActivities(clubId, context.user.id, {
    includeDrafts: canManageClub,
  });

  return (
    <main className="space-y-5 pb-12">
      <div>
        <Link
          href="/project-center"
          className="inline-flex min-h-[44px] items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#0D3594] dark:text-slate-400 dark:hover:text-blue-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Back to Project Center</span>
        </Link>
        <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-400">
          Club operations
        </p>
        <h1 className="mt-1 text-2xl font-bold text-[#111625] dark:text-white">
          Project Moments
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Recent event photo documentation and service highlights across the club.
        </p>
      </div>

      <ActivityMoments activities={activities.filter((a) => !a.isArchived)} />
    </main>
  );
}

