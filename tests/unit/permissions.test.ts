import { describe, it, expect } from "vitest";
import {
  ROLE_PERMISSIONS,
  hasPermission,
  hasAnyPermission,
  PermissionMap,
} from "@/lib/permissions/keys";

describe("Role and Permission Invariants", () => {
  it("enforces Treasurer does NOT have BUDGET_APPROVE_PRESIDENT", () => {
    const treasurerPerms = ROLE_PERMISSIONS.TREASURER;
    expect(treasurerPerms).not.toContain("BUDGET_APPROVE_PRESIDENT");
    expect(treasurerPerms).toContain("BUDGET_APPROVE_TREASURER");
  });

  it("enforces President does NOT have BUDGET_APPROVE_TREASURER", () => {
    const presidentPerms = ROLE_PERMISSIONS.PRESIDENT;
    expect(presidentPerms).toContain("BUDGET_APPROVE_PRESIDENT");
    expect(presidentPerms).not.toContain("BUDGET_APPROVE_TREASURER");
  });

  it("enforces Auditor has read-only treasury permissions and no mutations", () => {
    const auditorPerms = ROLE_PERMISSIONS.AUDITOR;
    expect(auditorPerms).toContain("TREASURY_VIEW");
    expect(auditorPerms).not.toContain("PAYMENT_VERIFY");
    expect(auditorPerms).not.toContain("INVOICE_CREATE");
    expect(auditorPerms).not.toContain("LEDGER_ADJUST");
    expect(auditorPerms).not.toContain("REPORT_APPROVE");
  });

  it("enforces General Member cannot approve or manage other members", () => {
    const memberPerms = ROLE_PERMISSIONS.GENERAL_MEMBER;
    expect(memberPerms).not.toContain("MEMBER_APPROVE");
    expect(memberPerms).not.toContain("MEMBER_UPDATE");
    expect(memberPerms).not.toContain("MEMBER_SENSITIVE_VIEW");
    expect(memberPerms).toContain("EVENT_VIEW");
    expect(memberPerms).toContain("PAYMENT_SUBMIT");
  });

  it("verifies scoped permissions and platform admin bypass", () => {
    const perms: PermissionMap = {
      club_1: new Set(["EVENT_VIEW", "PAYMENT_SUBMIT"]),
      club_2: new Set(["EVENT_VIEW", "TREASURY_VIEW"]),
    };

    expect(hasPermission(perms, "club_1", "EVENT_VIEW")).toBe(true);
    expect(hasPermission(perms, "club_1", "TREASURY_VIEW")).toBe(false);
    expect(hasPermission(perms, "club_2", "TREASURY_VIEW")).toBe(true);

    // Platform admin bypasses all scopes
    expect(hasPermission(perms, "club_1", "TREASURY_VIEW", true)).toBe(true);
    expect(hasAnyPermission(perms, "club_1", ["SETTINGS_MANAGE", "DATA_EXPORT"], true)).toBe(true);
  });
});
