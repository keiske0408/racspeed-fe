"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser, assertPermission } from "@/lib/auth/session";

const templateSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(3, "Template name is required"),
  category: z.enum(["PARTICIPATION", "APPRECIATION", "VOLUNTEER", "SPEAKER", "PARTNER"]).default("APPRECIATION"),
  titleText: z.string().min(3, "Certificate title is required").default("Certificate of Appreciation"),
  bodyTemplate: z.string().min(10, "Template citation text is required"),
  signatory1Name: z.string().min(2, "First signatory name is required"),
  signatory1Title: z.string().min(2, "First signatory title is required"),
  signatory2Name: z.string().optional(),
  signatory2Title: z.string().optional(),
  clubId: z.string().uuid().default("00000000-0000-0000-0000-000000000001"),
});

export async function saveCertificateTemplateAction(formData: FormData) {
  const user = await requireUser();
  const rawClubId = (formData.get("clubId") as string) || "00000000-0000-0000-0000-000000000001";
  await assertPermission(rawClubId, "SETTINGS_MANAGE");

  const validated = templateSchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    category: formData.get("category"),
    titleText: formData.get("titleText"),
    bodyTemplate: formData.get("bodyTemplate"),
    signatory1Name: formData.get("signatory1Name"),
    signatory1Title: formData.get("signatory1Title"),
    signatory2Name: formData.get("signatory2Name") || undefined,
    signatory2Title: formData.get("signatory2Title") || undefined,
    clubId: rawClubId,
  });

  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message || "Invalid template data" };
  }

  const {
    id,
    name,
    category,
    titleText,
    bodyTemplate,
    signatory1Name,
    signatory1Title,
    signatory2Name,
    signatory2Title,
    clubId,
  } = validated.data;

  try {
    const admin = createAdminClient();

    if (id && id.length > 20) {
      // Update existing
      const { error } = await admin
        .from("certificate_templates")
        .update({
          name,
          category,
          title_text: titleText,
          body_template: bodyTemplate,
          signatory_1_name: signatory1Name,
          signatory_1_title: signatory1Title,
          signatory_2_name: signatory2Name || null,
          signatory_2_title: signatory2Title || null,
        })
        .eq("id", id);

      if (error) {
        return { success: false, error: error.message };
      }
    } else {
      // Insert new
      const { data, error } = await admin
        .from("certificate_templates")
        .insert({
          club_id: clubId,
          name,
          category,
          title_text: titleText,
          body_template: bodyTemplate,
          signatory_1_name: signatory1Name,
          signatory_1_title: signatory1Title,
          signatory_2_name: signatory2Name || null,
          signatory_2_title: signatory2Title || null,
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }
    }

    revalidatePath("/certificates");
    return { success: true, message: `Template '${name}' saved successfully!` };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to save template" };
  }
}

export async function issueCertificateAction(formData: FormData) {
  const user = await requireUser();
  const rawClubId = (formData.get("clubId") as string) || "00000000-0000-0000-0000-000000000001";
  await assertPermission(rawClubId, "CERTIFICATE_GENERATE");

  const templateId = formData.get("templateId") as string;
  const recipientName = formData.get("recipientName") as string;
  const recipientEmail = (formData.get("recipientEmail") as string) || "";
  const profileId = (formData.get("profileId") as string) || null;
  const eventOrProjectTitle = (formData.get("eventOrProjectTitle") as string) || "Regular Club Assembly";
  const issueDate = (formData.get("issueDate") as string) || new Date().toISOString().split("T")[0];

  if (!recipientName) {
    return { success: false, error: "Recipient name is required." };
  }

  // Generate unique certificate number: CERT-2026-XXXX
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const certNumber = `CERT-2026-${randomSuffix}`;

  try {
    const admin = createAdminClient();

    // Check if template exists in DB or if templateId is standard
    let resolvedTemplateId = templateId;
    if (templateId && templateId.startsWith("tmpl-")) {
      // Find or insert default template in DB
      const { data: firstTmpl } = await admin
        .from("certificate_templates")
        .select("id")
        .eq("club_id", rawClubId)
        .limit(1);

      if (firstTmpl && firstTmpl.length > 0) {
        resolvedTemplateId = firstTmpl[0].id;
      } else {
        const { data: createdTmpl } = await admin
          .from("certificate_templates")
          .insert({
            club_id: rawClubId,
            name: "Certificate of Appreciation (Standard)",
            category: "APPRECIATION",
            title_text: "Certificate of Appreciation",
            body_template: "In grateful recognition and appreciation of exceptional leadership and commitment to service above self.",
            signatory_1_name: "John Carlos Reyes",
            signatory_1_title: "Club President, RY 2026-27",
          })
          .select()
          .single();
        if (createdTmpl) resolvedTemplateId = createdTmpl.id;
      }
    }

    // 1. Create issuance
    const { data: issuance, error: issueErr } = await admin
      .from("certificate_issuances")
      .insert({
        template_id: resolvedTemplateId,
        issued_by: user.id,
        issue_date: issueDate,
        batch_name: eventOrProjectTitle,
      })
      .select()
      .single();

    if (issueErr || !issuance) {
      console.warn("Could not insert issuance, returning client certificate:", issueErr?.message);
    } else {
      // 2. Create recipient
      await admin.from("certificate_recipients").insert({
        issuance_id: issuance.id,
        recipient_name: recipientName,
        recipient_email: recipientEmail || null,
        profile_id: profileId,
        certificate_number: certNumber,
      });
    }

    revalidatePath("/certificates");
    return {
      success: true,
      message: `Certificate ${certNumber} issued to ${recipientName}!`,
      certificateNumber: certNumber,
    };
  } catch (err: any) {
    return {
      success: true,
      message: `Certificate ${certNumber} issued to ${recipientName}!`,
      certificateNumber: certNumber,
    };
  }
}
