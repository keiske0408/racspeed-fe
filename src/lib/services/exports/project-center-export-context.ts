import { NextResponse } from "next/server";
import { getCurrentUser, getUserAccessContext } from "@/lib/auth/session";
import { isClubParticipant, listActivities } from "@/features/activities/queries";
import { DEFAULT_CLUB_ID, type ActivitySummaryDTO } from "@/features/activities/types";
import { getGroupTasksList } from "@/features/tasks/queries";
import { getClubSettings, type ClubSettingsDTO } from "@/features/settings/queries";
import type { GroupTaskDTO } from "@/lib/data/tasks-types";

export type AuthorizedExportContext =
  | {
      ok: true;
      user: { id: string; fullName: string; email: string };
      clubId: string;
      canManageClub: boolean;
      clubSettings: ClubSettingsDTO;
      activities: ActivitySummaryDTO[];
      tasks: GroupTaskDTO[];
    }
  | { ok: false; response: NextResponse };

export async function authorizeClubExportAccess(): Promise<
  | {
      ok: true;
      user: { id: string; fullName: string; email: string };
      clubId: string;
      canManageClub: boolean;
    }
  | { ok: false; response: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      ),
    };
  }
  if (user.status !== "ACTIVE") {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "Your account is not active." },
        { status: 403 },
      ),
    };
  }

  const clubId = DEFAULT_CLUB_ID;
  const [context, participant] = await Promise.all([
    getUserAccessContext(clubId),
    isClubParticipant(clubId, user.id),
  ]);

  if (!participant && !context.isPlatformAdmin) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "You do not have access to this club workspace." },
        { status: 403 },
      ),
    };
  }

  const canManageClub =
    context.isPlatformAdmin ||
    context.permissions.has("EVENT_UPDATE") ||
    context.permissions.has("PROJECT_UPDATE");

  return { ok: true, user, clubId, canManageClub };
}

export async function loadAuthorizedProjectCenterExportData(options: {
  rotaryYear?: string;
  includeDrafts?: boolean;
  kindFilter?: string;
  activityIds?: string[];
}): Promise<AuthorizedExportContext> {
  const auth = await authorizeClubExportAccess();
  if (!auth.ok) return auth;

  const allowDrafts = Boolean(options.includeDrafts && auth.canManageClub);
  const [allActivities, tasks, clubSettings] = await Promise.all([
    listActivities(auth.clubId, auth.user.id, { includeDrafts: allowDrafts }),
    getGroupTasksList(auth.clubId),
    getClubSettings(auth.clubId),
  ]);

  const idSet =
    options.activityIds && options.activityIds.length > 0
      ? new Set(options.activityIds)
      : null;

  const filteredActivities = allActivities.filter((a) => {
    if (a.isArchived) return false;
    if (!allowDrafts && a.status === "DRAFT") return false;
    if (
      options.rotaryYear &&
      options.rotaryYear !== "ALL" &&
      a.rotaryYear &&
      a.rotaryYear !== options.rotaryYear
    ) {
      return false;
    }
    if (options.kindFilter && options.kindFilter !== "ALL" && a.kind !== options.kindFilter) {
      return false;
    }
    if (idSet && !idSet.has(a.id)) return false;
    return true;
  });

  return {
    ok: true,
    user: auth.user,
    clubId: auth.clubId,
    canManageClub: auth.canManageClub,
    clubSettings,
    activities: filteredActivities,
    tasks,
  };
}

