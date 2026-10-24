"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  HelpCircle,
  Search,
  BookOpen,
  QrCode,
  Users,
  Receipt,
  FileSpreadsheet,
  Mail,
  Phone,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  CheckCircle2,
  Sparkles,
  Send,
  X,
  ShieldAlert,
  LayoutDashboard,
  UserPlus,
  Calendar,
  Megaphone,
  FolderKanban,
  CheckSquare,
  Globe,
  Bookmark,
  Award,
  Settings,
  ShieldCheck,
  FileText,
  Lock,
  ArrowRight,
  Clock,
  Layers,
  AlertCircle,
  Check,
  Copy,
} from "lucide-react";

// ==========================================
// Types
// ==========================================

export type ModuleCategory =
  | "ALL"
  | "EXECUTIVE"
  | "MEMBERSHIP"
  | "ACTIVITIES"
  | "FINANCE"
  | "RESOURCES";

export interface ModuleManual {
  id: string;
  name: string;
  route: string;
  icon: React.ComponentType<{ className?: string }>;
  category: "EXECUTIVE" | "MEMBERSHIP" | "ACTIVITIES" | "FINANCE" | "RESOURCES";
  categoryLabel: string;
  tagline: string;
  description: string;
  capabilities: string[];
  workflow: {
    step: number;
    title: string;
    description: string;
  }[];
  rolesAndPermissions: {
    role: string;
    level: "Board / Executive" | "Committee Officer" | "General Member" | "Independent Auditor";
    permissions: string;
  }[];
  rulesAndPolicies: string[];
  proTip: string;
}

interface FAQItem {
  id: string;
  category: "MEMBERSHIP" | "EVENTS" | "TREASURY" | "REPORTING" | "GENERAL";
  question: string;
  answer: string;
}

// ==========================================
// Comprehensive Manuals Data (All 14 Modules)
// ==========================================

const MODULE_MANUALS: ModuleManual[] = [
  {
    id: "dashboard",
    name: "Dashboard & Operational Telemetry",
    route: "/dashboard",
    icon: LayoutDashboard,
    category: "EXECUTIVE",
    categoryLabel: "Executive & Roster",
    tagline: "Real-time club health, Rotary Year metrics & global quick actions",
    description:
      "The Dashboard serves as the operational cockpit of the Rotaract Club of San Pedro East. It consolidates real-time telemetry across membership, dues collection, volunteer hours, and project execution while adhering to District 3820 Rotary Year standards.",
    capabilities: [
      "Real-time metric telemetry: Active Roster, Dues Collection Rate, Total Volunteer Hours, and Active Projects.",
      "Rotary Year tracking (1 July to 30 June) with district-aligned terminology and automated term resets.",
      "Global Quick-Create Hub (+ Create) enabling instant creation of tasks, budget requests, leads, and event sessions.",
      "Live Agenda & Countdown widget for upcoming General Assemblies, District Governor visits, and service projects.",
      "Actionable alerts summarizing pending payment proofs, unliquidated advances, and at-risk member alerts.",
    ],
    workflow: [
      {
        step: 1,
        title: "Daily Pulse Review",
        description: "Review top stat cards for active member count, collection percentages, and pending tasks.",
      },
      {
        step: 2,
        title: "Quick Action Dispatch",
        description: "Use the top '+ Create' button to immediately dispatch a new task, log an incoming lead, or start a budget proposal.",
      },
      {
        step: 3,
        title: "Timeline & Event Tracking",
        description: "Check the upcoming operational schedule and inspect recent check-ins or status updates.",
      },
    ],
    rolesAndPermissions: [
      {
        role: "President & VP",
        level: "Board / Executive",
        permissions: "Full visibility across all operational metrics, executive briefings, and district compliance counters.",
      },
      {
        role: "Secretary & Treasurer",
        level: "Board / Executive",
        permissions: "Real-time monitoring of attendance numbers and financial collection rates.",
      },
      {
        role: "General Member",
        level: "General Member",
        permissions: "View personal volunteer hour contributions, upcoming club events, and club-wide announcements.",
      },
    ],
    rulesAndPolicies: [
      "All Rotary Year calculations must use the standardized formula (1 July – 30 June) and never manual calendar dates.",
      "Financial figures displayed are derived purely from verified ledger allocations, preventing fictitious or unconfirmed balances.",
    ],
    proTip: "Use the keyboard shortcut or top utility bar '+ Create' button anywhere in the app to rapidly record items without interrupting your current workflow.",
  },
  {
    id: "members",
    name: "Members Directory & Privacy",
    route: "/members",
    icon: Users,
    category: "EXECUTIVE",
    categoryLabel: "Executive & Roster",
    tagline: "Roster administration, RBAC roles & Philippine Data Privacy Act compliance",
    description:
      "The Members module manages the club's active, prospective, and alumni directory. Built under strict compliance with the Philippine Data Privacy Act, it enforces granular Role-Based Access Control (RBAC) across 10 distinct club roles.",
    capabilities: [
      "Unified member directory with search, committee filters, and badge distinctions (President, Board, General Member).",
      "Role-Based Access Control (RBAC) managing 10 official club roles and granular server-side permission assertions.",
      "Philippine Data Privacy Act (DPA) isolation: sensitive personal information (birthday, blood type, emergency contact) stored securely.",
      "Account lifecycle governance: Pending Approval → Active → Suspended → Archived.",
      "Batch directory export with privacy-safe redaction for district secretariat reporting.",
    ],
    workflow: [
      {
        step: 1,
        title: "Registration & Ingestion",
        description: "New applicants sign up and enter a 'Pending' state with zero default permissions.",
      },
      {
        step: 2,
        title: "Credential Audit & Approval",
        description: "Membership Chair or President verifies applicant credentials and approves account via 'MEMBER_APPROVE'.",
      },
      {
        step: 3,
        title: "Role & Committee Assignment",
        description: "Assign the member to specific service committees and designate official officer roles where applicable.",
      },
      {
        step: 4,
        title: "Annual Roster Reconciliation",
        description: "Update member status each Rotary Year term during district charter renewals.",
      },
    ],
    rolesAndPermissions: [
      {
        role: "President / Admin",
        level: "Board / Executive",
        permissions: "Full control: approve members, assign officer roles, configure permissions, and manage member statuses.",
      },
      {
        role: "Membership Chair",
        level: "Committee Officer",
        permissions: "Review applicants, update committee assignments, and access emergency contacts under DPA rules.",
      },
      {
        role: "General Member",
        level: "General Member",
        permissions: "View public club directory, search fellow Rotaractors, and manage personal profile details.",
      },
    ],
    rulesAndPolicies: [
      "Never authorize users from client-side user metadata; all role authorizations are asserted on the server and enforced via Postgres RLS.",
      "Sensitive fields (blood type, home address, emergency contacts) are strictly visible only to the member and authorized officers holding 'MEMBER_SENSITIVE_VIEW'.",
    ],
    proTip: "Keep member committee assignments updated so that when group tasks are created in the Task Center, assignees can be filtered by committee with one click.",
  },
  {
    id: "recruitment",
    name: "Recruitment CRM Funnel",
    route: "/recruitment",
    icon: UserPlus,
    category: "MEMBERSHIP",
    categoryLabel: "Membership Pipeline",
    tagline: "5-stage pipeline transforming prospects into inducted Rotaractors",
    description:
      "A structured recruitment pipeline tailored to Rotaract onboarding. Tracks prospective members from their first inquiry through orientation, service project participation, dues settlement, and final formal induction ceremony.",
    capabilities: [
      "Kanban-style 5-stage recruitment funnel (Inquiry → Orientation → Service Project → Dues Settled → Inducted).",
      "Candidate profile tracking including school/company background, interest areas, and assigned onboarding mentor.",
      "Automated prerequisite checklist ensuring every prospective Rotaractor fulfills club bylaws before induction.",
      "One-click conversion from 'Inducted' prospect directly into an active club member profile.",
      "Recruitment batch analytics to measure recruitment drive conversion rates across semesters.",
    ],
    workflow: [
      {
        step: 1,
        title: "Capture Prospect",
        description: "Log candidate details from orientation booths, campus drives, or social media inquiries.",
      },
      {
        step: 2,
        title: "Orientation Session",
        description: "Candidate attends orientation covering Rotary history, The Four-Way Test, and club traditions.",
      },
      {
        step: 3,
        title: "Service Immersion",
        description: "Candidate actively volunteers in at least 1 community service project or club fellowship.",
      },
      {
        step: 4,
        title: "Dues Settlement",
        description: "Candidate settles their initial induction dues; Treasurer marks dues as verified.",
      },
      {
        step: 5,
        title: "Formal Induction",
        description: "Board inducts candidate with the official Rotaract pin; system converts candidate to active member.",
      },
    ],
    rolesAndPermissions: [
      {
        role: "Membership Chair & Committee",
        level: "Committee Officer",
        permissions: "Add prospects, update pipeline stages, log notes, and assign onboarding buddies.",
      },
      {
        role: "President & Secretary",
        level: "Board / Executive",
        permissions: "Final induction approval and official promotion into active club roster.",
      },
    ],
    rulesAndPolicies: [
      "A candidate must never be inducted without attending at least 1 orientation and 1 community service activity.",
      "Never delete prospect records after a recruitment cycle; archive them to maintain historical outreach data.",
    ],
    proTip: "Assign an active officer as an 'Onboarding Buddy' to each prospect to increase conversion rates from Orientation to Service Immersion by over 40%.",
  },
  {
    id: "retention-alerts",
    name: "Retention Alerts & Engagement",
    route: "/retention-alerts",
    icon: ShieldAlert,
    category: "MEMBERSHIP",
    categoryLabel: "Membership Pipeline",
    tagline: "Proactive attendance health monitoring & compassionate member retention",
    description:
      "An automated retention engine that monitors attendance patterns to detect disengagement before a member goes inactive. Anchored in compassion and fellowship, alerts trigger supportive outreach rather than punitive action.",
    capabilities: [
      "Algorithmic attendance health analysis evaluating General Assembly presence and service hours.",
      "Automated alert trigger: flags members who miss 3 consecutive General Assemblies without an excused absence.",
      "Service engagement trigger: flags members with 60+ consecutive days without participating in a qualifying service project.",
      "Confidential outreach log for Membership Officers to record fellowship check-ins, study leaves, or work conflicts.",
      "Excused absence recording to protect members on academic leave, thesis defense, or overseas work.",
    ],
    workflow: [
      {
        step: 1,
        title: "Automated Detection",
        description: "System background engine scans attendance logs weekly and evaluates engagement thresholds.",
      },
      {
        step: 2,
        title: "Confidential Alert Raised",
        description: "At-risk flag is displayed privately to the Membership Committee and Club President.",
      },
      {
        step: 3,
        title: "Personal Fellowship Outreach",
        description: "An assigned officer reaches out personally via call or coffee to understand the member's situation.",
      },
      {
        step: 4,
        title: "Resolution & Documentation",
        description: "Officer records notes (e.g. academic leave approved) or welcomes member back to upcoming fellowship.",
      },
    ],
    rolesAndPermissions: [
      {
        role: "Membership Chair & President",
        level: "Board / Executive",
        permissions: "Exclusive access via 'RETENTION_ALERT_VIEW' permission key.",
      },
      {
        role: "General Member / Auditor",
        level: "General Member",
        permissions: "Restricted. Retention flags are strictly hidden to preserve member dignity and privacy.",
      },
    ],
    rulesAndPolicies: [
      "CRITICAL POLICY: Retention alerts must NEVER be displayed publicly, used for ranking, or weaponized for shaming.",
      "No automated suspensions. All retention decisions require personal human-in-the-loop fellowship outreach.",
    ],
    proTip: "When reaching out, lead with empathy: ask 'How are you doing with school/work?' rather than 'Why haven't you attended meetings?'.",
  },
  {
    id: "events",
    name: "Events & Dynamic QR Check-in",
    route: "/events",
    icon: Calendar,
    category: "ACTIVITIES",
    categoryLabel: "Activities & Reporting",
    tagline: "Rolling HMAC-signed QR sessions & fraud-proof attendance tracking",
    description:
      "A comprehensive event management and attendance platform. Features a cryptographic rolling QR code generator that rotates every 15 seconds, eliminating proxy check-ins and screenshot sharing during General Assemblies and service projects.",
    capabilities: [
      "Event scheduling for General Assemblies, Committee Meetings, Service Projects, and Fellowships.",
      "Dynamic rolling QR code session: generates rotating HMAC-signed tokens refreshed every 15 seconds.",
      "GPS & time-windowed attendance validation with instant duplicate-scan rejection.",
      "Automated volunteer service hour calculation derived from event duration and committee multipliers.",
      "Manual attendance adjustment portal for officers with mandatory audit trail logging.",
    ],
    workflow: [
      {
        step: 1,
        title: "Create Event",
        description: "Event Chair creates the event, specifies service category, date, venue, and volunteer hours.",
      },
      {
        step: 2,
        title: "Launch Rolling Session",
        description: "Attendance Marshal projects the dynamic QR code on a screen or tablet at the venue entrance.",
      },
      {
        step: 3,
        title: "Member Scans",
        description: "Attending members scan the live QR code with their mobile device; attendance is verified instantly.",
      },
      {
        step: 4,
        title: "Audit & Finalization",
        description: "Marshal checks off manual overrides for camera-impaired members and closes the session.",
      },
    ],
    rolesAndPermissions: [
      {
        role: "Secretary & Attendance Marshals",
        level: "Board / Executive",
        permissions: "Launch QR sessions, view real-time headcount, and perform manual attendance overrides.",
      },
      {
        role: "Event Chairs",
        level: "Committee Officer",
        permissions: "Configure event details, program agendas, and volunteer hour multipliers.",
      },
      {
        role: "General Members",
        level: "General Member",
        permissions: "Scan QR code to log attendance and view credited volunteer service hours.",
      },
    ],
    rulesAndPolicies: [
      "Tokens rotate every 15 seconds. Static photos or screenshots of the QR code will fail validation.",
      "Manual attendance adjustments require 'ATTENDANCE_MANAGE' permission and must include a documented reason in 'attendance_adjustments'.",
    ],
    proTip: "For large district-wide conventions, set up two separate check-in stations using tablets to clear a 100-member line in under 3 minutes.",
  },
  {
    id: "broadcasts",
    name: "GC Broadcasts (AI-Assisted)",
    route: "/broadcasts",
    icon: Megaphone,
    category: "ACTIVITIES",
    categoryLabel: "Activities & Reporting",
    tagline: "Mobile-optimized announcement generator for Messenger, Discord & Viber",
    description:
      "Crafts high-engagement, perfectly structured announcements for club group chats. Includes an AI-assisted generator that transforms raw notes into polished announcements with proper headings, bullet points, emoji cues, and clear call-to-actions.",
    capabilities: [
      "Pre-configured templates: General Assembly Call, Service Mobilization, Dues Reminder, and Fellowship Invitations.",
      "AI Copywriting Assistant: Refines tone (Formal, Energetic, Urgent) and ensures essential details are never omitted.",
      "Mobile Preview Simulator: Live preview formatted exactly as it appears on mobile Messenger, Discord, or Viber screens.",
      "One-click Copy: Instantly copies clean markdown/plain text formatted for immediate dispatch.",
      "Broadcast history log to track previous calls-to-order and attendance advisories.",
    ],
    workflow: [
      {
        step: 1,
        title: "Select Intent",
        description: "Pick a template (e.g. General Assembly Call or Emergency Typhoon Relief Mobilization).",
      },
      {
        step: 2,
        title: "Fill Details",
        description: "Enter meeting date, time, venue/Zoom link, attire (Rotary polo, club shirt, or casual), and key agenda.",
      },
      {
        step: 3,
        title: "Generate & Polish",
        description: "Click 'Generate Announcement' and adjust tone or wording with the AI assistant.",
      },
      {
        step: 4,
        title: "Dispatch to GC",
        description: "Click 'Copy to Clipboard' and paste directly into your official club Messenger or Discord channels.",
      },
    ],
    rolesAndPermissions: [
      {
        role: "Secretary & PRO",
        level: "Board / Executive",
        permissions: "Full authoring and template management permissions.",
      },
      {
        role: "Committee Chairs",
        level: "Committee Officer",
        permissions: "Draft committee-specific announcements and service mobilization advisories.",
      },
    ],
    rulesAndPolicies: [
      "Announcements must adhere to Rotary Public Image standards and maintain a respectful, inspiring tone.",
      "AI output is advisory; human review is mandatory before posting to external group chats.",
    ],
    proTip: "Always send General Assembly announcements 3 days in advance, with a brief reminder posted 3 hours before call-to-order.",
  },
  {
    id: "projects",
    name: "Projects & District 3820 Reports",
    route: "/projects",
    icon: FolderKanban,
    category: "ACTIVITIES",
    categoryLabel: "Activities & Reporting",
    tagline: "Rotary 7 Areas of Focus, UN SDGs & reproducible District report exports",
    description:
      "The definitive documentation and reporting engine for club service operations. Maps projects to the 7 Rotary Areas of Focus and 17 UN Sustainable Development Goals, and generates immutable, reproducible District 3820 PDF/DOCX reports.",
    capabilities: [
      "Full project lifecycle management (Planning → Execution → Reporting → Evaluation).",
      "Official Rotary 7 Areas of Focus classification & UN SDG 1-17 impact alignment.",
      "Separation of service categories (Club, Community, International, Professional Dev, Youth Service, Fellowship).",
      "District 3820 Report workflow: DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED (or REVISION_REQUESTED).",
      "Immutable JSON snapshot generation guaranteeing 100% reproducible PDF/DOCX district reports.",
    ],
    workflow: [
      {
        step: 1,
        title: "Charter & Planning",
        description: "Create project charter, assign Service Committee, select Areas of Focus, and set beneficiary targets.",
      },
      {
        step: 2,
        title: "Execution & Data Capture",
        description: "Link event check-ins, record volunteer hours, log beneficiaries served, and attach high-res project photos.",
      },
      {
        step: 3,
        title: "Financial Consolidation",
        description: "Connect verified budget liquidations and total funds disbursed from the Treasury module.",
      },
      {
        step: 4,
        title: "Snapshot & District Filing",
        description: "Generate immutable snapshot, submit for President review, and export the official District 3820 report.",
      },
    ],
    rolesAndPermissions: [
      {
        role: "Project Chairs",
        level: "Committee Officer",
        permissions: "Draft projects, upload documentation, and record project beneficiaries.",
      },
      {
        role: "President & Secretary",
        level: "Board / Executive",
        permissions: "Final review, electronic signature endorsement, and official District submission.",
      },
    ],
    rulesAndPolicies: [
      "Rotary Areas of Focus are strictly limited to the official 7; service categories must not be confused with Areas of Focus.",
      "Once approved, project reports are locked; any corrections require a formal revision request and create a new version snapshot.",
    ],
    proTip: "Take photos showing members wearing Rotary/Rotaract pins or shirts in action; District awards favor reports with vibrant, candid service photography.",
  },
  {
    id: "tasks",
    name: "Task Center & Team Collaboration",
    route: "/tasks",
    icon: CheckSquare,
    category: "ACTIVITIES",
    categoryLabel: "Activities & Reporting",
    tagline: "Notion & Linear style committee task tracking and deliverable management",
    description:
      "A fast, modern task center built for club committees. Inspired by Notion and Linear, it features multi-assignee management, quick-assign card popovers, checklist progress tracking, and full editing of deliverables and timelines.",
    capabilities: [
      "Committee-based task filtering (Club Admin, Community Service, Professional Dev, International, Public Image, Finance).",
      "Notion-style multi-assignee management with interactive member-picker popover directly on task cards.",
      "Deliverable checklists with dynamic completion percentage calculation.",
      "Priority triage (Low, Medium, High, Urgent) and workflow progression (Todo → In Progress → In Review → Completed).",
      "Full edit modal to update task titles, scope, target due dates, committee assignments, and assignees.",
    ],
    workflow: [
      {
        step: 1,
        title: "Create Task",
        description: "Click '+ New Group Task', enter title, description, committee, priority, and due date.",
      },
      {
        step: 2,
        title: "Assign People",
        description: "Click the assignee pill or '+' icon on the card to instantly toggle committee members.",
      },
      {
        step: 3,
        title: "Track Deliverables",
        description: "Tick checklist items as progress is made; the card dynamically reflects percentage completion.",
      },
      {
        step: 4,
        title: "Status Progression",
        description: "Move cards through Todo, In Progress, In Review, and Completed as deliverables are achieved.",
      },
    ],
    rolesAndPermissions: [
      {
        role: "Board Officers & Committee Chairs",
        level: "Committee Officer",
        permissions: "Create, edit, delete tasks, and manage committee member assignments.",
      },
      {
        role: "Assigned Members",
        level: "General Member",
        permissions: "Check off deliverables, update task progress, and cycle workflow status.",
      },
    ],
    rulesAndPolicies: [
      "Every group task must have an assigned committee and realistic target due date.",
      "Completed tasks remain accessible in the completed filter for end-of-term operational audits.",
    ],
    proTip: "Break large projects into smaller tasks of 1-3 days duration each, and assign a single primary lead to each deliverable for accountability.",
  },
  {
    id: "treasury",
    name: "Treasury, Invoicing & Dues",
    route: "/treasury",
    icon: Receipt,
    category: "FINANCE",
    categoryLabel: "Finance & Treasury",
    tagline: "Double-entry integrity, integer-centavo math & verified payment audits",
    description:
      "The club's financial accounting and dues collection backbone. Employs integer-centavo arithmetic to prevent floating-point rounding errors and enforces human-in-the-loop verification of all GCash, Maya, and bank payments.",
    capabilities: [
      "Automated membership dues invoicing with idempotent deduplication keys preventing duplicate billing.",
      "Digital payment proof uploads supporting GCash, Maya, and BDO/BPI bank transfer receipts.",
      "Human-in-the-loop payment verification with in-browser OCR assistance via 'PAYMENT_VERIFY'.",
      "Immutable ledger balance dynamically calculated as: Σ Invoices + Σ Adjustments − Σ Verified Allocations.",
      "Automated electronic payment acknowledgment receipts for paid members.",
    ],
    workflow: [
      {
        step: 1,
        title: "Invoice Generation",
        description: "Treasurer generates annual or semester dues invoices for the active club roster.",
      },
      {
        step: 2,
        title: "Proof Upload",
        description: "Member pays via GCash or bank transfer and uploads receipt screenshot with transaction reference.",
      },
      {
        step: 3,
        title: "Treasurer Verification",
        description: "Treasurer verifies receipt against actual bank balance and clicks 'Verify Payment'.",
      },
      {
        step: 4,
        title: "Balance Credit",
        description: "System records verified allocation and issues digital acknowledgment receipt to member.",
      },
    ],
    rolesAndPermissions: [
      {
        role: "Treasurer",
        level: "Board / Executive",
        permissions: "Issue invoices, verify payment proofs, record ledger adjustments.",
      },
      {
        role: "Auditor",
        level: "Independent Auditor",
        permissions: "Read-only inspection of all ledgers, uploaded proofs, allocations, and bank reconciliations.",
      },
      {
        role: "General Member",
        level: "General Member",
        permissions: "View personal billing statement, pending balances, and upload payment receipts.",
      },
    ],
    rulesAndPolicies: [
      "All monetary values are stored in integer centavos (PHP 100.00 = 10000) to prevent floating-point math bugs.",
      "OCR suggestions are strictly advisory; a human officer holding 'PAYMENT_VERIFY' must review before balance updates.",
      "Never rewrite or edit verified ledger rows; discrepancies must be resolved via transparent ledger adjustments.",
    ],
    proTip: "Reconcile GCash and club bank accounts weekly. Match reference numbers in the receipt with the SMS confirmation log.",
  },
  {
    id: "budgets",
    name: "Budget Approvals & Liquidation",
    route: "/budgets",
    icon: FileSpreadsheet,
    category: "FINANCE",
    categoryLabel: "Finance & Treasury",
    tagline: "Dual-authorization budget approvals & post-event receipt liquidations",
    description:
      "Enforces strict fiscal governance for service projects. Requires independent dual approvals (Treasurer + President) for fund disbursement, and mandates full receipt-level liquidation within 14 calendar days post-event.",
    capabilities: [
      "Itemized budget proposals linked to approved club service projects.",
      "Dual approval workflow: requires independent sign-offs from both Treasurer and Club President.",
      "Self-approval prohibition: requesters cannot approve their own budget requests.",
      "14-day post-event liquidation portal with itemized receipt uploads and line-item acceptance/rejection.",
      "Disbursement tracking and unliquidated cash advance aging alerts.",
    ],
    workflow: [
      {
        step: 1,
        title: "Budget Proposal",
        description: "Project Chair submits itemized budget with expense items and vendor quotations.",
      },
      {
        step: 2,
        title: "Dual Review & Approval",
        description: "Treasurer approves fiscal viability; President signs off on strategic execution.",
      },
      {
        step: 3,
        title: "Fund Disbursement",
        description: "Treasurer releases funds via bank transfer/GCash and records disbursement reference.",
      },
      {
        step: 4,
        title: "Receipt Liquidation",
        description: "Within 14 days post-event, Chair uploads official receipts for every spent centavo.",
      },
      {
        step: 5,
        title: "Audit Sign-off",
        description: "Treasurer and Auditor audit receipts; unspent advances are refunded to club treasury.",
      },
    ],
    rolesAndPermissions: [
      {
        role: "Treasurer & President",
        level: "Board / Executive",
        permissions: "Dual approval authority; Treasurer records disbursement, President signs executive consent.",
      },
      {
        role: "Project Chairs",
        level: "Committee Officer",
        permissions: "Submit budget requests and file liquidation vouchers with receipt attachments.",
      },
      {
        role: "Auditor",
        level: "Independent Auditor",
        permissions: "Audit liquidation packages and flag unreceipted or non-compliant expenditures.",
      },
    ],
    rulesAndPolicies: [
      "Treasurer ≠ President. Neither officer can single-handedly disburse club project funds.",
      "Liquidation must be finalized within 14 calendar days. Unliquidated advances freeze future project approvals.",
    ],
    proTip: "Photocopy or photograph thermal paper receipts (e.g. convenience stores, gas stations) immediately—they fade quickly in humid Philippine climates.",
  },
  {
    id: "partnerships",
    name: "Sister Clubs & Partnerships",
    route: "/partnerships",
    icon: Globe,
    category: "FINANCE",
    categoryLabel: "Finance & Treasury",
    tagline: "Memorandums of Understanding & collaborative joint service projects",
    description:
      "Tracks formal alliances with domestic and international sister Rotaract and Rotary clubs. Manages Memorandums of Understanding (MoU), collaborative service projects, and inter-club fellowship history while preserving club data sovereignty.",
    capabilities: [
      "Sister Club directory covering District 3820, other Philippine districts, and international twin clubs.",
      "Memorandum of Understanding (MoU) management tracking effective dates, mutual goals, and signed agreements.",
      "Collaborative joint project linking via multi-club scoping ('project_clubs', 'event_clubs').",
      "Shared impact metrics allowing clubs to co-report volunteer hours and beneficiaries to Rotary International.",
      "Partner contact book for Club Presidents, International Service Directors, and twin club coordinators.",
    ],
    workflow: [
      {
        step: 1,
        title: "Establish Alliance",
        description: "Club initiates contact with sister club and agrees upon mutual fellowship and service focus.",
      },
      {
        step: 2,
        title: "Record MoU",
        description: "Log agreement terms, term dates, and upload scanned copy of signed Memorandum of Understanding.",
      },
      {
        step: 3,
        title: "Co-host Project",
        description: "Link sister club to joint service projects; system isolates private rosters while co-reporting metrics.",
      },
      {
        step: 4,
        title: "Annual Review",
        description: "Evaluate collaborative impact during district conferences and renew active partnerships.",
      },
    ],
    rolesAndPermissions: [
      {
        role: "International Service Director",
        level: "Committee Officer",
        permissions: "Manage sister club profiles, maintain contact records, and track MoU deliverables.",
      },
      {
        role: "President",
        level: "Board / Executive",
        permissions: "Final approval and formal signing of partnership Memorandums of Understanding.",
      },
    ],
    rulesAndPolicies: [
      "Data sovereignty mandate: partner clubs share combined project metrics but never receive access to private member records.",
      "Every joint project must designate a single primary host club accountable for budget and reporting.",
    ],
    proTip: "Schedule a virtual joint fellowship before your actual service project to build personal rapport between both clubs' member bases.",
  },
  {
    id: "resources",
    name: "Resources & External Links Hub",
    route: "/resources",
    icon: Bookmark,
    category: "RESOURCES",
    categoryLabel: "Tools & Resources",
    tagline: "Centralized bookmarks for external apps, cloud drives & district resources",
    description:
      "A centralized repository for all club bookmarks, external software, Google Drive folders, Canva brand assets, and district portals. Solves lost links in group chats and provides role-based visibility controls.",
    capabilities: [
      "Full CRUD operations to add, edit, or archive club resources and links.",
      "Categorized filtering: District & Rotary, Operations & Drive, Social Media & PR, Finance & Banking, Governance.",
      "Granular access control levels: Public, Members Only, and Board Officers Only.",
      "Direct external launch buttons and one-click link copy with clipboard confirmation.",
      "Search filter to find links by title, description, or domain URL.",
    ],
    workflow: [
      {
        step: 1,
        title: "Add Resource",
        description: "Click '+ Add Resource', enter title, external URL, description, category, and access level.",
      },
      {
        step: 2,
        title: "Protocol Validation",
        description: "System verifies the URL format and ensures safe 'https://' protocol.",
      },
      {
        step: 3,
        title: "Categorized Access",
        description: "Members access verified links directly from the hub without searching group chat pinned messages.",
      },
    ],
    rolesAndPermissions: [
      {
        role: "Board Officers",
        level: "Board / Executive",
        permissions: "Create, edit, delete, and configure access levels for club links.",
      },
      {
        role: "General Members",
        level: "General Member",
        permissions: "View and launch all Public and Members-Only resources.",
      },
    ],
    rulesAndPolicies: [
      "All external links must use encrypted 'https://' protocols to safeguard member device security.",
      "Internal financial spreadsheets or credential documents must be strictly tagged 'Board Only'.",
    ],
    proTip: "Pin your club's official Google Drive folder and Canva team workspace here so incoming committee heads have immediate onboarding access.",
  },
  {
    id: "certificates",
    name: "Certificates & Recognition",
    route: "/certificates",
    icon: Award,
    category: "RESOURCES",
    categoryLabel: "Tools & Resources",
    tagline: "Automated issuance of certificates of attendance, appreciation & citations",
    description:
      "Automates the design and generation of official Rotaract certificates. Generates personalized Certificates of Attendance for event attendees, Certificates of Appreciation for guest speakers, and Member of the Month citations with cryptographic verification.",
    capabilities: [
      "Batch certificate generation populated directly from verified event attendance rosters.",
      "Standardized templates: Certificate of Attendance, Guest Speaker Appreciation, and Citation of Merit.",
      "Dynamic SVG and high-resolution PDF rendering with official signatures and club seal.",
      "Cryptographic serial code on every certificate to enable tamper-proof authenticity verification.",
      "Self-service download portal for members and external guest speakers.",
    ],
    workflow: [
      {
        step: 1,
        title: "Finalize Attendance",
        description: "Ensure event attendance roster is closed and verified in the Events module.",
      },
      {
        step: 2,
        title: "Select Template",
        description: "Secretary selects certificate type and verifies digital signature authorizations.",
      },
      {
        step: 3,
        title: "Batch Generation",
        description: "System generates personalized certificates with unique serial numbers for all verified attendees.",
      },
      {
        step: 4,
        title: "Download & Verify",
        description: "Members download PDF certificates; employers or universities can verify validity using the serial code.",
      },
    ],
    rolesAndPermissions: [
      {
        role: "Secretary & President",
        level: "Board / Executive",
        permissions: "Template configuration, digital signature attachment, and issuance authorization.",
      },
      {
        role: "Attending Members / Speakers",
        level: "General Member",
        permissions: "Download personalized certificate files.",
      },
    ],
    rulesAndPolicies: [
      "Certificates can only be issued to individuals with verified check-in records in the database.",
      "Certificate serial numbers are permanently recorded in the verification ledger and cannot be reused.",
    ],
    proTip: "Issue certificates of attendance within 24 hours of an event while attendee enthusiasm and engagement are at their peak.",
  },
  {
    id: "settings",
    name: "Club Settings & Governance",
    route: "/settings",
    icon: Settings,
    category: "EXECUTIVE",
    categoryLabel: "Executive & Roster",
    tagline: "Rotary Year configuration, district parameters & RBAC permission matrix",
    description:
      "The administrative control center for the club. Manages Rotary International charter details, District 3820 codes, Rotary Year transitions, role-permission matrices, and system security audit logs.",
    capabilities: [
      "Club charter profile: Charter Date, Club ID, Sponsoring Rotary Club, and District 3820 designation.",
      "Rotary Year configuration: define active term boundaries (July 1 – June 30) and initialize rollover states.",
      "Role-Permission matrix editor: configure granular system permissions across all 10 club roles.",
      "Comprehensive system audit log: records every administrative update, permission change, and role elevation.",
      "Data retention and privacy policy switches aligned with Rotary International and Philippine legal standards.",
    ],
    workflow: [
      {
        step: 1,
        title: "Term Initialization",
        description: "Incoming President and Secretary initialize the upcoming Rotary Year term parameters.",
      },
      {
        step: 2,
        title: "Role Matrix Calibration",
        description: "Verify that permission keys match the current board's executive responsibilities.",
      },
      {
        step: 3,
        title: "Security & Audit Review",
        description: "Auditor and Board periodically review security logs for unauthorized configuration attempts.",
      },
    ],
    rolesAndPermissions: [
      {
        role: "President & Platform Admin",
        level: "Board / Executive",
        permissions: "Exclusive governance access; permission adjustments and system configuration.",
      },
      {
        role: "Auditor",
        level: "Independent Auditor",
        permissions: "Read-only access to system audit logs and permission matrices.",
      },
    ],
    rulesAndPolicies: [
      "Changes to financial permissions or dual-approval thresholds require two-officer executive confirmation.",
      "System audit logs are immutable and can never be truncated or cleared.",
    ],
    proTip: "Always perform a full audit log review during the annual club assembly handover before the new board officially takes office on July 1.",
  },
];

// ==========================================
// FAQ Data
// ==========================================

const FAQS: FAQItem[] = [
  {
    id: "faq-1",
    category: "MEMBERSHIP",
    question: "How does the 5-stage recruitment and onboarding pipeline work?",
    answer:
      "Candidates start as 'Inquiry/Prospect'. When they attend an orientation, their status is updated to 'Orientation Attended'. Next, they join at least 1 community service project, settle their annual club dues, and are finally inducted by the Club President and Board into active member status.",
  },
  {
    id: "faq-2",
    category: "MEMBERSHIP",
    question: "How are Retention Alerts triggered, and what is the club's policy?",
    answer:
      "The system monitors attendance logs. If an active member misses 3 consecutive General Assemblies without an excused absence or 60 days without service participation, an alert is raised. Our policy is strictly supportive: alerts are private to the Membership Committee and used exclusively for personal fellowship check-ins, never public shaming or automated suspension.",
  },
  {
    id: "faq-3",
    category: "EVENTS",
    question: "How does the dynamic QR rolling-code check-in operate?",
    answer:
      "When the Event Chair starts a session, the system generates a cryptographic QR code that updates every 15 seconds to prevent screenshot sharing. Members scan the QR via camera or in-app scanner to record GPS-verified timestamps.",
  },
  {
    id: "faq-4",
    category: "EVENTS",
    question: "What if a member's smartphone has no internet or camera issues?",
    answer:
      "Authorized club officers (Secretary or Attendance Marshals) can open the event roster and manually verify the member's presence with an officer override flag. The system records the officer ID and a mandatory audit reason.",
  },
  {
    id: "faq-5",
    category: "TREASURY",
    question: "How are project budgets disbursed and liquidated?",
    answer:
      "Project Chairs submit a Budget Request with itemized line items. It requires dual authorization (Treasurer + President). After the project, all receipts must be uploaded for liquidation within 14 calendar days. Unliquidated advances freeze subsequent budget requests.",
  },
  {
    id: "faq-6",
    category: "REPORTING",
    question: "How do we generate District 3820 Monthly Reports?",
    answer:
      "Navigate to 'Projects & Reports'. Select the project and click 'Generate District Report'. The platform bundles attendance counts, volunteer hours, and funds raised into a compliant PDF/HTML document ready for the District Governor.",
  },
  {
    id: "faq-7",
    category: "GENERAL",
    question: "Where can I find official Rotaract logos and social media assets?",
    answer:
      "Visit the 'Resources & Links Hub' in the sidebar or directly access the Rotary Brand Center via our pinned links to download high-resolution vectors, colors, and official emblem guidelines.",
  },
];

const CATEGORIES: { key: ModuleCategory; label: string }[] = [
  { key: "ALL", label: "All Modules (14)" },
  { key: "EXECUTIVE", label: "Executive & Roster (3)" },
  { key: "MEMBERSHIP", label: "Membership Pipeline (2)" },
  { key: "ACTIVITIES", label: "Activities & Reporting (4)" },
  { key: "FINANCE", label: "Finance & Treasury (3)" },
  { key: "RESOURCES", label: "Tools & Resources (2)" },
];

export function HelpClient() {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<"MANUAL" | "FAQS" | "SUPPORT">("MANUAL");

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ModuleCategory>("ALL");

  // Active module for deep dive
  const [activeModuleId, setActiveModuleId] = useState<string>("dashboard");

  // FAQ state
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>("faq-1");

  // Support ticket modal
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketMessage, setTicketMessage] = useState("");
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null);

  // Copy notification toast
  const [copiedText, setCopiedText] = useState<string | null>(null);

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2500);
  }

  // Filtered module manuals
  const filteredModules = useMemo(() => {
    return MODULE_MANUALS.filter((mod) => {
      if (selectedCategory !== "ALL" && mod.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          mod.name.toLowerCase().includes(q) ||
          mod.tagline.toLowerCase().includes(q) ||
          mod.description.toLowerCase().includes(q) ||
          mod.capabilities.some((c) => c.toLowerCase().includes(q)) ||
          mod.rulesAndPolicies.some((r) => r.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [searchQuery, selectedCategory]);

  const activeModule = useMemo(() => {
    return (
      MODULE_MANUALS.find((m) => m.id === activeModuleId) ||
      filteredModules[0] ||
      MODULE_MANUALS[0]
    );
  }, [activeModuleId, filteredModules]);

  // Filtered FAQs
  const filteredFaqs = useMemo(() => {
    return FAQS.filter((faq) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return faq.question.toLowerCase().includes(q) || faq.answer.toLowerCase().includes(q);
      }
      return true;
    });
  }, [searchQuery]);

  function handleSubmitTicket(e: React.FormEvent) {
    e.preventDefault();
    setSubmittedMessage("Your inquiry has been logged with the District 3820 Secretariat & IT Team.");
    setTicketSubject("");
    setTicketMessage("");
    setTimeout(() => {
      setShowSupportModal(false);
      setSubmittedMessage(null);
    }, 3000);
  }

  return (
    <div className="space-y-6 select-none max-w-6xl mx-auto pb-12">
      {/* 1. Header Hero Banner */}
      <div className="bg-gradient-to-r from-[#0D3594] via-[#103EAE] to-[#0D3594] text-white rounded-2xl p-6 md:p-8 relative overflow-hidden shadow-xs">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-white/90 border border-white/20 mb-3">
            <BookOpen className="w-3.5 h-3.5" />
            <span>District 3820 Operations Manual & Knowledge Hub</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Racspeed System Manual & Module Guide
          </h1>
          <p className="mt-2 text-xs md:text-sm text-blue-100 leading-relaxed">
            Comprehensive operational manual, step-by-step functionality guides, and governance rules
            for every module in the Rotaract Club of San Pedro East workspace.
          </p>

          {/* Search Bar in Banner */}
          <div className="mt-5 relative max-w-lg">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search all manuals: QR check-in, dues, retention, liquidation, tasks..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white text-[#111625] text-xs font-medium placeholder-slate-400 focus:outline-hidden shadow-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Top-Level Section Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-[#EDEDF2] dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("MANUAL")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === "MANUAL"
                ? "bg-[#0D3594] text-white shadow-xs"
                : "bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800 text-[#6B7280] dark:text-slate-400 hover:text-[#111625] dark:hover:text-white"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Operations Manual & Modules (14)</span>
          </button>

          <button
            onClick={() => setActiveTab("FAQS")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === "FAQS"
                ? "bg-[#0D3594] text-white shadow-xs"
                : "bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800 text-[#6B7280] dark:text-slate-400 hover:text-[#111625] dark:hover:text-white"
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>FAQs & Quick Answers</span>
          </button>

          <button
            onClick={() => setActiveTab("SUPPORT")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === "SUPPORT"
                ? "bg-[#0D3594] text-white shadow-xs"
                : "bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800 text-[#6B7280] dark:text-slate-400 hover:text-[#111625] dark:hover:text-white"
            }`}
          >
            <Phone className="w-4 h-4" />
            <span>District Support & Contacts</span>
          </button>
        </div>

        {copiedText && (
          <div className="text-[11px] font-semibold text-[#17A863] bg-[#E7F8F0] px-3 py-1 rounded-lg border border-[#17A863]/20 flex items-center gap-1.5 animate-in fade-in duration-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Copied to clipboard!</span>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* TAB 1: OPERATIONS MANUAL & MODULE FUNCTIONALITY GUIDE    */}
      {/* ======================================================== */}
      {activeTab === "MANUAL" && (
        <div className="space-y-6">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setSelectedCategory(cat.key)}
                className={`px-3 py-1.5 rounded-xl font-semibold transition shrink-0 cursor-pointer ${
                  selectedCategory === cat.key
                    ? "bg-[#0D3594] text-white shadow-xs"
                    : "bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800 text-[#6B7280] dark:text-slate-400 hover:text-[#111625] dark:hover:text-white"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Master-Detail Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Module Navigation Selector List */}
            <div className="lg:col-span-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-[#8E95A5] px-1 uppercase tracking-wider">
                <span>Select Module ({filteredModules.length})</span>
                <span>Category</span>
              </div>

              {filteredModules.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#8E95A5] bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800 rounded-2xl">
                  No modules match "{searchQuery}".
                </div>
              ) : (
                <div className="space-y-2 max-h-[750px] overflow-y-auto pr-1">
                  {filteredModules.map((mod) => {
                    const Icon = mod.icon;
                    const isSelected = mod.id === activeModule.id;
                    return (
                      <button
                        key={mod.id}
                        onClick={() => setActiveModuleId(mod.id)}
                        className={`w-full text-left p-3.5 rounded-2xl border transition flex items-start gap-3 cursor-pointer ${
                          isSelected
                            ? "bg-[#0D3594]/5 dark:bg-[#0D3594]/15 border-[#0D3594] shadow-xs"
                            : "bg-white dark:bg-[#111622] border-[#EDEDF2] dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                            isSelected
                              ? "bg-[#0D3594] text-white"
                              : "bg-[#EDEDF2] dark:bg-slate-800 text-[#6B7280] dark:text-slate-300"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <h3
                              className={`text-xs font-bold truncate ${
                                isSelected
                                  ? "text-[#0D3594] dark:text-blue-400"
                                  : "text-[#111625] dark:text-white"
                              }`}
                            >
                              {mod.name}
                            </h3>
                            <span className="text-[10px] font-semibold text-[#8E95A5] uppercase shrink-0">
                              {mod.category}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#8E95A5] line-clamp-1 mt-0.5">
                            {mod.tagline}
                          </p>
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              {mod.route}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Column: Deep-Dive Module Manual & How It Works */}
            <div className="lg:col-span-8 bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800/80 rounded-2xl p-6 md:p-8 space-y-6">
              {/* Module Header Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#EDEDF2] dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#E2EBFF] text-[#0D3594] flex items-center justify-center shrink-0">
                    {React.createElement(activeModule.icon, { className: "w-6 h-6" })}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg md:text-xl font-extrabold text-[#111625] dark:text-white">
                        {activeModule.name}
                      </h2>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E2EBFF] text-[#0D3594]">
                        {activeModule.categoryLabel}
                      </span>
                    </div>
                    <p className="text-xs text-[#8E95A5] mt-0.5">{activeModule.tagline}</p>
                  </div>
                </div>

                <Link
                  href={activeModule.route}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0D3594] hover:bg-[#092569] text-white text-xs font-semibold shadow-xs transition shrink-0 cursor-pointer"
                >
                  <span>Open {activeModule.route}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* 1. Purpose & Scope */}
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#8E95A5] mb-2 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-[#0D3594]" />
                  <span>1. Purpose & Scope</span>
                </h3>
                <p className="text-xs text-[#374151] dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                  {activeModule.description}
                </p>
              </div>

              {/* 2. Key Capabilities */}
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#8E95A5] mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#17A863]" />
                  <span>2. Core Capabilities & Features</span>
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  {activeModule.capabilities.map((cap, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800 text-xs text-[#111625] dark:text-slate-200"
                    >
                      <CheckCircle2 className="w-4 h-4 text-[#17A863] shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{cap}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Step-by-Step "How It Works" Workflow */}
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#8E95A5] mb-3 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>3. Step-by-Step Operational Workflow</span>
                </h3>
                <div className="space-y-3">
                  {activeModule.workflow.map((w) => (
                    <div
                      key={w.step}
                      className="flex items-start gap-3 p-3.5 rounded-xl border border-[#EDEDF2] dark:border-slate-800 bg-white dark:bg-[#161B26]"
                    >
                      <div className="w-6 h-6 rounded-full bg-[#0D3594] text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-xs">
                        {w.step}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#111625] dark:text-white">
                          {w.title}
                        </h4>
                        <p className="text-[11px] text-[#6B7280] dark:text-slate-400 mt-1 leading-relaxed">
                          {w.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. Governance & Role Matrix */}
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#8E95A5] mb-3 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#8244E8]" />
                  <span>4. Roles & Authorization Matrix</span>
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border border-[#EDEDF2] dark:border-slate-800 rounded-xl overflow-hidden">
                    <thead className="bg-slate-50 dark:bg-slate-900 text-[#8E95A5] font-semibold text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3">Role Designation</th>
                        <th className="py-2.5 px-3">Authority Level</th>
                        <th className="py-2.5 px-3">Operational Permissions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EDEDF2] dark:divide-slate-800">
                      {activeModule.rolesAndPermissions.map((rp, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 font-bold text-[#111625] dark:text-white">
                            {rp.role}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {rp.level}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-[#6B7280] dark:text-slate-300 text-[11px] leading-relaxed">
                            {rp.permissions}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 5. Mandatory Rules & Policies */}
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#8E95A5] mb-2 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                  <span>5. Mandatory Policies & Anti-Fraud Rules</span>
                </h3>
                <div className="space-y-2">
                  {activeModule.rulesAndPolicies.map((rule, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/50 dark:border-rose-900/40 text-xs text-rose-900 dark:text-rose-200"
                    >
                      <Lock className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                      <span className="leading-relaxed text-[11px] font-medium">{rule}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 6. Senior Architect Pro-Tip */}
              <div className="p-4 rounded-xl bg-[#E2EBFF]/60 dark:bg-[#0D3594]/20 border border-[#2563EB]/20 flex items-start gap-3">
                <Sparkles className="w-4 h-4 text-[#0D3594] shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-[#0D3594] dark:text-blue-300">
                    Senior Architect Pro-Tip
                  </h4>
                  <p className="text-[11px] text-[#374151] dark:text-slate-300 mt-0.5 leading-relaxed">
                    {activeModule.proTip}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: FREQUENTLY ASKED QUESTIONS                       */}
      {/* ======================================================== */}
      {activeTab === "FAQS" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800/80 rounded-2xl p-6 transition">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div>
                <h2 className="text-base font-bold text-[#111625] dark:text-white">
                  Frequently Asked Questions
                </h2>
                <p className="text-xs text-[#8E95A5] mt-0.5">
                  Quick answers to standard operating procedures, dues, attendance, and reporting.
                </p>
              </div>
              <span className="text-xs font-semibold text-[#0D3594] bg-[#E2EBFF] px-2.5 py-1 rounded-full">
                {filteredFaqs.length} Answers Available
              </span>
            </div>

            {filteredFaqs.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#8E95A5]">
                No answers match your search term "{searchQuery}".
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredFaqs.map((faq) => {
                  const isOpen = expandedFaqId === faq.id;
                  return (
                    <div key={faq.id} className="py-3.5">
                      <button
                        onClick={() => setExpandedFaqId(isOpen ? null : faq.id)}
                        className="w-full flex items-center justify-between text-left gap-4 cursor-pointer"
                      >
                        <span className="text-xs font-bold text-[#111625] dark:text-white">
                          {faq.question}
                        </span>
                        {isOpen ? (
                          <ChevronUp className="w-4 h-4 text-[#0D3594] shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-[#8E95A5] shrink-0" />
                        )}
                      </button>
                      {isOpen && (
                        <p className="mt-2.5 text-xs text-[#6B7280] dark:text-slate-300 leading-relaxed pr-6 bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                          {faq.answer}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: DISTRICT SUPPORT & CONTACTS                      */}
      {/* ======================================================== */}
      {activeTab === "SUPPORT" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Club Secretariat */}
            <div className="bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800/80 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#0D3594]" />
                <h3 className="text-xs font-bold text-[#111625] dark:text-white">Club Secretariat</h3>
              </div>
              <p className="text-[11px] text-[#8E95A5]">
                For membership certificates, roster updates, excused absences, and General Assembly inquiries.
              </p>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-semibold text-[#111625] dark:text-white truncate">
                  rotaract.sanpedroeast@gmail.com
                </span>
                <button
                  onClick={() => copyToClipboard("rotaract.sanpedroeast@gmail.com")}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
                  title="Copy email"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* District 3820 Secretariat */}
            <div className="bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800/80 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#17A863]" />
                <h3 className="text-xs font-bold text-[#111625] dark:text-white">District 3820 Secretariat</h3>
              </div>
              <p className="text-[11px] text-[#8E95A5]">
                District Governor monthly report compliance, Rotary citation goals, and DISAS registrations.
              </p>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-semibold text-[#111625] dark:text-white truncate">
                  district3820.rotaract@gmail.com
                </span>
                <button
                  onClick={() => copyToClipboard("district3820.rotaract@gmail.com")}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
                  title="Copy email"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Platform IT Committee & Support Ticket */}
            <div className="bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800/80 rounded-2xl p-5 space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-[#8244E8]" />
                  <h3 className="text-xs font-bold text-[#111625] dark:text-white">Platform IT Committee</h3>
                </div>
                <p className="text-[11px] text-[#8E95A5] mt-1">
                  Report platform bugs, request permission upgrades, or suggest operational features.
                </p>
              </div>
              <button
                onClick={() => setShowSupportModal(true)}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#0D3594] hover:bg-[#092569] text-white text-xs font-semibold transition cursor-pointer shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit Support Ticket</span>
              </button>
            </div>
          </div>

          {/* System Health Status Card */}
          <div className="bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800/80 rounded-2xl p-6">
            <h3 className="text-xs font-bold text-[#111625] dark:text-white mb-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#17A863]" />
              <span>Platform Health & Compliance Diagnostics</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-bold text-[#8E95A5] uppercase">Active District Code</span>
                <p className="text-sm font-extrabold text-[#111625] dark:text-white mt-0.5">District 3820</p>
                <span className="text-[10px] text-[#17A863] font-semibold">● Synchronized</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-bold text-[#8E95A5] uppercase">Current Rotary Year</span>
                <p className="text-sm font-extrabold text-[#111625] dark:text-white mt-0.5">RY 2026-2027</p>
                <span className="text-[10px] text-[#2563EB] font-semibold">● Active Term</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-bold text-[#8E95A5] uppercase">Data Privacy Protection</span>
                <p className="text-sm font-extrabold text-[#111625] dark:text-white mt-0.5">PH DPA Act 10173</p>
                <span className="text-[10px] text-[#17A863] font-semibold">● RLS Enforced</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Support Ticket Submission Modal */}
      {showSupportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setShowSupportModal(false)}
          />
          <div className="relative w-full max-w-md bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800 rounded-2xl elevation-popover p-6 z-10 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded-lg bg-[#E2EBFF] text-[#0D3594]">
                  <Send className="w-4 h-4" />
                </span>
                <h2 className="text-base font-bold text-[#111625] dark:text-white">
                  Contact Platform Support
                </h2>
              </div>
              <button
                onClick={() => setShowSupportModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {submittedMessage ? (
              <div className="p-4 rounded-xl bg-[#E7F8F0] border border-[#17A863]/20 text-[#17A863] text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{submittedMessage}</span>
              </div>
            ) : (
              <form onSubmit={handleSubmitTicket} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-[#111625] dark:text-slate-200 mb-1">
                    Subject / Concern *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rolling QR session reset or Budget Approval question"
                    value={ticketSubject}
                    onChange={(e) => setTicketSubject(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#EDEDF2] dark:border-slate-800 bg-white dark:bg-[#161B26] text-[#111625] dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#0D3594]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#111625] dark:text-slate-200 mb-1">
                    Detailed Message *
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Describe your inquiry, steps to reproduce, or module in question..."
                    value={ticketMessage}
                    onChange={(e) => setTicketMessage(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#EDEDF2] dark:border-slate-800 bg-white dark:bg-[#161B26] text-[#111625] dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#0D3594]"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSupportModal(false)}
                    className="px-4 py-2 rounded-xl border border-[#EDEDF2] dark:border-slate-800 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[#0D3594] hover:bg-[#092569] text-white font-semibold shadow-xs transition cursor-pointer"
                  >
                    Send to IT Committee
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
