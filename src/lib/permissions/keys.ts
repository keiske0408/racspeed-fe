/**
 * Permission keys. Mirrored by `public.permissions` / `public.role_permissions` seed data in
 * supabase/migrations (see 0001 foundation). Keep this file and the SQL seed in sync —
 * tests/unit/permissions.test.ts asserts the matrix invariants.
 */
export const PERMISSIONS = [
  "MEMBER_VIEW",
  "MEMBER_CREATE",
  "MEMBER_UPDATE",
  "MEMBER_APPROVE",
  "MEMBER_SUSPEND",
  "MEMBER_SENSITIVE_VIEW",
  "ROLE_ASSIGN",
  "RECRUITMENT_MANAGE",
  "EVENT_VIEW",
  "EVENT_CREATE",
  "EVENT_UPDATE",
  "ATTENDANCE_MANAGE",
  "RETENTION_ALERT_VIEW",
  "PROJECT_CREATE",
  "PROJECT_UPDATE",
  "PROJECT_SUBMIT_REPORT",
  "REPORT_APPROVE",
  "REPORT_TEMPLATE_MANAGE",
  "CERTIFICATE_GENERATE",
  "TREASURY_VIEW",
  "INVOICE_CREATE",
  "PAYMENT_SUBMIT",
  "PAYMENT_VERIFY",
  "LEDGER_ADJUST",
  "BUDGET_REQUEST",
  "BUDGET_APPROVE_PRESIDENT",
  "BUDGET_APPROVE_TREASURER",
  "DISBURSEMENT_RECORD",
  "LIQUIDATION_SUBMIT",
  "LIQUIDATION_VERIFY",
  "NOTIFICATION_SEND",
  "AUDIT_LOG_VIEW",
  "SETTINGS_MANAGE",
  "DATA_EXPORT",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLES = [
  "PRESIDENT",
  "VICE_PRESIDENT",
  "SECRETARY",
  "TREASURER",
  "PROJECT_CHAIR",
  "MEMBERSHIP_CHAIR",
  "BOARD_OFFICER",
  "GENERAL_MEMBER",
  "AUDITOR",
] as const;

export type RoleKey = (typeof ROLES)[number];

export const ROLE_LABELS: Record<RoleKey, string> = {
  PRESIDENT: "Club President",
  VICE_PRESIDENT: "Vice President",
  SECRETARY: "Secretary",
  TREASURER: "Treasurer",
  PROJECT_CHAIR: "Project Chair",
  MEMBERSHIP_CHAIR: "Membership Chair",
  BOARD_OFFICER: "Board Officer",
  GENERAL_MEMBER: "General Member",
  AUDITOR: "Auditor",
};

const MEMBER_BASE: Permission[] = ["EVENT_VIEW", "PAYMENT_SUBMIT"];
const BOARD_BASE: Permission[] = [
  ...MEMBER_BASE,
  "MEMBER_VIEW",
  "RETENTION_ALERT_VIEW",
  "PROJECT_CREATE",
  "PROJECT_UPDATE",
  "PROJECT_SUBMIT_REPORT",
  "BUDGET_REQUEST",
  "LIQUIDATION_SUBMIT",
  "EVENT_CREATE",
  "EVENT_UPDATE",
  "ATTENDANCE_MANAGE",
];

export const ROLE_PERMISSIONS: Record<RoleKey, readonly Permission[]> = {
  GENERAL_MEMBER: MEMBER_BASE,
  PROJECT_CHAIR: [
    ...MEMBER_BASE,
    "PROJECT_CREATE",
    "PROJECT_UPDATE",
    "PROJECT_SUBMIT_REPORT",
    "BUDGET_REQUEST",
    "LIQUIDATION_SUBMIT",
    "EVENT_CREATE",
    "EVENT_UPDATE",
    "ATTENDANCE_MANAGE",
    "CERTIFICATE_GENERATE",
  ],
  MEMBERSHIP_CHAIR: [...MEMBER_BASE, "MEMBER_VIEW", "MEMBER_CREATE", "MEMBER_UPDATE", "RECRUITMENT_MANAGE", "RETENTION_ALERT_VIEW"],
  BOARD_OFFICER: BOARD_BASE,
  SECRETARY: [
    ...BOARD_BASE,
    "MEMBER_CREATE",
    "MEMBER_UPDATE",
    "MEMBER_APPROVE",
    "RECRUITMENT_MANAGE",
    "REPORT_APPROVE",
    "REPORT_TEMPLATE_MANAGE",
    "CERTIFICATE_GENERATE",
    "NOTIFICATION_SEND",
    "DATA_EXPORT",
  ],
  TREASURER: [
    ...BOARD_BASE,
    "TREASURY_VIEW",
    "INVOICE_CREATE",
    "PAYMENT_VERIFY",
    "LEDGER_ADJUST",
    "BUDGET_APPROVE_TREASURER",
    "DISBURSEMENT_RECORD",
    "LIQUIDATION_VERIFY",
    "NOTIFICATION_SEND",
    "DATA_EXPORT",
  ],
  VICE_PRESIDENT: [
    ...BOARD_BASE,
    "MEMBER_CREATE",
    "MEMBER_UPDATE",
    "MEMBER_APPROVE",
    "RECRUITMENT_MANAGE",
    "REPORT_APPROVE",
    "CERTIFICATE_GENERATE",
  ],
  PRESIDENT: [
    ...BOARD_BASE,
    "MEMBER_CREATE",
    "MEMBER_UPDATE",
    "MEMBER_APPROVE",
    "MEMBER_SUSPEND",
    "MEMBER_SENSITIVE_VIEW",
    "ROLE_ASSIGN",
    "RECRUITMENT_MANAGE",
    "REPORT_APPROVE",
    "REPORT_TEMPLATE_MANAGE",
    "CERTIFICATE_GENERATE",
    "TREASURY_VIEW",
    "BUDGET_APPROVE_PRESIDENT",
    "LIQUIDATION_VERIFY",
    "NOTIFICATION_SEND",
    "AUDIT_LOG_VIEW",
    "SETTINGS_MANAGE",
    "DATA_EXPORT",
  ],
  AUDITOR: ["EVENT_VIEW", "MEMBER_VIEW", "TREASURY_VIEW", "AUDIT_LOG_VIEW"],
};

/** Permissions held by a user per club (club_id -> set). Platform admins bypass. */
export type PermissionMap = Record<string, ReadonlySet<Permission>>;

export function hasPermission(
  perms: PermissionMap,
  clubId: string,
  permission: Permission,
  isPlatformAdmin = false,
): boolean {
  if (isPlatformAdmin) return true;
  return perms[clubId]?.has(permission) ?? false;
}

export function hasAnyPermission(
  perms: PermissionMap,
  clubId: string,
  permissions: readonly Permission[],
  isPlatformAdmin = false,
): boolean {
  return permissions.some((p) => hasPermission(perms, clubId, p, isPlatformAdmin));
}

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}
