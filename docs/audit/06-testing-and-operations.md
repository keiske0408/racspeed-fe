# 06 — Testing and Operations

## What's done well

- The unit suite is executable and currently green: **21 test files, 145 tests**.
- Tests cover permissions, money, activities, projects, attendance, treasury, notifications, and selected UI components.
- Playwright and axe-core are installed/configured, and there is an operations workflow spec.
- Deployment and operations docs describe the Vercel/Supabase setup, cron secret, notification providers, and a disposable-database checklist.

## Findings

### High — OPS-001: Production build stops on the installed Next.js security version

- **Status:** Resolved by P0-T01 (2026-11-28, commit `5e677a0`).
- **Confidence:** High
- **Location:** `package.json:29`; `npm run build` output.
- **Evidence:** Compilation, type checking, and static page generation completed, then Next.js threw `SecurityFatalError` stating that the installed version is affected by a known security vulnerability. The declared version is `next: 16.4.2`.
- **Impact:** The production build cannot currently complete; a vulnerable framework version may also expose deployed users if the same version is live.
- **Recommendation:** Review the official Next.js security advisory and upgrade to a patched compatible release, update the lockfile through the normal dependency process, then rerun build, lint, typecheck, and tests. This audit intentionally made no dependency or source changes.
- **Plan task:** P0-T01.

The patched `next` and `eslint-config-next` version 16.4.6 completed the production build without the security fatal. Typecheck and the unit suite passed, and the production server returned a healthy local health response. Lint still failed with the unchanged audit baseline of 123 errors and 159 warnings. The unit test run required the local-only workaround described in OPS-005.

### P0-T02 verification (2026-11-28, commit `269931a`)

- `npm test -- tests/unit/resource-partnership-actions.test.ts`: pass, 4 tests.
- `npm run typecheck`: pass.
- `npm run build`: pass with a temporary local `CRON_SECRET`; no production credentials were used.
- Targeted ESLint on the changed files reports three existing `no-explicit-any` errors in `src/features/resources/actions.ts` and four existing unused-variable warnings in `src/features/partnerships/actions.ts`. No new lint diagnostics were introduced by P0-T02.
- Validation used the exact local Rolldown binding workaround recorded in OPS-005; no dependency manifest or lockfile change was made.

### Medium — OPS-002: No CI workflow or enforced quality gate was found

- **Confidence:** High
- **Location:** Repository inventory; `package.json:5-14`.
- **Evidence:** No `.github/workflows/` files were found. The package defines lint, typecheck, test, build, and E2E scripts, but no CI configuration invokes them.
- **Impact:** The existing lint failure and future regressions can reach a branch without automated feedback.
- **Recommendation:** Add a minimal CI workflow for typecheck and unit tests immediately; add lint after the existing baseline is brought under control, then build and safe database integration tests.
- **Plan task:** P1-T07.

### Medium — OPS-003: Authorization and persistence regressions lack targeted server-action tests

- **Confidence:** High for tests inspected; overall coverage map is partial.
- **Location:** `tests/unit/`; `tests/e2e/operations-workflow.spec.ts`.
- **Evidence:** The suite has broad pure utility/UI tests, but no focused cases were found for unauthorized resource/partnership/task mutations, cross-club record IDs, or database write failure behavior.
- **Impact:** The highest-impact audit findings are not currently guarded by regression tests.
- **Recommendation:** Add tests for each P0 authorization and persistence task before refactoring; use a local disposable Supabase instance for RLS/integration cases.
- **Plan task:** P1-T01 and P1-T02.

P0-T02 adds `tests/unit/resource-partnership-actions.test.ts`, covering allowed and denied create/update/delete calls for resources and partnership initiatives. P0-T03 adds five checklist tests for assignees, managers, unassigned users, and unknown tasks/items. Cross-club isolation and persistence-failure tests remain follow-ups.

### P0-T03 verification (2026-11-28, commit `ae419ee`)

- `npm test -- tests/unit/task-checklist-actions.test.ts`: pass, 5 tests; 4 failed before the fix.
- `npm run typecheck` and `npm run build`: pass; build uses only a process-local nonproduction `CRON_SECRET`.
- Scoped lint: 11 existing `no-explicit-any` errors, matching the parent branch; no new diagnostics.
- Local test dependency restoration follows OPS-005; no manifest or lockfile changes.

### Medium — OPS-004: Central error monitoring and recovery evidence is missing

- **Confidence:** Medium
- **Location:** `package.json`, route/service configuration, and `docs/deployment.md`.
- **Evidence:** No error-tracking/metrics provider or backup/restore verification was found in the inspected configuration. Most available evidence is console logging and deployment guidance.
- **Impact:** Operators may not know that cron deliveries, provider calls, or database operations are failing until users report them.
- **Recommendation:** Add a low-PII error tracker, cron/outbox health metrics and alerts, database backup ownership, and a documented restore drill.
- **Plan task:** P1-T06.

### Medium — OPS-005: Clean Windows install omits the Rolldown native binding

- **Confidence:** High for Windows x64, Node 22.18.0, and npm 11.5.2.
- **Location:** `package-lock.json`; `npm ci`; `npm test`.
- **Evidence:** The pre-upgrade lockfile declares Rolldown 1.2.14's Windows x64 optional binding but has no corresponding package entry. A clean `npm ci` completed without the binding, and Vitest failed to start. Installing that exact binding locally without changing the manifest or lockfile allowed all 145 tests to pass.
- **Impact:** A fresh Windows checkout cannot run the unit suite using the checked-in lockfile alone.
- **Recommendation:** Repair and verify the cross-platform optional dependency lockfile separately, including a clean-install test in CI.
- **Plan task:** Follow-up needed.

### Medium — OPS-006: Documented Node.js minimum conflicts with a dependency engine

- **Confidence:** High.
- **Location:** `docs/deployment.md`; `docs/operations-and-setup-guide.md`; `package-lock.json`.
- **Evidence:** The setup documents state Node.js >=20.9.0, while the existing direct dependency `@zxing/library` 0.23.0 declares Node.js >=24.0.0. npm warned about this mismatch on Node 22.18.0.
- **Impact:** The documented versions do not satisfy all installed dependency engine requirements; strict engine enforcement can reject installation.
- **Recommendation:** Choose and document a compatible supported Node/dependency combination and verify installation and tests against it.
- **Plan task:** Follow-up needed.

## Test map and original audit baseline

P0-T04 verification (2026-11-28, `6aaafda`): seven ownership tests pass;
`npm test` passes all 24 files/161 tests, including P0-T02/P0-T03 regressions.
`npm run typecheck` and production build pass with local dummy cron configuration.
Full lint retains 123 errors and 157 warnings (two existing unused variables
were removed in the changed mutation paths). No database or production service
was contacted; the OPS-005 local binding workaround remains necessary.
Follow-up: because Vitest uses `isolate: false`, the P0-T02 and P0-T04 files
could reuse each other's mocked partnership actions depending on file order
(2 failures in a later full run). Both files now reset modules and import the
actions dynamically; the full suite passes in default order and with shuffle
seeds 1-3.

| Suite | Coverage visible in repository | Audit run |
|---|---|---|
| Unit | 21 Vitest files across activities, money, permissions, treasury, notifications, workflows, and UI | Pass: 145 tests |
| Type checking | TypeScript project | Pass |
| Lint | Whole application ESLint config | Fail: 123 errors, 159 warnings |
| E2E | One operations workflow spec; desktop and mobile Chrome projects configured | Not run |
| Supabase integration | Local DB workflows are described in docs; no package script was found | Not run; no database contacted |
| Production build | Next.js build and static generation | Fail after compilation due to Next.js security block |

## Minimum high-value tests

1. Verify signed-in general members cannot call resource/partnership/task management actions.
2. Verify club A officers cannot mutate club B sister-club or activity records by changing an ID.
3. Verify task/partnership/resource writes fail visibly when Supabase returns an error; verify empty database results do not expose demo records.
4. Exercise RLS for profile email and private-detail self-update permissions with separate users.
5. Test Gemini route rejects unauthenticated, oversized, over-limit, and timed-out requests.
6. Add Playwright smoke coverage for registration/pending state, core event/attendance, and a service-project report using a disposable local Supabase instance.

Do not run integration tests against production or a linked database.
