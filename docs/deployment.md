# Local Setup & Cloud Deployment Guide

## 1. Local Development Setup

### Prerequisites
- Node.js >= 20.9.0 (v22.21 LTS verified)
- Docker Desktop (for local Supabase instance)

### Installation
```bash
cd d:\RACSPEED\racspeed-fe
npm install
```

### Local Database Setup (via Supabase CLI)
```bash
# Start local Supabase containers (requires Docker)
npx supabase start

# Apply SQL migrations
npx supabase migration up

# Check status and credentials
npx supabase status
```

Copy the generated API URL and keys into `.env.local`.

### Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Run Unit Tests
```bash
npm test
```

## 2. Bootstrapping the First Administrator
Because initial registration produces `PENDING` accounts, bootstrap the first Platform Administrator safely:
```bash
npx tsx scripts/bootstrap-admin.ts admin@rotaract.local
```

## 3. Cloud Deployment (Vercel & Supabase)
1. **Supabase Cloud Project**:
   - Create a project on [supabase.com](https://supabase.com).
   - In Database settings, link project via `npx supabase link --project-ref <ref>`.
   - Push migrations: `npx supabase db push`.
2. **Vercel Deployment**:
   - Import the `racspeed-fe` repository on [vercel.com](https://vercel.com).
   - Set environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `RESEND_API_KEY`).
   - Framework preset: Next.js. Deploy!
3. **Resend Transactional Email**:
   - Add a domain you own in Resend and publish the DNS records Resend provides. A `.local` domain cannot send production email.
   - Set `RESEND_API_KEY` and `EMAIL_FROM` to a sender address on the verified domain. If omitted, the app records `SKIPPED_PREVIEW` and sends no email.

## 4. Project Center Database Setup

The Project Center depends on migrations `0008_project_center.sql` and `0009_engagement_and_notifications.sql`. If activity creation returns `Could not find the table 'public.activities' in the schema cache`, the database connected by this app has not applied migration 0008, or the API schema cache has not refreshed.

For a local database, start Docker Desktop and run:

```bash
npx supabase start
npx supabase migration up
npx supabase migration list
```

For the linked cloud database, confirm the Supabase project reference is the intended environment, then run:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
npx supabase migration list
```

After the migrations report as applied, verify `public.activities` exists in Supabase Table Editor. If it exists but the API still reports a schema-cache error, run this in the Supabase SQL Editor:

```sql
notify pgrst, 'reload schema';
```

Do not run `db push` against production until the linked project reference has been checked and the migration diff has been reviewed.

## 5. Email, Push, and Retention Configuration

Add these values to `.env.local` for development and to the deployment environment for production. Keep private keys out of source control and chat.

```env
RESEND_API_KEY=re_<key-from-resend>
EMAIL_FROM=RacSpeed Notifications <notifications@your-verified-domain.org>
EMAIL_TEST_RECIPIENT=your-test-address@example.com
NEXT_PUBLIC_APP_URL=https://your-app-domain.example
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<vapid-public-key>
VAPID_PRIVATE_KEY=<vapid-private-key>
VAPID_SUBJECT=mailto:admin@your-verified-domain.org
CRON_SECRET=<long-random-secret>
```

- **Resend:** Create an API key in the Resend dashboard and verify the sender domain through DNS. `EMAIL_FROM` must use that verified domain. `EMAIL_TEST_RECIPIENT` is optional and redirects app emails to one test inbox; remove it when ready to email members.
- **VAPID:** Generate a key pair with `npx web-push generate-vapid-keys`. Put the public key in `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and the private key in `VAPID_PRIVATE_KEY`. The private key is server-only. Members opt in per browser under Settings.
- **Cron:** Schedule `POST /api/cron/retention-check` daily with `Authorization: Bearer <CRON_SECRET>`. The job evaluates missed General Assemblies, service-project RSVPs/no-shows, due project reports, and minimum-member RSVPs.
- **Preview mode:** Without `RESEND_API_KEY`, email is logged as `SKIPPED_PREVIEW`. Without both VAPID keys, push is skipped and recorded; in-app notifications still work.

## 6. End-to-End Operations Checklist

Run this against a disposable local Supabase database after applying migrations 0001–0009. Confirm the application points to the same local Supabase URL and keys.

| Workflow | Check |
|---|---|
| Create activity | Create a Meeting and a Fellowship; verify each appears in List, Board, and Calendar. |
| Create service project | Create a Service Project; verify project-specific details exist and the chair can open its Report tab. |
| Minimum members | Toggle the minimum off and confirm no threshold is stored; toggle on and confirm the RSVP progress/shortfall appears. |
| RSVP and capacity | RSVP Going, update the response, and verify duplicate/capacity rules. |
| Check-in | Verify disabled self check-in is rejected; enable it and test both “Check in as me” and QR scanning, including duplicate and out-of-window attempts. |
| Tasks and collaboration | Create a task on an activity, update its status, post/delete a comment, react, and upload/remove a photo. |
| Accomplishment report | Complete the project, add required report fields and a photo, publish, and verify the saved snapshot and Accomplished status. |
| Aspirant approval | Approve without a Rotary ID; verify active login, ASPIRANT membership, null Rotary ID, and CRM link. Then induct with a Rotary ID. |
| Notifications | Run the cron with the secret; verify in-app notices, Resend delivery (or preview log), and push on an opted-in browser. |

This repository environment did not have Docker/local Postgres running, so migrations and database-backed workflows were not executed here. Typecheck, unit tests, focused lint, and the production build are separate checks and do not replace this checklist.
