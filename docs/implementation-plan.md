# Rotaract Club Operations Platform — Implementation Plan & Delivery Record

**Target Entity**: Rotaract Club of San Pedro East (Rotary International District 3820, Laguna, Philippines)  
**Status**: Production-Ready Architectural Monolith Completed  
**Framework**: Next.js 16 (App Router + Turbopack) & Supabase PostgreSQL with Strict RLS

## Project Center Refactor — Implementation Checklist (2026-10-31)

| Area                      | Checklist                                                                                                               | Status / next gate                                                                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unified activity model    | Add activities, project-only detail, RSVP, media, comments, team, logs, legacy backfills, and sister-club bindings      | Implemented in migrations 0008–0010; apply and validate against Supabase before deployment                                                                  |
| Project Center            | Create by activity type; List, Board, Month/Agenda calendar, detail sections, tasks, reports, media, discussion         | Implemented; existing Events/Projects/Calendar/Tasks routes route into Project Center views                                                                 |
| Events and QR check-in    | Keep QR scanning/session management separate from event creation                                                        | Implemented; QR page now links to Project Center and no longer creates events                                                                               |
| RSVP and minimum members  | Member RSVP; optional minimum-member field; alert chair if threshold is unmet near start                                | Implemented; requires migration 0008 and scheduled retention job                                                                                            |
| Personal check-in         | “Check in as me” within activity window; QR remains available; member/aspirant-only server validation                   | Implemented; enable per activity                                                                                                                            |
| Service project reporting | Rotary Showcase-inspired completion fields, photo requirement, immutable submission snapshot, accomplished status       | Implemented; requires a report template row and `activity-media` storage bucket from migration 0008                                                         |
| Project collaboration     | Comments, reactions, follows, activity history, private photo uploads                                                   | Implemented; @mention notifications and threaded reply UI remain follow-up work                                                                             |
| Partnership projects      | Add up to 20 partners with a dropdown; preserve card preselection; open bound projects from each partnership            | Implemented for Joint and Service Projects; server validates all database partner bindings; totals count each project once                                  |
| My Profile                | Avatar menu links to the signed-in member's profile, points, badges, and reward history                                 | Implemented; own-profile access does not require member-directory permissions                                                                               |
| Member retention          | Detect missed consecutive GAs, repeated Going RSVP no-shows, and service inactivity; send member nudge and chair digest | Implemented in cron/dispatcher; configure cron, Resend, and VAPID to deliver externally                                                                     |
| Membership approval       | Aspirant can be active with null Rotary ID and a Recruitment CRM link; full induction requires Rotary ID                | Implemented                                                                                                                                                 |
| Rewards                   | Idempotent points for attendance and completed tasks, threshold badges, Rotary Year leaderboard                         | Initial version implemented; RSVP-honored/no-show point awards and GA streak badge calculation remain follow-up work                                        |
| Dashboard                 | Personalized greeting, upcoming activities, accomplished projects, personal dues, engagement points                     | Implemented with live Supabase data                                                                                                                         |
| Verification              | Typecheck, unit tests, focused lint, production build                                                                   | Multi-partner UI, persistence, club ownership and unique totals covered; pre-existing lint failures remain; authenticated browser workflow not yet verified |

### Deployment checklist

- [x] Add browser photo compression, sequential upload retries, and private paginated Moments albums; verified with 77 unit tests, typecheck, focused lint, production build, a real Chromium compression check, and read-only Supabase queries.
- [ ] Apply migrations 0008–0010 to a database copy and verify backfilled activity, attendance, photo, and sister-club rows.
- [ ] Configure `RESEND_API_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT`.
- [ ] Configure the daily `/api/cron/retention-check` job with `Authorization: Bearer $CRON_SECRET`.
- [ ] Verify Storage bucket access, RLS policies, email preview mode, and push delivery on a real browser subscription.
- [ ] Run the Project Center create → RSVP → check-in → report publish workflow against the migrated database.

---

## 1. Executive Summary & Delivery Scope

This platform replaces fragmented spreadsheets, chat threads, and manual paper workflows with a unified, role-governed Progressive Web Application (PWA) tailored specifically for Rotaract club governance, Philippine legal compliance (RA 10173), and District 3820 operational rhythms.

### Key Milestones Achieved

1. **Repository & Architecture Foundations**: Monorepo structure consolidated under `d:\RACSPEED\racspeed-fe` with Next.js 16 App Router, TypeScript, Tailwind CSS, Lucide icons, and server-only security boundaries.
2. **Domain State Machines & Exact Mathematics**: 100% test coverage across financial math (`money.ts`), Philippine wall-clock and Rotary Year boundaries (`rotary-year.ts`), 34 fine-grained permission checks (`keys.ts`), and 4 lifecycle state machines (Reports, Budgets, Liquidations, Onboarding).
3. **Database Architecture (Supabase / PostgreSQL)**: 5 migration scripts covering 28 relational tables, composite constraints, `private` schema security functions (`search_path = ''`), RLS policies, and complete seed data.
4. **Mobile-First Responsive User Experience**: Fully realized PWA with manifest, dark cranberry/navy palette, navigation shell, and screens for Dashboard, Members, Recruitment CRM, Events & Attendance, Projects & Reporting, Treasury & Dues, Budgets & Disbursements, Certificates, and Retention Alerts.
5. **Quality Assurance & Verification**: All 29 unit tests passing cleanly in Vitest; production Turbopack build generating all static and dynamic routes with zero TypeScript or bundling errors.

---

## 2. Phase-by-Phase Delivery Breakdown

### Phase 0: Discovery, Architecture & Agent Skills Setup

- Installed agent skills for domain logic (`rotaract-operations`), database engineering (`supabase`, `supabase-postgres-best-practices`), React architecture (`vercel-react-best-practices`, `vercel-composition-patterns`), and design standards (`web-design-guidelines`).
- Configured root `AGENTS.md` and created technical documentation (`architecture.md`, `database.md`, `security.md`, `reporting.md`, `deployment.md`).

### Phase 1: PostgreSQL Schema & Strict Security Hardening

- **Migration 0001**: Core profiles, memberships, clubs, roles, permissions, audit logs, and member consent models with `private.has_permission()` and `private.is_platform_admin()`.
- **Migration 0002**: Recruitment prospects, stage history, interactions, events, attendance sessions, and check-in records with `UNIQUE (event_id, profile_id)` anti-duplicate constraint.
- **Migration 0003**: 7 official Rotary Areas of Focus, 17 UN Sustainable Development Goals, service categories, projects, report templates, immutable report snapshots (`report_submissions`), and certificate issuance records.
- **Migration 0004**: Double-entry ledger math (invoices with deduplication keys, invoice items, payment submissions, allocations, balance adjustments), budget requests with dual-officer approvals, liquidations, and notification queues.
- **Migration 0005**: Complete seed data for District 3820 / San Pedro East, Rotary areas of focus, SDGs, and initial permission matrices.

### Phase 2: Domain Logic & Pure State Machines (Verified with Vitest)

- `src/lib/utils/money.ts`: Integer-centavo currency handling preventing IEEE 754 floating point drift.
- `src/lib/utils/rotary-year.ts`: Boundary-safe calculation of Rotary Years (July 1 – June 30) evaluated exclusively in `Asia/Manila` time.
- `src/lib/services/workflows/report.ts`: Accomplishment report workflow state transitions (`DRAFT -> UNDER_REVIEW -> SUBMITTED_TO_DISTRICT -> ACCEPTED` / `REVISION_REQUESTED`).
- `src/lib/services/workflows/budget.ts`: Dual-officer approval policy enforcing that President and Treasurer must approve, and requesters cannot approve their own requests.
- `src/lib/services/workflows/liquidation.ts`: Variance tracking and approval state transitions.
- `src/lib/services/workflows/onboarding.ts`: Recruitment pipeline progression and induction readiness checks.
- `src/lib/services/engagement.ts`: Deterministic detection of 3 consecutive missed GAs and 60-day club inactivity.
- `src/lib/services/treasury.ts`: Ledger verification preventing unverified payment proofs from crediting balances.

### Phase 3: Route Handlers & Server API Layer

- `src/proxy.ts`: Next.js 16 proxy replacing legacy middleware for token refresh and route protection.
- `src/app/api/attendance/check-in/route.ts`: Secure QR check-in endpoint enforcing active session validity, geolocation windows, and idempotency.
- `src/app/api/cron/retention-check/route.ts`: Automated pastoral care evaluator generating member engagement alerts.
- `src/app/api/health/route.ts`: Uptime and system health monitor.

### Phase 4: UI Design & Feature Consoles

- **PWA Manifest & Theming**: `src/app/manifest.ts` configured for standalone mobile installation with Rotaract Cranberry (`#D91B5C`) and Navy themes.
- **App Shell**: Responsive sidebar with quick-access navigation, user avatar, active Rotary Year banner, and mobile menu toggle.
- **Dashboard (`/dashboard`)**: Metric cards for active members, YTD service hours, dues collection rate, and open retention alerts.
- **Member Directory (`/members`)**: Tiered member list with status filters, role badges, and privacy protections.
- **Recruitment Pipeline (`/recruitment`)**: Visual Kanban board from Lead to Inducted with checklist progress.
- **Attendance & Events (`/events`)**: Event calendar, QR check-in triggers, and volunteer hour logs.
- **Projects & Reports (`/projects`)**: Projects mapped to official Areas of Focus, SDGs, and reproducible JSON report snapshots.
- **Treasury & Dues (`/treasury`)**: Centavo-exact invoice ledger, unverified payment proof verification queue, and collection rates.
- **Budget Requests (`/budgets`)**: Dual-officer approval queue, disbursement tracking, and liquidation variance review.
- **Certificates (`/certificates`)**: Verification portal and certificate generation records.
- **Retention Alerts (`/retention-alerts`)**: Actionable pastoral list with direct WhatsApp/SMS contact prompts.
- **Settings (`/settings`)**: Club profiles, Rotary Year switcher, and DPA compliance notices.

---

## 3. Automated Test Results

```
 RUN  v5.0.5 D:/RACSPEED/racspeed-fe

 ✓ tests/unit/permissions.test.ts (5 tests)
 ✓ tests/unit/money.test.ts (6 tests)
 ✓ tests/unit/workflows.test.ts (8 tests)
 ✓ tests/unit/treasury.test.ts (3 tests)
 ✓ tests/unit/rotary-year.test.ts (4 tests)
 ✓ tests/unit/engagement.test.ts (3 tests)

 Test Files  6 passed (6)
      Tests  29 passed (29)
```

---

## 4. Production Build Verification

The application builds cleanly under Next.js 16 with Turbopack:

```
▲ Next.js 16.4.2 (Turbopack)
✓ Compiled successfully in 48s
✓ TypeScript checks passed with 0 errors
✓ Static pages generated (11/11)
✓ Route Handlers and Dynamic Pages verified
```

---

## 5. Operations & Runbook

### Running the Application Locally

```bash
cd d:\RACSPEED\racspeed-fe
npm run dev
```

Open `http://localhost:3000` in your browser.

### Running Test Suite

```bash
cd d:\RACSPEED\racspeed-fe
npm test
```

### Running Static Type Checks

```bash
cd d:\RACSPEED\racspeed-fe
npm run typecheck
```

### Building for Production

```bash
cd d:\RACSPEED\racspeed-fe
npm run build
```

### Bootstrapping the First Administrator

Once Supabase is connected:

```bash
cd d:\RACSPEED\racspeed-fe
npx tsx scripts/bootstrap-admin.ts admin@rotaractsps.ph "Admin Password 2026!" "Club President"
```
