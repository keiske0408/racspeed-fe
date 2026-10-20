-- ==============================================================================
-- 0002_recruitment_and_events.sql
-- Module 4: Recruitment & Onboarding Pipeline
-- Module 2: Events & Attendance QR Check-in Engine
-- ==============================================================================

-- 1. Prospects
create table if not exists public.prospects (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  stage text not null default 'PROSPECT' check (
    stage in (
      'PROSPECT',
      'ATTENDED_ORIENTATION',
      'ATTENDED_FIRST_SERVICE_PROJECT',
      'ATTENDED_GENERAL_ASSEMBLY',
      'READY_FOR_INDUCTION',
      'INDUCTED',
      'DECLINED',
      'INACTIVE'
    )
  ),
  recruiter_id uuid references public.profiles(id) on delete set null,
  assigned_officer_id uuid references public.profiles(id) on delete set null,
  source text,
  has_privacy_consent boolean not null default false,
  converted_profile_id uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Prospect Stage History
create table if not exists public.prospect_stage_history (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  from_stage text not null,
  to_stage text not null,
  changed_by uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

-- 3. Prospect Interactions
create table if not exists public.prospect_interactions (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  interaction_type text not null check (interaction_type in ('CALL', 'SMS', 'EMAIL', 'MEETING', 'NOTE')),
  summary text not null,
  logged_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 4. Events
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  host_club_id uuid not null references public.clubs(id) on delete cascade,
  title text not null,
  description text,
  event_category text not null check (
    event_category in (
      'GENERAL_ASSEMBLY',
      'SERVICE_PROJECT',
      'FELLOWSHIP',
      'DISTRICT_EVENT',
      'JOINT_PROJECT',
      'PROFESSIONAL_DEVELOPMENT',
      'BOARD_MEETING',
      'OTHER'
    )
  ),
  location text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  check_in_window_minutes int not null default 180,
  volunteer_hours_default numeric(5,2) not null default 0.00,
  attendance_manager_id uuid references public.profiles(id) on delete set null,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. Event Clubs (Supports joint events with partner clubs without mixing primary records)
create table if not exists public.event_clubs (
  event_id uuid not null references public.events(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  is_host boolean not null default false,
  primary key (event_id, club_id)
);

-- 6. Attendance Sessions (Dynamic QR sessions with rotating tokens and time limits)
create table if not exists public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  session_token text not null unique,
  secret_hash text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'CLOSED', 'EXPIRED')),
  expires_at timestamptz not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 7. Attendance Records (Enforces 1 check-in per user per event)
create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid references public.attendance_sessions(id) on delete set null,
  attended boolean not null default true,
  is_excused boolean not null default false,
  check_in_time timestamptz default now(),
  check_in_method text not null default 'QR' check (check_in_method in ('QR', 'MANUAL', 'GUEST')),
  volunteer_hours numeric(5,2) not null default 0.00,
  verified_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (event_id, profile_id)
);

-- 8. Attendance Adjustments (Manual corrections audit trail)
create table if not exists public.attendance_adjustments (
  id uuid primary key default gen_random_uuid(),
  attendance_record_id uuid not null references public.attendance_records(id) on delete cascade,
  adjusted_by uuid not null references public.profiles(id) on delete cascade,
  previous_hours numeric(5,2) not null,
  new_hours numeric(5,2) not null,
  reason text not null,
  created_at timestamptz not null default now()
);

-- ==============================================================================
-- RLS POLICIES FOR RECRUITMENT & EVENTS
-- ==============================================================================

alter table public.prospects enable row level security;
alter table public.prospect_stage_history enable row level security;
alter table public.prospect_interactions enable row level security;
alter table public.events enable row level security;
alter table public.event_clubs enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_records enable row level security;
alter table public.attendance_adjustments enable row level security;

-- Prospects policies
create policy "prospects_select" on public.prospects
  for select to authenticated
  using (
    private.is_platform_admin()
    or private.has_permission(club_id, 'RECRUITMENT_MANAGE')
    or recruiter_id = (select auth.uid())
    or assigned_officer_id = (select auth.uid())
  );

create policy "prospects_modify" on public.prospects
  for all to authenticated
  using (
    private.is_platform_admin()
    or private.has_permission(club_id, 'RECRUITMENT_MANAGE')
  )
  with check (
    private.is_platform_admin()
    or private.has_permission(club_id, 'RECRUITMENT_MANAGE')
  );

-- Events policies
create policy "events_select" on public.events
  for select to authenticated
  using (
    is_published = true
    or private.is_platform_admin()
    or exists (
      select 1 from public.event_clubs ec
      where ec.event_id = public.events.id
        and private.is_active_member(ec.club_id)
    )
  );

create policy "events_modify" on public.events
  for all to authenticated
  using (
    private.is_platform_admin()
    or private.has_permission(host_club_id, 'EVENT_CREATE')
    or private.has_permission(host_club_id, 'EVENT_UPDATE')
  )
  with check (
    private.is_platform_admin()
    or private.has_permission(host_club_id, 'EVENT_CREATE')
    or private.has_permission(host_club_id, 'EVENT_UPDATE')
  );

-- Attendance Sessions policies
create policy "attendance_sessions_select" on public.attendance_sessions
  for select to authenticated
  using (true);

create policy "attendance_sessions_manage" on public.attendance_sessions
  for all to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = public.attendance_sessions.event_id
        and (private.has_permission(e.host_club_id, 'ATTENDANCE_MANAGE') or private.is_platform_admin())
    )
  )
  with check (
    exists (
      select 1 from public.events e
      where e.id = public.attendance_sessions.event_id
        and (private.has_permission(e.host_club_id, 'ATTENDANCE_MANAGE') or private.is_platform_admin())
    )
  );

-- Attendance Records policies
create policy "attendance_records_select" on public.attendance_records
  for select to authenticated
  using (
    profile_id = (select auth.uid())
    or private.is_platform_admin()
    or exists (
      select 1 from public.events e
      where e.id = public.attendance_records.event_id
        and private.has_permission(e.host_club_id, 'EVENT_VIEW')
    )
  );

create policy "attendance_records_manage" on public.attendance_records
  for all to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = public.attendance_records.event_id
        and (private.has_permission(e.host_club_id, 'ATTENDANCE_MANAGE') or private.is_platform_admin())
    )
  )
  with check (
    exists (
      select 1 from public.events e
      where e.id = public.attendance_records.event_id
        and (private.has_permission(e.host_club_id, 'ATTENDANCE_MANAGE') or private.is_platform_admin())
    )
  );
