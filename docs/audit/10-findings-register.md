# 10 — Findings Register

Status is **Open** unless marked otherwise. Feature proposals are **Proposed**. Location paths are repository-relative.

| ID | Title | Area | Severity | Effort | Confidence | Location | Plan task | Status |
|---|---|---|---|---|---|---|---|---|
| OPS-001 | Production build blocked by Next.js security guard | DevOps/security | High | M | High | `package.json`; `npm run build` | P0-T01 | Resolved |
| SEC-001 | Privileged resource, initiative, and checklist actions lack permission/ownership checks | Authorization | High | M | High | `src/features/resources/actions.ts`; `src/features/partnerships/actions.ts`; `src/features/tasks/actions.ts` | P0-T02, P0-T03 | Resolved |
| SEC-008 | Local role defaults can restore permissions removed in the database | Authorization | High | M | High | `src/lib/auth/session.ts:136-153`; `src/lib/data/role-permissions-types.ts:503-513`; `src/features/permissions/actions.ts:20-91` | P0-T10 | Open |
| SEC-002 | Sister-club mutations are not scoped to the authorized club | Authorization/tenant isolation | High | S | High | `src/features/partnerships/actions.ts:158-202,233-246` | P0-T04 | Open |
| SEC-003 | Gemini broadcast endpoint is public and unbounded | API abuse/cost | High | M | High | `src/app/api/broadcasts/generate/route.ts:8-31,70-75` | P0-T05 | Open |
| SEC-007 | Tracked example cron credential passes production validation | Secrets/operations | High | S | High | `.env.example:28`; `src/lib/env.ts:39-41`; `src/app/api/cron/notifications/route.ts:14-15`; `src/app/api/cron/retention-check/route.ts:55-58` | P0-T08 | Open |
| DATA-001 | Seeded file/in-memory fallback can replace durable state and report false success | Persistence/reliability | High | M per domain | High | `src/lib/data/tasks-storage.ts:13-16,140-167`; `src/features/tasks/queries.ts:29-58`; `src/features/tasks/actions.ts:151-196`; partnership/resource storage | P0-T06, P0-T09, P1-T02 | Open |
| SEC-004 | Members can modify all columns in their private-detail row | Privacy/RLS | Medium | M | High | `supabase/migrations/0001_core_schema.sql:83-92,248-263` | P0-T07 | Open |
| SEC-005 | Shared-club profile policy exposes email with the full row | Privacy/RLS | Medium | M | High | `supabase/migrations/0001_core_schema.sql:25-34,213-225` | P0-T07 | Open |
| SEC-006 | Local Supabase auth policy differs from registration UI | Authentication config | Medium | S | High for local config | `supabase/config.toml:172-180,218-225`; `src/app/(auth)/register/page.tsx:135-145` | P1-T01 | Open |
| CODE-001 | ESLint reports 123 errors and 159 warnings | Code quality/DX | Medium | M per batch | High | `package.json:9`; `npm run lint` result | P1-T03 | Open |
| OPS-002 | No CI workflow invokes quality checks | DevOps | Medium | S | High | Repository inventory; `package.json:5-14` | P1-T07 | Open |
| OPS-003 | Critical authorization and persistence cases lack focused regression tests | Testing | Medium | M | High for inspected cases | `tests/unit/`; `tests/e2e/operations-workflow.spec.ts` | P1-T01, P1-T02 | Open |
| OPS-004 | Central error monitoring, alerts, and restore evidence not found | Operations | Medium | M | Medium | `package.json`, `docs/deployment.md`, route/service configuration | P1-T06 | Open |
| OPS-005 | Clean Windows install omits Rolldown native binding and prevents tests from starting | Testing/dependencies | Medium | S | High | `package-lock.json`; `npm ci`; `npm test` | Follow-up needed | Open |
| OPS-006 | Documented Node.js minimum conflicts with installed dependency engine | Dependencies/DX | Medium | S | High | `docs/deployment.md`; `docs/operations-and-setup-guide.md`; `package-lock.json` | Follow-up needed | Open |
| ARCH-001 | Service-role client makes application checks the effective authorization boundary | Architecture/security | Medium | M | High | `src/lib/supabase/admin.ts`; `src/features/*` | P1-T04 | Open |
| PERF-001 | Task query loads all rows and columns without pagination | Performance | Medium | M | High | `src/features/tasks/queries.ts:14-29` | P2-T04 | Open |
| PERF-002 | Gemini request has no explicit timeout or workload cap | Performance/cost | Medium | M | High | `src/app/api/broadcasts/generate/route.ts:8-31,70-75` | P0-T05 | Open |
| CODE-002 | JSON and database access patterns drift across features | Maintainability/data | Medium | M per domain | High | `src/features/tasks/queries.ts:29-58`; `src/lib/data/tasks-storage.ts:13-16,140-167`; `src/features/partnerships/actions.ts:100-152` | P0-T06, P0-T09 | Open |
| UX-001 | Dashboard charts and total include fixed sample values | UX/data trust | Medium | M | High | `src/app/(app)/dashboard/dashboard-client.tsx:55-68,91,166,370-406` | P2-T01 | Open |
| A11Y-001 | Login/register labels are not associated with inputs | Accessibility | Medium | S | High | `src/app/(auth)/login/page.tsx:98-121`; `src/app/(auth)/register/page.tsx:101-143` | P2-T02 | Open |
| PERF-003 | No production Web Vitals or route/query measurements available | Performance/observability | Low | M | High that no measurements were available | `package.json`; deployment configuration scan | P1-T06 | Open |
| CODE-003 | Authorization/query paths use unchecked casts and silent fallback | Type safety | Low | M | High | `src/lib/auth/session.ts:85-111`; `src/features/permissions/queries.ts:27-62` | P1-T04 | Open |
| CODE-004 | Root README retains create-next-app instructions | Developer experience | Low | S | High | `README.md` | P1-T05 | Open |
| UX-002 | Dashboard text is marked unselectable | Usability | Low | S | High | `src/app/(app)/dashboard/dashboard-client.tsx:94` | P2-T02 | Open |
| UX-003 | Loading, empty, and failure states need a feature-by-feature audit | Usability | Low | M per feature | Medium | `src/app/(app)/`; `src/components/shared/` | P2-T03 | Open |
| FEAT-001 | Verified email and password recovery | Product | — | M | 90% | Auth route inventory | P3-T01 | Proposed |
| FEAT-002 | Member export and deletion request workflow | Product/privacy | — | M per PR | 75% | Member/auth route inventory; profile/private-detail schema | P3-T02, P3-T05 | Proposed |
| FEAT-003 | Source-backed operational analytics | Product/analytics | — | M | 90% | `src/app/(app)/dashboard/dashboard-client.tsx:55-68,91,166,370-406` | P2-T01 | Proposed |
| FEAT-004 | Comprehensive audit history for high-impact changes | Product/operations | — | M | 80% | Membership, treasury, role, and activity modules | P3-T03 | Proposed |
| FEAT-005 | Guided first-run club and officer onboarding | Product/DX | — | M | 70% | `docs/deployment.md`; `scripts/bootstrap-admin.ts` | P3-T04 | Proposed |

## Severity and confidence definitions

- **Critical:** exploitable or catastrophic impact requiring immediate containment.
- **High:** credible authorization, data integrity, launch-blocking, or cost risk; fix before production.
- **Medium:** material risk or important quality gap; fix in the near-term roadmap.
- **Low:** limited impact, measurement gap, or maintainability/polish concern.
- **High confidence:** directly verified in source, schema, or command output. **Medium:** evidence is partial or needs owner/runtime confirmation.
