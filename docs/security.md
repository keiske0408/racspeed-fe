# Security & Data Protection Standards

## 1. Authentication & Session Handling
- Supabase Auth handles password authentication and session JWTs.
- Next.js 16 Server Components interact via `@supabase/ssr` using asynchronous `await cookies()`.
- Public registration creates accounts in `PENDING` state with no assigned club roles. An authorized officer (`MEMBER_APPROVE`) must approve the request before operational access is granted.

## 2. Role-Based Access Control (RBAC)
- 9 System Roles: `PLATFORM_ADMIN`, `PRESIDENT`, `VICE_PRESIDENT`, `SECRETARY`, `TREASURER`, `PROJECT_CHAIR`, `MEMBERSHIP_CHAIR`, `BOARD_OFFICER`, `GENERAL_MEMBER`, `AUDITOR`.
- 34 granular permissions define operational capability.
- Separation of Concerns:
  - The Treasurer cannot approve presidential budget decisions (`BUDGET_APPROVE_PRESIDENT`).
  - The Club Auditor has read-only access to treasury ledgers and audit logs, but cannot create invoices or verify payments.
  - Self-approval by budget requesters is strictly blocked unless explicitly permitted by club settings.

## 3. Philippine Data Privacy Act Compliance (RA 10173)
- Transparency & Legitimate Purpose: Members consent explicitly to operational data processing upon registration (`member_consents`).
- Proportionality: Sensitive personal and health-related fields (blood type, emergency contacts) are isolated in `member_private_details` and never rendered in public directories or exports.
- Private Storage Buckets: Payment proof images, receipts, and sensitive documents are saved in private Supabase Storage buckets, accessed only via short-lived signed URLs.
