import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { rotaryYearFor } from "@/lib/utils/rotary-year";
import { earnedBadgeKeys, rewardPoints } from "./rewards-core";

export {
  DEFAULT_REWARD_POINTS,
  earnedBadgeKeys,
  rewardPoints,
} from "./rewards-core";
export type { RewardSourceType } from "./rewards-core";

export async function awardEngagementPoints(input: {
  clubId: string;
  profileId: string;
  sourceType:
    | "CHECK_IN"
    | "SERVICE_CHECK_IN"
    | "RSVP_HONORED"
    | "NO_SHOW"
    | "TASK_COMPLETED";
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
    const config = settings?.engagement_points_config as Record<
      string,
      unknown
    > | null;
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
    checkIns: rows.filter(
      (row) =>
        row.source_type === "CHECK_IN" ||
        row.source_type === "SERVICE_CHECK_IN",
    ).length,
    serviceCheckIns: rows.filter(
      (row) => row.source_type === "SERVICE_CHECK_IN",
    ).length,
    completedTasks: rows.filter((row) => row.source_type === "TASK_COMPLETED")
      .length,
  };
  const keys = earnedBadgeKeys(stats);
  if (keys.length === 0) return;

  const { data: badges } = await admin
    .from("badges")
    .select("id, key")
    .in("key", keys);
  if (!badges?.length) return;
  await admin.from("member_badges").upsert(
    badges.map((badge) => ({
      profile_id: profileId,
      badge_id: badge.id,
      club_id: clubId,
    })),
    { onConflict: "profile_id,badge_id", ignoreDuplicates: true },
  );
}

export interface LeaderboardEntry {
  profileId: string;
  fullName: string;
  points: number;
}

export interface MemberRewardBadge {
  key: string;
  name: string;
  description: string;
  icon: string;
  awardedAt: string;
}

export interface MemberRewardEntry {
  id: string;
  sourceType: string;
  points: number;
  reason: string;
  createdAt: string;
}

export interface MemberRewardsProfile {
  rotaryYear: string;
  points: number;
  checkIns: number;
  serviceCheckIns: number;
  tasksCompleted: number;
  badges: MemberRewardBadge[];
  recent: MemberRewardEntry[];
}

export async function getMemberRewardsProfile(
  clubId: string,
  profileId: string,
  rotaryYear = rotaryYearFor(),
): Promise<MemberRewardsProfile> {
  const empty: MemberRewardsProfile = {
    rotaryYear,
    points: 0,
    checkIns: 0,
    serviceCheckIns: 0,
    tasksCompleted: 0,
    badges: [],
    recent: [],
  };

  try {
    const admin = createAdminClient();
    const [
      { data: ledger, error: ledgerError },
      { data: badges, error: badgeError },
    ] = await Promise.all([
      admin
        .from("engagement_points_ledger")
        .select("id, source_type, points, reason, created_at")
        .eq("club_id", clubId)
        .eq("profile_id", profileId)
        .eq("rotary_year", rotaryYear)
        .order("created_at", { ascending: false }),
      admin
        .from("member_badges")
        .select("awarded_at, badges(key, name, description, icon)")
        .eq("club_id", clubId)
        .eq("profile_id", profileId)
        .order("awarded_at", { ascending: false }),
    ]);

    if (ledgerError || badgeError) return empty;
    const entries = ledger || [];
    const recent: MemberRewardEntry[] = entries.slice(0, 10).map((entry) => ({
      id: entry.id,
      sourceType: entry.source_type,
      points: Number(entry.points || 0),
      reason: entry.reason || entry.source_type.replaceAll("_", " "),
      createdAt: entry.created_at,
    }));

    return {
      rotaryYear,
      points: entries.reduce(
        (sum, entry) => sum + Number(entry.points || 0),
        0,
      ),
      checkIns: entries.filter((entry) =>
        ["CHECK_IN", "SERVICE_CHECK_IN"].includes(entry.source_type),
      ).length,
      serviceCheckIns: entries.filter(
        (entry) => entry.source_type === "SERVICE_CHECK_IN",
      ).length,
      tasksCompleted: entries.filter(
        (entry) => entry.source_type === "TASK_COMPLETED",
      ).length,
      badges: (badges || []).flatMap((row) => {
        const badge = row.badges as unknown as {
          key: string;
          name: string;
          description: string;
          icon: string;
        } | null;
        return badge ? [{ ...badge, awardedAt: row.awarded_at }] : [];
      }),
      recent,
    };
  } catch (error) {
    console.warn("Could not load member reward profile:", error);
    return empty;
  }
}
export async function getEngagementLeaderboard(
  clubId: string,
  rotaryYear = rotaryYearFor(),
  limit = 5,
): Promise<LeaderboardEntry[]> {
  try {
    const { data, error } = await createAdminClient()
      .from("engagement_points_ledger")
      .select("profile_id, points, profiles(full_name)")
      .eq("club_id", clubId)
      .eq("rotary_year", rotaryYear);
    if (error || !data) return [];

    const totals = new Map<string, LeaderboardEntry>();
    for (const row of data) {
      const profile = row.profiles as unknown as {
        full_name: string | null;
      } | null;
      const entry = totals.get(row.profile_id) || {
        profileId: row.profile_id,
        fullName: profile?.full_name || "Club Member",
        points: 0,
      };
      entry.points += Number(row.points || 0);
      totals.set(row.profile_id, entry);
    }
    return Array.from(totals.values())
      .sort((a, b) => b.points - a.points)
      .slice(0, limit);
  } catch (error) {
    console.warn("Could not load engagement leaderboard:", error);
    return [];
  }
}
