"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser, assertPermission } from "@/lib/auth/session";
import {
  addCustomSisterClub,
  updateCustomSisterClub,
  deleteCustomSisterClub,
  addCustomInitiative,
  updateCustomInitiative,
  deleteCustomInitiative,
  normalizeSisterClubId,
  StoredInitiative,
  InitiativeStatus,
  PartnershipType,
  ClubPartnershipStatus,
  SisterClubDTO,
} from "@/lib/data/partnerships-storage";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_CLUB_ID = "00000000-0000-0000-0000-000000000001";

const createSisterClubSchema = z.object({
  partnerClubName: z.string().min(3, "Club name must be at least 3 characters"),
  district: z.string().min(1, "District is required"),
  country: z.string().min(2, "Country is required").default("Philippines"),
  partnershipType: z.enum([
    "SISTER_CLUB_MOA",
    "DISTRICT_TWIN_CLUB",
    "PROJECT_PARTNER",
    "SPONSOR_ROTARY_CLUB",
  ]).default("SISTER_CLUB_MOA"),
  agreementSignedDate: z.string().optional().nullable(),
  renewalDate: z.string().optional().nullable(),
  liaisonOfficerName: z.string().optional().nullable(),
  liaisonEmail: z.string().email("Invalid email").optional().nullable().or(z.literal("")),
  liaisonPhone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  homeClubId: z.string().regex(UUID_PATTERN, "Invalid club identifier").default(DEFAULT_CLUB_ID),
});

export async function createSisterClubAction(formData: FormData) {
  const user = await requireUser();
  const rawClubId = (formData.get("homeClubId") as string)?.trim() || "";
  const homeClubId = UUID_PATTERN.test(rawClubId) ? rawClubId : DEFAULT_CLUB_ID;
  await assertPermission(homeClubId, "SETTINGS_MANAGE");

  const validated = createSisterClubSchema.safeParse({
    partnerClubName: formData.get("partnerClubName"),
    district: formData.get("district"),
    country: formData.get("country") || "Philippines",
    partnershipType: formData.get("partnershipType"),
    agreementSignedDate: formData.get("agreementSignedDate") || undefined,
    renewalDate: formData.get("renewalDate") || undefined,
    liaisonOfficerName: formData.get("liaisonOfficerName") || undefined,
    liaisonEmail: formData.get("liaisonEmail") || undefined,
    liaisonPhone: formData.get("liaisonPhone") || undefined,
    notes: formData.get("notes") || undefined,
    homeClubId,
  });

  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message || "Invalid partnership data" };
  }

  const {
    partnerClubName,
    district,
    country,
    partnershipType,
    agreementSignedDate,
    renewalDate,
    liaisonOfficerName,
    liaisonEmail,
    liaisonPhone,
    notes,
  } = validated.data;

  // For collaborative project partners, this is a prospective alliance:
  // No agreements signed and no expiration date. Initial status is PENDING_MOA.
  const isProjectPartner = partnershipType === "PROJECT_PARTNER";
  const agreementSignedDateToSave = isProjectPartner
    ? null
    : agreementSignedDate || new Date().toISOString().split("T")[0];
  const renewalDateToSave = isProjectPartner
    ? null
    : renewalDate || "2027-06-30";
  const initialStatus: ClubPartnershipStatus = isProjectPartner
    ? "PENDING_MOA"
    : "ACTIVE";

  const generatedId = randomUUID();
  let savedId = generatedId;

  try {
    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from("sister_clubs")
      .insert({
        id: generatedId,
        home_club_id: homeClubId,
        partner_club_name: partnerClubName,
        district,
        country,
        partnership_type: partnershipType,
        agreement_signed_date: agreementSignedDateToSave,
        renewal_date: renewalDateToSave,
        liaison_officer_name: liaisonOfficerName || null,
        liaison_email: liaisonEmail || null,
        liaison_phone: liaisonPhone || null,
        notes: notes || null,
        status: initialStatus,
      })
      .select()
      .single();

    if (data && !error) {
      savedId = data.id;
    }
  } catch (err) {
    console.warn("Direct Supabase sister_clubs insert fallback:", err);
  }

  const clubDTO: SisterClubDTO = {
    id: savedId,
    partnerClubName,
    district,
    country,
    partnershipType,
    agreementSignedDate: agreementSignedDateToSave || "",
    renewalDate: renewalDateToSave || "",
    liaisonOfficerName: liaisonOfficerName || "Designated Liaison",
    liaisonEmail: liaisonEmail || "",
    liaisonPhone: liaisonPhone || "",
    status: initialStatus,
    notes: notes || "",
    initiativesCount: 0,
    initiatives: [],
  };
  addCustomSisterClub(clubDTO);

  revalidatePath("/partnerships");
  revalidatePath("/dashboard");
  return {
    success: true,
    message: isProjectPartner
      ? `Prospective partner '${partnerClubName}' registered successfully (no MOA/expiration required).`
      : `Partner club '${partnerClubName}' registered successfully!`,
    partnerId: savedId,
    club: clubDTO,
  };
}

export async function updateSisterClubAction(formData: FormData) {
  const user = await requireUser();
  const rawClubId = (formData.get("homeClubId") as string)?.trim() || "";
  const homeClubId = UUID_PATTERN.test(rawClubId) ? rawClubId : DEFAULT_CLUB_ID;
  await assertPermission(homeClubId, "SETTINGS_MANAGE");

  const clubId = formData.get("clubId") as string;
  const partnerClubName = (formData.get("partnerClubName") as string)?.trim();
  const district = (formData.get("district") as string)?.trim();
  const country = (formData.get("country") as string)?.trim() || "Philippines";
  const partnershipType = (formData.get("partnershipType") as PartnershipType) || "SISTER_CLUB_MOA";
  const isProjectPartner = partnershipType === "PROJECT_PARTNER";
  const agreementSignedDate = isProjectPartner ? "" : ((formData.get("agreementSignedDate") as string) || "");
  const renewalDate = isProjectPartner ? "" : ((formData.get("renewalDate") as string) || "");
  const liaisonOfficerName = (formData.get("liaisonOfficerName") as string) || "";
  const liaisonEmail = (formData.get("liaisonEmail") as string) || "";
  const liaisonPhone = (formData.get("liaisonPhone") as string) || "";
  const status = (formData.get("status") as ClubPartnershipStatus) || (isProjectPartner ? "PENDING_MOA" : "ACTIVE");
  const notes = (formData.get("notes") as string) || "";

  if (!clubId || !partnerClubName) {
    return { success: false, error: "Club ID and partner club name are required." };
  }

  // 1. Update in Supabase if exists and is valid UUID
  if (UUID_PATTERN.test(clubId)) {
    try {
      const adminClient = createAdminClient();
      await adminClient
        .from("sister_clubs")
        .update({
          partner_club_name: partnerClubName,
          district,
          country,
          partnership_type: partnershipType,
          agreement_signed_date: isProjectPartner ? null : (agreementSignedDate || null),
          renewal_date: isProjectPartner ? null : (renewalDate || null),
          liaison_officer_name: liaisonOfficerName || null,
          liaison_email: liaisonEmail || null,
          liaison_phone: liaisonPhone || null,
          status,
          notes: notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", clubId);
    } catch (err) {
      console.warn("Direct Supabase sister_clubs update fallback:", err);
    }
  }

  // 2. Update in persistent store
  const updated = updateCustomSisterClub(clubId, {
    partnerClubName,
    district,
    country,
    partnershipType,
    agreementSignedDate,
    renewalDate,
    liaisonOfficerName,
    liaisonEmail,
    liaisonPhone,
    status,
    notes,
  });

  revalidatePath("/partnerships");
  revalidatePath("/dashboard");

  return {
    success: true,
    message: `Partner club '${partnerClubName}' updated successfully!`,
    club: updated,
  };
}

export async function deleteSisterClubAction(clubId: string) {
  const user = await requireUser();
  await assertPermission(DEFAULT_CLUB_ID, "SETTINGS_MANAGE");

  if (!clubId) {
    return { success: false, error: "Club ID is required." };
  }

  // 1. Delete from Supabase if valid UUID
  if (UUID_PATTERN.test(clubId)) {
    try {
      const adminClient = createAdminClient();
      await adminClient.from("sister_clubs").delete().eq("id", clubId);
    } catch (err) {
      console.warn("Direct Supabase sister_clubs delete fallback:", err);
    }
  }

  // 2. Delete from persistent store
  deleteCustomSisterClub(clubId);

  revalidatePath("/partnerships");
  revalidatePath("/dashboard");

  return {
    success: true,
    message: "Partner club and its associated collaborative initiatives have been removed.",
  };
}

export async function createPartnershipInitiativeAction(formData: FormData) {
  const user = await requireUser();
  const rawSisterClubId = formData.get("sisterClubId") as string;
  const sisterClubId = normalizeSisterClubId(rawSisterClubId);
  const title = (formData.get("title") as string)?.trim();
  const description = ((formData.get("description") as string) || "").trim();
  const jointVolunteers = Number(formData.get("jointVolunteers") || 0);
  const status = (formData.get("status") as InitiativeStatus) || "IN_PROGRESS";
  const rotaryYear = (formData.get("rotaryYear") as string) || "2026-27";

  if (!sisterClubId || !title) {
    return { success: false, error: "Sister club and initiative title are required." };
  }

  const generatedId = randomUUID();

  if (UUID_PATTERN.test(sisterClubId)) {
    try {
      const adminClient = createAdminClient();
      await adminClient.from("partnership_initiatives").insert({
        id: generatedId,
        sister_club_id: sisterClubId,
        title,
        description: description || null,
        joint_volunteer_count: jointVolunteers,
        rotary_year: rotaryYear,
        status,
        shared_funding_centavos: 0,
      });
    } catch (err) {
      console.warn("Direct Supabase initiative insert fallback:", err);
    }
  }

  const newInitiative: StoredInitiative = {
    id: generatedId,
    sisterClubId,
    title,
    description,
    jointVolunteers,
    rotaryYear,
    status,
    createdAt: new Date().toISOString(),
  };
  addCustomInitiative(newInitiative);

  revalidatePath("/partnerships");
  return {
    success: true,
    message: `Collaborative initiative '${title}' recorded successfully!`,
    initiative: newInitiative,
  };
}

export async function updatePartnershipInitiativeAction(formData: FormData) {
  await requireUser();

  const initiativeId = formData.get("initiativeId") as string;
  const title = (formData.get("title") as string)?.trim();
  const description = ((formData.get("description") as string) || "").trim();
  const jointVolunteers = Number(formData.get("jointVolunteers") || 0);
  const status = (formData.get("status") as InitiativeStatus) || "IN_PROGRESS";
  const rotaryYear = (formData.get("rotaryYear") as string) || "2026-27";

  if (!initiativeId || !title) {
    return { success: false, error: "Initiative ID and title are required." };
  }

  try {
    const adminClient = createAdminClient();
    await adminClient
      .from("partnership_initiatives")
      .update({
        title,
        description: description || null,
        joint_volunteer_count: jointVolunteers,
        rotary_year: rotaryYear,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", initiativeId);
  } catch (err) {
    console.warn("Direct Supabase initiative update fallback:", err);
  }

  const updated = updateCustomInitiative(initiativeId, {
    title,
    description,
    jointVolunteers,
    status,
    rotaryYear,
  });

  revalidatePath("/partnerships");
  return {
    success: true,
    message: `Initiative '${title}' updated successfully.`,
    initiative: updated || {
      id: initiativeId,
      sisterClubId: "",
      title,
      description,
      jointVolunteers,
      status,
      rotaryYear,
      createdAt: new Date().toISOString(),
    },
  };
}

export async function deletePartnershipInitiativeAction(initiativeId: string) {
  await requireUser();

  if (!initiativeId) {
    return { success: false, error: "Initiative ID is required." };
  }

  try {
    const adminClient = createAdminClient();
    await adminClient
      .from("partnership_initiatives")
      .delete()
      .eq("id", initiativeId);
  } catch (err) {
    console.warn("Direct Supabase initiative delete fallback:", err);
  }

  deleteCustomInitiative(initiativeId);

  revalidatePath("/partnerships");
  return {
    success: true,
    message: "Collaborative project removed successfully.",
  };
}
