-- ==============================================================================
-- 0004_treasury_budgets_liquidations.sql
-- Module 3: Treasury, Invoices, Proofs, Budgets & Liquidations
-- Notifications & Background Schedulers
-- ==============================================================================

-- 1. Invoices & Items
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  invoice_number text not null unique,
  dedupe_key text unique, -- Prevents duplicate invoice generation in scheduled jobs
  title text not null,
  description text,
  due_date date not null,
  status text not null default 'ISSUED' check (status in ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID', 'CANCELLED')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  category text not null check (category in ('MEMBERSHIP_DUES', 'EVENT_FEE', 'FUNDRAISER', 'DISASTER_RELIEF', 'OTHER')),
  amount numeric(12,2) not null check (amount >= 0.00),
  quantity numeric(8,2) not null default 1.00,
  created_at timestamptz not null default now()
);

-- 2. Payment Submissions (Proof-of-payment portal)
create table if not exists public.payment_submissions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  claimed_amount numeric(12,2) not null check (claimed_amount > 0.00),
  claimed_date date not null default current_date,
  reference_number text,
  payment_channel text, -- e.g. GCash, Maya, BDO, Cash
  receipt_storage_path text not null,
  ocr_extracted_data jsonb, -- Untrusted suggestions for human verification
  status text not null default 'SUBMITTED' check (status in ('SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'NEEDS_CLARIFICATION')),
  treasurer_notes text,
  verified_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Payment Allocations (Links a verified payment to one or more invoices)
create table if not exists public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.payment_submissions(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  allocated_amount numeric(12,2) not null check (allocated_amount > 0.00),
  created_at timestamptz not null default now(),
  unique (submission_id, invoice_id)
);

-- 4. Ledger Adjustments (Auditable corrections; never rewrite historical rows)
create table if not exists public.ledger_adjustments (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null, -- positive increases debt, negative decreases debt
  reason text not null,
  adjusted_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

-- 5. Budget Requests
create table if not exists public.budget_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete restrict,
  title text not null,
  justification text not null,
  total_requested_amount numeric(12,2) not null default 0.00,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'DISBURSED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.budget_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.budget_requests(id) on delete cascade,
  description text not null,
  quantity numeric(8,2) not null default 1.00,
  unit_cost numeric(12,2) not null check (unit_cost >= 0.00),
  total_cost numeric(12,2) not null check (total_cost >= 0.00),
  created_at timestamptz not null default now()
);

create table if not exists public.budget_approvals (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.budget_requests(id) on delete cascade,
  approver_id uuid not null references public.profiles(id) on delete restrict,
  role_at_decision text not null check (role_at_decision in ('PRESIDENT', 'TREASURER')),
  approved boolean not null,
  comments text,
  decided_at timestamptz not null default now(),
  unique (request_id, role_at_decision)
);

-- 6. Fund Disbursements
create table if not exists public.fund_disbursements (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.budget_requests(id) on delete cascade,
  disbursed_by uuid not null references public.profiles(id) on delete restrict,
  disbursed_amount numeric(12,2) not null check (disbursed_amount > 0.00),
  disbursement_date date not null default current_date,
  disbursement_channel text not null,
  reference_number text,
  notes text,
  created_at timestamptz not null default now()
);

-- 7. Liquidations
create table if not exists public.liquidations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.budget_requests(id) on delete cascade,
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  total_disbursed numeric(12,2) not null,
  total_actual_spent numeric(12,2) not null default 0.00,
  variance numeric(12,2) not null default 0.00, -- variance = total_actual_spent - total_disbursed
  status text not null default 'DRAFT' check (status in ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REVISION_REQUESTED', 'REJECTED')),
  reviewer_id uuid references public.profiles(id) on delete set null,
  review_notes text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.liquidation_items (
  id uuid primary key default gen_random_uuid(),
  liquidation_id uuid not null references public.liquidations(id) on delete cascade,
  description text not null,
  actual_amount numeric(12,2) not null check (actual_amount >= 0.00),
  receipt_storage_path text,
  is_approved boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

-- 8. Notifications & Scheduler
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null check (type in ('INVOICE_REMINDER', 'PAYMENT_STATUS', 'BUDGET_ACTION', 'REPORT_REVIEW', 'ATTENDANCE_ALERT', 'GENERAL')),
  link_url text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  email_dues_reminders boolean not null default true,
  email_event_reminders boolean not null default true,
  email_approval_updates boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.email_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  recipient_email text not null,
  subject text not null,
  provider text not null default 'RESEND',
  provider_id text,
  status text not null check (status in ('SENT', 'DELIVERED', 'FAILED', 'SKIPPED_PREVIEW')),
  error_details text,
  created_at timestamptz not null default now()
);

create table if not exists public.scheduled_job_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  run_key text not null unique, -- Idempotency token (e.g. "retention-check-2026-10-20")
  status text not null check (status in ('RUNNING', 'SUCCESS', 'FAILED')),
  records_processed int not null default 0,
  details jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

-- ==============================================================================
-- RLS POLICIES FOR TREASURY & LIQUIDATION
-- ==============================================================================

alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payment_submissions enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.ledger_adjustments enable row level security;
alter table public.budget_requests enable row level security;
alter table public.budget_request_items enable row level security;
alter table public.budget_approvals enable row level security;
alter table public.fund_disbursements enable row level security;
alter table public.liquidations enable row level security;
alter table public.liquidation_items enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.email_delivery_logs enable row level security;
alter table public.scheduled_job_runs enable row level security;

-- Invoices: members see own invoices; treasurers and presidents see club invoices
create policy "invoices_select" on public.invoices
  for select to authenticated
  using (
    profile_id = (select auth.uid())
    or private.is_platform_admin()
    or private.has_permission(club_id, 'TREASURY_VIEW')
  );

create policy "invoices_manage" on public.invoices
  for all to authenticated
  using (private.is_platform_admin() or private.has_permission(club_id, 'INVOICE_CREATE'))
  with check (private.is_platform_admin() or private.has_permission(club_id, 'INVOICE_CREATE'));

-- Invoice items follow parent invoice
create policy "invoice_items_select" on public.invoice_items
  for select to authenticated
  using (
    exists (
      select 1 from public.invoices i
      where i.id = public.invoice_items.invoice_id
        and (i.profile_id = (select auth.uid()) or private.is_platform_admin() or private.has_permission(i.club_id, 'TREASURY_VIEW'))
    )
  );

-- Payment submissions: strictly isolated! Submitters see own proofs; treasurers see proofs for verification
create policy "payment_submissions_select" on public.payment_submissions
  for select to authenticated
  using (
    submitted_by = (select auth.uid())
    or private.is_platform_admin()
    or private.has_permission(club_id, 'PAYMENT_VERIFY')
  );

create policy "payment_submissions_insert" on public.payment_submissions
  for insert to authenticated
  with check (
    submitted_by = (select auth.uid())
    or private.is_platform_admin()
  );

create policy "payment_submissions_update" on public.payment_submissions
  for update to authenticated
  using (private.is_platform_admin() or private.has_permission(club_id, 'PAYMENT_VERIFY'))
  with check (private.is_platform_admin() or private.has_permission(club_id, 'PAYMENT_VERIFY'));

-- Notifications: user sees own notifications
create policy "notifications_select_self" on public.notifications
  for select to authenticated
  using (profile_id = (select auth.uid()));

create policy "notifications_update_self" on public.notifications
  for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));
