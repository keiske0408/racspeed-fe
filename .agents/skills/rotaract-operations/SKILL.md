---
name: rotaract-operations
description: Domain rules for the Rotaract Club Operations Platform (Rotaract San Pedro East and partner clubs). Load this skill BEFORE changing anything that touches club roles/permissions, membership, recruitment, events/attendance, volunteer hours, engagement alerts, projects and district reporting, Areas of Focus/SDGs, certificates, dues/invoices/payments, budgets/liquidations, notifications, member privacy, or document generation.
metadata:
  author: racspeed
  version: "1.0.0"
---

# Rotaract Operations — Domain Skill

This app is a **records and approval system** for a small volunteer club. It is not a payment
processor, not an official district system, and not a replacement for the club's books.
When unsure, prefer the safer, auditable, human-in-the-loop option.

## 1. Clubs, Rotary year, district

- Every operational record is **club-scoped** (`club_id`). Never make club data visible just
  because two users share the app. Joint events use `event_clubs`; joint projects use
  `project_clubs`. A record has exactly one *host/owning* club.
- Rotary year runs **1 July – 30 June** and is labelled `"2026-27"`. Use
  `src/lib/utils/rotary-year.ts` — never hand-roll the calculation.
- Timezone `Asia/Manila`, currency `PHP`, language English. Store `timestamptz` in UTC,
  display in Asia/Manila via `src/lib/utils/dates.ts`.
- District identifier is configurable (`clubs.district_code`, default `3820`).

## 2. Roles and permissions

Roles (table `roles`): `PLATFORM_ADMIN` (flag on profile, not a club role), `PRESIDENT`,
`VICE_PRESIDENT`, `SECRETARY`, `TREASURER`, `PROJECT_CHAIR`, `MEMBERSHIP_CHAIR`,
`BOARD_OFFICER`, `GENERAL_MEMBER`, `AUDITOR`.

- Authorization = **permission keys** (`src/lib/permissions/keys.ts`) mapped to roles in
  `role_permissions`, granted per club through `membership_roles`.
- Enforce on **both** the server (`assertPermission`) **and** RLS (`private.has_permission`).
  Hiding a button is never authorization.
- Treasurer ≠ President. Treasurer must not hold `BUDGET_APPROVE_PRESIDENT`.
- Auditor is read-only (views treasury, reports, audit log; never mutates).
- Requesters may not approve their own budget request unless
  `app_settings.allow_self_approval = true` (default false).
- Never authorize from `user_metadata`; it is user-editable.

## 3. Account lifecycle

`pending → active | rejected`, `active ↔ suspended`. New sign-ups are always `pending` with
**no roles**. Only users with `MEMBER_APPROVE` may approve. The first admin is created via
`npm run bootstrap:admin` (see docs/deployment.md) — never by code paths reachable from the UI.

## 4. Projects & reporting

- Official **Rotary Areas of Focus** (exactly seven, seeded): Peacebuilding and Conflict
  Prevention; Disease Prevention and Treatment; Water, Sanitation, and Hygiene; Maternal and
  Child Health; Basic Education and Literacy; Community Economic Development; Environment.
- **Service categories** (Club/Community/International/Professional Development/Youth Service,
  Fellowship) are a *separate* table. Never store "Youth Service" as an Area of Focus.
- SDGs: 1–17, many-to-many. Alignment ≠ proven impact — label UI copy accordingly.
- Report workflow: `DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED`, or
  `UNDER_REVIEW → REVISION_REQUESTED → SUBMITTED`. Transitions live in
  `src/lib/services/workflows/report.ts` and are mirrored by a DB trigger.
- Each submission stores an immutable JSON **snapshot**; documents are generated from the
  snapshot so they are reproducible.
- **District 3820 templates are NOT available in this repo.** Templates are configurable
  (`report_templates`). Never label output "officially compliant" unless
  `report_templates.is_official_validated = true`, which only an admin can set after
  validating against the real district form.

## 5. Attendance, volunteer hours, engagement

- One attendance row per (event, person) — DB unique constraint. Duplicate check-ins are
  rejected, never summed.
- QR tokens are HMAC-signed, time-windowed (rotating) and tied to an `attendance_session`
  that can expire or be revoked. Server derives `profile_id` from the session cookie and
  `volunteer_hours` from the event rule. The browser supplies only the token.
- Members never set their own hours. Manual corrections require `ATTENDANCE_MANAGE`, a reason,
  and write an `attendance_adjustments` row.
- Engagement rules (thresholds in `app_settings`): flag after **3 consecutive general
  assemblies missed** (excused does not count as missed) and after **60 days without
  qualifying service-project participation**. Pure logic in
  `src/lib/services/engagement.ts`. Alerts explain rule + dates. Never auto-suspend, rank
  publicly, or shame. Only `RETENTION_ALERT_VIEW` holders see alerts.

## 6. Treasury

- Money is `numeric(12,2)` in SQL and **integer centavos** in TypeScript
  (`src/lib/utils/money.ts`). Never use float arithmetic for totals.
- Balance = Σ invoice items + Σ ledger adjustments − Σ verified allocations. Never store an
  editable balance.
- A payment **proof** is not a payment. Only `verify_payment()` (requires `PAYMENT_VERIFY`)
  creates allocations. Rejected/pending proofs never affect balances.
- OCR (tesseract.js, in-browser, opt-in) only produces **suggestions**; humans confirm. Never
  auto-verify. Never send receipts to external AI without a documented privacy decision.
- Invoice generation is idempotent via `invoices.dedupe_key`.
- Corrections use `ledger_adjustments`; never rewrite verified rows.

## 7. Budgets & liquidation

`DRAFT → SUBMITTED → PENDING_APPROVAL → APPROVED | REJECTED`. Independent rows in
`budget_approvals` for `PRESIDENT` and `TREASURER`; order policy from `app_settings`.
Disbursement only after APPROVED and only records what happened (no external transfer
claims). Liquidation: `DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED | REVISION_REQUESTED |
REJECTED`, items can be individually accepted/rejected.

## 8. Privacy (Philippine Data Privacy Act principles)

- Transparency, legitimate purpose, proportionality. Collect the minimum.
- Sensitive fields (birthday, emergency contact, blood type, shirt size) live in
  `member_private_details` — visible to the member and `MEMBER_SENSITIVE_VIEW` holders only.
  Never in directories or exports by default. Blood type requires explicit consent.
- Receipts, photos, generated docs live in **private** buckets; serve via short-lived signed
  URLs created after authorization.
- Never log tokens, cookies, keys, receipt contents or full request bodies.

## 9. Integrations

- Email: Resend via `src/lib/email/provider.ts`. Without `RESEND_API_KEY` the provider is in
  **preview mode** (logs `skipped_config`). Dev uses `EMAIL_TEST_RECIPIENT` override.
- No MyRotary sync, scraping, or unofficial Messenger/Discord automation. CSV export only.
- Scheduled jobs: `/api/cron/[job]` protected by `CRON_SECRET`, idempotent via
  `scheduled_job_runs.run_key`.

## 10. Documents

All generation in `src/lib/documents/*` (server-only). `@react-pdf/renderer` for PDFs, `docx`
for editable reports. Validate source, handle missing data, store in `generated-documents`
bucket, record metadata, return signed URL. Test that output bytes start with `%PDF` / `PK`.

## 11. Testing rules

- Unit (Vitest): every workflow transition table, money math, engagement rules, permission
  helpers, rotary-year/date edge cases.
- Integration (`tests/integration`, needs local Supabase): RLS allow + deny, club isolation,
  receipt privacy, duplicate check-in, idempotent jobs.
- E2E (Playwright): scenarios A–H in docs/implementation-plan.md.
- Never weaken a test to pass a build. Never use real member data in fixtures.
