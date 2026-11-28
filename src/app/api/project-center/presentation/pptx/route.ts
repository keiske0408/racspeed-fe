import { NextResponse } from "next/server";
import { presentationDeckSchema } from "@/features/activities/export-types";
import { renderPresentationPptxBuffer } from "@/lib/services/exports/presentation-pptx";
import { authorizeClubExportAccess } from "@/lib/services/exports/project-center-export-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await authorizeClubExportAccess();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = presentationDeckSchema.safeParse(body?.deck ?? body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error:
          parsed.error.issues[0]?.message || "Invalid presentation deck data.",
      },
      { status: 400 },
    );
  }

  const pptxBytes = await renderPresentationPptxBuffer(parsed.data);
  const slug =
    parsed.data.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "racspeed-presentation";

  return new NextResponse(Buffer.from(pptxBytes), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${slug}.pptx"`,
      "Cache-Control": "no-store",
    },
  });
}

