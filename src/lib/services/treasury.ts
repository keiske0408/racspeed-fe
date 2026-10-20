import { Centavos, sumCentavos, toCentavos } from "@/lib/utils/money";

export interface InvoiceItemLike {
  id: string;
  amountCentavos: Centavos;
}

export interface InvoiceLike {
  id: string;
  dueDate: string;
  items: InvoiceItemLike[];
  status: "DRAFT" | "ISSUED" | "PAID" | "PARTIALLY_PAID" | "VOID" | "CANCELLED";
}

export interface PaymentAllocationLike {
  invoiceId: string;
  amountCentavos: Centavos;
}

export interface PaymentSubmissionLike {
  id: string;
  amountCentavos: Centavos;
  status: "SUBMITTED" | "UNDER_REVIEW" | "VERIFIED" | "REJECTED" | "NEEDS_CLARIFICATION";
  allocations: PaymentAllocationLike[];
}

export interface LedgerAdjustmentLike {
  id: string;
  amountCentavos: Centavos; // positive increases debt, negative decreases debt
  reason: string;
}

export interface MemberBalanceBreakdown {
  totalInvoicedCentavos: Centavos;
  totalAdjustmentsCentavos: Centavos;
  totalVerifiedPaidCentavos: Centavos;
  outstandingBalanceCentavos: Centavos;
}

/**
 * Calculates a member's current financial balance dynamically from ledger records.
 * Outstanding = (Invoices - Voided) + Adjustments - Verified Allocations.
 * A payment proof (SUBMITTED/UNDER_REVIEW/REJECTED) has ZERO effect on balance.
 */
export function calculateMemberBalance(
  invoices: InvoiceLike[],
  payments: PaymentSubmissionLike[],
  adjustments: LedgerAdjustmentLike[] = [],
): MemberBalanceBreakdown {
  // Sum active invoice items
  const activeInvoices = invoices.filter((i) => i.status !== "VOID" && i.status !== "CANCELLED");
  const totalInvoicedCentavos = sumCentavos(
    activeInvoices.flatMap((inv) => inv.items.map((item) => item.amountCentavos)),
  );

  const totalAdjustmentsCentavos = sumCentavos(adjustments.map((a) => a.amountCentavos));

  // Only count VERIFIED payment allocations
  const verifiedPayments = payments.filter((p) => p.status === "VERIFIED");
  const totalVerifiedPaidCentavos = sumCentavos(
    verifiedPayments.flatMap((p) => p.allocations.map((a) => a.amountCentavos)),
  );

  const outstandingBalanceCentavos = (totalInvoicedCentavos + totalAdjustmentsCentavos - totalVerifiedPaidCentavos) as Centavos;

  return {
    totalInvoicedCentavos,
    totalAdjustmentsCentavos,
    totalVerifiedPaidCentavos,
    outstandingBalanceCentavos,
  };
}

/**
 * Validates a payment verification action.
 */
export function canVerifyPayment(
  submission: PaymentSubmissionLike,
  hasVerifyPermission: boolean,
): { allowed: boolean; reason?: string } {
  if (!hasVerifyPermission) {
    return { allowed: false, reason: "Unauthorized: only treasurers and platform admins may verify payments." };
  }

  if (submission.status === "VERIFIED") {
    return { allowed: false, reason: "Payment has already been verified and posted." };
  }

  if (submission.status === "REJECTED") {
    return { allowed: false, reason: "Cannot verify a rejected payment without a new submission or status reset." };
  }

  return { allowed: true };
}
