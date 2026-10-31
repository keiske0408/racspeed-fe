export type InitiativeStatus =
  "PROPOSED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export type PartnershipType =
  | "SISTER_CLUB_MOA"
  | "DISTRICT_TWIN_CLUB"
  | "PROJECT_PARTNER"
  | "SPONSOR_ROTARY_CLUB";

export type ClubPartnershipStatus = "ACTIVE" | "PENDING_MOA" | "INACTIVE";

export interface StoredInitiative {
  id: string;
  sisterClubId: string;
  source?: "LEGACY" | "ACTIVITY";
  activityId?: string;
  partnerName?: string;
  title: string;
  description: string;
  jointVolunteers: number;
  rotaryYear: string;
  status: InitiativeStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface StoredSisterClub {
  id: string;
  partnerClubName: string;
  district: string;
  country: string;
  partnershipType: PartnershipType;
  agreementSignedDate: string;
  renewalDate: string;
  liaisonOfficerName: string;
  liaisonEmail: string;
  liaisonPhone: string;
  status: ClubPartnershipStatus;
  notes: string;
  initiativesCount: number;
}

export interface SisterClubDTO extends StoredSisterClub {
  initiatives?: StoredInitiative[];
}
