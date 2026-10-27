export type ResourceCategory =
  | "SOCIAL_MEDIA"
  | "DISTRICT_PORTAL"
  | "DRIVE_DOCUMENTS"
  | "DESIGN_BRAND"
  | "COMMUNITY_TOOL"
  | "OTHER";

export interface ClubResource {
  id: string;
  clubId: string;
  title: string;
  description: string;
  url: string;
  category: ResourceCategory;
  isPinned?: boolean;
  createdAt: string;
  updatedAt: string;
}

export const RESOURCE_CATEGORIES: { value: ResourceCategory; label: string }[] = [
  { value: "SOCIAL_MEDIA", label: "Social Media & Public Image" },
  { value: "DISTRICT_PORTAL", label: "District & Rotary Portals" },
  { value: "DRIVE_DOCUMENTS", label: "Documents & Google Drive" },
  { value: "DESIGN_BRAND", label: "Brand Center & Visuals" },
  { value: "COMMUNITY_TOOL", label: "Community & External Tools" },
  { value: "OTHER", label: "General Resources" },
];
