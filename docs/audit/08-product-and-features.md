# 08 — Product and Features

## What's done well

- RacSpeed targets real Rotaract officer/member work rather than a generic CRM: projects, attendance, treasury, recruitment, member operations, and district reporting.
- The product has an end-to-end membership approval concept, role/permission model, QR attendance, service-project reporting, and notification delivery.
- The existing breadth gives the club a coherent operational hub and a strong base for a small-team product.

## Product summary

RacSpeed is a web/PWA operations platform for Rotaract Club of San Pedro East and partner clubs in the Philippines. Its core job is to help officers coordinate membership, events, service projects, attendance, treasury, and reporting from one place. Members can request accounts, participate in activity workflows, and receive notifications. The app combines public registration with authenticated club administration. This understanding is inferred from source pages, route structure, migrations, and project documentation.

## Feature inventory and category benchmark

| Capability | Status | Notes |
|---|---|---|
| Registration and officer approval | Partial | Present; password recovery/email confirmation were not found in app routes. |
| Member directory and role-based permissions | Partial | Present; see server-action authorization findings. |
| Events, RSVP, calendar, QR attendance | Present, validation needed | Routes/actions/tests exist; real deployment/database not exercised. |
| Service projects, tasks, media, reports | Partial | Broad workflow exists; tasks have file/seed fallback risk. |
| Recruitment and retention | Present, validation needed | Domain modules and scheduled route exist. |
| Treasury, payment proof, budgets/liquidations | Present, validation needed | Strong domain depth; integration and audit trail need verification. |
| Partnerships/resources | Partial | Server-action authorization and fallback persistence need correction. |
| Notifications: in-app, email, push, Telegram | Partial | Providers and queue exist; email is preview-only without configuration. |
| Operational analytics | Partial / illustrative | Dashboard sample metrics are hard-coded (UX-001). |
| Account export/deletion and privacy requests | Missing or unverified | No clear member self-service workflow found in inspected routes. |
| Password reset and verified email | Missing or unverified | No UI route/action found in the inspected auth route inventory. |
| Support and feedback | Partial | Help page exists; no support case workflow was verified. |
| Audit history | Partial | Activity/event logs exist, but an operator-grade, comprehensive immutable audit trail was not verified. |

## Launch and product risks

- The framework build guard currently prevents a production build (OPS-001).
- Unauthorized server actions and cross-club mutation paths can undermine trust and club data integrity (SEC-001/SEC-002).
- Dashboard numbers that do not reflect stored data risk officer decisions and adoption (UX-001).
- Data request/deletion, retention, privacy notice, and production auth settings need owner/legal review for Philippine Data Privacy Act obligations; this audit is not legal advice.
- Operational readiness for backups, restore, monitoring, and incident response is unverified.

## Feature proposals

RICE uses `Reach × Impact × Confidence / Effort`; reach and impact are 1–10 estimates, confidence is a fraction, effort is a relative 1–10 scale. Scores are directional and should be recalibrated with actual usage.

### FEAT-001 — Verified email and password recovery

- **Tier:** Must-have · **Effort:** M · **RICE:** Reach 8 · Impact 3 · Confidence 90% · Effort 2 → **10.8**
- **User value:** Members can safely recover access and officers can trust account contact addresses.
- **Why this app needs it:** Registration and login exist, while the inspected auth routes do not show email confirmation or password-recovery flows (`src/app/(auth)/login/page.tsx`; `src/app/(auth)/register/page.tsx`).
- **Technical approach:** Use Supabase Auth recovery/verification callbacks; add public pages, rate limits, non-enumerating responses, and tests.
- **Dependencies & risks:** Verify production Supabase auth settings and redirect URLs first.
- **Success metric:** Fewer officer-assisted account resets; successful verification without account enumeration.
- **Plan task:** P3-T01.

### FEAT-002 — Member data export and deletion requests

- **Tier:** Must-have · **Effort:** L · **RICE:** Reach 6 · Impact 3 · Confidence 75% · Effort 4 → **3.4**
- **User value:** Members have a clear, accountable way to request a copy of or deletion of eligible personal data.
- **Why this app needs it:** The app stores profile, consent, emergency-contact, and financial-related records; a member-facing data request workflow was not found.
- **Technical approach:** Define retention/legal holds with the club, implement a permission-checked export/deletion request workflow, maintain a deletion audit event, and separate identity deletion from statutory/financial record retention.
- **Dependencies & risks:** Requires owner/legal decisions on retention, third-party processors, and records that cannot be deleted.
- **Success metric:** Requests are acknowledged and completed within the club's published service target.
- **Plan task:** P3-T02.

### FEAT-003 — Source-backed operational analytics

- **Tier:** Should-have · **Effort:** M · **RICE:** Reach 7 · Impact 2 · Confidence 90% · Effort 3 → **4.2**
- **User value:** Officers can make reliable decisions about participation, recruitment, and service delivery.
- **Why this app needs it:** Dashboard charts currently use fixed data and a fixed added count (UX-001).
- **Technical approach:** Build bounded, permission-scoped aggregate queries with clear date ranges and “as of” labels; use a demo-data flag only in development.
- **Dependencies & risks:** Agree metric definitions before implementing chart logic; avoid exposing sensitive personal data in aggregates.
- **Success metric:** Each dashboard KPI reconciles to its source query and selected date range.
- **Plan task:** P2-T01.

### FEAT-004 — Comprehensive audit history

- **Tier:** Should-have · **Effort:** M · **RICE:** Reach 6 · Impact 3 · Confidence 80% · Effort 4 → **3.6**
- **User value:** Officers can explain who changed a member role, financial record, or approval and when.
- **Why this app needs it:** The product performs sensitive membership, finance, and permission operations; a comprehensive immutable trail was not verified.
- **Technical approach:** Record actor, club, entity, action, timestamp, and redacted diff through trusted server-side writes; restrict reads by `AUDIT_LOG_VIEW`.
- **Dependencies & risks:** Define retention and PII redaction; never log tokens, receipts, or full sensitive payloads.
- **Success metric:** All high-impact role, finance, and approval transitions have attributable audit events.
- **Plan task:** P3-T03.

### FEAT-005 — Guided first-run club and officer onboarding

- **Tier:** Should-have · **Effort:** M · **RICE:** Reach 5 · Impact 2 · Confidence 70% · Effort 3 → **2.3**
- **User value:** New officers can configure a club and understand the first steps without relying on informal handover.
- **Why this app needs it:** The current setup spans Supabase configuration, bootstrap-admin, environment variables, scheduled jobs, and club settings.
- **Technical approach:** Add a permission-gated checklist for club profile, roles, first event, notification providers, and cron health; link to docs rather than exposing secrets.
- **Dependencies & risks:** Keep setup status informational; do not store credentials in the checklist.
- **Success metric:** Reduced time from deployment to first successful event/report and fewer setup support requests.
- **Plan task:** P3-T04.

## Product evolution roadmap

- **Now:** Patch Next.js; enforce authorization and data ownership; eliminate non-durable production writes; correct dashboard trust.
- **Next:** Email recovery/verification, privacy request workflow, audit history, and first-run accessibility improvements.
- **Later:** Source-backed analytics, multi-club administration polish, richer operational reporting, and scale work driven by measured usage.
