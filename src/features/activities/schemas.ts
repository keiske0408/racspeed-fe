import { z } from "zod";
import {
  ACTIVITY_KINDS,
  AREAS_OF_FOCUS,
  COMMITTEES,
  MEETING_TYPES,
  PARTNER_ROLES,
  PROJECT_KINDS,
  RSVP_RESPONSES,
  TEAM_ROLES,
} from "./types";

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const uuidString = z.string().regex(UUID_PATTERN, "Invalid identifier");

// Wall-clock value from a datetime-local input, interpreted in Asia/Manila.
const localDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/, "Enter a valid date and time");

const optionalText = (max: number) => z.string().trim().max(max).optional().default("");
const optionalPositiveInt = z.coerce.number().int().positive().max(100000).optional();

const NON_PROJECT_KINDS = ACTIVITY_KINDS.filter(
  (k) => k !== "MEETING" && !(PROJECT_KINDS as readonly string[]).includes(k)
) as Exclude<(typeof ACTIVITY_KINDS)[number], "MEETING" | (typeof PROJECT_KINDS)[number]>[];

const baseShape = {
  clubId: uuidString,
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(160),
  shortDescription: optionalText(280),
  description: optionalText(10000),
  location: optionalText(300),
  startAt: localDateTime,
  endAt: localDateTime,
  allDay: z.boolean().default(false),
  committee: z.enum(COMMITTEES).optional(),
  status: z.enum(["DRAFT", "PLANNED"]).default("PLANNED"),
  minMembersEnabled: z.boolean().default(false),
  minMembersRequired: optionalPositiveInt,
  capacity: optionalPositiveInt,
  rsvpEnabled: z.boolean().default(true),
  rsvpDeadline: localDateTime.optional(),
  selfCheckInEnabled: z.boolean().default(false),
  checkInWindowMinutes: z.coerce.number().int().min(0).max(1440).default(180),
  volunteerHoursDefault: z.coerce.number().min(0).max(24).default(0),
};

const meetingSchema = z.object({
  ...baseShape,
  kind: z.literal("MEETING"),
  meetingType: z.enum(MEETING_TYPES),
});

const partnerSchema = z.object({
  name: z.string().trim().min(1).max(200),
  role: z.enum(PARTNER_ROLES).default("IMPLEMENTING_PARTNER"),
});

const AREA_CODES = AREAS_OF_FOCUS.map((a) => a.code) as [string, ...string[]];

const projectSchema = z.object({
  ...baseShape,
  kind: z.enum(PROJECT_KINDS),
  objective: optionalText(2000),
  beneficiaryType: optionalText(200),
  beneficiaryTarget: z.coerce.number().int().min(0).max(1000000).default(0),
  fundingTarget: z.coerce.number().min(0).max(100000000).default(0),
  fundingSource: optionalText(300),
  areasOfFocus: z.array(z.enum(AREA_CODES)).max(7).default([]),
  sdgs: z.array(z.coerce.number().int().min(1).max(17)).max(17).default([]),
  partners: z.array(partnerSchema).max(20).default([]),
});

const generalSchema = z.object({
  ...baseShape,
  kind: z.enum(NON_PROJECT_KINDS as [string, ...string[]]),
});

export const createActivitySchema = z
  .discriminatedUnion("kind", [meetingSchema, projectSchema, generalSchema])
  .superRefine((data, ctx) => {
    if (data.endAt < data.startAt) {
      ctx.addIssue({ code: "custom", path: ["endAt"], message: "End must be after start" });
    }
    if (data.minMembersEnabled && !data.minMembersRequired) {
      ctx.addIssue({
        code: "custom",
        path: ["minMembersRequired"],
        message: "Enter the minimum number of members, or turn the requirement off",
      });
    }
    if (
      data.minMembersEnabled &&
      data.minMembersRequired &&
      data.capacity &&
      data.capacity < data.minMembersRequired
    ) {
      ctx.addIssue({ code: "custom", path: ["capacity"], message: "Capacity cannot be below the minimum" });
    }
    if (data.rsvpDeadline && data.rsvpDeadline > data.startAt) {
      ctx.addIssue({ code: "custom", path: ["rsvpDeadline"], message: "RSVP deadline must be before the start" });
    }
  });

export type CreateActivityInput = z.input<typeof createActivitySchema>;
export type CreateActivityData = z.output<typeof createActivitySchema>;

/** Minimum is only stored when the form toggle is on. */
export function resolveMinMembers(data: Pick<CreateActivityData, "minMembersEnabled" | "minMembersRequired">) {
  return data.minMembersEnabled && data.minMembersRequired ? data.minMembersRequired : null;
}

export const rsvpSchema = z.object({
  activityId: uuidString,
  response: z.enum(RSVP_RESPONSES),
  note: z.string().trim().max(280).optional(),
});

export const commentSchema = z.object({
  activityId: uuidString,
  body: z.string().trim().min(1, "Comment cannot be empty").max(5000),
  parentId: uuidString.optional(),
  mentions: z.array(uuidString).max(20).default([]),
});

export const teamMemberSchema = z.object({
  activityId: uuidString,
  profileId: uuidString,
  role: z.enum(TEAM_ROLES),
});

export const ALLOWED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export const MAX_MEDIA_BYTES = 10 * 1024 * 1024;
