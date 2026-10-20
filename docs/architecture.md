# Architecture Assessment & System Design

**Rotaract Club Operations Platform**
Target Club: Rotaract Club of San Pedro East (District 3820, Laguna, Philippines)

## 1. Architectural Philosophy
The platform is designed as a **modular monolith** running on Next.js 16 (App Router) backed by Supabase PostgreSQL. It rejects microservice sprawl in favor of maintainability by volunteer officers while enforcing strict domain boundaries.

```
                    ┌────────────────────────────┐
                    │      Next.js 16 App        │
                    │   React Server Components  │
                    └─────────────┬──────────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         ▼                        ▼                        ▼
  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
  │ UI & Client  │         │ Server-Side  │         │ API & Proxy  │
  │  Components  │         │ Services &   │         │ (proxy.ts,   │
  │ (shadcn/ui,  │         │ Workflows    │         │ Route        │
  │ Lucide, RHF) │         │ (pure rules) │         │ Handlers)    │
  └──────────────┘         └──────┬───────┘         └──────┬───────┘
                                  │                        │
                                  ▼                        ▼
                           ┌──────────────┐         ┌──────────────┐
                           │   Supabase   │         │ Document &   │
                           │ PostgreSQL + │         │ Resend Email │
                           │  RLS Schema  │         │  Generators  │
                           └──────────────┘         └──────────────┘
```

## 2. Layer Boundaries
- **UI Components (`src/components`, `src/features`)**: Render data and collect input. They **never** make authorization decisions or perform financial calculations.
- **Server Services (`src/lib/services`)**: Enforce business rules, transition states (reports, budgets, onboarding), and audit logs.
- **Proxy Layer (`src/proxy.ts`)**: Next.js 16 successor to `middleware.ts`. Handles session cookie refreshing and optimistic routing without bypassing server checks.
- **Data Access & PostgreSQL RLS (`supabase/migrations`)**: The ultimate security boundary. Tables in `public` have Row Level Security enabled with explicit policies. Privileged helper functions live in `private` schema with `SET search_path = ''`.
- **Server-Only Modules (`src/lib/supabase/admin.ts`, `src/lib/documents`)**: Use `import 'server-only'` to guarantee secrets and private documents never leak to client bundles.

## 3. Core Modules
1. **Module 1 — Automated Project Reporting Engine**: Focus areas, SDGs, beneficiary statistics, snapshot versioning, and exportable reports.
2. **Module 2 — Attendance & Engagement**: Dynamic QR sessions, anti-duplicate check-ins, volunteer-hour rules, and explainable retention alerts.
3. **Module 3 — Treasury, Invoices, Proofs & Budgets**: Integer-centavo accounting, proof verification portal, dual-approval budget requests, and variance liquidation.
4. **Module 4 — Recruitment CRM & Member Directory**: Kanban pipeline, privacy-first directory, and MyRotary readiness checks.
