export type BroadcastTone = "energetic" | "formal" | "taglish" | "bullet" | "urgent";

export type BroadcastMessageType = "invitation" | "reminder_3d" | "reminder_1d" | "post_event";

export type VolunteerActivityCategory =
  | "COMMUNITY_SERVICE"
  | "ENVIRONMENT"
  | "BASIC_EDUCATION"
  | "MATERNAL_CHILD_HEALTH"
  | "PEACEBUILDING"
  | "ECONOMIC_DEVELOPMENT"
  | "FELLOWSHIP"
  | "DISASTER_RELIEF";

export interface BroadcastDraft {
  id?: string;
  title: string;
  organizer: string;
  category: VolunteerActivityCategory;
  date: string;
  time: string;
  callTime: string;
  venue: string;
  mapsUrl?: string;
  targetBeneficiaries?: string;
  volunteersNeeded: number;
  volunteersConfirmed: number;
  volunteerRoles?: string;
  attire: string;
  thingsToBring: string[];
  perks: string[];
  contactPerson: string;
  registrationLink?: string;
  notes?: string;
  customHashtags?: string;
}

export interface WebhookConfig {
  enabled: boolean;
  platform: "discord" | "telegram" | "slack" | "generic";
  webhookUrl: string;
  channelName?: string;
}

export interface BroadcastTemplatePreset {
  id: string;
  label: string;
  description: string;
  iconName: string;
  sampleInput: string;
  draft: BroadcastDraft;
}
