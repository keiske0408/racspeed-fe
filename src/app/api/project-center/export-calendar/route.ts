import { NextResponse } from "next/server";
import { calendarExportRequestSchema } from "@/features/activities/export-types";
import {
  buildCalendarWorkbookBuffer,
  getCalendarFileSlug,
} from "@/lib/services/exports/calendar-excel";
import { loadAuthorizedProjectCenterExportData } from "@/lib/services/exports/project-center-export-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = calendarExportRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid export parameters.",
      },
      { status: 400 },
    );
  }

  const data = await loadAuthorizedProjectCenterExportData({
    rotaryYear: parsed.data.rotaryYear,
    includeDrafts: parsed.data.includeDrafts,
    kindFilter: parsed.data.kindFilter,
  });
  if (!data.ok) return data.response;

  const buffer = await buildCalendarWorkbookBuffer({
    clubName: data.clubSettings.clubName,
    districtCode: data.clubSettings.districtCode,
    rotaryYear:
      parsed.data.rotaryYear || data.clubSettings.currentRotaryYear || "ALL",
    months: parsed.data.months,
    activities: data.activities,
    tasks: data.tasks,
    includeTasks: parsed.data.includeTasks,
  });

  const filename = `${getCalendarFileSlug(parsed.data.months)}.xlsx`;

  return new NextResponse(Buffer.from(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

