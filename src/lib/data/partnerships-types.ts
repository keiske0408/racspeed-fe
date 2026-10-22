export type InitiativeStatus = "PROPOSED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export interface StoredInitiative {
  id: string;
  sisterClubId: string;
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
  partnershipType: "SISTER_CLUB_MOA" | "DISTRICT_TWIN_CLUB" | "PROJECT_PARTNER" | "SPONSOR_ROTARY_CLUB";
  agreementSignedDate: string;
  renewalDate: string;
  liaisonOfficerName: string;
  liaisonEmail: string;
  liaisonPhone: string;
  status: "ACTIVE" | "PENDING_MOA" | "INACTIVE";
  notes: string;
  initiativesCount: number;
}
