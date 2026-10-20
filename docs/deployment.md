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
   - Add your sending domain (e.g. `rotaract.local` or verified custom domain) in Resend.
   - Set `RESEND_API_KEY` and `EMAIL_FROM`. If omitted, the app operates safely in preview mode without sending real emails.
