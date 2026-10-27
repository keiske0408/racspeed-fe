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
  { key: "retention", name: "Retention & Pastoral Alerts", path: "/retention-alerts", description: "Member disengagement prevention and outreach", category: "CORE" },
  { key: "calendar", name: "Master Calendar", path: "/calendar", description: "Unified operational calendar, committee timeline, and milestones", category: "SERVICE" },
  { key: "events", name: "Events & Attendance", path: "/events", description: "General Assemblies, fellowship, and QR check-in", category: "SERVICE" },
  { key: "tasks", name: "Committee Task Center", path: "/tasks", description: "Group tasks, checklists, and assignee tracking", category: "SERVICE" },
  { key: "broadcasts", name: "GC Broadcasts", path: "/broadcasts", description: "AI-generated announcements, Messenger group chat drafts, and push broadcasts", category: "SERVICE" },
  { key: "projects", name: "Projects & Reports", path: "/projects", description: "Community service initiatives and completion reports", category: "SERVICE" },
  { key: "treasury", name: "Treasury & Dues", path: "/treasury", description: "Invoicing, member payment tracking, and ledger", category: "FINANCE" },
  { key: "budgets", name: "Budget & Liquidation", path: "/budgets", description: "Dual-sign budget approvals and receipt liquidations", category: "FINANCE" },
  { key: "partnerships", name: "Sister Clubs & Partners", path: "/partnerships", description: "Domestic & international twin clubs and MOAs", category: "FINANCE" },
  { key: "resources", name: "Resources & Links", path: "/resources", description: "Rotary citations, District manuals, brand kits, and shared drives", category: "GOVERNANCE" },
  { key: "certificates", name: "Certificate Studio", path: "/certificates", description: "Design templates and issue verifiable certificates", category: "GOVERNANCE" },
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
  PRESIDENT: [
    "dashboard", "members", "recruitment", "retention", "calendar", "events",
    "tasks", "broadcasts", "projects", "treasury", "budgets", "partnerships",
    "resources", "certificates", "settings",
  ],
  VICE_PRESIDENT: [
    "dashboard", "members", "recruitment", "retention", "calendar", "events",
    "tasks", "broadcasts", "projects", "partnerships", "resources", "certificates",
  ],
  SECRETARY: [
    "dashboard", "recruitment", "retention", "calendar", "events",
    "tasks", "broadcasts", "projects", "partnerships", "resources", "certificates",
  ],
  TREASURER: [
    "dashboard", "members", "calendar", "events", "tasks", "projects",
    "treasury", "budgets", "partnerships", "resources",
  ],
  PROJECT_CHAIR: [
    "dashboard", "members", "calendar", "events", "tasks", "broadcasts",
    "projects", "budgets", "resources", "certificates",
  ],
  MEMBERSHIP_CHAIR: [
    "dashboard", "members", "recruitment", "retention", "calendar", "events",
    "tasks", "broadcasts", "resources",
  ],
  BOARD_OFFICER: [
    "dashboard", "members", "calendar", "events", "tasks", "broadcasts",
    "projects", "budgets", "partnerships", "resources", "retention",
  ],
  GENERAL_MEMBER: [
    "dashboard", "calendar", "events", "tasks", "projects", "resources", "certificates",
  ],
  AUDITOR: [
    "dashboard", "members", "calendar", "treasury", "budgets", "resources", "retention",
  ],
};

export interface PermissionDefinition {
  key: Permission;
  name: string;
  category: "MEMBERSHIP" | "SERVICE" | "COMMUNICATION" | "FINANCE" | "GOVERNANCE";
  description: string;
}

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  // MEMBERSHIP (8)
  { key: "MEMBER_VIEW", name: "View Member Profiles", category: "MEMBERSHIP", description: "Read-only access to member roster and directory" },
  { key: "MEMBER_CREATE", name: "Add Member Profiles", category: "MEMBERSHIP", description: "Create new member records and user credentials" },
  { key: "MEMBER_UPDATE", name: "Edit Member Details", category: "MEMBERSHIP", description: "Modify member contact & classifications" },
  { key: "MEMBER_APPROVE", name: "Approve Member Registrations", category: "MEMBERSHIP", description: "Authorize applicant induction & membership" },
  { key: "MEMBER_SUSPEND", name: "Suspend / Terminate Members", category: "MEMBERSHIP", description: "Revoke active club membership credentials" },
  { key: "MEMBER_SENSITIVE_VIEW", name: "View Sensitive Member Info", category: "MEMBERSHIP", description: "Access restricted health, emergency contacts, and private notes" },
  { key: "ROLE_ASSIGN", name: "Assign Officer Roles", category: "MEMBERSHIP", description: "Change leadership and committee titles" },
  { key: "RECRUITMENT_MANAGE", name: "Manage Recruitment CRM", category: "MEMBERSHIP", description: "Move leads through orientation pipeline and log follow-ups" },

  // SERVICE & ACTIVITIES (9)
  { key: "EVENT_VIEW", name: "View Events & Meetings", category: "SERVICE", description: "Access club calendar & public event itineraries" },
  { key: "EVENT_CREATE", name: "Create & Publish Events", category: "SERVICE", description: "Schedule general assemblies, projects & fellowships" },
  { key: "EVENT_UPDATE", name: "Modify Event Details", category: "SERVICE", description: "Change event dates, venues, agendas, and posters" },
  { key: "ATTENDANCE_MANAGE", name: "Record & Verify Attendance", category: "SERVICE", description: "Generate QR check-in sessions and record manual attendances" },
  { key: "PROJECT_CREATE", name: "Initiate Service Projects", category: "SERVICE", description: "Create project dossiers and plan club community initiatives" },
  { key: "PROJECT_UPDATE", name: "Update Project Status", category: "SERVICE", description: "Edit metrics, beneficiaries, and volunteer hours" },
  { key: "PROJECT_SUBMIT_REPORT", name: "Submit Accomplishment Reports", category: "SERVICE", description: "File completed project report dossiers for review" },
  { key: "REPORT_APPROVE", name: "Sign & Approve Project Reports", category: "SERVICE", description: "Authorize final service completion reports" },
  { key: "REPORT_TEMPLATE_MANAGE", name: "Manage Report Templates", category: "SERVICE", description: "Configure accomplishment report templates and formatting" },

  // COMMUNICATION (1)
  { key: "NOTIFICATION_SEND", name: "Send GC Broadcasts & Notifications", category: "COMMUNICATION", description: "Dispatch AI announcements, Messenger group chat blasts, and alerts" },

  // FINANCE (11)
  { key: "TREASURY_VIEW", name: "View Financial Ledger", category: "FINANCE", description: "Inspect balance sheets, collection history, and invoices" },
  { key: "INVOICE_CREATE", name: "Issue Membership Invoices", category: "FINANCE", description: "Generate dues billing and payment requests for members" },
  { key: "PAYMENT_SUBMIT", name: "Submit Payment Proofs", category: "FINANCE", description: "Upload bank slips or GCash references against invoices" },
  { key: "PAYMENT_VERIFY", name: "Verify & Approve Payments", category: "FINANCE", description: "Confirm proof-of-payment receipts into treasury ledger" },
  { key: "LEDGER_ADJUST", name: "Adjust Treasury Ledger", category: "FINANCE", description: "Apply auditable accounting debits or credits with explanation" },
  { key: "BUDGET_REQUEST", name: "Request Project Advances", category: "FINANCE", description: "Submit formal funding and expenditure proposals" },
  { key: "BUDGET_APPROVE_PRESIDENT", name: "President Dual-Sign Approval", category: "FINANCE", description: "Authorize disbursements as Club President" },
  { key: "BUDGET_APPROVE_TREASURER", name: "Treasurer Dual-Sign Approval", category: "FINANCE", description: "Authorize disbursements as Club Treasurer" },
  { key: "DISBURSEMENT_RECORD", name: "Record Fund Disbursements", category: "FINANCE", description: "Log release of approved funds with transaction reference" },
  { key: "LIQUIDATION_SUBMIT", name: "Submit Expense Liquidations", category: "FINANCE", description: "Provide actual expense receipts against disbursed budgets" },
  { key: "LIQUIDATION_VERIFY", name: "Verify Liquidations", category: "FINANCE", description: "Audit and approve submitted receipts and expense vouchers" },

  // GOVERNANCE & COMPLIANCE (5)
  { key: "CERTIFICATE_GENERATE", name: "Issue Digital Certificates", category: "GOVERNANCE", description: "Create and issue verifiable PDF certificates of recognition" },
  { key: "RETENTION_ALERT_VIEW", name: "View Pastoral Care Alerts", category: "GOVERNANCE", description: "Monitor attendance disengagement flags and member drop-offs" },
  { key: "AUDIT_LOG_VIEW", name: "View Governance Audit Logs", category: "GOVERNANCE", description: "Inspect system mutation history, admin actions, and audit trails" },
  { key: "SETTINGS_MANAGE", name: "Configure Club Settings", category: "GOVERNANCE", description: "Manage club identity, bylaws, parameters, and policies" },
  { key: "DATA_EXPORT", name: "Export Club Data", category: "GOVERNANCE", description: "Generate CSV exports of club rosters, attendance, and finances" },
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

