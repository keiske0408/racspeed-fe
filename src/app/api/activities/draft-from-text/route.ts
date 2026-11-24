import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, getUserAccessContext } from "@/lib/auth/session";
import { DEFAULT_CLUB_ID } from "@/features/activities/types";
import { MAX_RAW_TEXT_LENGTH } from "@/features/activities/ai-draft-schema";
import { generateActivityDraftFromText } from "@/lib/services/ai/gemini";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  rawText: z.string(),
});

function manilaTodayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Authentication required." },
      { status: 401 },
    );
  }
  if (user.status !== "ACTIVE") {
    return NextResponse.json(
      { success: false, error: "Your account is not active." },
      { status: 403 },
    );
  }

  const context = await getUserAccessContext(DEFAULT_CLUB_ID);
  const canCreate =
    context.isPlatformAdmin ||
    context.permissions.has("PROJECT_CREATE") ||
    context.permissions.has("EVENT_CREATE");
  if (!canCreate) {
    return NextResponse.json(
      {
        success: false,
        error: "You do not have permission to create projects or activities.",
      },
      { status: 403 },
    );
  }

  const rawBody = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Request body must include `rawText`." },
      { status: 400 },
    );
  }

  const trimmed = parsed.data.rawText.trim();
  if (!trimmed) {
    return NextResponse.json(
      {
        success: false,
        error: "Please paste a project message, email, or invitation first.",
      },
      { status: 400 },
    );
  }

  if (trimmed.length > MAX_RAW_TEXT_LENGTH) {
    return NextResponse.json(
      {
        success: false,
        error: `Pasted text is too long (${trimmed.length.toLocaleString()} characters; maximum is ${MAX_RAW_TEXT_LENGTH.toLocaleString()}). Please trim unnecessary parts and try again.`,
      },
      { status: 400 },
    );
  }

  const todayIso = manilaTodayIso();
  const result = await generateActivityDraftFromText({
    rawText: trimmed,
    todayIso,
  });

  if (!result.success) {
    const status =
      result.code === "NOT_CONFIGURED"
        ? 503
        : result.code === "INVALID_AI_OUTPUT"
          ? 422
          : 502;
    return NextResponse.json(
      { success: false, error: result.error, code: result.code },
      { status },
    );
  }

  return NextResponse.json({
    success: true,
    data: result.data,
    todayIso,
    attempts: result.attempts,
  });
}

