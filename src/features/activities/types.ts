export const DEFAULT_CLUB_ID =
  process.env.NEXT_PUBLIC_DEFAULT_CLUB_ID ||
  "00000000-0000-0000-0000-000000000001";

export const ACTIVITY_KINDS = [
  "MEETING",
  "SERVICE_PROJECT",
  "JOINT_PROJECT",
  "FELLOWSHIP",
  "DISTRICT_EVENT",
  "PROFESSIONAL_DEVELOPMENT",
  "FUNDRAISER",
  "OTHER",
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const PROJECT_KINDS = ["SERVICE_PROJECT", "JOINT_PROJECT"] as const;
export type ProjectKind = (typeof PROJECT_KINDS)[number];

export const MEETING_TYPES = [
  "GENERAL_ASSEMBLY",
  "BOARD_MEETING",
  "COMMITTEE_MEETING",
] as const;
export type MeetingType = (typeof MEETING_TYPES)[number];

export const ACTIVITY_STATUSES = [
  "DRAFT",
  "PLANNED",
  "ONGOING",
  "COMPLETED",
  "AWAITING_REPORT",
  "ACCOMPLISHED",
  "CANCELLED",
] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];

export const RSVP_RESPONSES = ["GOING", "MAYBE", "NOT_GOING"] as const;
export type RsvpResponse = (typeof RSVP_RESPONSES)[number];

export const TEAM_ROLES = [
  "CHAIR",
  "CO_CHAIR",
  "COMMITTEE",
  "VOLUNTEER",
] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export const PARTNER_ROLES = [
  "IMPLEMENTING_PARTNER",
  "SPONSOR",
  "COOPERATING_ORGANIZATION",
  "BENEFICIARY_ORGANIZATION",
  "OTHER",
] as const;
export type PartnerRole = (typeof PARTNER_ROLES)[number];

export const COMMITTEES = [
  "CLUB_SERVICE",
  "COMMUNITY_SERVICE",
  "VOCATIONAL",
  "INTERNATIONAL",
  "PUBLIC_IMAGE",
  "FINANCE",
  "SECRETARIAT",
  "BOARD",
] as const;
export type Committee = (typeof COMMITTEES)[number];

export const AREAS_OF_FOCUS = [
  { code: "PEACEBUILDING", name: "Peacebuilding and conflict prevention" },
  { code: "DISEASE_PREVENTION", name: "Disease prevention and treatment" },
  { code: "WATER_SANITATION", name: "Water, sanitation, and hygiene" },
  { code: "MATERNAL_CHILD_HEALTH", name: "Maternal and child health" },
  { code: "BASIC_EDUCATION", name: "Basic education and literacy" },
  { code: "ECONOMIC_DEVELOPMENT", name: "Community economic development" },
  { code: "ENVIRONMENT", name: "Supporting the environment" },
] as const;

export interface ActivityKindMeta {
  label: string;
  description: string;
  isProject: boolean;
  dotClass: string;
  chipClass: string;
}

export const ACTIVITY_KIND_META: Record<ActivityKind, ActivityKindMeta> = {
  MEETING: {
    label: "Meeting",
    description:
      "General Assembly, board or committee meeting with agenda and attendance.",
    isProject: false,
    dotClass: "bg-sky-500",
    chipClass:
      "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/20",
  },
  SERVICE_PROJECT: {
    label: "Service Project",
    description:
      "Community service with beneficiaries, Areas of Focus and a Showcase report.",
    isProject: true,
    dotClass: "bg-emerald-500",
    chipClass:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20",
  },
  JOINT_PROJECT: {
    label: "Joint Project",
    description: "Service project co-implemented with partner or sister clubs.",
    isProject: true,
    dotClass: "bg-teal-500",
    chipClass:
      "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:border-teal-500/20",
  },
  FELLOWSHIP: {
    label: "Fellowship",
    description: "Social gathering, team building or celebration.",
    isProject: false,
    dotClass: "bg-pink-500",
    chipClass:
      "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-500/10 dark:text-pink-300 dark:border-pink-500/20",
  },
  DISTRICT_EVENT: {
    label: "District Event",
    description: "District conference, assembly or official visit.",
    isProject: false,
    dotClass: "bg-indigo-500",
    chipClass:
      "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/20",
  },
  PROFESSIONAL_DEVELOPMENT: {
    label: "Professional Development",
    description: "Workshop, seminar or vocational training.",
    isProject: false,
    dotClass: "bg-violet-500",
    chipClass:
      "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/20",
  },
  FUNDRAISER: {
    label: "Fundraiser",
    description: "Fund-raising activity with funding targets.",
    isProject: false,
    dotClass: "bg-amber-500",
    chipClass:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20",
  },
  OTHER: {
    label: "Other",
    description: "Any other club activity.",
    isProject: false,
    dotClass: "bg-slate-400",
    chipClass:
      "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:border-slate-500/20",
  },
};

export const ACTIVITY_STATUS_LABELS: Record<ActivityStatus, string> = {
  DRAFT: "Draft",
  PLANNED: "Planned",
  ONGOING: "Ongoing",
  COMPLETED: "Completed",
  AWAITING_REPORT: "Awaiting report",
  ACCOMPLISHED: "Accomplished",
  CANCELLED: "Cancelled",
};

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  GENERAL_ASSEMBLY: "General Assembly",
  BOARD_MEETING: "Board Meeting",
  COMMITTEE_MEETING: "Committee Meeting",
};

export function isProjectKind(kind: string): kind is ProjectKind {
  return (PROJECT_KINDS as readonly string[]).includes(kind);
}

export interface RsvpCounts {
  going: number;
  maybe: number;
  notGoing: number;
}

export interface ActivitySummaryDTO {
  id: string;
  clubId: string;
  kind: ActivityKind;
  meetingType: MeetingType | null;
  title: string;
  shortDescription: string;
  location: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  status: ActivityStatus;
  committee: Committee | null;
  ownerId: string | null;
  ownerName: string | null;
  minMembersRequired: number | null;
  capacity: number | null;
  rsvpEnabled: boolean;
  rsvpDeadline: string | null;
  selfCheckInEnabled: boolean;
  checkInWindowMinutes: number;
  volunteerHoursDefault: number;
  rsvp: RsvpCounts;
  myRsvp: RsvpResponse | null;
  attendeesCount: number;
  checkedIn: boolean;
  tasksTotal: number;
  tasksDone: number;
  commentsCount: number;
  coverUrl: string | null;
}

export interface ActivityProjectDetailsDTO {
  objective: string;
  inspiration: string;
  outcomesSummary: string;
  beneficiaryType: string;
  beneficiaryCount: number;
  volunteerMemberCount: number;
  volunteerNonmemberCount: number;
  totalVolunteerHours: number;
  fundingTotal: number;
  fundingCurrency: string;
  fundingSource: string;
  totalExpenses: number;
  supportsPolio: boolean;
  tags: string[];
  relatedLinks: { label: string; url: string }[];
  spcInitiativeId: string;
  completedAt: string | null;
  areasOfFocus: string[];
  sdgs: number[];
  partners: { id: string; name: string; role: PartnerRole }[];
}

export interface ActivityPersonDTO {
  profileId: string;
  fullName: string;
  avatarUrl: string | null;
}

export interface ActivityTeamMemberDTO extends ActivityPersonDTO {
  role: TeamRole;
}

export interface ActivityRsvpDTO extends ActivityPersonDTO {
  response: RsvpResponse;
  note: string | null;
  respondedAt: string;
}

export interface ActivityAttendeeDTO extends ActivityPersonDTO {
  id: string;
  checkInTime: string;
  checkInMethod: string;
  volunteerHours: number;
}

export interface ActivityMediaDTO {
  id: string;
  url: string | null;
  caption: string | null;
  isFeatured: boolean;
}

export interface ActivityCommentDTO {
  id: string;
  parentId: string | null;
  author: ActivityPersonDTO;
  body: string;
  createdAt: string;
  editedAt: string | null;
  isDeleted: boolean;
  reactions: { emoji: string; count: number; mine: boolean }[];
}

export interface ActivityLogEntryDTO {
  id: string;
  actorName: string;
  action: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface ActivityDetailDTO extends ActivitySummaryDTO {
  description: string;
  isPublished: boolean;
  rotaryYear: string;
  projectDetails: ActivityProjectDetailsDTO | null;
  team: ActivityTeamMemberDTO[];
  rsvps: ActivityRsvpDTO[];
  attendees: ActivityAttendeeDTO[];
  media: ActivityMediaDTO[];
  comments: ActivityCommentDTO[];
  log: ActivityLogEntryDTO[];
  isFollowing: boolean;
  canManage: boolean;
  canManageAttendance: boolean;
}
