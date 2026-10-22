"use server";

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
  StoredInitiative,
  InitiativeStatus,
  PartnershipType,
  ClubPartnershipStatus,
  SisterClubDTO,
} from "@/lib/data/partnerships-storage";

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
  agreementSignedDate: z.string().optional(),
  renewalDate: z.string().optional(),
  liaisonOfficerName: z.string().optional(),
  liaisonEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  liaisonPhone: z.string().optional(),
  notes: z.string().optional(),
  homeClubId: z.string().uuid().default("00000000-0000-0000-0000-000000000001"),
});

export async function createSisterClubAction(formData: FormData) {
  const user = await requireUser();
  const rawClubId = (formData.get("homeClubId") as string) || "00000000-0000-0000-0000-000000000001";
  await assertPermission(rawClubId, "SETTINGS_MANAGE");

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
    homeClubId: rawClubId,
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
    homeClubId,
  } = validated.data;

  const generatedId = `sc-${Date.now()}`;
  let savedId = generatedId;

  try {
    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from("sister_clubs")
      .insert({
        home_club_id: homeClubId,
        partner_club_name: partnerClubName,
        district,
        country,
        partnership_type: partnershipType,
        agreement_signed_date: agreementSignedDate || null,
        renewal_date: renewalDate || null,
        liaison_officer_name: liaisonOfficerName || null,
        liaison_email: liaisonEmail || null,
        liaison_phone: liaisonPhone || null,
        notes: notes || null,
        status: "ACTIVE",
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
    agreementSignedDate: agreementSignedDate || new Date().toISOString().split("T")[0],
    renewalDate: renewalDate || "2027-06-30",
    liaisonOfficerName: liaisonOfficerName || "Designated Liaison",
    liaisonEmail: liaisonEmail || "",
    liaisonPhone: liaisonPhone || "",
    status: "ACTIVE",
    notes: notes || "",
    initiativesCount: 0,
    initiatives: [],
  };
  addCustomSisterClub(clubDTO);

  revalidatePath("/partnerships");
  revalidatePath("/dashboard");
  return { success: true, message: `Partner club '${partnerClubName}' registered successfully!`, partnerId: savedId, club: clubDTO };
}

export async function updateSisterClubAction(formData: FormData) {
  const user = await requireUser();
  const rawClubId = (formData.get("homeClubId") as string) || "00000000-0000-0000-0000-000000000001";
  await assertPermission(rawClubId, "SETTINGS_MANAGE");

  const clubId = formData.get("clubId") as string;
  const partnerClubName = (formData.get("partnerClubName") as string)?.trim();
  const district = (formData.get("district") as string)?.trim();
  const country = (formData.get("country") as string)?.trim() || "Philippines";
  const partnershipType = (formData.get("partnershipType") as PartnershipType) || "SISTER_CLUB_MOA";
  const agreementSignedDate = (formData.get("agreementSignedDate") as string) || "";
  const renewalDate = (formData.get("renewalDate") as string) || "";
  const liaisonOfficerName = (formData.get("liaisonOfficerName") as string) || "";
  const liaisonEmail = (formData.get("liaisonEmail") as string) || "";
  const liaisonPhone = (formData.get("liaisonPhone") as string) || "";
  const status = (formData.get("status") as ClubPartnershipStatus) || "ACTIVE";
  const notes = (formData.get("notes") as string) || "";

  if (!clubId || !partnerClubName) {
    return { success: false, error: "Club ID and partner club name are required." };
  }

  // 1. Update in Supabase if exists
  try {
    const adminClient = createAdminClient();
    await adminClient
      .from("sister_clubs")
      .update({
        partner_club_name: partnerClubName,
        district,
        country,
        partnership_type: partnershipType,
        agreement_signed_date: agreementSignedDate || null,
        renewal_date: renewalDate || null,
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
  await assertPermission("00000000-0000-0000-0000-000000000001", "SETTINGS_MANAGE");

  if (!clubId) {
    return { success: false, error: "Club ID is required." };
  }

  // 1. Delete from Supabase if exists
  try {
    const adminClient = createAdminClient();
    await adminClient.from("sister_clubs").delete().eq("id", clubId);
  } catch (err) {
    console.warn("Direct Supabase sister_clubs delete fallback:", err);
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
  const sisterClubId = formData.get("sisterClubId") as string;
  const title = (formData.get("title") as string)?.trim();
  const description = ((formData.get("description") as string) || "").trim();
  const jointVolunteers = Number(formData.get("jointVolunteers") || 0);
  const status = (formData.get("status") as InitiativeStatus) || "IN_PROGRESS";
  const rotaryYear = (formData.get("rotaryYear") as string) || "2026-27";

  if (!sisterClubId || !title) {
    return { success: false, error: "Sister club and initiative title are required." };
  }

  const generatedId = `init-${Date.now()}`;

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
