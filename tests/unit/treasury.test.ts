import { describe, it, expect } from "vitest";
import { calculateMemberBalance, canVerifyPayment, InvoiceLike, PaymentSubmissionLike } from "@/lib/services/treasury";
import { toCentavos } from "@/lib/utils/money";

describe("Treasury Calculations and Payment Rules", () => {
  it("calculates member running balance accurately from ledger items", () => {
    const invoices: InvoiceLike[] = [
      {
        id: "inv-1",
        dueDate: "2026-08-01",
        status: "ISSUED",
        items: [
          { id: "item-1", amountCentavos: toCentavos("500.00") }, // 500 PHP
          { id: "item-2", amountCentavos: toCentavos("250.00") }, // 250 PHP
        ],
      },
      {
        id: "inv-2",
        dueDate: "2026-09-01",
        status: "ISSUED",
        items: [{ id: "item-3", amountCentavos: toCentavos("1000.00") }], // 1000 PHP
      },
      {
        id: "inv-void",
        dueDate: "2026-07-01",
        status: "VOID",
        items: [{ id: "item-void", amountCentavos: toCentavos("9999.00") }], // must NOT be counted
      },
    ];

    const payments: PaymentSubmissionLike[] = [
      {
        id: "pay-1",
        amountCentavos: toCentavos("750.00"),
        status: "VERIFIED",
        allocations: [{ invoiceId: "inv-1", amountCentavos: toCentavos("750.00") }],
      },
      {
        id: "pay-pending",
        amountCentavos: toCentavos("1000.00"),
        status: "UNDER_REVIEW", // proof uploaded, NOT yet verified by treasurer
        allocations: [{ invoiceId: "inv-2", amountCentavos: toCentavos("1000.00") }],
      },
    ];

    const balance = calculateMemberBalance(invoices, payments, []);

    // Total Invoiced: 500 + 250 + 1000 = 1750.00 PHP (175000 centavos)
    expect(balance.totalInvoicedCentavos).toBe(175000);
    // Verified Paid: 750.00 PHP (75000 centavos)
    expect(balance.totalVerifiedPaidCentavos).toBe(75000);
    // Outstanding: 1750 - 750 = 1000.00 PHP (100000 centavos)
    expect(balance.outstandingBalanceCentavos).toBe(100000);
  });

  it("prevents double-verification of already verified payment submissions", () => {
    const verifiedSub: PaymentSubmissionLike = {
      id: "pay-1",
      amountCentavos: toCentavos("500.00"),
      status: "VERIFIED",
      allocations: [],
    };

    const res = canVerifyPayment(verifiedSub, true);
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain("already been verified");
  });

  it("rejects unauthorized verification attempts", () => {
    const pendingSub: PaymentSubmissionLike = {
      id: "pay-2",
      amountCentavos: toCentavos("500.00"),
      status: "SUBMITTED",
      allocations: [],
    };

    const res = canVerifyPayment(pendingSub, false);
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain("Unauthorized");
  });
});
