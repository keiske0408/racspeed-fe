import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { rotaryYearFor } from "@/lib/utils/rotary-year";
import { earnedBadgeKeys, rewardPoints } from "./rewards-core";

export { DEFAULT_REWARD_POINTS, earnedBadgeKeys, rewardPoints } from "./rewards-core";
export type { RewardSourceType } from "./rewards-core";

export async function awardEngagementPoints(input: {
  clubId: string;
  profileId: string;
  sourceType: "CHECK_IN" | "SERVICE_CHECK_IN" | "RSVP_HONORED" | "NO_SHOW" | "TASK_COMPLETED";
  sourceId: string;
  reason: string;
  rotaryYear?: string;
}) {
  try {
    const admin = createAdminClient();
    const { data: settings } = await admin
      .from("app_settings")
      .select("engagement_points_config")
      .eq("club_id", input.clubId)
      .maybeSingle();
    const config = settings?.engagement_points_config as Record<string, unknown> | null;
    const points = rewardPoints(input.sourceType, config);
    const rotaryYear = input.rotaryYear || rotaryYearFor();

    const { data: award, error } = await admin
      .from("engagement_points_ledger")
      .insert({
        club_id: input.clubId,
        profile_id: input.profileId,
        source_type: input.sourceType,
        source_id: input.sourceId,
        points,
        reason: input.reason,
        rotary_year: rotaryYear,
      })
      .select("id")
      .maybeSingle();

    if (error?.code === "23505") return { awarded: false, points: 0 };
    if (error || !award) {
      console.warn("Could not award engagement points:", error?.message);
      return { awarded: false, points: 0 };
    }

    await refreshMemberBadges(input.clubId, input.profileId);
    return { awarded: true, points };
  } catch (error) {
    console.warn("Could not award engagement points:", error);
    return { awarded: false, points: 0 };
  }
}

async function refreshMemberBadges(clubId: string, profileId: string) {
  const admin = createAdminClient();
  const { data: ledger } = await admin
    .from("engagement_points_ledger")
    .select("source_type")
    .eq("club_id", clubId)
    .eq("profile_id", profileId);
  const rows = ledger || [];
  const stats = {
    checkIns: rows.filter((row) => row.source_type === "CHECK_IN" || row.source_type === "SERVICE_CHECK_IN").length,
    serviceCheckIns: rows.filter((row) => row.source_type === "SERVICE_CHECK_IN").length,
    completedTasks: rows.filter((row) => row.source_type === "TASK_COMPLETED").length,
  };
  const keys = earnedBadgeKeys(stats);
  if (keys.length === 0) return;

  const { data: badges } = await admin.from("badges").select("id, key").in("key", keys);
  if (!badges?.length) return;
  await admin.from("member_badges").upsert(
    badges.map((badge) => ({ profile_id: profileId, badge_id: badge.id, club_id: clubId })),
    { onConflict: "profile_id,badge_id", ignoreDuplicates: true }
  );
}

export interface LeaderboardEntry {
  profileId: string;
  fullName: string;
  points: number;
}

export async function getEngagementLeaderboard(clubId: string, rotaryYear = rotaryYearFor(), limit = 5): Promise<LeaderboardEntry[]> {
  try {
    const { data, error } = await createAdminClient()
      .from("engagement_points_ledger")
      .select("profile_id, points, profiles(full_name)")
      .eq("club_id", clubId)
      .eq("rotary_year", rotaryYear);
    if (error || !data) return [];

    const totals = new Map<string, LeaderboardEntry>();
    for (const row of data) {
      const profile = row.profiles as unknown as { full_name: string | null } | null;
      const entry = totals.get(row.profile_id) || {
        profileId: row.profile_id,
        fullName: profile?.full_name || "Club Member",
        points: 0,
      };
      entry.points += Number(row.points || 0);
      totals.set(row.profile_id, entry);
    }
    return Array.from(totals.values()).sort((a, b) => b.points - a.points).slice(0, limit);
  } catch (error) {
    console.warn("Could not load engagement leaderboard:", error);
    return [];
  }
}