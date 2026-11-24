"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser, assertPermission } from "@/lib/auth/session";
import { toCentavos } from "@/lib/utils/money";
import { dispatchNotification } from "@/lib/services/notifications/dispatch";

const createInvoiceSchema = z.object({
  profileId: z.string().uuid("Invalid member selection"),
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  amountPHP: z.coerce.number().positive("Amount must be greater than zero"),
  dueDate: z.string().min(10, "Due date is required"),
  clubId: z.string().uuid().default("00000000-0000-0000-0000-000000000001"),
});

export async function createInvoiceAction(formData: FormData) {
  const user = await requireUser();
  const rawClubId = (formData.get("clubId") as string) || "00000000-0000-0000-0000-000000000001";
  await assertPermission(rawClubId, "INVOICE_CREATE");

  const validated = createInvoiceSchema.safeParse({
    profileId: formData.get("profileId"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    amountPHP: formData.get("amountPHP"),
    dueDate: formData.get("dueDate"),
    clubId: rawClubId,
  });

  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message || "Invalid invoice details" };
  }

  const { profileId, title, description, amountPHP, dueDate, clubId } = validated.data;
  const adminClient = createAdminClient();

  const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const { data: newInvoice, error: invError } = await adminClient
    .from("invoices")
    .insert({
      club_id: clubId,
      profile_id: profileId,
      invoice_number: invoiceNumber,
      title,
      description: description || null,
      due_date: dueDate,
      status: "ISSUED",
      created_by: user.id,
    })
    .select()
    .single();

  if (invError || !newInvoice) {
    return { success: false, error: `Failed to issue invoice: ${invError?.message}` };
  }

  // Insert associated line item
  await adminClient.from("invoice_items").insert({
    invoice_id: newInvoice.id,
    description: title,
    category: "DUES",
    amount: amountPHP,
    quantity: 1,
  });

  await dispatchNotification({
    profileId,
    clubId,
    type: "PAYMENT_STATUS",
    title: "New invoice issued",
    message: "A new club invoice is available in your account.",
    linkUrl: "/treasury",
    dedupeKey: `invoice-issued:${newInvoice.id}`,
    sendTelegram: true,
  }).catch((notificationError) =>
    console.error("Could not notify member about issued invoice:", notificationError),
  );

  revalidatePath("/treasury");
  revalidatePath("/dashboard");
  return { success: true, message: `Invoice ${invoiceNumber} issued successfully!` };
}

export async function submitPaymentProofAction(formData: FormData) {
  const user = await requireUser();
  const rawClubId = (formData.get("clubId") as string) || "00000000-0000-0000-0000-000000000001";

  const claimedAmount = Number(formData.get("claimedAmount") || 0);
  const paymentChannel = (formData.get("paymentChannel") as string) || "GCash";
  const referenceNumber = (formData.get("referenceNumber") as string) || "";
  const receiptFile = formData.get("receiptFile") as File | null;

  if (claimedAmount <= 0) {
    return { success: false, error: "Please enter a valid payment amount." };
  }

  const adminClient = createAdminClient();
  let receiptStoragePath = `receipts/proof-${Date.now()}.png`;

  // Upload receipt image to Supabase Storage bucket 'receipts'
  if (receiptFile && receiptFile.size > 0) {
    try {
      const arrayBuffer = await receiptFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const safeName = receiptFile.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      receiptStoragePath = `${rawClubId}/${user.id}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await adminClient.storage
        .from("receipts")
        .upload(receiptStoragePath, buffer, {
          contentType: receiptFile.type || "image/png",
          upsert: true,
        });

      if (uploadError) {
        console.warn("Supabase Storage receipt upload warning:", uploadError.message);
      }
    } catch (storageErr) {
      console.warn("Storage upload exception, continuing with fallback path:", storageErr);
    }
  }

  const { data: submission, error } = await adminClient
    .from("payment_submissions")
    .insert({
    club_id: rawClubId,
    submitted_by: user.id,
    claimed_amount: claimedAmount,
    claimed_date: new Date().toISOString().split("T")[0],
    payment_channel: paymentChannel,
    reference_number: referenceNumber || `REF-${Date.now()}`,
    receipt_storage_path: receiptStoragePath,
    status: "SUBMITTED",
    })
    .select("id")
    .single();

  if (error) {
    return { success: false, error: `Failed to submit payment proof: ${error.message}` };
  }

  if (submission) {
    const { data: memberships, error: reviewerError } = await adminClient
      .from("club_memberships")
      .select("profile_id, membership_roles(roles(key))")
      .eq("club_id", rawClubId)
      .eq("membership_status", "ACTIVE");
    if (reviewerError) {
      console.error("Could not find payment reviewers:", reviewerError.message);
    } else {
      const reviewerIds = new Set(
        (memberships || [])
          .filter((membership) =>
            (membership.membership_roles as { roles: { key: string }[] | null }[] | null)?.some(
              (membershipRole) =>
                membershipRole.roles?.some((role) =>
                  ["PRESIDENT", "TREASURER"].includes(role.key),
                ),
            ),
          )
          .map((membership) => membership.profile_id),
      );
      await Promise.all(
        Array.from(reviewerIds).map((reviewerId) =>
          dispatchNotification({
            profileId: reviewerId,
            clubId: rawClubId,
            type: "PAYMENT_STATUS",
            title: "Payment proof awaiting review",
            message: "A member submitted payment proof that is waiting for verification.",
            linkUrl: "/treasury",
            dedupeKey: `payment-review:${submission.id}:${reviewerId}`,
            sendTelegram: true,
          }).catch((notificationError) =>
            console.error("Could not notify payment reviewer:", notificationError),
          ),
        ),
      );
    }
  }

  revalidatePath("/treasury");
  revalidatePath("/dashboard");
  return { success: true, message: "Payment proof and receipt uploaded! Awaiting Treasurer review." };
}

export async function verifyPaymentSubmissionAction(submissionId: string, clubId = "00000000-0000-0000-0000-000000000001") {
  const user = await requireUser();
  await assertPermission(clubId, "PAYMENT_VERIFY");

  const adminClient = createAdminClient();

  const { data: submission, error: lookupError } = await adminClient
    .from("payment_submissions")
    .select("submitted_by")
    .eq("id", submissionId)
    .eq("club_id", clubId)
    .eq("status", "SUBMITTED")
    .maybeSingle();
  if (lookupError) return { success: false, error: lookupError.message };
  if (!submission) return { success: false, error: "Pending payment submission not found." };

  const { error } = await adminClient
    .from("payment_submissions")
    .update({
      status: "VERIFIED",
      verified_by: user.id,
      verified_at: new Date().toISOString(),
    })
    .eq("id", submissionId)
    .eq("club_id", clubId)
    .eq("status", "SUBMITTED");

  if (error) {
    return { success: false, error: `Failed to verify payment: ${error.message}` };
  }

  await dispatchNotification({
    profileId: submission.submitted_by,
    clubId,
    type: "PAYMENT_STATUS",
    title: "Payment verified",
    message: "Your payment proof was verified and recorded.",
    linkUrl: "/treasury",
    dedupeKey: `payment-verified:${submissionId}`,
    sendTelegram: true,
  }).catch((notificationError) =>
    console.error("Could not notify member about verified payment:", notificationError),
  );

  revalidatePath("/treasury");
  revalidatePath("/dashboard");
  return { success: true, message: "Payment verified and recorded to confirmed ledger!" };
}

export async function rejectPaymentSubmissionAction(submissionId: string, notes = "Receipt unclear or reference invalid", clubId = "00000000-0000-0000-0000-000000000001") {
  const user = await requireUser();
  await assertPermission(clubId, "PAYMENT_VERIFY");

  const adminClient = createAdminClient();
  const { data: submission, error: lookupError } = await adminClient
    .from("payment_submissions")
    .select("submitted_by")
    .eq("id", submissionId)
    .eq("club_id", clubId)
    .eq("status", "SUBMITTED")
    .maybeSingle();
  if (lookupError) return { success: false, error: lookupError.message };
  if (!submission) return { success: false, error: "Pending payment submission not found." };

  const { error } = await adminClient
    .from("payment_submissions")
    .update({
      status: "REJECTED",
      treasurer_notes: notes,
      verified_by: user.id,
      verified_at: new Date().toISOString(),
    })
    .eq("id", submissionId)
    .eq("club_id", clubId)
    .eq("status", "SUBMITTED");

  if (error) {
    return { success: false, error: `Failed to reject payment: ${error.message}` };
  }

  await dispatchNotification({
    profileId: submission.submitted_by,
    clubId,
    type: "PAYMENT_STATUS",
    title: "Payment proof needs attention",
    message: "Your payment proof could not be verified. Please review the notes in your account or contact the Treasurer.",
    linkUrl: "/treasury",
    dedupeKey: `payment-rejected:${submissionId}`,
    sendTelegram: true,
  }).catch((notificationError) =>
    console.error("Could not notify member about rejected payment:", notificationError),
  );

  revalidatePath("/treasury");
  return { success: true, message: "Payment proof marked as REJECTED." };
}
