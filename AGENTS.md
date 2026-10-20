<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Rotaract Club Operations Platform — Agent Guide

Read `.agents/skills/rotaract-operations/SKILL.md` before touching domain logic.
Read `.agents/skills/supabase*/SKILL.md` before touching SQL, RLS, auth or storage.
Read `.agents/skills/vercel-*/SKILL.md` and `web-design-guidelines` before UI/perf work.
(`next-best-practices` could not be installed — the upstream repo had no valid SKILL.md;
use the bundled docs in `node_modules/next/dist/docs/` instead.)

## Stack (approved — do not swap without discussion)

Next.js 16 (App Router, Turbopack, `proxy.ts` not `middleware.ts`) · React 19 · TypeScript
strict · Tailwind CSS v4 · shadcn/ui (Radix) · lucide-react · React Hook Form + Zod ·
Recharts · Supabase (Postgres, Auth, Storage, RLS) via `@supabase/ssr` · Resend ·
@react-pdf/renderer · docx · qrcode · @zxing/browser · tesseract.js (opt-in, browser only) ·
Vitest + Testing Library · Playwright + axe-core. No Prisma, no Express, no Redis.

## Layout

```
src/app/(auth)/...         public auth pages (login, register, pending)
src/app/(app)/...          authenticated app shell + feature pages
src/app/api/...            route handlers (check-in, downloads, CSV, cron, health)
src/components/ui          shadcn primitives (generated; edit sparingly)
src/components/layout      shell, nav, page header
src/components/shared      cross-feature components (data table, empty state, status badge)
src/features/<module>      feature components + server actions (actions.ts)
src/lib/supabase           client factories (browser, server, admin[server-only])
src/lib/auth               session context, requireUser, requirePermission
src/lib/permissions        permission keys + pure helpers
src/lib/services           business logic (server-only), workflows/*.ts are pure
src/lib/validators         Zod schemas shared by forms and server
src/lib/documents          PDF/DOCX/CSV generation (server-only)
src/lib/email              provider abstraction + templates
src/lib/utils              money, dates, rotary-year, csv, cn
supabase/migrations        SQL — the source of truth for schema
supabase/seed.sql          dev-only demo data (never real members)
tests/unit|integration|e2e
docs/                      architecture, database, security, reporting, deployment
```

## Boundaries

- UI components never decide authorization. Server actions/route handlers:
  authenticate → validate (Zod) → `assertPermission` → service → safe response.
- Business rules live in `src/lib/services`; pure state machines in `services/workflows`.
- `src/lib/supabase/admin.ts` (service role) is `server-only`; use only for account approval,
  check-in insert, notifications to others, cron jobs, and explicit audit writes.
- Never put secrets in `NEXT_PUBLIC_*`. Never log tokens/cookies/receipt data.

## Database rules

- Create migrations with `npx supabase migration new <name>`; never edit an applied migration
  — add a new one. RLS on every `public` table, with explicit per-command policies.
- Helpers live in schema `private` (not exposed): `private.has_permission(club, perm)`,
  `private.is_platform_admin()`, `private.is_active_member(club)`.
- SECURITY DEFINER only in `private`, always `set search_path = ''`.
- Views must use `with (security_invoker = true)`.
- Money `numeric(12,2)`; timestamps `timestamptz`.
- Regenerate types after schema changes: `npm run db:types`.

## Commands

```
npm run dev              # Next dev server
npm run build            # production build
npm run lint             # ESLint
npm run typecheck        # tsc --noEmit
npm test                 # Vitest unit tests
npm run test:integration # Vitest against local Supabase (needs `npm run db:start`)
npm run test:e2e         # Playwright
npm run db:start | db:stop | db:reset | db:types
npm run bootstrap:admin -- you@example.com
```

Run typecheck + lint + unit tests after every meaningful change. Do not weaken tests.
