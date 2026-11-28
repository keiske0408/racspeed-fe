# 03 — Security

## What's done well

- Privileged Supabase code is marked `server-only`; the admin client fails clearly when the service-role key is absent.
- Cron routes compare bearer credentials, Telegram webhook processing verifies its secret token, and delivery claims use a database RPC.
- The reviewed migrations enable RLS on core tables, use private-schema security-definer helpers with empty search paths, and revoke user access to Telegram delivery tables.
- Validation uses Zod at many API and server-action boundaries; the attendance endpoint includes a rate-limit helper.

## Findings

### High — SEC-001: Several privileged server actions lack role and record authorization

- **Confidence:** High
- **Lenses:** Engineer, Architect
- **Location:** `src/features/resources/actions.ts:43-147`; `src/features/partnerships/actions.ts:263-398`; `src/features/tasks/actions.ts:318-428`.
- **Evidence:** Resource create/update/delete actions do not call `requireUser` or `assertPermission`. Partnership initiative create/update/delete actions call `requireUser` but not `assertPermission`. Task checklist toggle/add actions call `requireUser` but do not verify task assignment or a management permission. These paths also mutate data using the service-role client or local store.
- **Impact:** A member who can invoke these server actions can change shared resources, initiatives, or task checklists without a per-role/ownership check; partnership/task actions only require `requireUser`. Service-role writes bypass normal RLS protections.
- **Recommendation:** Require server-side `assertPermission` for each operation and scope every update/delete to the authorized club and target record. For task checklist changes, explicitly define whether an assignee may edit their own checklist, then enforce that server-side. Add cross-role and cross-club regression tests.
- **Plan task:** P0-T02 and P0-T03.

### High — SEC-008: Local role defaults can restore permissions removed in the database

- **Confidence:** High for the merge behavior; cross-instance persistence impact depends on deployment filesystem.
- **Lenses:** Engineer, Architect
- **Location:** `src/lib/auth/session.ts:136-153`; `src/lib/data/role-permissions-types.ts:503-513`; `src/lib/data/role-permissions-storage.ts:11-43,47-55`; `src/features/permissions/actions.ts:20-91`.
- **Evidence:** After loading database role permissions, `getUserAccessContext` also adds every permission from `readRolePermissionsStore`. Those local defaults are initialized from `ROLE_PERMISSIONS`; the store writes to a file and catches read-only filesystem errors. Permission-save actions can still return success after database synchronization errors.
- **Impact:** Removing a built-in permission in PostgreSQL may not revoke it in app instances that load stale local defaults, particularly on serverless/read-only deployments. This makes permission revocation unreliable.
- **Recommendation:** Make the database role-permission set authoritative whenever the database query succeeds; do not union local defaults into effective authorization. Fail closed on authorization-store errors and return failure when a role update did not persist.
- **Plan task:** P0-T10.

### High — SEC-002: Sister-club mutation authorization is not bound to the target record

- **Confidence:** High
- **Location:** `src/features/partnerships/actions.ts:158-202,233-246`.
- **Evidence:** `updateSisterClubAction` checks `SETTINGS_MANAGE` against the submitted `homeClubId`, then updates a record using only `.eq("id", clubId)`. `deleteSisterClubAction` checks the default club permission and deletes using only the supplied record ID.
- **Impact:** An officer authorized for one club can target a known sister-club ID owned by a different club; in multi-club deployments this permits unauthorized cross-club changes/deletion.
- **Recommendation:** Load the target row first and verify its `home_club_id` matches the club for which the caller was authorized; include both identifiers in the mutation predicate and return a non-disclosing not-found response on mismatch.
- **Plan task:** P0-T04.

### High — SEC-003: Gemini broadcast generation is public and unbounded

- **Confidence:** High
- **Lenses:** Engineer, Architect
- **Location:** `src/app/api/broadcasts/generate/route.ts:8-31,70-75`.
- **Evidence:** The route accepts POST requests without authentication or a permission check, reads an unbounded JSON body, accepts a caller-supplied key or uses `GEMINI_API_KEY`, and makes a provider request without an explicit timeout or rate limit.
- **Impact:** Unauthenticated callers can consume the app's paid Gemini quota and submit large prompts; provider availability can also hold the route open.
- **Recommendation:** Require the intended authenticated permission, cap body and prompt size with a schema, apply per-user/IP limits, set a timeout, and avoid accepting a server credential from request data.
- **Plan task:** P0-T05.

### High — SEC-007: Tracked example cron credential is accepted by production validation

- **Confidence:** High
- **Location:** `.env.example:28`; `src/lib/env.ts:39-41`; `src/app/api/cron/notifications/route.ts:14-15`; `src/app/api/cron/retention-check/route.ts:55-58`.
- **Evidence:** The example file contains a fixed, publicly visible local cron credential. Production validation checks only that `CRON_SECRET` is at least 16 characters, and both cron routes use that value as their bearer credential. The value is intentionally redacted here.
- **Impact:** If the example is copied unchanged to production, anyone who knows the repository can invoke scheduled notification/retention work.
- **Recommendation:** Remove the fixed credential from the example, require a generated deployment secret, and reject known local/example values in production configuration validation.
- **Plan task:** P0-T08.

### Medium — SEC-004: Self-service policy can modify all private member-detail columns

- **Confidence:** High for the policy; intended self-service scope needs owner confirmation.
- **Location:** `supabase/migrations/0001_core_schema.sql:83-92,248-263`.
- **Evidence:** `member_private_details` contains birthdate, emergency-contact details, and blood type. The `private_details_modify` policy allows a member to modify their own row or a caller with `MEMBER_UPDATE`; it applies to the whole row.
- **Impact:** The table-level self-edit path is broader than the documented `MEMBER_SENSITIVE_VIEW` boundary and cannot distinguish benign self-service changes from fields intended to require an officer.
- **Recommendation:** Decide which fields members may self-edit; enforce that allowlist in a constrained server operation or column-specific design, and separately authorize officer access.
- **Plan task:** P0-T07.

### Medium — SEC-005: Shared-club profile policy exposes email with the entire row

- **Confidence:** High for RLS behavior; product expectation needs owner confirmation.
- **Location:** `supabase/migrations/0001_core_schema.sql:25-34,213-225`.
- **Evidence:** Email is stored on `profiles`; the select policy permits an authenticated caller with an active membership in a shared club to select another profile row, without column-level filtering. The policy does not also require the target member to be active.
- **Impact:** Authenticated club members can read email addresses through the Supabase data API even if a particular UI does not display them.
- **Recommendation:** Confirm whether member email is intentionally visible to every club member. If not, expose a narrow view/RPC for directory fields and keep email behind a specific permission.
- **Plan task:** P0-T07.

### Medium — SEC-006: Local Supabase auth defaults are weaker than the registration form

- **Confidence:** High for local config; production configuration was not inspected.
- **Location:** `supabase/config.toml:172-180,218-225`; `src/app/(auth)/register/page.tsx:135-145`.
- **Evidence:** Local Supabase config permits six-character passwords and disables email confirmation; registration UI requires eight characters.
- **Impact:** Local testing does not match the form's password rule or a verified-email production flow. Production risk depends on the deployed Supabase settings.
- **Recommendation:** Align local settings with production policy and verify production email confirmation, password policy, and auth redirect configuration before launch.
- **Plan task:** P1-T01.

## Secrets and exposure

- No committed `.env.local` was found; Git ignores the local file, which was deliberately not opened. The tracked `.env.example` contains a known local cron credential and must not be used as a production secret (SEC-007).
- `.env.example` includes placeholder/local-only values; replace all sample secrets before deployment and never treat them as production-safe.
- No confirmed live secret value was copied into this report. Full Git-history and built-client credential scanning were not completed, so no credential is declared safe from rotation.
- If any real credential was ever committed or shared, rotate it at its provider; do not merely delete the current file.

## Additional checks

- No CSP/security-header policy was found in the inspected Next.js config or source search; verify deployment/platform headers and add a tested baseline CSP, HSTS, frame-ancestors, and content-type protection.
- The local Supabase config is not evidence of production auth settings.
- The local privacy consent copy is not a substitute for a linked privacy notice, retention schedule, member request process, or incident-response procedure.
