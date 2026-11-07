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
  sourceId?: string;
  points: number;
  reason: string;
  projectTitle?: string | null;
  activityId?: string | null;
  categoryLabel?: string;
  volunteerHours?: number | null;
  createdAt: string;
}

export interface AttendedActivityEntry {
  id: string;
  activityId: string | null;
  title: string;
  kind: string;
  location: string | null;
  attendedAt: string;
  checkInMethod: string;
  volunteerHours: number;
  pointsEarned: number;
}

export interface MemberRewardsProfile {
  rotaryYear: string;
  points: number;
  checkIns: number;
  serviceCheckIns: number;
  tasksCompleted: number;
  badges: MemberRewardBadge[];
  recent: MemberRewardEntry[];
  attendedActivities?: AttendedActivityEntry[];
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatSourceCategory(sourceType: string): string {
  switch (sourceType) {
    case "SERVICE_CHECK_IN":
      return "Service Project Attendance";
    case "CHECK_IN":
      return "Activity Check-in";
    case "TASK_COMPLETED":
      return "Task Completed";
    case "RSVP_HONORED":
      return "RSVP Honored";
    case "NO_SHOW":
      return "Missed RSVP";
    default:
      return sourceType.replaceAll("_", " ");
  }
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
    attendedActivities: [],
  };

  try {
    const admin = createAdminClient();
    const [
      { data: ledger, error: ledgerError },
      { data: badges, error: badgeError },
      attendanceRes,
    ] = await Promise.all([
      admin
        .from("engagement_points_ledger")
        .select("id, source_type, source_id, points, reason, created_at")
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
      Promise.resolve(
        admin
          .from("attendance_records")
          .select(
            "id, activity_id, event_id, attended, check_in_method, volunteer_hours, check_in_time, created_at, activities(id, title, kind, location, start_at), events(id, title, event_category, location, start_time)",
          )
          .eq("profile_id", profileId)
          .eq("attended", true)
          .order("check_in_time", { ascending: false }),
      ).catch(() => ({ data: null, error: null })),
    ]);

    if (ledgerError || badgeError) return empty;
    const entries = (ledger || []) as {
      id: string;
      source_type: string;
      source_id?: string | null;
      points: number;
      reason: string | null;
      created_at: string;
    }[];

    const attendanceRows = ((attendanceRes as any)?.data || []) as {
      id: string;
      activity_id?: string | null;
      event_id?: string | null;
      attended: boolean;
      check_in_method?: string | null;
      volunteer_hours?: number | string | null;
      check_in_time?: string | null;
      created_at?: string | null;
      activities?: {
        id: string;
        title: string;
        kind: string;
        location?: string | null;
        start_at?: string | null;
      } | null;
      events?: {
        id: string;
        title: string;
        event_category: string;
        location?: string | null;
        start_time?: string | null;
      } | null;
    }[];

    // Map by attendance_record.id and by activity_id for fast resolution
    const byRecordId = new Map<string, (typeof attendanceRows)[number]>();
    const byActivityId = new Map<string, (typeof attendanceRows)[number]>();
    for (const row of attendanceRows) {
      if (row.id) byRecordId.set(row.id, row);
      if (row.activity_id) byActivityId.set(row.activity_id, row);
      if (row.activities?.id) byActivityId.set(row.activities.id, row);
    }

    // Also look up any direct activity UUIDs in source_id that weren't in attendanceRows
    const unresolvedActivityIds = entries
      .map((e) => e.source_id || "")
      .filter(
        (sid) =>
          UUID_RE.test(sid) && !byRecordId.has(sid) && !byActivityId.has(sid),
      );

    const directActivityMap = new Map<
      string,
      { id: string; title: string; kind: string; location?: string | null }
    >();
    if (unresolvedActivityIds.length > 0) {
      try {
        const { data: actData } = await admin
          .from("activities")
          .select("id, title, kind, location")
          .in("id", unresolvedActivityIds);
        for (const a of (actData || []) as any[]) {
          if (a?.id) directActivityMap.set(a.id, a);
        }
      } catch {
        // ignore if activities query not mocked in tests
      }
    }

    const recent: MemberRewardEntry[] = entries.slice(0, 15).map((entry) => {
      const sid = entry.source_id || "";
      const attRow = byRecordId.get(sid) || byActivityId.get(sid);
      const directAct = directActivityMap.get(sid);

      let projectTitle: string | null =
        attRow?.activities?.title ||
        attRow?.events?.title ||
        directAct?.title ||
        null;
      const activityId: string | null =
        attRow?.activity_id ||
        attRow?.activities?.id ||
        directAct?.id ||
        null;
      const volunteerHours =
        attRow?.volunteer_hours != null
          ? Number(attRow.volunteer_hours)
          : null;

      // Extract title if already embedded in reason (e.g. "Attended Service Project: Title" or "Completed task: Title")
      const rawReason =
        entry.reason || entry.source_type.replaceAll("_", " ");
      if (!projectTitle) {
        const colonIdx = rawReason.indexOf(":");
        if (colonIdx !== -1 && colonIdx < rawReason.length - 1) {
          projectTitle = rawReason.slice(colonIdx + 1).trim();
        }
      }

      const isGenericReason =
        rawReason === "Verified service project attendance" ||
        rawReason === "Verified activity attendance" ||
        rawReason === "CHECK IN" ||
        rawReason === "SERVICE CHECK IN";

      const displayReason =
        isGenericReason && projectTitle
          ? `${
              entry.source_type === "SERVICE_CHECK_IN"
                ? "Attended Service Project"
                : "Attended Activity"
            }: ${projectTitle}`
          : rawReason;

      return {
        id: entry.id,
        sourceType: entry.source_type,
        sourceId: sid || undefined,
        points: Number(entry.points || 0),
        reason: displayReason,
        projectTitle,
        activityId,
        categoryLabel: formatSourceCategory(entry.source_type),
        volunteerHours,
        createdAt: entry.created_at,
      };
    });

    // Build attendedActivities list from attendanceRows + any check-in ledger entries
    const attendedActivities: AttendedActivityEntry[] = [];
    const seenActivityKeys = new Set<string>();

    for (const row of attendanceRows) {
      const actId = row.activity_id || row.activities?.id || null;
      const title =
        row.activities?.title || row.events?.title || "Club Activity";
      const kind =
        row.activities?.kind || row.events?.event_category || "SERVICE_PROJECT";
      const key = actId || row.event_id || row.id;
      if (seenActivityKeys.has(key)) continue;
      seenActivityKeys.add(key);

      // Find matching ledger points if any
      const matchedEntry = entries.find(
        (e) =>
          e.source_id === row.id || (actId && e.source_id === actId),
      );
      const isService =
        kind === "SERVICE_PROJECT" || kind === "JOINT_PROJECT";
      const defaultPts = isService ? 20 : 10;

      attendedActivities.push({
        id: row.id,
        activityId: actId,
        title,
        kind,
        location: row.activities?.location || row.events?.location || null,
        attendedAt:
          row.check_in_time ||
          row.activities?.start_at ||
          row.events?.start_time ||
          row.created_at ||
          new Date().toISOString(),
        checkInMethod: row.check_in_method || "QR",
        volunteerHours: Number(row.volunteer_hours || 0),
        pointsEarned: matchedEntry ? Number(matchedEntry.points || 0) : defaultPts,
      });
    }

    // Also include any check-in ledger entries that weren't in attendanceRows
    for (const r of recent) {
      if (
        (r.sourceType === "CHECK_IN" || r.sourceType === "SERVICE_CHECK_IN") &&
        r.activityId &&
        !seenActivityKeys.has(r.activityId)
      ) {
        seenActivityKeys.add(r.activityId);
        const directAct = directActivityMap.get(r.activityId);
        attendedActivities.push({
          id: r.id,
          activityId: r.activityId,
          title: r.projectTitle || directAct?.title || r.reason,
          kind:
            directAct?.kind ||
            (r.sourceType === "SERVICE_CHECK_IN"
              ? "SERVICE_PROJECT"
              : "GENERAL"),
          location: directAct?.location || null,
          attendedAt: r.createdAt,
          checkInMethod: "VERIFIED",
          volunteerHours: r.volunteerHours || 0,
          pointsEarned: r.points,
        });
      }
    }

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
      attendedActivities,
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
