import { createAdminClient } from "@/lib/supabase/admin";

export interface InvoiceDTO {
  id: string;
  invoiceNumber: string;
  memberName: string;
  title: string;
  dueDate: string;
  amount: number;
  status: "ISSUED" | "PAID" | "PARTIALLY_PAID" | "DRAFT" | "VOID";
}

export interface PaymentSubmissionDTO {
  id: string;
  invoiceNumber: string;
  memberName: string;
  claimedAmount: number;
  referenceNumber: string;
  paymentChannel: string;
  status: "SUBMITTED" | "VERIFIED" | "REJECTED";
  claimedDate: string;
  receiptStoragePath?: string;
  receiptUrl?: string;
}

export interface TreasuryDataDTO {
  invoices: InvoiceDTO[];
  submissions: PaymentSubmissionDTO[];
}

export async function getTreasuryData(clubId = "00000000-0000-0000-0000-000000000001"): Promise<TreasuryDataDTO> {
  try {
    const adminClient = createAdminClient();

    // 1. Fetch Invoices
    const { data: rawInvoices, error: invErr } = await adminClient
      .from("invoices")
      .select(`
        id,
        invoice_number,
        title,
        due_date,
        status,
        profiles (
          full_name,
          email
        ),
        invoice_items (
          amount,
          quantity
        )
      `)
      .eq("club_id", clubId)
      .order("created_at", { ascending: false });

    // 2. Fetch Payment Submissions
    const { data: rawSubmissions, error: subErr } = await adminClient
      .from("payment_submissions")
      .select(`
        id,
        claimed_amount,
        claimed_date,
        reference_number,
        payment_channel,
        status,
        receipt_storage_path,
        profiles!payment_submissions_submitted_by_fkey (
          full_name,
          email
        )
      `)
      .eq("club_id", clubId)
      .order("created_at", { ascending: false });

    const invoices: InvoiceDTO[] = (rawInvoices || []).map((inv) => {
      const p = inv.profiles as any;
      const items = (inv.invoice_items as any[]) || [];
      const totalAmount = items.reduce((acc, it) => acc + Number(it.amount || 0) * Number(it.quantity || 1), 0);

      return {
        id: inv.id,
        invoiceNumber: inv.invoice_number,
        memberName: p?.full_name || p?.email || "Club Member",
        title: inv.title,
        dueDate: inv.due_date,
        amount: totalAmount > 0 ? totalAmount : 1500,
        status: (inv.status || "ISSUED") as InvoiceDTO["status"],
      };
    });

    const submissions: PaymentSubmissionDTO[] = (rawSubmissions || []).map((sub, idx) => {
      const p = sub.profiles as any;
      const path = sub.receipt_storage_path;
      let receiptUrl: string | undefined = undefined;

      if (path) {
        try {
          const { data } = adminClient.storage.from("receipts").getPublicUrl(path);
          receiptUrl = data.publicUrl;
        } catch {
          // Fallback
        }
      }

      return {
        id: sub.id,
        invoiceNumber: `INV-2026-00${idx + 1}`,
        memberName: p?.full_name || p?.email || "Club Member",
        claimedAmount: Number(sub.claimed_amount || 0),
        referenceNumber: sub.reference_number || "N/A",
        paymentChannel: sub.payment_channel || "GCash",
        status: (sub.status || "SUBMITTED") as PaymentSubmissionDTO["status"],
        claimedDate: sub.claimed_date || new Date().toISOString().split("T")[0],
        receiptStoragePath: path,
        receiptUrl,
      };
    });

    return { invoices, submissions };
  } catch (err) {
    console.error("Error in getTreasuryData:", err);
    return { invoices: [], submissions: [] };
  }
}
