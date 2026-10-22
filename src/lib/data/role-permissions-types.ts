import {
  ROLES,
  RoleKey,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  Permission,
} from "@/lib/permissions/keys";

export interface PageModuleDef {
  key: string;
  name: string;
  path: string;
  description: string;
  category: "CORE" | "SERVICE" | "FINANCE" | "GOVERNANCE";
}

export const APP_MODULES: PageModuleDef[] = [
  { key: "dashboard", name: "Dashboard", path: "/dashboard", description: "Executive KPI overview and vital statistics", category: "CORE" },
  { key: "members", name: "Members Directory & Approval", path: "/members", description: "Club roster, membership cards, and registration gate", category: "CORE" },
  { key: "recruitment", name: "Recruitment CRM", path: "/recruitment", description: "Prospect pipeline from lead to inducted Rotaractor", category: "CORE" },
  { key: "events", name: "Events & Attendance", path: "/events", description: "General Assemblies, fellowship, and QR check-in", category: "SERVICE" },
  { key: "projects", name: "Projects & Reports", path: "/projects", description: "Community service initiatives and completion reports", category: "SERVICE" },
  { key: "tasks", name: "Committee Task Center", path: "/tasks", description: "Group tasks, checklists, and assignee tracking", category: "SERVICE" },
  { key: "treasury", name: "Treasury & Dues", path: "/treasury", description: "Invoicing, member payment tracking, and ledger", category: "FINANCE" },
  { key: "budgets", name: "Budget & Liquidation", path: "/budgets", description: "Dual-sign budget approvals and receipt liquidations", category: "FINANCE" },
  { key: "partnerships", name: "Sister Clubs & Partners", path: "/partnerships", description: "Domestic & international twin clubs and MOAs", category: "GOVERNANCE" },
  { key: "certificates", name: "Certificate Studio", path: "/certificates", description: "Design templates and issue verifiable certificates", category: "GOVERNANCE" },
  { key: "retention", name: "Retention & Pastoral Alerts", path: "/retention-alerts", description: "Member disengagement prevention and outreach", category: "GOVERNANCE" },
  { key: "settings", name: "Club Settings & Governance", path: "/settings", description: "District parameters, dual-approval rules, and policies", category: "GOVERNANCE" },
];

export interface RoleConfigDTO {
  roleKey: RoleKey;
  roleLabel: string;
  description: string;
  allowedPages: string[];
  allowedPermissions: Permission[];
}

export const DEFAULT_ROLE_PAGES: Record<RoleKey, string[]> = {
  PRESIDENT: ["dashboard", "members", "recruitment", "events", "projects", "tasks", "treasury", "budgets", "partnerships", "certificates", "retention", "settings"],
  VICE_PRESIDENT: ["dashboard", "members", "recruitment", "events", "projects", "tasks", "partnerships", "certificates", "retention"],
  SECRETARY: ["dashboard", "members", "recruitment", "events", "projects", "tasks", "partnerships", "certificates", "retention"],
  TREASURER: ["dashboard", "members", "events", "projects", "tasks", "treasury", "budgets", "partnerships"],
  PROJECT_CHAIR: ["dashboard", "members", "events", "projects", "tasks", "budgets", "certificates"],
  MEMBERSHIP_CHAIR: ["dashboard", "members", "recruitment", "events", "tasks", "retention"],
  BOARD_OFFICER: ["dashboard", "members", "events", "projects", "tasks", "budgets", "partnerships", "retention"],
  GENERAL_MEMBER: ["dashboard", "events", "projects", "tasks", "treasury", "certificates"],
  AUDITOR: ["dashboard", "members", "treasury", "budgets", "retention"],
};

export interface PermissionDefinition {
  key: Permission;
  name: string;
  category: "MEMBERSHIP" | "SERVICE" | "FINANCE" | "GOVERNANCE";
  description: string;
}

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  { key: "MEMBER_VIEW", name: "View Member Profiles", category: "MEMBERSHIP", description: "Read-only access to roster" },
  { key: "MEMBER_CREATE", name: "Add Member Profiles", category: "MEMBERSHIP", description: "Create new member records" },
  { key: "MEMBER_UPDATE", name: "Edit Member Details", category: "MEMBERSHIP", description: "Modify member contact & classifications" },
  { key: "MEMBER_APPROVE", name: "Approve Member Registrations", category: "MEMBERSHIP", description: "Authorize applicant induction & membership" },
  { key: "MEMBER_SUSPEND", name: "Suspend / Terminate Members", category: "MEMBERSHIP", description: "Revoke club membership credentials" },
  { key: "ROLE_ASSIGN", name: "Assign Officer Roles", category: "MEMBERSHIP", description: "Change leadership and committee titles" },
  { key: "RECRUITMENT_MANAGE", name: "Manage Recruitment CRM", category: "MEMBERSHIP", description: "Move leads through orientation pipeline" },
  { key: "EVENT_VIEW", name: "View Events & Meetings", category: "SERVICE", description: "Access club calendar & itineraries" },
  { key: "EVENT_CREATE", name: "Create & Publish Events", category: "SERVICE", description: "Schedule general assemblies & fellowships" },
  { key: "EVENT_UPDATE", name: "Modify Event Details", category: "SERVICE", description: "Change event dates, venues, and posters" },
  { key: "ATTENDANCE_MANAGE", name: "Record & Verify Attendance", category: "SERVICE", description: "Take check-ins and excuse absences" },
  { key: "PROJECT_CREATE", name: "Initiate Service Projects", category: "SERVICE", description: "Create project dossiers and plans" },
  { key: "PROJECT_UPDATE", name: "Update Project Status", category: "SERVICE", description: "Edit metrics and volunteer hours" },
  { key: "REPORT_APPROVE", name: "Sign & Approve Project Reports", category: "SERVICE", description: "Authorize final service completion reports" },
  { key: "CERTIFICATE_GENERATE", name: "Issue Digital Certificates", category: "GOVERNANCE", description: "Generate verifiable PDF credentials" },
  { key: "TREASURY_VIEW", name: "View Financial Ledger", category: "FINANCE", description: "Inspect revenues, disbursements, and dues" },
  { key: "INVOICE_CREATE", name: "Issue Membership Invoices", category: "FINANCE", description: "Generate dues billing for members" },
  { key: "PAYMENT_SUBMIT", name: "Submit Payment Proofs", category: "FINANCE", description: "Upload bank slips or GCash references" },
  { key: "PAYMENT_VERIFY", name: "Verify & Approve Payments", category: "FINANCE", description: "Confirm receipts into treasury ledger" },
  { key: "BUDGET_REQUEST", name: "Request Project Advances", category: "FINANCE", description: "Submit funding request for initiatives" },
  { key: "BUDGET_APPROVE_PRESIDENT", name: "President Dual-Sign Approval", category: "FINANCE", description: "Authorize disbursements as Club President" },
  { key: "BUDGET_APPROVE_TREASURER", name: "Treasurer Dual-Sign Approval", category: "FINANCE", description: "Authorize disbursements as Club Treasurer" },
  { key: "LIQUIDATION_SUBMIT", name: "Submit Expense Liquidations", category: "FINANCE", description: "Upload receipts for fund liquidation" },
  { key: "LIQUIDATION_VERIFY", name: "Verify Liquidations", category: "FINANCE", description: "Audit submitted receipts and vouchers" },
  { key: "RETENTION_ALERT_VIEW", name: "View Pastoral Care Alerts", category: "GOVERNANCE", description: "Monitor attendance disengagement flags" },
  { key: "SETTINGS_MANAGE", name: "Configure Club Settings", category: "GOVERNANCE", description: "Manage club identity, bylaws, and policies" },
];

export function getDefaultRoleConfigs(): Record<RoleKey, RoleConfigDTO> {
  const configs = {} as Record<RoleKey, RoleConfigDTO>;

  for (const role of ROLES) {
    configs[role] = {
      roleKey: role,
      roleLabel: ROLE_LABELS[role],
      description: `Default authority and page accessibility for ${ROLE_LABELS[role]} under District 3820 guidelines.`,
      allowedPages: [...(DEFAULT_ROLE_PAGES[role] || ["dashboard", "events"])],
      allowedPermissions: [...(ROLE_PERMISSIONS[role] || [])],
    };
  }

  return configs;
}
