import { z } from "zod";
import {
  ACTIVITY_KINDS,
  ACTIVITY_PRIORITIES,
  ACTIVITY_STATUSES,
  AREAS_OF_FOCUS,
  COMMITTEES,
  MEETING_TYPES,
  PARTNER_ROLES,
  PROJECT_KINDS,
  type ActivityKind,
  type ActivityPriority,
  type ActivityStatus,
  type Committee,
  type MeetingType,
  type PartnerRole,
} from "./types";
import {
  AREA_CODES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  initialTaskInputSchema,
  meetingSchema,
  projectSchema,
} from "./schemas";
import type { TaskPriority, TaskStatus } from "@/lib/data/tasks-types";

export const MAX_RAW_TEXT_LENGTH = 20_000;

export const URL_PURPOSES = ["primer", "registration", "other"] as const;
export type AiUrlPurpose = (typeof URL_PURPOSES)[number];

const EXCLUDED_PROJECT_PROMPT_FIELDS = new Set([
  "clubId",
  "ownerId",
  "sisterClubId",
  "committeeMembers",
  "initialTasks",
  "minMembersEnabled",
  "minMembersRequired",
  "capacity",
  "rsvpEnabled",
  "selfCheckInEnabled",
  "qrCheckInEnabled",
  "checkInWindowMinutes",
  "volunteerHoursDefault",
]);

const EXCLUDED_TASK_PROMPT_FIELDS = new Set(["assigneeId"]);

/**
 * Dynamically inspects the live Zod validation schemas (`projectSchema`,
 * `meetingSchema`, `initialTaskInputSchema`) via `z.toJSONSchema` so any
 * field or enum changes automatically propagate to the LLM prompt.
 */
export function buildDynamicPromptSchemas(): {
  projectSchemaPrompt: string;
  activitySchemaPrompt: string;
} {
  const projectJson = z.toJSONSchema(projectSchema, {
    unrepresentable: "any",
  }) as {
    properties?: Record<string, Record<string, unknown>>;
  };
  const meetingJson = z.toJSONSchema(meetingSchema, {
    unrepresentable: "any",
  }) as {
    properties?: Record<string, Record<string, unknown>>;
  };
  const taskJson = z.toJSONSchema(initialTaskInputSchema, {
    unrepresentable: "any",
  }) as {
    properties?: Record<string, Record<string, unknown>>;
  };

  const projectFields: Record<string, unknown> = {};
  for (const [key, prop] of Object.entries(projectJson.properties ?? {})) {
    if (EXCLUDED_PROJECT_PROMPT_FIELDS.has(key)) continue;
    projectFields[key] = { ...prop };
  }

  // Merge full ACTIVITY_KINDS + optional meetingType from meetingSchema so non-project proposals are also expressible.
  projectFields.kind = {
    type: "string",
    enum: [...ACTIVITY_KINDS],
    description:
      "Use JOINT_PROJECT for partner/sister-club collaborations, SERVICE_PROJECT for community outreach, or the best matching club activity kind.",
  };
  if (meetingJson.properties?.meetingType) {
    projectFields.meetingType = {
      ...meetingJson.properties.meetingType,
      nullable: true,
      description: "Only set when kind is MEETING; otherwise null.",
    };
  }
  projectFields.areasOfFocus = {
    type: "array",
    items: {
      type: "string",
      enum: AREAS_OF_FOCUS.map((a) => `${a.code} (${a.name})`),
    },
    description:
      "Return only the uppercase enum codes (e.g. BASIC_EDUCATION, ECONOMIC_DEVELOPMENT).",
  };
  projectFields.status = {
    type: "string",
    enum: [...ACTIVITY_STATUSES],
    default: "DRAFT",
    description:
      "Use DRAFT for incoming project invitations/proposals awaiting club meeting approval.",
  };

  // Required contextual extraction fields from the pasted invitation/chat
  projectFields.organizer = {
    type: ["string", "null"],
    description: "Host/organizing club or organization name, or null.",
  };
  projectFields.call_to_action = {
    type: ["string", "null"],
    description:
      "Primary ask or call to action (e.g. 'Sign up to partner if interested'), or null.",
  };
  projectFields.addressed_to = {
    type: ["string", "null"],
    description: "Recipient role/name (e.g. 'Club President'), or null.",
  };
  projectFields.sent_by = {
    type: ["string", "null"],
    description: "Sender name/title if present, or null.",
  };
  projectFields.urls = {
    type: "array",
    items: {
      type: "object",
      properties: {
        url: { type: "string", description: "Exact URL copied verbatim" },
        label: { type: "string" },
        purpose: { type: "string", enum: [...URL_PURPOSES] },
      },
      required: ["url", "label", "purpose"],
    },
  };
  projectFields.dates_mentioned = {
    type: "array",
    items: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "ISO date YYYY-MM-DD resolved against Today's date",
        },
        label: { type: "string" },
      },
      required: ["date", "label"],
    },
  };

  const activityFields: Record<string, unknown> = {};
  for (const [key, prop] of Object.entries(taskJson.properties ?? {})) {
    if (EXCLUDED_TASK_PROMPT_FIELDS.has(key)) continue;
    activityFields[key] = { ...prop };
  }
  activityFields.dueDate = {
    type: ["string", "null"],
    description: "ISO date YYYY-MM-DD resolved against Today's date, or null.",
  };
  activityFields.order = {
    type: "integer",
    description: "1-based sequential order for the club meeting/prep checklist.",
  };

  const fullProjectEnvelope = {
    type: "object",
    properties: {
      project: {
        type: "object",
        properties: projectFields,
      },
      missing_info: {
        type: "array",
        items: { type: "string" },
        description:
          "Unclear, ambiguous, or missing details (e.g., venue, budget, exact time, deadline).",
      },
    },
    required: ["project", "missing_info"],
  };

  const fullActivityEnvelope = {
    type: "object",
    description:
      "Return an `activities` array of 6-12 checklist items matching these fields:",
    properties: {
      activities: {
        type: "array",
        minItems: 6,
        maxItems: 12,
        items: {
          type: "object",
          properties: activityFields,
          required: ["title", "description", "dueDate", "priority", "status", "order"],
        },
      },
    },
    required: ["activities"],
  };

  return {
    projectSchemaPrompt: JSON.stringify(fullProjectEnvelope),
    activitySchemaPrompt: JSON.stringify(fullActivityEnvelope),
  };
}

/**
 * Builds the exact runtime prompt specified for the club project-evaluation assistant.
 */
export function buildAiDraftPrompt({
  rawText,
  todayIso,
}: {
  rawText: string;
  todayIso: string;
}): string {
  const { projectSchemaPrompt, activitySchemaPrompt } =
    buildDynamicPromptSchemas();

  return `You are an assistant that helps a club evaluate and prepare for projects. You will receive a raw message (chat or email) about a project invitation or proposal. Extract the project details and generate a checklist of activities for the club's meeting and approval process.

Today's date: ${todayIso}
Project schema (fill only these fields): ${projectSchemaPrompt}
Activity schema: ${activitySchemaPrompt}

Rules:
- Use only information in the message. Never invent dates, names, links, or amounts. Use null for unknown values and list them in \`missing_info\`.
- Resolve dates against today's date and output ISO format.
- Keep original URLs exactly as written and label each by purpose.
- Generate 6-12 specific, actionable checklist items in logical order, using the real dates and links from the message.
- Respond with valid JSON only, matching the schema. No markdown, no commentary.

Message:
${rawText}`;
}

export const aiExtractedUrlSchema = z.object({
  url: z.string().trim().min(1).max(2000),
  label: z.string().trim().min(1).max(160),
  purpose: z.enum(URL_PURPOSES).default("other"),
});

export const aiExtractedDateSchema = z.object({
  date: z.string().trim().min(4).max(32),
  label: z.string().trim().min(1).max(160),
});

export const aiExtractedPartnerSchema = z.object({
  name: z.string().trim().min(1).max(200),
  role: z.enum(PARTNER_ROLES).default("IMPLEMENTING_PARTNER"),
});

export const aiChecklistItemSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  priority: z.enum(TASK_PRIORITIES).default("MEDIUM"),
  status: z.enum(TASK_STATUSES).default("TODO"),
  order: z.coerce.number().int().min(1).max(100),
});

export const aiProjectFieldsSchema = z.object({
  kind: z.enum(ACTIVITY_KINDS).nullable().optional(),
  meetingType: z.enum(MEETING_TYPES).nullable().optional(),
  title: z.string().trim().max(160).nullable().optional(),
  shortDescription: z.string().trim().max(280).nullable().optional(),
  description: z.string().trim().max(10000).nullable().optional(),
  location: z.string().trim().max(300).nullable().optional(),
  startAt: z.string().trim().nullable().optional(),
  endAt: z.string().trim().nullable().optional(),
  allDay: z.boolean().nullable().optional(),
  committee: z.enum(COMMITTEES).nullable().optional(),
  status: z.enum(ACTIVITY_STATUSES).nullable().optional(),
  priority: z.enum(ACTIVITY_PRIORITIES).nullable().optional(),
  rsvpDeadline: z.string().trim().nullable().optional(),
  objective: z.string().trim().max(2000).nullable().optional(),
  beneficiaryType: z.string().trim().max(200).nullable().optional(),
  beneficiaryTarget: z.coerce.number().int().min(0).max(1000000).nullable().optional(),
  fundingTarget: z.coerce.number().min(0).max(100000000).nullable().optional(),
  fundingSource: z.string().trim().max(300).nullable().optional(),
  areasOfFocus: z.array(z.enum(AREA_CODES)).max(7).nullable().optional(),
  sdgs: z.array(z.coerce.number().int().min(1).max(17)).max(17).nullable().optional(),
  partners: z.array(aiExtractedPartnerSchema).max(20).nullable().optional(),
  relatedLinks: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(160),
        url: z.string().trim().min(1).max(2000),
      }),
    )
    .max(20)
    .nullable()
    .optional(),
  organizer: z.string().trim().max(200).nullable().optional(),
  call_to_action: z.string().trim().max(400).nullable().optional(),
  addressed_to: z.string().trim().max(200).nullable().optional(),
  sent_by: z.string().trim().max(200).nullable().optional(),
  urls: z.array(aiExtractedUrlSchema).max(20).nullable().optional(),
  dates_mentioned: z.array(aiExtractedDateSchema).max(20).nullable().optional(),
});

export const aiDraftResponseSchema = z.object({
  project: aiProjectFieldsSchema,
  activities: z.array(aiChecklistItemSchema).min(1).max(20),
  missing_info: z.array(z.string().trim().min(1)).default([]),
});

export type AiChecklistItem = z.infer<typeof aiChecklistItemSchema>;
export type AiDraftResponse = z.infer<typeof aiDraftResponseSchema>;

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

/**
 * Resolves full or partial dates (e.g. "2026-11-28", "Nov 28", "Jan 15", "11/28")
 * against `todayIso` (`YYYY-MM-DD`). If the year is omitted, chooses the next
 * upcoming occurrence relative to `todayIso`.
 */
export function resolvePartialDateToIso(
  input: string | null | undefined,
  todayIso: string,
): { date: string; time: string | null } | null {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 1. Standard ISO date or datetime: YYYY-MM-DD or YYYY-MM-DDTHH:mm(:ss)(Z|+08:00)
  const isoMatch = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/,
  );
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month)) {
      const date = `${year}-${pad2(month)}-${pad2(day)}`;
      const time =
        isoMatch[4] && isoMatch[5] ? `${isoMatch[4]}:${isoMatch[5]}` : null;
      return { date, time };
    }
  }

  const [todayYear, todayMonth, todayDay] = todayIso.split("-").map(Number);

  // 2. Named month + day (+ optional year): "Nov 28", "November 28, 2026"
  const monthNameMatch = trimmed.match(
    /^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?/i,
  );
  if (monthNameMatch) {
    const month = MONTHS[monthNameMatch[1].toLowerCase()];
    const day = Number(monthNameMatch[2]);
    if (month && day >= 1 && day <= 31) {
      let year = monthNameMatch[3] ? Number(monthNameMatch[3]) : todayYear;
      if (!monthNameMatch[3]) {
        const candidateMmDd = month * 100 + day;
        const todayMmDd = todayMonth * 100 + todayDay;
        if (candidateMmDd < todayMmDd) {
          year += 1;
        }
      }
      if (day <= daysInMonth(year, month)) {
        return { date: `${year}-${pad2(month)}-${pad2(day)}`, time: null };
      }
    }
  }

  // 3. Numeric MM/DD or MM-DD (+ optional YYYY)
  const slashMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?$/);
  if (slashMatch) {
    const month = Number(slashMatch[1]);
    const day = Number(slashMatch[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      let year = slashMatch[3] ? Number(slashMatch[3]) : todayYear;
      if (!slashMatch[3] && month * 100 + day < todayMonth * 100 + todayDay) {
        year += 1;
      }
      if (day <= daysInMonth(year, month)) {
        return { date: `${year}-${pad2(month)}-${pad2(day)}`, time: null };
      }
    }
  }

  return null;
}

/**
 * Unwraps markdown links (`[Label](https://example.com)`) into clean URL strings
 * while keeping the original URL untouched.
 */
export function unwrapMarkdownLink(raw: string): {
  url: string;
  markdownLabel: string | null;
} {
  const trimmed = raw.trim();
  const md = trimmed.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/i);
  if (md) {
    return { url: md[2].trim(), markdownLabel: md[1].trim() };
  }
  const inlineUrl = trimmed.match(/https?:\/\/[^\s)>"']+/i);
  if (inlineUrl) {
    return { url: inlineUrl[0].trim(), markdownLabel: null };
  }
  return { url: trimmed, markdownLabel: null };
}

/**
 * Parses a raw LLM text response into JSON, handling optional markdown code fences
 * or extra surrounding prose safely.
 */
export function extractJsonFromModelText(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Empty response from AI model.");
  }

  // Strip ```json ... ``` fences if model emitted them despite instructions
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    const firstBrace = candidate.indexOf("{");
    const lastBrace = candidate.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
    }
    throw new Error("AI response was not valid JSON.");
  }
}

function normalizeLocalDateTimeString(
  raw: unknown,
  todayIso: string,
  defaultHour: string,
): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const resolved = resolvePartialDateToIso(raw, todayIso);
  if (!resolved) return null;
  return `${resolved.date}T${resolved.time || defaultHour}`;
}

function normalizeDateOnlyString(raw: unknown, todayIso: string): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const resolved = resolvePartialDateToIso(raw, todayIso);
  return resolved ? resolved.date : null;
}

/**
 * Normalizes benign formatting variations (date-only -> YYYY-MM-DDTHH:mm,
 * markdown URL unwrapping, area code annotations) and validates strictly
 * against `aiDraftResponseSchema` (including all fixed app enums).
 */
export function sanitizeAndValidateAiDraft(
  rawUnknown: unknown,
  todayIso: string,
):
  | { success: true; data: AiDraftResponse }
  | { success: false; error: string } {
  if (!rawUnknown || typeof rawUnknown !== "object" || Array.isArray(rawUnknown)) {
    return { success: false, error: "Root AI output must be a JSON object." };
  }

  const root = rawUnknown as Record<string, unknown>;
  const rawProject =
    root.project && typeof root.project === "object" && !Array.isArray(root.project)
      ? ({ ...(root.project as Record<string, unknown>) } as Record<string, unknown>)
      : {};

  // Clean up optional date fields into formats accepted by the schema & UI
  if ("startAt" in rawProject) {
    rawProject.startAt = normalizeLocalDateTimeString(
      rawProject.startAt,
      todayIso,
      "09:00",
    );
  }
  if ("endAt" in rawProject) {
    rawProject.endAt = normalizeLocalDateTimeString(
      rawProject.endAt,
      todayIso,
      "17:00",
    );
  }
  if ("rsvpDeadline" in rawProject) {
    rawProject.rsvpDeadline = normalizeLocalDateTimeString(
      rawProject.rsvpDeadline,
      todayIso,
      "18:00",
    );
  }

  // Strip optional parenthetical area description if the model echoed "BASIC_EDUCATION (Basic education...)"
  if (Array.isArray(rawProject.areasOfFocus)) {
    rawProject.areasOfFocus = rawProject.areasOfFocus.map((code) => {
      if (typeof code !== "string") return code;
      return code.split(/\s*\(/)[0].trim().toUpperCase();
    });
  }

  // Unwrap markdown links cleanly while preserving exact URLs
  if (Array.isArray(rawProject.urls)) {
    rawProject.urls = rawProject.urls
      .map((entry) => {
        if (typeof entry === "string") {
          const { url, markdownLabel } = unwrapMarkdownLink(entry);
          return { url, label: markdownLabel || "Reference Link", purpose: "other" };
        }
        if (entry && typeof entry === "object") {
          const obj = entry as Record<string, unknown>;
          const { url, markdownLabel } = unwrapMarkdownLink(
            String(obj.url || ""),
          );
          const rawPurpose = String(obj.purpose || "other").toLowerCase().trim();
          return {
            url,
            label:
              String(obj.label || "").trim() || markdownLabel || "Reference Link",
            purpose: rawPurpose,
          };
        }
        return entry;
      })
      .filter((u) => {
        if (!u || typeof u !== "object") return false;
        const urlStr = String((u as { url?: unknown }).url || "");
        return /^https?:\/\//i.test(urlStr);
      });
  }

  if (Array.isArray(rawProject.dates_mentioned)) {
    rawProject.dates_mentioned = rawProject.dates_mentioned
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const obj = entry as Record<string, unknown>;
        const date = normalizeDateOnlyString(obj.date, todayIso);
        if (!date) return null;
        return {
          date,
          label: String(obj.label || "Mentioned date").trim() || "Mentioned date",
        };
      })
      .filter(Boolean);
  }

  // Clean checklist items & normalize dueDate values
  const rawActivities = Array.isArray(root.activities)
    ? root.activities.map((item, idx) => {
        if (!item || typeof item !== "object") return item;
        const obj = { ...(item as Record<string, unknown>) };
        if (obj.dueDate !== null && obj.dueDate !== undefined) {
          obj.dueDate = normalizeDateOnlyString(obj.dueDate, todayIso);
        }
        if (obj.order === undefined || obj.order === null) {
          obj.order = idx + 1;
        }
        if (typeof obj.status === "string") {
          obj.status = obj.status.trim().toUpperCase();
        }
        if (typeof obj.priority === "string") {
          obj.priority = obj.priority.trim().toUpperCase();
        }
        return obj;
      })
    : root.activities;

  const normalizedRoot = {
    project: rawProject,
    activities: rawActivities,
    missing_info: Array.isArray(root.missing_info)
      ? root.missing_info
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter(Boolean)
      : [],
  };

  const parsed = aiDraftResponseSchema.safeParse(normalizedRoot);
  if (!parsed.success) {
    const issueSummary = parsed.error.issues
      .slice(0, 4)
      .map((i) => `${i.path.join(".") || "root"}: ${i.message}`)
      .join("; ");
    return {
      success: false,
      error: issueSummary || "AI output failed schema validation.",
    };
  }

  return { success: true, data: parsed.data };
}

export interface EditableChecklistItem {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  priority: TaskPriority;
  status: TaskStatus;
  assigneeId?: string;
  order: number;
}

export interface EditableRelatedLink {
  label: string;
  url: string;
  purpose: AiUrlPurpose;
}

export interface ActivityFormState {
  kind: ActivityKind;
  meetingType: MeetingType;
  title: string;
  shortDescription: string;
  description: string;
  location: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  committee: Committee | "";
  status: ActivityStatus;
  priority: ActivityPriority;
  objective: string;
  beneficiaryType: string;
  beneficiaryTarget: number;
  fundingTarget: number;
  fundingSource: string;
  areasOfFocus: string[];
  sdgs: number[];
  selectedPartnerIds: string[];
  externalPartners: { name: string; role: PartnerRole }[];
  relatedLinks: EditableRelatedLink[];
  initialTasks: EditableChecklistItem[];
}

export interface MappedAiDraftResult {
  form: ActivityFormState;
  meta: {
    organizer: string | null;
    callToAction: string | null;
    addressedTo: string | null;
    sentBy: string | null;
    datesMentioned: { date: string; label: string }[];
    missingInfo: string[];
  };
}

/**
 * Maps validated AI extraction JSON cleanly into the app's existing
 * `ActivityFormState` (compatible with `createActivitySchema`).
 */
export function mapAiDraftToFormDraft(
  validated: AiDraftResponse,
  {
    todayIso,
    partnerClubs,
    canCreateProject = true,
    canCreateEvent = true,
  }: {
    todayIso: string;
    partnerClubs: { id: string; name: string }[];
    canCreateProject?: boolean;
    canCreateEvent?: boolean;
  },
): MappedAiDraftResult {
  const p = validated.project;

  // Choose an allowed ActivityKind respecting user permissions
  let kind: ActivityKind = p.kind || "JOINT_PROJECT";
  if ((PROJECT_KINDS as readonly string[]).includes(kind) && !canCreateProject) {
    kind = canCreateEvent ? "OTHER" : kind;
  } else if (!(PROJECT_KINDS as readonly string[]).includes(kind) && !canCreateEvent) {
    kind = canCreateProject ? "SERVICE_PROJECT" : kind;
  }

  // Deduplicate URLs preserving verbatim link strings
  const seenUrls = new Set<string>();
  const relatedLinks: EditableRelatedLink[] = [];
  for (const item of p.urls ?? []) {
    if (!item.url || seenUrls.has(item.url)) continue;
    seenUrls.add(item.url);
    relatedLinks.push({
      label: item.label,
      url: item.url,
      purpose: item.purpose,
    });
  }
  for (const item of p.relatedLinks ?? []) {
    if (!item.url || seenUrls.has(item.url)) continue;
    seenUrls.add(item.url);
    relatedLinks.push({
      label: item.label,
      url: item.url,
      purpose: "other",
    });
  }

  // Resolve dates cleanly ensuring endAt >= startAt
  const mentionedDates = (p.dates_mentioned ?? [])
    .map((d) => d.date)
    .sort();
  const fallbackStart = `${addDaysIso(todayIso, 7)}T09:00`;
  const startAt =
    p.startAt ||
    (mentionedDates[0] ? `${mentionedDates[0]}T09:00` : fallbackStart);
  let endAt =
    p.endAt ||
    (mentionedDates.length > 1
      ? `${mentionedDates[mentionedDates.length - 1]}T17:00`
      : `${startAt.slice(0, 10)}T17:00`);
  if (endAt < startAt) {
    endAt = `${startAt.slice(0, 10)}T23:59`;
  }

  // Match organizer / partner names to registered sister/partner clubs
  const selectedPartnerIds: string[] = [];
  const externalPartners: { name: string; role: PartnerRole }[] = [];
  const seenExternalNames = new Set<string>();

  const registerPartnerName = (name: string, role: PartnerRole) => {
    const cleaned = name.trim();
    if (!cleaned) return;
    const lower = cleaned.toLowerCase();
    const matchedClub = partnerClubs.find(
      (club) =>
        club.name.trim().toLowerCase() === lower ||
        club.name.trim().toLowerCase().includes(lower) ||
        lower.includes(club.name.trim().toLowerCase()),
    );
    if (matchedClub) {
      if (!selectedPartnerIds.includes(matchedClub.id)) {
        selectedPartnerIds.push(matchedClub.id);
      }
      return;
    }
    if (!seenExternalNames.has(lower)) {
      seenExternalNames.add(lower);
      externalPartners.push({ name: cleaned, role });
    }
  };

  for (const partner of p.partners ?? []) {
    registerPartnerName(partner.name, partner.role);
  }
  if (p.organizer) {
    registerPartnerName(p.organizer, "IMPLEMENTING_PARTNER");
  }
  if (
    kind === "JOINT_PROJECT" &&
    selectedPartnerIds.length === 0 &&
    externalPartners.length === 0 &&
    p.sent_by
  ) {
    registerPartnerName(p.sent_by, "IMPLEMENTING_PARTNER");
  }

  // Build readable description retaining context + links
  const baseDesc = (p.description || p.shortDescription || "").trim();
  const linkLines = relatedLinks.map(
    (l) => `- ${l.label} (${l.purpose}): ${l.url}`,
  );
  const contextLines = [
    p.organizer ? `Host / Organizer: ${p.organizer}` : null,
    p.call_to_action ? `Call to Action: ${p.call_to_action}` : null,
    p.addressed_to ? `Addressed To: ${p.addressed_to}` : null,
    p.sent_by ? `Sent By: ${p.sent_by}` : null,
  ].filter(Boolean) as string[];

  const extraSections: string[] = [];
  if (contextLines.length > 0) {
    extraSections.push(`Invitation Details:\n${contextLines.join("\n")}`);
  }
  if (linkLines.length > 0) {
    extraSections.push(`Reference Links:\n${linkLines.join("\n")}`);
  }

  const combinedDescription = [baseDesc, ...extraSections]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 10_000);

  // Sort checklist items chronologically by dueDate (when present), then by order
  const startDateOnly = startAt.slice(0, 10);
  const defaultTaskDue =
    startDateOnly >= todayIso ? startDateOnly : addDaysIso(todayIso, 3);

  const sortedItems = [...validated.activities].sort((a, b) => {
    if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
      return a.dueDate.localeCompare(b.dueDate);
    }
    return a.order - b.order;
  });

  const initialTasks: EditableChecklistItem[] = sortedItems.map((item, idx) => ({
    id: `ai-task-${idx + 1}`,
    title: item.title,
    description: item.description || "",
    dueDate: item.dueDate || defaultTaskDue,
    priority: item.priority,
    status: item.status || "TODO",
    order: idx + 1,
  }));

  return {
    form: {
      kind,
      meetingType: p.meetingType || "GENERAL_ASSEMBLY",
      title: (p.title || "").trim(),
      shortDescription: (p.shortDescription || "").trim().slice(0, 280),
      description: combinedDescription,
      location: (p.location || "").trim(),
      startAt,
      endAt,
      allDay: Boolean(p.allDay),
      committee: p.committee || "",
      status: p.status || "DRAFT",
      priority: p.priority || "MEDIUM",
      objective: (p.objective || "").trim(),
      beneficiaryType: (p.beneficiaryType || "").trim(),
      beneficiaryTarget: p.beneficiaryTarget ?? 0,
      fundingTarget: p.fundingTarget ?? 0,
      fundingSource: (p.fundingSource || "").trim(),
      areasOfFocus: p.areasOfFocus ?? [],
      sdgs: p.sdgs ?? [],
      selectedPartnerIds,
      externalPartners,
      relatedLinks,
      initialTasks,
    },
    meta: {
      organizer: p.organizer ?? null,
      callToAction: p.call_to_action ?? null,
      addressedTo: p.addressed_to ?? null,
      sentBy: p.sent_by ?? null,
      datesMentioned: p.dates_mentioned ?? [],
      missingInfo: validated.missing_info ?? [],
    },
  };
}

export interface FormFieldConflict {
  field: keyof ActivityFormState;
  label: string;
  currentValue: string;
  incomingValue: string;
}

/**
 * Compares user-entered form values against incoming AI values so existing
 * entries are never silently overwritten.
 */
export function detectFormConflicts(
  current: ActivityFormState,
  incoming: ActivityFormState,
  options?: { defaultStartAt?: string; defaultEndAt?: string },
): FormFieldConflict[] {
  const conflicts: FormFieldConflict[] = [];

  const checkString = (
    field: keyof ActivityFormState,
    label: string,
    currVal: string,
    incVal: string,
    ignoreDefault?: string,
  ) => {
    const c = currVal.trim();
    const i = incVal.trim();
    if (!c || !i) return;
    if (ignoreDefault && c === ignoreDefault) return;
    if (c !== i) {
      conflicts.push({
        field,
        label,
        currentValue: c.length > 80 ? `${c.slice(0, 77)}...` : c,
        incomingValue: i.length > 80 ? `${i.slice(0, 77)}...` : i,
      });
    }
  };

  checkString("title", "Title", current.title, incoming.title);
  checkString(
    "shortDescription",
    "Short description",
    current.shortDescription,
    incoming.shortDescription,
  );
  checkString(
    "description",
    "Description",
    current.description,
    incoming.description,
  );
  checkString("location", "Location", current.location, incoming.location);
  checkString(
    "startAt",
    "Start date & time",
    current.startAt,
    incoming.startAt,
    options?.defaultStartAt,
  );
  checkString(
    "endAt",
    "End date & time",
    current.endAt,
    incoming.endAt,
    options?.defaultEndAt,
  );
  checkString("committee", "Committee", current.committee, incoming.committee);
  checkString("objective", "Objective", current.objective, incoming.objective);
  checkString(
    "beneficiaryType",
    "Beneficiary group",
    current.beneficiaryType,
    incoming.beneficiaryType,
  );
  checkString(
    "fundingSource",
    "Funding source",
    current.fundingSource,
    incoming.fundingSource,
  );

  if (
    current.beneficiaryTarget > 0 &&
    incoming.beneficiaryTarget > 0 &&
    current.beneficiaryTarget !== incoming.beneficiaryTarget
  ) {
    conflicts.push({
      field: "beneficiaryTarget",
      label: "Target beneficiaries",
      currentValue: String(current.beneficiaryTarget),
      incomingValue: String(incoming.beneficiaryTarget),
    });
  }
  if (
    current.fundingTarget > 0 &&
    incoming.fundingTarget > 0 &&
    current.fundingTarget !== incoming.fundingTarget
  ) {
    conflicts.push({
      field: "fundingTarget",
      label: "Funding target",
      currentValue: String(current.fundingTarget),
      incomingValue: String(incoming.fundingTarget),
    });
  }
  if (current.initialTasks.length > 0 && incoming.initialTasks.length > 0) {
    conflicts.push({
      field: "initialTasks",
      label: "Checklist / action items",
      currentValue: `${current.initialTasks.length} existing item(s)`,
      incomingValue: `${incoming.initialTasks.length} generated item(s)`,
    });
  }

  return conflicts;
}

/**
 * Merges incoming AI draft values into the form state.
 * With `strategy === "fill_empty"`, user-entered values are strictly preserved
 * and only blank fields are filled (while unique links/partners/tasks are appended).
 */
export function mergeAiDraftWithExistingForm(
  current: ActivityFormState,
  incoming: ActivityFormState,
  strategy: "fill_empty" | "overwrite",
  options?: { defaultStartAt?: string; defaultEndAt?: string },
): ActivityFormState {
  if (strategy === "overwrite") {
    return {
      ...incoming,
      externalPartners: incoming.externalPartners.map((p) => ({ ...p })),
      relatedLinks: incoming.relatedLinks.map((l) => ({ ...l })),
      initialTasks: incoming.initialTasks.map((t, idx) => ({
        ...t,
        order: idx + 1,
      })),
    };
  }

  const pickStr = (curr: string, inc: string, defaultVal?: string) => {
    const c = curr.trim();
    if (c && (!defaultVal || c !== defaultVal)) return curr;
    return inc;
  };

  const mergedPartnerIds = Array.from(
    new Set([...current.selectedPartnerIds, ...incoming.selectedPartnerIds]),
  );

  const externalMap = new Map<string, { name: string; role: PartnerRole }>();
  for (const p of [...current.externalPartners, ...incoming.externalPartners]) {
    const key = p.name.trim().toLowerCase();
    if (key && !externalMap.has(key)) {
      externalMap.set(key, { ...p });
    }
  }

  const linkMap = new Map<string, EditableRelatedLink>();
  for (const l of [...current.relatedLinks, ...incoming.relatedLinks]) {
    if (l.url && !linkMap.has(l.url)) {
      linkMap.set(l.url, { ...l });
    }
  }

  const taskTitles = new Set(
    current.initialTasks.map((t) => t.title.trim().toLowerCase()),
  );
  const combinedTasks = [
    ...current.initialTasks,
    ...incoming.initialTasks.filter(
      (t) => !taskTitles.has(t.title.trim().toLowerCase()),
    ),
  ].map((t, idx) => ({ ...t, order: idx + 1 }));

  return {
    kind: current.title.trim() ? current.kind : incoming.kind,
    meetingType:
      current.kind === "MEETING" ? current.meetingType : incoming.meetingType,
    title: pickStr(current.title, incoming.title),
    shortDescription: pickStr(
      current.shortDescription,
      incoming.shortDescription,
    ),
    description: pickStr(current.description, incoming.description),
    location: pickStr(current.location, incoming.location),
    startAt: pickStr(
      current.startAt,
      incoming.startAt,
      options?.defaultStartAt,
    ),
    endAt: pickStr(current.endAt, incoming.endAt, options?.defaultEndAt),
    allDay: current.allDay || incoming.allDay,
    committee: current.committee || incoming.committee,
    status: current.title.trim() ? current.status : incoming.status,
    priority:
      current.priority && current.priority !== "MEDIUM"
        ? current.priority
        : incoming.priority || "MEDIUM",
    objective: pickStr(current.objective, incoming.objective),
    beneficiaryType: pickStr(current.beneficiaryType, incoming.beneficiaryType),
    beneficiaryTarget:
      current.beneficiaryTarget > 0
        ? current.beneficiaryTarget
        : incoming.beneficiaryTarget,
    fundingTarget:
      current.fundingTarget > 0 ? current.fundingTarget : incoming.fundingTarget,
    fundingSource: pickStr(current.fundingSource, incoming.fundingSource),
    areasOfFocus:
      current.areasOfFocus.length > 0
        ? current.areasOfFocus
        : incoming.areasOfFocus,
    sdgs: current.sdgs.length > 0 ? current.sdgs : incoming.sdgs,
    selectedPartnerIds: mergedPartnerIds,
    externalPartners: Array.from(externalMap.values()),
    relatedLinks: Array.from(linkMap.values()),
    initialTasks: combinedTasks,
  };
}

