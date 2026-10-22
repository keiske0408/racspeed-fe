"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser, assertPermission } from "@/lib/auth/session";

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

  if (error) {
    return { success: false, error: `Failed to record sister club: ${error.message}` };
  }

  revalidatePath("/partnerships");
  revalidatePath("/dashboard");
  return { success: true, message: `Partner club '${partnerClubName}' registered successfully!`, partnerId: data.id };
}

export async function createPartnershipInitiativeAction(formData: FormData) {
  const user = await requireUser();
  const sisterClubId = formData.get("sisterClubId") as string;
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const jointVolunteers = Number(formData.get("jointVolunteers") || 0);

  if (!sisterClubId || !title) {
    return { success: false, error: "Sister club and initiative title are required." };
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient.from("partnership_initiatives").insert({
    sister_club_id: sisterClubId,
    title,
    description: description || null,
    joint_volunteer_count: jointVolunteers,
    rotary_year: "2026-27",
    shared_funding_centavos: 0,
  });

  if (error) {
    return { success: false, error: `Failed to record initiative: ${error.message}` };
  }

  revalidatePath("/partnerships");
  return { success: true, message: `Collaborative initiative '${title}' recorded!` };
}
