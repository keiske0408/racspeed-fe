-- ==============================================================================
-- 0014_qr_attendance_sessions_upgrade.sql
-- Enhances QR-based Project & Event Attendance Sessions:
-- 1. Configurable expiration duration (default 20 minutes)
-- 2. Full session lifecycle statuses (DRAFT, SCHEDULED, ACTIVE, PAUSED, CLOSED, EXPIRED, REVOKED)
-- 3. Check-in window timestamps (opens_at, closes_at) and revocation audit fields
-- 4. Atomic uniqueness constraints & lookup indexes
-- ==============================================================================

-- 1. Expand status check constraint on attendance_sessions
alter table public.attendance_sessions
  drop constraint if exists attendance_sessions_status_check;

alter table public.attendance_sessions
  add constraint attendance_sessions_status_check
  check (status in ('DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'CLOSED', 'EXPIRED', 'REVOKED'));

-- 2. Add session configuration and audit columns
alter table public.attendance_sessions
  add column if not exists duration_minutes int not null default 20 check (duration_minutes between 1 and 1440),
  add column if not exists session_date date,
  add column if not exists label text,
  add column if not exists opens_at timestamptz,
  add column if not exists closes_at timestamptz,
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

-- 3. Add performance indexes for token validation and active session lookup
create index if not exists attendance_sessions_activity_status_idx
  on public.attendance_sessions (activity_id, status, expires_at desc);

create index if not exists attendance_sessions_event_status_idx
  on public.attendance_sessions (event_id, status, expires_at desc);

create index if not exists attendance_sessions_token_idx
  on public.attendance_sessions (session_token);

-- 4. Ensure duplicate attendance prevention constraints exist
create unique index if not exists attendance_records_activity_profile_key
  on public.attendance_records (activity_id, profile_id)
  where activity_id is not null;

create unique index if not exists attendance_records_event_profile_key
  on public.attendance_records (event_id, profile_id)
  where event_id is not null;

