import { NextResponse } from "next/server";
import { presentationGenerateRequestSchema } from "@/features/activities/export-types";
import {
  buildDeterministicDeck,
  enrichDeckWithGemini,
} from "@/lib/services/exports/presentation-builder";
import { loadAuthorizedProjectCenterExportData } from "@/lib/services/exports/project-center-export-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = presentationGenerateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error:
          parsed.error.issues[0]?.message ||
          "Invalid presentation configuration.",
      },
      { status: 400 },
    );
  }

  const data = await loadAuthorizedProjectCenterExportData({
    rotaryYear: parsed.data.rotaryYear,
    includeDrafts: parsed.data.includeDrafts,
    activityIds: parsed.data.activityIds,
  });
  if (!data.ok) return data.response;

  const baseDeck = buildDeterministicDeck({
    title: parsed.data.title,
    clubName: data.clubSettings.clubName,
    districtCode: data.clubSettings.districtCode,
    rotaryYear:
      parsed.data.rotaryYear || data.clubSettings.currentRotaryYear || "ALL",
    presenterName: data.user.fullName || "Club Officer",
    months: parsed.data.months,
    activities: data.activities,
    tasks: data.tasks,
    includeCalendar: parsed.data.includeCalendar,
    includeTasks: parsed.data.includeTasks,
    includeWorkload: parsed.data.includeWorkload,
  });

  const deck = parsed.data.useAi
    ? await enrichDeckWithGemini(baseDeck)
    : baseDeck;

  return NextResponse.json({
    success: true,
    deck,
  });
}

