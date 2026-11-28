# RacSpeed Repository Audit

**Verdict: Not ready for production.** The app has a broad, useful operations feature set and good foundations, but server actions allow unauthorized data changes and file-backed fallbacks can report non-durable writes as successful.

**Implementation update (2026-11-28):** P0-T01 resolved the original Next.js production-build block. Lint remains at its original failing baseline; clean Windows installs also have a test dependency issue (OPS-005). The scorecard, risks, and command results below describe the original audit snapshot unless noted.

## Scorecard

| Dimension | Score / 10 | Rationale |
|---|---:|---|
| Code quality | 5 | Strong TypeScript structure, but lint reports 123 errors and 159 warnings. |
| Security | 4 | Good RLS and server-only boundaries coexist with missing authorization in several server actions and an unprotected AI endpoint. |
| Performance | 6 | Existing pagination/media work is promising; some operational queries are unbounded and no runtime measurements were available. |
| Architecture | 6 | Modular Next.js monolith fits the product; JSON/file fallbacks undermine production data ownership. |
| Data design | 6 | PostgreSQL constraints and scoped tables are good; some row policies expose more member data than documented. |
| Testing | 5 | 145 unit tests pass; authorization, persistence, database integration, and broad end-to-end coverage remain gaps. |
| DevOps & observability | 3 | No CI workflow or centralized error tracking was found; production build is blocked. |
| UI consistency | 6 | Reusable components and a responsive app shell exist; dashboard metrics are partly hard-coded. |
| UX & usability | 5 | Core journeys are present, though dashboard trust and recovery states need attention. |
| Accessibility | 4 | Some controls are accessible, but login/registration labels are not programmatically associated with inputs. |
| Feature completeness | 7 | Broad club operations coverage; several supporting capabilities are partial or rely on fallback/demo data. |
| Documentation & DX | 5 | Useful architecture, security, database, and deployment docs; README is still largely the create-next-app template. |

## Top risks

1. **OPS-001 — Production build was blocked (resolved):** At audit time, `npm run build` stopped with Next.js `SecurityFatalError` on 16.4.2. P0-T01 upgraded to 16.4.6 and the build passed.
2. **SEC-001 / SEC-008 — Authorization gaps and stale grants:** several server actions lack role checks, and local default permissions are unioned with database grants, which can undermine revocation.
3. **SEC-002 — Cross-club record changes:** sister-club updates/deletes authorize against a submitted/default club but do not scope the target row to that club.
4. **SEC-003 — Public Gemini quota use:** `/api/broadcasts/generate` accepts requests without authentication, rate limiting, a bounded input schema, or a request timeout, and uses the server Gemini key.
5. **SEC-007 — Predictable cron credential:** the tracked example cron secret passes production minimum-length validation and is accepted by both cron routes if copied unchanged.

**DATA-001** is an additional high-priority reliability risk: task/partnership/resource flows can display seeded records or report success without a durable write.

## Top quick wins

1. Add server-side permission/ownership checks and make database permission revocation authoritative (SEC-001, SEC-002, SEC-008).
2. Remove the tracked example cron credential from production use (SEC-007).
3. Require an authenticated, authorized caller and bounded request/rate/time limits for Gemini generation (SEC-003).
4. Patch Next.js to a release accepted by the production build guard (OPS-001, completed in P0-T01).
5. Remove fake seeded fallback data from production paths and return explicit errors when persistence fails (DATA-001).

## Top feature opportunities

1. FEAT-001 — Verified email and password recovery.
2. FEAT-002 — Member data export and account/data deletion workflow.
3. FEAT-003 — Auditable, source-backed operational analytics.
4. FEAT-004 — Tamper-resistant audit history for finance, membership, and permissions.
5. FEAT-005 — Guided first-run club setup and officer onboarding.

## Audit scope and coverage

The application repository is `racspeed-fe`; `racspeed-be` contains only a README pointing back to it. The application is a Next.js 16 App Router / React 19 / TypeScript / Supabase platform for a Philippine Rotaract club. 275 non-generated files were inventoried (excluding generated folders, `.agents`, and local environment files); 62,235 source lines across TypeScript, TSX, JavaScript, SQL, and CSS were counted. All 18 migrations present at the database-review snapshot were reviewed; UI and key auth, server-action, data, API, test, and configuration areas were inspected. This is a risk-focused audit, not a line-by-line proof: estimated detailed review is about one quarter of files, with the remainder covered by inventory and targeted searches. The UI was reviewed from source; no browser session or production database was used.

| Command | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm test` | Pass: 21 files, 145 tests |
| `npm run lint` | Fail: 282 problems (123 errors, 159 warnings) |
| `npm run build` | Compiled and generated routes, then failed with `SecurityFatalError` for the installed Next.js version |
| `npm run test:e2e` | Not run; requires a running app and configured services |
| Supabase integration/migrations | Not run; no live or local database was contacted |
| Dependency advisory audit | Not run independently; the build itself reported a Next.js security block |

No `.github/workflows/` CI workflow was found. The local `.env.local` was ignored by Git and deliberately not opened. No secret values are reproduced here; a full credential scan of Git history and built client artifacts was not completed, so secret rotation is **not** asserted as unnecessary. At the start of the audit only `src/lib/data/tasks-store.json` was modified. During the audit, additional uncommitted activity source, migration, and test files appeared; they were not inspected or modified. The database review predates the new recurrence migration.

## Assumptions and questions

- Assumption: the initial target is one Rotaract club with partner clubs, with a small volunteer engineering team; scale and production status are unknown.
- Assumption: the Philippine Data Privacy Act is relevant because the app identifies a Philippine club and processes member and emergency-contact data.
- Confirm whether `.env.local` and Vercel/Supabase production credentials have ever been exposed or committed; rotate any affected credentials.
- Confirm expected visibility of member email and self-service edits to sensitive member details.
- Confirm whether deployment uses multiple clubs, whether the Gemini endpoint is intended to be public, and what the real production environment/version is.
- Confirm whether the seeded task/partnership examples are strictly development-only and whether account deletion, export, password recovery, and email verification are handled outside this repository.

## Documents

- [01 — System overview](./01-system-overview.md)
- [02 — Code quality](./02-code-quality.md)
- [03 — Security](./03-security.md)
- [04 — Performance](./04-performance.md)
- [05 — Architecture and data](./05-architecture-and-data.md)
- [06 — Testing and operations](./06-testing-and-operations.md)
- [07 — UI/UX and accessibility](./07-ui-ux-and-accessibility.md)
- [08 — Product and features](./08-product-and-features.md)
- [09 — Implementation plan](./09-implementation-plan.md)
- [10 — Findings register](./10-findings-register.md)
