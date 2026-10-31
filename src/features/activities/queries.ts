import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGroupTasksList } from "@/features/tasks/queries";
import { UUID_PATTERN } from "./schemas";
import type {
  ActivityCommentDTO,
  ActivityDetailDTO,
  ActivityKind,
  ActivityMediaDTO,
  ActivityProjectDetailsDTO,
  ActivityStatus,
  ActivitySummaryDTO,
  Committee,
  MeetingType,
  PartnerRole,
  RsvpResponse,
  TeamRole,
} from "./types";

export const MEDIA_BUCKET = "activity-media";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

const SUMMARY_COLUMNS = `
  id, club_id, kind, meeting_type, title, short_description, location, start_at, end_at, all_day,
  status, committee, owner_id, min_members_required, capacity, rsvp_enabled, rsvp_deadline,
  self_check_in_enabled, check_in_window_minutes, volunteer_hours_default, cover_storage_path,
  owner:profiles!activities_owner_id_fkey(full_name),
  activity_rsvps(profile_id, response),
  attendance_records(profile_id),
  activity_comments(count), activity_media(count),
  tasks(status)
`;

interface ActivitySummaryRow {
  id: string;
  club_id: string;
  kind: string;
  meeting_type: string | null;
  title: string;
  short_description: string | null;
  description?: string | null;
  location: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  status: string;
  committee: string | null;
  owner_id: string | null;
  owner?: { full_name: string | null } | null;
  min_members_required: number | null;
  capacity: number | null;
  rsvp_enabled: boolean;
  rsvp_deadline: string | null;
  self_check_in_enabled: boolean;
  check_in_window_minutes: number;
  volunteer_hours_default: number;
  cover_storage_path: string | null;
  is_published?: boolean;
  rotary_year?: string;
  activity_rsvps?: { profile_id: string; response: RsvpResponse }[] | null;
  attendance_records?: { profile_id: string }[] | null;
  tasks?: { status: string }[] | null;
  activity_comments?: { count: number }[] | null;
  activity_media?: { count: number }[] | null;
}

interface ProfileRow {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface ActivityTeamRow {
  profile_id: string;
  team_role: TeamRole;
  profiles: ProfileRow | null;
}

interface ActivityRsvpRow {
  profile_id: string;
  response: RsvpResponse;
  note: string | null;
  responded_at: string;
  profiles: ProfileRow | null;
}

interface ActivityAttendanceRow {
  id: string;
  profile_id: string;
  check_in_time: string;
  check_in_method: string;
  volunteer_hours: number | string;
  profiles: ProfileRow | null;
}

interface ActivityMediaRow {
  id: string;
  storage_path: string;
  caption: string | null;
  is_featured: boolean;
  sort_order: number;
}

interface ActivityCommentRow {
  id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  author_id: string;
  profiles: ProfileRow | null;
  activity_comment_reactions: { emoji: string; profile_id: string }[] | null;
}

interface ActivityLogRow {
  id: string;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
  profiles: { full_name: string | null } | null;
}

interface ActivityProjectDetailsRow {
  objective: string | null;
  inspiration: string | null;
  outcomes_summary: string | null;
  beneficiary_type: string | null;
  beneficiary_count: number;
  volunteer_member_count: number;
  volunteer_nonmember_count: number;
  total_volunteer_hours: number | string;
  funding_total: number | string;
  funding_currency: string;
  funding_source: string | null;
  total_expenses: number | string;
  supports_polio: boolean;
  tags: string[];
  related_links: unknown;
  spc_initiative_id: string | null;
  completed_at: string | null;
}

export async function isClubParticipant(
  clubId: string,
  profileId: string,
): Promise<boolean> {
  if (!UUID_PATTERN.test(profileId)) return false;
  const admin = createAdminClient();
  const { data } = await admin
    .from("club_memberships")
    .select("membership_status, profiles!inner(status, is_platform_admin)")
    .eq("club_id", clubId)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (!data) {
    const { data: profile } = await admin
      .from("profiles")
      .select("is_platform_admin, status")
      .eq("id", profileId)
      .maybeSingle();
    return Boolean(profile?.is_platform_admin && profile.status === "ACTIVE");
  }
  const profile = (data as unknown as { profiles: { status: string } | null })
    .profiles;
  return (
    ["ACTIVE", "ASPIRANT"].includes(data.membership_status) &&
    profile?.status === "ACTIVE"
  );
}

async function signPaths(paths: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(paths.filter(Boolean)));
  const out = new Map<string, string>();
  if (unique.length === 0) return out;
  const admin = createAdminClient();
  const { data } = await admin.storage
    .from(MEDIA_BUCKET)
    .createSignedUrls(unique, SIGNED_URL_TTL_SECONDS);
  for (const item of data || []) {
    if (item.path && item.signedUrl) out.set(item.path, item.signedUrl);
  }
  return out;
}

function mapSummary(
  row: ActivitySummaryRow,
  userId: string,
  coverUrls: Map<string, string>,
): ActivitySummaryDTO {
  const rsvps: { profile_id: string; response: RsvpResponse }[] =
    row.activity_rsvps || [];
  const attendance: { profile_id: string }[] = row.attendance_records || [];
  const tasks: { status: string }[] = row.tasks || [];
  return {
    id: row.id,
    clubId: row.club_id,
    kind: row.kind as ActivityKind,
    meetingType: (row.meeting_type as MeetingType) || null,
    title: row.title,
    shortDescription: row.short_description || "",
    location: row.location || "",
    startAt: row.start_at,
    endAt: row.end_at,
    allDay: Boolean(row.all_day),
    status: row.status as ActivityStatus,
    committee: (row.committee as Committee) || null,
    ownerId: row.owner_id,
    ownerName: row.owner?.full_name || null,
    minMembersRequired: row.min_members_required,
    capacity: row.capacity,
    rsvpEnabled: Boolean(row.rsvp_enabled),
    rsvpDeadline: row.rsvp_deadline,
    selfCheckInEnabled: Boolean(row.self_check_in_enabled),
    checkInWindowMinutes: row.check_in_window_minutes ?? 180,
    volunteerHoursDefault: Number(row.volunteer_hours_default || 0),
    rsvp: {
      going: rsvps.filter((r) => r.response === "GOING").length,
      maybe: rsvps.filter((r) => r.response === "MAYBE").length,
      notGoing: rsvps.filter((r) => r.response === "NOT_GOING").length,
    },
    myRsvp: rsvps.find((r) => r.profile_id === userId)?.response || null,
    attendeesCount: attendance.length,
    checkedIn: attendance.some((a) => a.profile_id === userId),
    tasksTotal: tasks.length,
    tasksDone: tasks.filter((t) => t.status === "COMPLETED").length,
    commentsCount: row.activity_comments?.[0]?.count ?? 0,
    mediaCount: row.activity_media?.[0]?.count ?? 0,
    coverUrl: row.cover_storage_path
      ? coverUrls.get(row.cover_storage_path) || null
      : null,
  };
}

export async function listActivities(
  clubId: string,
  userId: string,
  options: {
    from?: string;
    to?: string;
    limit?: number;
    includeDrafts?: boolean;
  } = {},
): Promise<ActivitySummaryDTO[]> {
  try {
    const admin = createAdminClient();
    let query = admin
      .from("activities")
      .select(SUMMARY_COLUMNS)
      .eq("club_id", clubId)
      .order("start_at", { ascending: true });
    if (!options.includeDrafts && UUID_PATTERN.test(userId)) {
      query = query.or(`is_published.eq.true,owner_id.eq.${userId}`);
    }
    if (options.from) query = query.gte("end_at", options.from);
    if (options.to) query = query.lte("start_at", options.to);
    if (options.limit) query = query.limit(options.limit);

    const { data, error } = await query;
    if (error || !data) {
      console.warn("Could not load activities:", error?.message);
      return [];
    }
    const rows = data as unknown as ActivitySummaryRow[];
    const coverUrls = await signPaths(
      rows
        .map((row) => row.cover_storage_path)
        .filter((path): path is string => Boolean(path)),
    );
    return rows.map((row) => mapSummary(row, userId, coverUrls));
  } catch (err) {
    console.warn("Could not load activities:", err);
    return [];
  }
}

export async function getActivityMediaPage(
  activityId: string,
  offset: number,
): Promise<{ media: ActivityMediaDTO[]; hasMore: boolean }> {
  const { data, error } = await createAdminClient()
    .from("activity_media")
    .select("id, storage_path, caption, is_featured, sort_order")
    .eq("activity_id", activityId)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true })
    .range(offset, offset + 24);
  if (error) throw new Error("Photos could not be loaded.");
  const rows = (data || []) as ActivityMediaRow[];
  const page = rows.slice(0, 24);
  const urls = await signPaths(page.map((photo) => photo.storage_path));
  return {
    media: page.map((photo) => ({
      id: photo.id,
      url: urls.get(photo.storage_path) || null,
      caption: photo.caption,
      isFeatured: photo.is_featured,
    })),
    hasMore: rows.length > 24,
  };
}

function person(p: ProfileRow | null, fallbackId: string) {
  return {
    profileId: p?.id || fallbackId,
    fullName: p?.full_name || "Club Member",
    avatarUrl: p?.avatar_url || null,
  };
}

export async function getActivityDetail(
  activityId: string,
  userId: string,
  access: { canManageClub: boolean; canManageAttendance: boolean },
): Promise<ActivityDetailDTO | null> {
  if (!UUID_PATTERN.test(activityId)) return null;
  const admin = createAdminClient();

  const { data: row, error } = await admin
    .from("activities")
    .select(`${SUMMARY_COLUMNS}, description, is_published, rotary_year`)
    .eq("id", activityId)
    .maybeSingle();
  if (error || !row) return null;

  const [
    details,
    aof,
    sdgs,
    partners,
    team,
    rsvps,
    attendance,
    media,
    comments,
    log,
    follow,
  ] = await Promise.all([
    admin
      .from("activity_project_details")
      .select("*")
      .eq("activity_id", activityId)
      .maybeSingle(),
    admin
      .from("activity_areas_of_focus")
      .select("areas_of_focus(code)")
      .eq("activity_id", activityId),
    admin
      .from("activity_sdgs")
      .select("sdgs(number)")
      .eq("activity_id", activityId),
    admin
      .from("activity_partners")
      .select("id, name, partner_role")
      .eq("activity_id", activityId)
      .order("created_at"),
    admin
      .from("activity_team")
      .select("profile_id, team_role, profiles(id, full_name, avatar_url)")
      .eq("activity_id", activityId),
    admin
      .from("activity_rsvps")
      .select(
        "profile_id, response, note, responded_at, profiles(id, full_name, avatar_url)",
      )
      .eq("activity_id", activityId)
      .order("responded_at", { ascending: false }),
    admin
      .from("attendance_records")
      .select(
        "id, profile_id, check_in_time, check_in_method, volunteer_hours, profiles:profile_id(id, full_name, avatar_url)",
      )
      .eq("activity_id", activityId)
      .order("check_in_time", { ascending: false }),
    admin
      .from("activity_media")
      .select("id, storage_path, caption, is_featured, sort_order")
      .eq("activity_id", activityId)
      .order("is_featured", { ascending: false })
      .order("sort_order")
      .order("created_at"),
    admin
      .from("activity_comments")
      .select(
        "id, parent_id, body, created_at, edited_at, deleted_at, author_id, profiles:author_id(id, full_name, avatar_url), activity_comment_reactions(emoji, profile_id)",
      )
      .eq("activity_id", activityId)
      .order("created_at"),
    admin
      .from("activity_log")
      .select("id, action, details, created_at, profiles:actor_id(full_name)")
      .eq("activity_id", activityId)
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("activity_followers")
      .select("profile_id")
      .eq("activity_id", activityId)
      .eq("profile_id", userId)
      .maybeSingle(),
  ]);

  const activityRow = row as unknown as ActivitySummaryRow;
  const mediaRows = (media.data || []) as unknown as ActivityMediaRow[];
  const urls = await signPaths([
    ...mediaRows.map((m) => m.storage_path),
    activityRow.cover_storage_path || "",
  ]);
  const summary = mapSummary(activityRow, userId, urls);
  const r = activityRow;

  const teamRows = (team.data || []) as unknown as ActivityTeamRow[];
  const teamList = teamRows.map((t) => ({
    ...person(t.profiles, t.profile_id),
    role: t.team_role,
  }));
  const isChair = teamList.some(
    (t) =>
      t.profileId === userId && (t.role === "CHAIR" || t.role === "CO_CHAIR"),
  );
  const canManage = access.canManageClub || r.owner_id === userId || isChair;

  let projectDetails: ActivityProjectDetailsDTO | null = null;
  if (details.data) {
    const d = details.data as unknown as ActivityProjectDetailsRow;
    projectDetails = {
      objective: d.objective || "",
      inspiration: d.inspiration || "",
      outcomesSummary: d.outcomes_summary || "",
      beneficiaryType: d.beneficiary_type || "",
      beneficiaryCount: d.beneficiary_count || 0,
      volunteerMemberCount: d.volunteer_member_count || 0,
      volunteerNonmemberCount: d.volunteer_nonmember_count || 0,
      totalVolunteerHours: Number(d.total_volunteer_hours || 0),
      fundingTotal: Number(d.funding_total || 0),
      fundingCurrency: d.funding_currency || "PHP",
      fundingSource: d.funding_source || "",
      totalExpenses: Number(d.total_expenses || 0),
      supportsPolio: Boolean(d.supports_polio),
      tags: d.tags || [],
      relatedLinks: Array.isArray(d.related_links) ? d.related_links : [],
      spcInitiativeId: d.spc_initiative_id || "",
      completedAt: d.completed_at,
      areasOfFocus: (
        (aof.data || []) as unknown as {
          areas_of_focus: { code: string } | null;
        }[]
      )
        .map((area) => area.areas_of_focus?.code)
        .filter((code): code is string => Boolean(code)),
      sdgs: (
        (sdgs.data || []) as unknown as { sdgs: { number: number } | null }[]
      )
        .map((goal) => goal.sdgs?.number)
        .filter((number): number is number => typeof number === "number"),
      partners: (
        (partners.data || []) as unknown as {
          id: string;
          name: string;
          partner_role: PartnerRole;
        }[]
      ).map((partner) => ({
        id: partner.id,
        name: partner.name,
        role: partner.partner_role,
      })),
    };
  }

  const commentRows = (comments.data || []) as unknown as ActivityCommentRow[];
  const commentList: ActivityCommentDTO[] = commentRows.map((c) => {
    const reactionRows: { emoji: string; profile_id: string }[] =
      c.activity_comment_reactions || [];
    const grouped = new Map<string, { count: number; mine: boolean }>();
    for (const rr of reactionRows) {
      const g = grouped.get(rr.emoji) || { count: 0, mine: false };
      g.count += 1;
      g.mine = g.mine || rr.profile_id === userId;
      grouped.set(rr.emoji, g);
    }
    const isDeleted = Boolean(c.deleted_at);
    return {
      id: c.id,
      parentId: c.parent_id,
      author: person(c.profiles, c.author_id),
      body: isDeleted ? "" : c.body,
      createdAt: c.created_at,
      editedAt: c.edited_at,
      isDeleted,
      reactions: Array.from(grouped.entries()).map(([emoji, g]) => ({
        emoji,
        ...g,
      })),
    };
  });

  return {
    ...summary,
    description: r.description || "",
    isPublished: Boolean(r.is_published),
    rotaryYear: r.rotary_year || "",
    projectDetails,
    team: teamList,
    rsvps: ((rsvps.data || []) as unknown as ActivityRsvpRow[]).map((x) => ({
      ...person(x.profiles, x.profile_id),
      response: x.response,
      note: x.note,
      respondedAt: x.responded_at,
    })),
    attendees: (
      (attendance.data || []) as unknown as ActivityAttendanceRow[]
    ).map((a) => ({
      ...person(a.profiles, a.profile_id),
      id: a.id,
      checkInTime: a.check_in_time,
      checkInMethod: a.check_in_method,
      volunteerHours: Number(a.volunteer_hours || 0),
    })),
    media: mediaRows.map((m) => ({
      id: m.id,
      url: urls.get(m.storage_path) || null,
      caption: m.caption,
      isFeatured: Boolean(m.is_featured),
    })),
    comments: commentList,
    log: ((log.data || []) as unknown as ActivityLogRow[]).map((l) => ({
      id: l.id,
      actorName: l.profiles?.full_name || "System",
      action: l.action,
      details: l.details || {},
      createdAt: l.created_at,
    })),
    isFollowing: Boolean(follow.data),
    canManage,
    canManageAttendance: canManage || access.canManageAttendance,
  };
}

export async function getActivityTasks(clubId: string, activityId: string) {
  const tasks = await getGroupTasksList(clubId);
  return tasks.filter((t) => t.projectId === activityId);
}
