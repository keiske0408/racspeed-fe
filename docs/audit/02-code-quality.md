# 02 — Code Quality

## What's done well

- TypeScript checking passes with the declared strict project configuration.
- Feature code is separated into domain folders; pure workflow helpers, shared validators, money/date utilities, and notification provider abstractions reduce duplication.
- `toCentavos` and related helpers use integer minor currency units, and the project has focused tests for money, permissions, attendance, and workflows.
- Existing project, database, security, and deployment documentation gives contributors a useful starting point.

## Findings

### Medium — CODE-001: Lint baseline is red across the application

- **Confidence:** High
- **Location:** `package.json:9`; command result from `npm run lint`.
- **Evidence:** ESLint exits non-zero with **282 problems (123 errors, 159 warnings)**. Issues include React effect/render rules, unsafe `any`, unescaped text, and unused imports.
- **Impact:** Lint cannot serve as a regression gate, and legitimate new defects are difficult to distinguish from the existing backlog.
- **Recommendation:** Add lint to CI after splitting the baseline into bounded, feature-owned batches. Do not disable the rules wholesale; fix functional React/compiler diagnostics first, then type-safety and warning groups.
- **Plan task:** P1-T03.

### Medium — CODE-002: Data-access patterns drift between Supabase and local JSON

- **Confidence:** High
- **Location:** `src/features/tasks/queries.ts:29-58`; `src/lib/data/tasks-storage.ts:13-16,140-167`; `src/features/partnerships/actions.ts:100-152`.
- **Evidence:** Queries fall back to local seeded files when Supabase returns an error or zero rows; writes mutate local state and treat Supabase operations as best-effort.
- **Impact:** A valid empty database can look populated with examples, while production instances can disagree about the authoritative state.
- **Recommendation:** Keep demo fixtures in tests/dev-only seed paths. In production, use one durable database source and surface failed writes.
- **Plan task:** P0-T06.

### Low — CODE-003: Some permission/data code relies on unchecked casts and broad fallbacks

- **Confidence:** High
- **Location:** `src/lib/auth/session.ts:85-111`; `src/features/permissions/queries.ts:27-62`.
- **Evidence:** Relationship payloads use `any`; lookup exceptions are caught and replaced with local role configuration.
- **Impact:** Schema drift and Supabase failures can be masked, making authorization behavior harder to reason about and test.
- **Recommendation:** Type nested Supabase results, validate role keys, and make fallback behavior explicit and environment-gated.
- **Plan task:** P1-T04.

### Low — CODE-004: README remains mostly framework boilerplate

- **Confidence:** High
- **Location:** `README.md` (repository root).
- **Evidence:** It still directs users to edit the create-next-app `app/page.tsx` example, while operations-specific setup is scattered through longer sections.
- **Impact:** New contributors may miss the actual feature layout, setup prerequisites, and safe test workflow.
- **Recommendation:** Replace the starter text with the app purpose, prerequisites, setup, environment variables, test commands, and links to the current architecture and operations docs.
- **Plan task:** P1-T05.

## AI-generated code health check

| Pattern | Assessment |
|---|---|
| Looks done but isn't | **Verified risk:** dashboard displays fixed chart values and a fixed count component; file-backed fallback can show seeded task/partnership examples. See UX-001 and DATA-001. |
| Security theater | **Verified:** hiding mutation controls in the UI is not enough where the server actions themselves lack permission/ownership checks; see SEC-001 and SEC-002. |
| Pattern drift | **Verified:** JSON storage, Supabase persistence, and fallback merging coexist across tasks/resources/partnerships/roles. |
| Copy-paste divergence | **Needs more verification:** repeated server action patterns exist, but no specific inconsistent duplicate was confirmed. |
| Dependency bloat | **Not established:** no dependency was removed or found confidently unused during this audit. |
| Version mismatch | **Verified build risk:** the declared Next.js version is rejected by the build's security guard; see OPS-001. |
| Hollow tests | **Not established for the whole suite:** 145 unit tests pass; no broad assertion-quality review was done. |

## Developer experience

- `npm run typecheck` and `npm test` pass.
- `npm run lint` fails; no CI workflow was found.
- `AGENTS.md` documents `npm run db:types` and integration scripts that are not present in the `package.json` script list (`package.json:5-14`).
- No package-script for integration tests was found; Playwright has one configured operations workflow, but it was not run.
- Do not run migration or bootstrap commands against linked/production services as part of this audit.
