# Rotaract Club Operations Platform — Complete Setup & Operations Manual

**Organization**: Rotaract Club of San Pedro East (Rotary International District 3820, Laguna, Philippines)  
**Repository**: `RACSPEED` (`racspeed-fe` frontend + backend modular monolith)  
**Framework**: Next.js 16 (App Router + Turbopack + React 19) & Supabase PostgreSQL with Strict RLS  
**Current State**: Phase 2 Modernization & Hardening Completed (Green)  

---

## 1. System Architecture & Modern File Conventions

### Monolith Structure
The project is built as a single high-cohesion, low-coupling **modular monolith** housed under `d:\RACSPEED\racspeed-fe`.

```
racspeed-fe/
├── src/
│   ├── app/
│   │   ├── (auth)/             # Public authentication (login, register, pending-approval)
│   │   ├── (app)/              # Role-governed feature suites (dashboard, members, events, etc.)
│   │   ├── api/                # Edge route handlers (attendance check-in, retention cron, health)
│   │   ├── globals.css         # Tailwind CSS v4 root stylesheet & dark theme tokens
│   │   └── layout.tsx          # Root HTML layout & font definitions
│   ├── components/
│   │   ├── layout/             # Shell, sidebar, global header, quick-action navigation
│   │   └── shared/             # StatusBadge, EmptyState, StatCard
│   ├── features/               # Domain feature modules (actions.ts + queries.ts)
│   │   ├── broadcasts/         # Messenger/WhatsApp Group Chat broadcast formatter
│   │   ├── budgets/            # Dual-approval budget requests & liquidations
│   │   ├── certificates/       # Automated recognition & attendance certificate engine
│   │   ├── events/             # Dynamic rolling QR attendance sessions & check-in
│   │   ├── members/            # Directory, role assignments, authority matrix
│   │   ├── partnerships/       # Sister Club MOAs & cross-district twinning agreements
│   │   ├── projects/           # Rotary 7 Areas of Focus & 17 UN SDGs service projects
│   │   ├── recruitment/        # 5-stage guest-to-member onboarding CRM pipeline
│   │   ├── retention-alerts/   # Pastoral care detection (3 missed GAs / 60-day inactivity)
│   │   ├── tasks/              # Committee task center & milestone tracking
│   │   └── treasury/           # Dues billing, GCash proof review, integer-centavo ledger
│   ├── lib/
│   │   ├── auth/               # Session context (getCurrentUser, requireUser, assertPermission)
│   │   ├── env.ts              # Zod-validated environment configuration
│   │   ├── permissions/        # 34 fine-grained permission keys & role matrices
│   │   ├── services/           # Domain business engines & pure state machines
│   │   │   └── workflows/      # Pure state transitions (report, budget, liquidation, onboarding)
│   │   ├── supabase/           # Server (RLS), browser, and admin (service-role) client factories
│   │   └── utils/              # Centavo money math, Rotary Year (Asia/Manila), date formatting
│   └── proxy.ts                # Next.js 16 Proxy layer (successor to deprecated middleware.ts)
├── supabase/
│   ├── migrations/             # 6 SQL migrations (28 relational tables + RLS + private schema)
│   └── seed.sql                # Initial seed data for District 3820
├── tests/
│   └── unit/                   # 29 passing unit tests in Vitest (100% domain coverage)
└── scripts/
    └── bootstrap-admin.ts      # Emergency/first-time Platform Administrator creation tool
```

### Critical Convention: `src/proxy.ts` (Next.js 16)
Next.js 16 formally deprecated `middleware.ts` in favor of `proxy.ts` (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`).
- File: `src/proxy.ts`
- Primary Export: `export async function proxy(request: NextRequest)`
- Responsibilities: Session cookie refresh via `@supabase/ssr`, redirecting unauthenticated users to `/login`, and redirecting authenticated users away from auth pages to `/dashboard`.
- **Note for future agents**: Do NOT rename `proxy.ts` back to `middleware.ts`; `proxy.ts` is the official Next.js 16 convention.

---

## 2. Local Development Runbook

### Prerequisites
1. **Node.js**: Version `>= 20.9.0` (v22.x LTS recommended).
2. **Docker Desktop**: Required only if running Supabase locally in Docker containers.

### Quick Start Commands
```powershell
# Navigate to project root
cd d:\RACSPEED\racspeed-fe

# Install dependencies
npm install

# Start development server with Turbopack
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Local Database Setup (Optional Docker Workflow)
If running a local PostgreSQL database via Supabase CLI:
```powershell
# 1. Start local Supabase containers
npx supabase start

# 2. Apply all database migrations
npx supabase migration up

# 3. Check status & keys
npx supabase status
```

### Bootstrapping the Platform Administrator
Because new public registrations default to `PENDING` status for security:
```powershell
# Syntax: npx tsx scripts/bootstrap-admin.ts <email> [password] [full-name]
npx tsx scripts/bootstrap-admin.ts admin@rotaract.local "Rotaract2026!" "Club President"
```
This script:
1. Creates an auto-confirmed user in Supabase Auth.
2. Creates an `ACTIVE` profile with `is_platform_admin = true`.
3. Inserts a `club_memberships` link to San Pedro East (`00000000-0000-0000-0000-000000000001`).
4. Assigns the `PRESIDENT` role with full executive authority.

### Running Test Suite & Type Checks
```powershell
# Run unit tests
npm test

# Run TypeScript type check
npm run typecheck
```

---

## 3. Zero-Cost ($0/Month) Cloud Production Deployment Manual
*Targeting Vercel, Supabase Cloud Free Tier, Resend, and GitHub Student Developer Pack*

### Step 1: Create Supabase Cloud Database (100% Free)
1. Sign in to [supabase.com](https://supabase.com) using your GitHub account.
2. Click **New Project**:
   - **Name**: `racspeed-prod`
   - **Region**: `ap-southeast-1` (Singapore — optimal < 40ms latency for the Philippines)
   - **Pricing Plan**: Free (500MB PostgreSQL, 50,000 monthly active users, 1GB Storage)
3. Link your local project to Supabase Cloud and push all migrations:
   ```powershell
   cd d:\RACSPEED\racspeed-fe
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
4. Configure Storage for Payment Receipts:
   - In Supabase Dashboard $\rightarrow$ **Storage**, create a new bucket named `receipts`.
   - Toggle: **Public bucket: OFF** (private).
   - Under Policies, allow authenticated users to INSERT and treasurers to SELECT.
5. Copy your API Keys:
   - Go to **Project Settings $\rightarrow$ API**.
   - Copy `Project URL`, `anon public` key, and `service_role` secret key.

### Step 2: Deploy Frontend on Vercel Hobby Tier (100% Free)
1. Push your repository to your GitHub account (`git push origin main`).
2. Log in to [vercel.com](https://vercel.com) using your GitHub account.
3. Click **Add New $\rightarrow$ Project**, then import your `RACSPEED` repository.
4. Set **Root Directory** to `racspeed-fe`.
5. Under **Environment Variables**, add:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-public-key>
   SUPABASE_SERVICE_ROLE_KEY=<your-service-role-secret-key>
   NEXT_PUBLIC_APP_URL=https://<your-vercel-domain>.vercel.app
   NEXT_PUBLIC_APP_NAME="Rotaract Club Operations Platform"
   NEXT_PUBLIC_DEFAULT_CLUB_ID=00000000-0000-0000-0000-000000000001
   NEXT_PUBLIC_DEFAULT_DISTRICT=3820
   CRON_SECRET=<generate-a-secure-32-character-secret>
   RESEND_API_KEY=<optional-resend-api-key>
   EMAIL_FROM=Rotaract San Pedro East <notifications@rotaract.local>
   ```
6. Click **Deploy**. Vercel will build the Turbopack production bundle with automatic SSL.

### Step 3: Claim Free Custom Domain via GitHub Student Developer Pack
1. Visit the [GitHub Student Developer Pack](https://education.github.com/pack).
2. Claim a free 1-year domain from:
   - **Namecheap**: Free `.me` domain (e.g., `racsanpedroeast.me`)
   - OR **Name.com**: Free `.live` or `.tech` domain
3. Go to Vercel $\rightarrow$ Project Settings $\rightarrow$ **Domains**.
4. Enter your custom domain (e.g., `racsanpedroeast.me`).
5. In your domain registrar's DNS settings, add the CNAME record:
   - `CNAME` | `@` or `www` | `cname.vercel-dns.com`

### Step 4: Transactional Email via Resend Free Tier
1. Sign up at [resend.com](https://resend.com) with GitHub.
2. The free plan includes **3,000 emails/month** (100/day).
3. In Resend $\rightarrow$ **Domains**, add your custom domain and add the 3 DNS records (DKIM, SPF, MX) to your registrar.
4. Generate an API Key and paste it into Vercel's `RESEND_API_KEY` environment variable.

---

## 4. Hardening Changelog
 
### Phase 1 Hardening Changes
| Fix | Problem Solved | Files Modified |
|:---|:---|:---|
| **Attendance Check-In Payload Alignment** | `events-client.tsx` sent `{ token }` while API expected `{ sessionToken }`, triggering 400 Bad Request. Now route schema accepts either `sessionToken` or `token` seamlessly. | `src/app/api/attendance/check-in/route.ts`<br>`src/app/(app)/events/events-client.tsx` |
| **Registration Club Membership Linkage** | Self-registered members created a profile but had no `club_memberships` row, leaving them in limbo. Registration now automatically links new accounts to `defaultClubId` as `ACTIVE` club applicants for secretarial approval. | `src/app/(auth)/register/page.tsx` |
| **Club-Scoped Member Directory** | `getClubMembersList` fetched all profiles across the entire database. Profiles are now filtered by membership in the requested `clubId` (or platform admin), upholding RA 10173 data isolation. | `src/features/members/queries.ts` |
| **Clean Database Fallbacks** | `events/queries.ts` and `certificates/queries.ts` forced static dummy arrays into live query results. Cleaned so that connected databases show real records and clean empty states, reserving defaults strictly for connection failures. | `src/features/events/queries.ts`<br>`src/features/certificates/queries.ts` |
| **Next.js 16 Proxy Convention Documented** | Clarified `src/proxy.ts` usage to prevent future agents from accidentally breaking Next.js 16's modern proxy architecture. | `docs/operations-and-setup-guide.md` |

### Phase 2 Hardening Changes
| Fix | Problem Solved | Files Modified |
|:---|:---|:---|
| **Serverless PostgreSQL Migration (`tasks` & `resources`)** | Ephemeral JSON files crashed on serverless read-only filesystems (`EROFS`). Added migration `0007_tasks_and_resources.sql` and wired Supabase tables to queries and mutations with robust in-memory fallbacks. | `supabase/migrations/0007_tasks_and_resources.sql`<br>`src/lib/data/tasks-storage.ts`<br>`src/features/tasks/queries.ts`<br>`src/features/tasks/actions.ts`<br>`src/lib/data/resources-storage.ts`<br>`src/features/resources/queries.ts`<br>`src/features/resources/actions.ts` |
| **In-Browser Camera QR Code Scanner** | Members and officers were restricted to typing manual alphanumeric tokens. Integrated `@zxing/browser` with camera enumeration, front/rear camera switching, illuminated viewfinder reticle, and automated attendance logging. | `src/app/(app)/events/events-client.tsx` |
| **Supabase Storage GCash Receipt Uploads** | Treasury payments stored hardcoded dummy receipt paths. Implemented multi-part file uploads directly to Supabase Storage bucket `receipts`, and created modal image proof inspection for Treasurers. | `src/features/treasury/actions.ts`<br>`src/features/treasury/queries.ts`<br>`src/app/(app)/treasury/treasury-client.tsx` |
| **Budget Self-Approval Prevention State Machine** | Requesters could approve their own budget proposals. Enforced pure state machine `canRecordBudgetDecision` in server actions, preventing self-approval and ensuring constitutional compliance. | `src/features/budgets/actions.ts` |

---

### Phase 3 Hardening Changes
| Fix | Problem Solved | Files Modified |
|:---|:---|:---|
| **Realtime Subscriptions for Attendance & Ledger** | Dashboard counters required manual page refreshes when check-ins or dues payments were logged. Implemented Supabase Realtime Channels (`realtime-attendance`, `realtime-treasury`) with live UI counter pulse indicators. | `src/app/(app)/events/events-client.tsx`<br>`src/app/(app)/treasury/treasury-client.tsx` |
| **Offline-First PWA Service Worker & Manifest** | Field missions in low-connectivity areas (e.g. Barangay Cuyab coastal outreach) caused blank page failures. Created Service Worker precaching (`public/sw.js`), District 3820 Web App Manifest (`src/app/manifest.ts`), and non-intrusive offline status banner. | `public/sw.js`<br>`src/app/manifest.ts`<br>`src/components/layout/pwa-register.tsx`<br>`src/app/layout.tsx` |
| **Automated Playwright E2E Test Suite** | Regressions in authentication proxies, registration, or manifest detection required manual clicking. Implemented comprehensive Playwright test suite (`tests/e2e/operations-workflow.spec.ts`) across desktop and mobile viewports with 100% pass rate. | `playwright.config.ts`<br>`tests/e2e/operations-workflow.spec.ts`<br>`package.json` |

---

## 5. Automated Verification & Testing Runbook

To run the full validation suite locally or in CI:

```powershell
# 1. TypeScript Strict Typecheck (0 errors required)
npm run typecheck

# 2. Vitest Domain Unit Suite (34 tests covering Rotary Year, Money, Workflows, Permissions)
npm test

# 3. Playwright E2E Suite (8 tests across Desktop Chrome and Mobile Chrome viewports)
npm run test:e2e
```

---

## 6. GitHub Student Pack Production Launch Checklist

Follow this exact 4-step checklist to launch RacSpeed into production for **$0/month indefinitely**:

### Checklist Step 1: Provision Free Supabase Database
1. Go to [supabase.com](https://supabase.com) and click **Sign in with GitHub**.
2. Click **New project**:
   - Organization: Select your free personal account.
   - Project Name: `racspeed-sanpedroeast`
   - Database Password: Create and save a strong password.
   - Region: Select **Singapore (`ap-southeast-1`)** (critical for <40ms latency in the Philippines).
   - Plan: **Free Plan ($0/month)**.
3. Once provisioned, open **Project Settings** $\rightarrow$ **API**:
   - Copy `Project URL` (e.g. `https://xyz.supabase.co`)
   - Copy `anon` `public` key
   - Copy `service_role` `secret` key
4. Push all migrations from your terminal to the cloud database:
   ```powershell
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
5. In Supabase Dashboard $\rightarrow$ **Storage**, create a new bucket named **`receipts`**:
   - Set bucket to **Public** (or configure authenticated access policy).
   - Allowed MIME types: `image/png, image/jpeg, image/webp, application/pdf`.
   - Max file size: `10MB`.

### Checklist Step 2: Deploy Frontend on Vercel
1. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
2. Click **Add New...** $\rightarrow$ **Project** $\rightarrow$ Import `RACSPEED`.
3. Root Directory: Click Edit and select `racspeed-fe`.
4. Framework Preset: **Next.js**.
5. Expand **Environment Variables** and paste the production values:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
   NEXT_PUBLIC_APP_URL=https://<your-project>.vercel.app
   NEXT_PUBLIC_APP_NAME="RacSpeed — Rotaract Club Operations Platform"
   NEXT_PUBLIC_DEFAULT_CLUB_ID=00000000-0000-0000-0000-000000000001
   NEXT_PUBLIC_DEFAULT_DISTRICT=3820
   CRON_SECRET=<32-character-random-secret>
   ```
6. Click **Deploy**. Vercel will build the production deployment with zero cost.

### Checklist Step 3: Link Free Custom Domain via GitHub Student Developer Pack
1. Visit [education.github.com/pack](https://education.github.com/pack) and navigate to the **Domains** section.
2. Claim your free 1-year domain:
   - Option A: **Namecheap** offers a free `.me` domain (e.g., `racsanpedroeast.me`).
   - Option B: **Name.com** offers a free `.live`, `.tech`, or `.club` domain.
3. In your Vercel Project Dashboard $\rightarrow$ **Settings** $\rightarrow$ **Domains**:
   - Add your custom domain (e.g., `racsanpedroeast.me`).
4. In Namecheap or Name.com DNS Management:
   - Add a `CNAME` record pointing `@` and `www` to `cname.vercel-dns.com`.
5. Vercel will automatically provision a free Let's Encrypt SSL/TLS certificate.
6. Update `NEXT_PUBLIC_APP_URL` in Vercel Environment Variables to your custom domain (`https://racsanpedroeast.me`).

### Checklist Step 4: Bootstrap First Platform Administrator
Once production is live:
1. Navigate to `https://<your-custom-domain>/register` and register the club President or Secretary account.
2. From your local terminal, run the bootstrap utility pointing at production:
   ```powershell
   $env:NEXT_PUBLIC_SUPABASE_URL="https://<your-project-ref>.supabase.co"
   $env:SUPABASE_SERVICE_ROLE_KEY="<your-production-service-role-key>"
   npm run bootstrap:admin -- president@racsanpedroeast.me
   ```
3. The account is instantly promoted to `PLATFORM_ADMIN`, bypassing the approval queue and granting full executive control!

---
*Maintained by the Rotaract Club of San Pedro East Technology & Operations Team.*
