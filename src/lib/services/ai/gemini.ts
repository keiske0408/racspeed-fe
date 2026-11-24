import "server-only";
import { env } from "@/lib/env";
import {
  buildAiDraftPrompt,
  extractJsonFromModelText,
  sanitizeAndValidateAiDraft,
  type AiDraftResponse,
} from "@/features/activities/ai-draft-schema";

export type GenerateAiDraftResult =
  | {
      success: true;
      data: AiDraftResponse;
      attempts: number;
    }
  | {
      success: false;
      code:
        | "NOT_CONFIGURED"
        | "INVALID_INPUT"
        | "UPSTREAM_ERROR"
        | "INVALID_AI_OUTPUT";
      error: string;
    };

export interface GeminiCallOptions {
  rawText: string;
  todayIso: string;
  fetchImpl?: typeof fetch;
  apiKeyOverride?: string;
  modelOverride?: string;
}

/**
 * Calls Google Gemini REST API server-side to extract structured project
 * fields and a club approval checklist from raw chat/email text.
 * Retries once automatically when the LLM emits malformed JSON or fails Zod validation.
 */
export async function generateActivityDraftFromText({
  rawText,
  todayIso,
  fetchImpl = fetch,
  apiKeyOverride,
  modelOverride,
}: GeminiCallOptions): Promise<GenerateAiDraftResult> {
  const apiKey = (
    apiKeyOverride ??
    env.GEMINI_API_KEY ??
    process.env.GOOGLE_GENAI_API_KEY ??
    ""
  ).trim();

  if (!apiKey) {
    return {
      success: false,
      code: "NOT_CONFIGURED",
      error:
        "AI draft generation is not configured on the server (missing GEMINI_API_KEY).",
    };
  }

  const model = (modelOverride ?? env.GEMINI_MODEL ?? "gemini-2.5-flash").trim();
  const basePrompt = buildAiDraftPrompt({ rawText, todayIso });
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  let lastValidationError = "";

  for (let attempt = 1; attempt <= 2; attempt++) {
    const promptText =
      attempt === 1
        ? basePrompt
        : `${basePrompt}

CORRECTION REQUIRED: Your previous response could not be parsed or failed schema validation (${lastValidationError}).
Return ONLY a valid JSON object matching the exact Project and Activity schemas with valid allowed enum values, null for unknown values, and no markdown or commentary.`;

    let response: Response;
    try {
      response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: promptText }] }],
          generationConfig: {
            temperature: attempt === 1 ? 0.2 : 0.1,
            responseMimeType: "application/json",
          },
        }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (err) {
      const message =
        err instanceof Error && err.name === "TimeoutError"
          ? "The AI service timed out while analyzing your message. Please try again."
          : "Could not reach the AI service. Please check your connection and retry.";
      return {
        success: false,
        code: "UPSTREAM_ERROR",
        error: message,
      };
    }

    if (!response.ok) {
      let detail = `status ${response.status}`;
      try {
        const errBody = (await response.json()) as {
          error?: { message?: string };
        };
        if (errBody?.error?.message) {
          detail = errBody.error.message.replaceAll(apiKey, "[REDACTED]");
        }
      } catch {
        // ignore unreadable error payload
      }
      return {
        success: false,
        code: "UPSTREAM_ERROR",
        error:
          response.status === 429
            ? "AI rate limit reached. Please wait a moment and retry."
            : `AI provider request failed (${detail}).`,
      };
    }

    let rawCandidateText = "";
    try {
      const payload = (await response.json()) as {
        candidates?: {
          content?: { parts?: { text?: string }[] };
        }[];
      };
      rawCandidateText =
        payload.candidates?.[0]?.content?.parts
          ?.map((part) => part.text || "")
          .join("") || "";
    } catch {
      lastValidationError = "Upstream response was not valid JSON.";
      continue;
    }

    let parsedJson: unknown;
    try {
      parsedJson = extractJsonFromModelText(rawCandidateText);
    } catch (err) {
      lastValidationError =
        err instanceof Error ? err.message : "Invalid JSON output.";
      continue;
    }

    const validated = sanitizeAndValidateAiDraft(parsedJson, todayIso);
    if (validated.success) {
      return {
        success: true,
        data: validated.data,
        attempts: attempt,
      };
    }

    lastValidationError = validated.error;
  }

  return {
    success: false,
    code: "INVALID_AI_OUTPUT",
    error: `The AI returned malformed output after retrying (${lastValidationError}). Please try again or adjust the pasted text.`,
  };
}

