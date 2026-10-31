-- ==============================================================================
-- 0008_project_center.sql
-- Unified Project Center: activities replace events + projects as the single
-- scheduled unit (meetings, service projects, fellowships, ...).
-- Legacy events/projects tables are kept read-only for one release.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Aspirant membership status + participant helper
-- ------------------------------------------------------------------------------
alter table public.club_memberships drop constraint if exists club_memberships_membership_status_check;
alter table public.club_memberships add constraint club_memberships_membership_status_check
  check (membership_status in ('ACTIVE', 'ASPIRANT', 'ALUMNI', 'HONORARY', 'LEAVE_OF_ABSENCE', 'TERMINATED'));

-- Active members and aspirants may view, RSVP, comment and check in.
create or replace function private.is_club_participant(lookup_club_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.club_memberships cm
    join public.profiles p on p.id = cm.profile_id
    where cm.club_id = lookup_club_id
      and cm.profile_id = (select auth.uid())
      and cm.membership_status in ('ACTIVE', 'ASPIRANT')
      and p.status = 'ACTIVE'
  );
$$;

create or replace function private.rotary_year_for(instant timestamptz)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when extract(month from instant at time zone 'Asia/Manila') >= 7
      then extract(year from instant at time zone 'Asia/Manila')::int::text || '-' ||
           lpad(((extract(year from instant at time zone 'Asia/Manila')::int + 1) % 100)::text, 2, '0')
    else (extract(year from instant at time zone 'Asia/Manila')::int - 1)::text || '-' ||
         lpad((extract(year from instant at time zone 'Asia/Manila')::int % 100)::text, 2, '0')
  end;
$$;

-- ------------------------------------------------------------------------------
-- 2. Activities
-- ------------------------------------------------------------------------------
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  kind text not null check (
    kind in (
      'MEETING',
      'SERVICE_PROJECT',
      'JOINT_PROJECT',
      'FELLOWSHIP',
      'DISTRICT_EVENT',
      'PROFESSIONAL_DEVELOPMENT',
      'FUNDRAISER',
      'OTHER'
    )
  ),
  meeting_type text check (meeting_type in ('GENERAL_ASSEMBLY', 'BOARD_MEETING', 'COMMITTEE_MEETING')),
  title text not null check (char_length(title) between 1 and 160),
  short_description text check (char_length(short_description) <= 280),
  description text check (char_length(description) <= 10000),
  location text,
  location_lat numeric(9,6),
  location_lng numeric(9,6),
  start_at timestamptz not null,
  end_at timestamptz not null,
  all_day boolean not null default false,
  committee text check (
    committee in (
      'CLUB_SERVICE', 'COMMUNITY_SERVICE', 'VOCATIONAL', 'INTERNATIONAL',
      'PUBLIC_IMAGE', 'FINANCE', 'SECRETARIAT', 'BOARD'
    )
  ),
  owner_id uuid references public.profiles(id) on delete set null,
  status text not null default 'PLANNED' check (
    status in ('DRAFT', 'PLANNED', 'ONGOING', 'COMPLETED', 'AWAITING_REPORT', 'ACCOMPLISHED', 'CANCELLED')
  ),
  -- null = no minimum (form question toggled off)
  min_members_required int check (min_members_required is null or min_members_required > 0),
  capacity int check (capacity is null or capacity > 0),
  rsvp_enabled boolean not null default true,
  rsvp_deadline timestamptz,
  self_check_in_enabled boolean not null default false,
  check_in_window_minutes int not null default 180 check (check_in_window_minutes between 0 and 1440),
  volunteer_hours_default numeric(5,2) not null default 0.00 check (volunteer_hours_default >= 0),
  is_published boolean not null default true,
  cover_storage_path text,
  rotary_year text not null,
  legacy_event_id uuid unique,
  legacy_project_id uuid unique,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at >= start_at),
  check (kind = 'MEETING' or meeting_type is null)
);

create index if not exists activities_club_start_idx on public.activities (club_id, start_at);
create index if not exists activities_club_status_idx on public.activities (club_id, status);
create index if not exists activities_owner_idx on public.activities (owner_id);

-- Project-only fields, modelled on the Rotary Showcase (spc.rotary.org) form.
create table if not exists public.activity_project_details (
  activity_id uuid primary key references public.activities(id) on delete cascade,
  objective text,
  inspiration text,
  outcomes_summary text,
  beneficiary_type text,
  beneficiary_count int not null default 0 check (beneficiary_count >= 0),
  volunteer_member_count int not null default 0 check (volunteer_member_count >= 0),
  volunteer_nonmember_count int not null default 0 check (volunteer_nonmember_count >= 0),
  total_volunteer_hours numeric(8,2) not null default 0.00 check (total_volunteer_hours >= 0),
  funding_total numeric(12,2) not null default 0.00 check (funding_total >= 0),
  funding_currency text not null default 'PHP',
  funding_source text,
  total_expenses numeric(12,2) not null default 0.00 check (total_expenses >= 0),
  supports_polio boolean not null default false,
  languages text[] not null default array['English']::text[],
  tags text[] not null default array[]::text[],
  related_links jsonb not null default '[]'::jsonb,
  spc_initiative_id text,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_areas_of_focus (
  activity_id uuid not null references public.activities(id) on delete cascade,
  area_of_focus_id uuid not null references public.areas_of_focus(id) on delete cascade,
  primary key (activity_id, area_of_focus_id)
);

create table if not exists public.activity_sdgs (
  activity_id uuid not null references public.activities(id) on delete cascade,
  sdg_id uuid not null references public.sdgs(id) on delete cascade,
  primary key (activity_id, sdg_id)
);

create table if not exists public.activity_partners (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  partner_role text not null default 'IMPLEMENTING_PARTNER' check (
    partner_role in ('IMPLEMENTING_PARTNER', 'SPONSOR', 'COOPERATING_ORGANIZATION', 'BENEFICIARY_ORGANIZATION', 'OTHER')
  ),
  partner_club_id uuid references public.clubs(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_contacts (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  name text not null,
  email text,
  phone text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_team (
  activity_id uuid not null references public.activities(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  team_role text not null default 'COMMITTEE' check (team_role in ('CHAIR', 'CO_CHAIR', 'COMMITTEE', 'VOLUNTEER')),
  added_at timestamptz not null default now(),
  primary key (activity_id, profile_id)
);

create table if not exists public.activity_rsvps (
  activity_id uuid not null references public.activities(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  response text not null check (response in ('GOING', 'MAYBE', 'NOT_GOING')),
  note text check (char_length(note) <= 280),
  responded_at timestamptz not null default now(),
  primary key (activity_id, profile_id)
);

create table if not exists public.activity_media (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  storage_path text not null unique,
  caption text check (char_length(caption) <= 280),
  mime_type text,
  size_bytes bigint,
  is_featured boolean not null default false,
  sort_order int not null default 0,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_comments (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.activity_comments(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  mentions uuid[] not null default array[]::uuid[],
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists activity_comments_activity_idx on public.activity_comments (activity_id, created_at);

create table if not exists public.activity_comment_reactions (
  comment_id uuid not null references public.activity_comments(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (comment_id, profile_id, emoji)
);

create table if not exists public.activity_followers (
  activity_id uuid not null references public.activities(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (activity_id, profile_id)
);

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_log_activity_idx on public.activity_log (activity_id, created_at desc);

-- ------------------------------------------------------------------------------
-- 3. Re-point attendance, tasks, reports and budgets to activities
-- ------------------------------------------------------------------------------
alter table public.attendance_sessions add column if not exists activity_id uuid references public.activities(id) on delete cascade;
alter table public.attendance_sessions alter column event_id drop not null;

alter table public.attendance_records add column if not exists activity_id uuid references public.activities(id) on delete cascade;
alter table public.attendance_records alter column event_id drop not null;
create unique index if not exists attendance_records_activity_profile_key
  on public.attendance_records (activity_id, profile_id) where activity_id is not null;

alter table public.attendance_records drop constraint if exists attendance_records_check_in_method_check;
alter table public.attendance_records add constraint attendance_records_check_in_method_check
  check (check_in_method in ('QR', 'MANUAL', 'GUEST', 'SELF'));

alter table public.tasks add column if not exists activity_id uuid references public.activities(id) on delete cascade;
create index if not exists tasks_activity_idx on public.tasks (activity_id);

alter table public.report_submissions add column if not exists activity_id uuid references public.activities(id) on delete cascade;
alter table public.report_submissions alter column project_id drop not null;

alter table public.budget_requests add column if not exists activity_id uuid references public.activities(id) on delete set null;

-- ------------------------------------------------------------------------------
-- 4. Backfill from legacy events and projects (ids are preserved)
-- ------------------------------------------------------------------------------
insert into public.activities (
  id, club_id, kind, meeting_type, title, description, location, start_at, end_at,
  owner_id, status, check_in_window_minutes, volunteer_hours_default, is_published,
  rotary_year, legacy_event_id, created_at, updated_at
)
select
  e.id,
  e.host_club_id,
  case when e.event_category in ('GENERAL_ASSEMBLY', 'BOARD_MEETING') then 'MEETING' else e.event_category end,
  case when e.event_category in ('GENERAL_ASSEMBLY', 'BOARD_MEETING') then e.event_category end,
  e.title,
  e.description,
  e.location,
  e.start_time,
  greatest(e.end_time, e.start_time),
  e.attendance_manager_id,
  case when e.end_time < now() then 'COMPLETED' else 'PLANNED' end,
  e.check_in_window_minutes,
  e.volunteer_hours_default,
  e.is_published,
  private.rotary_year_for(e.start_time),
  e.id,
  e.created_at,
  e.updated_at
from public.events e
on conflict (id) do nothing;

insert into public.activities (
  id, club_id, kind, title, short_description, description, location, start_at, end_at,
  all_day, owner_id, status, rotary_year, legacy_project_id, created_at, updated_at
)
select
  p.id,
  p.host_club_id,
  'SERVICE_PROJECT',
  p.title,
  left(p.summary, 280),
  p.summary,
  p.venue,
  (p.start_date::timestamp + time '09:00') at time zone 'Asia/Manila',
  (greatest(p.end_date, p.start_date)::timestamp + time '17:00') at time zone 'Asia/Manila',
  true,
  p.project_chair_id,
  case p.status
    when 'DRAFT' then 'DRAFT'
    when 'ONGOING' then 'ONGOING'
    when 'COMPLETED' then 'AWAITING_REPORT'
    when 'REPORT_SUBMITTED' then 'ACCOMPLISHED'
    else 'CANCELLED'
  end,
  p.rotary_year,
  p.id,
  p.created_at,
  p.updated_at
from public.projects p
on conflict (id) do nothing;

insert into public.activity_project_details (
  activity_id, objective, outcomes_summary, beneficiary_type, beneficiary_count,
  volunteer_member_count, total_volunteer_hours, funding_total, total_expenses
)
select p.id, p.objective, p.outcomes_summary, p.beneficiary_type, p.beneficiary_count,
       p.volunteer_count, p.total_volunteer_hours, p.funds_raised, p.total_expenses
from public.projects p
where exists (select 1 from public.activities a where a.id = p.id)
on conflict (activity_id) do nothing;

insert into public.activity_project_details (activity_id)
select a.id from public.activities a
where a.kind in ('SERVICE_PROJECT', 'JOINT_PROJECT')
on conflict (activity_id) do nothing;

insert into public.activity_areas_of_focus (activity_id, area_of_focus_id)
select project_id, area_of_focus_id from public.project_areas_of_focus
where exists (select 1 from public.activities a where a.id = project_id)
on conflict do nothing;

insert into public.activity_sdgs (activity_id, sdg_id)
select project_id, sdg_id from public.project_sdgs
where exists (select 1 from public.activities a where a.id = project_id)
on conflict do nothing;

insert into public.activity_media (activity_id, storage_path, caption, is_featured, uploaded_by, created_at)
select project_id, storage_path, caption, is_featured, uploaded_by, created_at from public.project_photos
where exists (select 1 from public.activities a where a.id = project_id)
on conflict (storage_path) do nothing;

insert into public.activity_team (activity_id, profile_id, team_role)
select a.id, a.owner_id, 'CHAIR' from public.activities a
where a.owner_id is not null
on conflict do nothing;

update public.attendance_sessions s set activity_id = s.event_id
where s.activity_id is null and exists (select 1 from public.activities a where a.id = s.event_id);

update public.attendance_records r set activity_id = r.event_id
where r.activity_id is null and exists (select 1 from public.activities a where a.id = r.event_id);

update public.report_submissions r set activity_id = r.project_id
where r.activity_id is null and exists (select 1 from public.activities a where a.id = r.project_id);

-- ------------------------------------------------------------------------------
-- 5. Authorization helpers
-- ------------------------------------------------------------------------------
create or replace function private.can_view_activity(lookup_activity_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.activities a
    where a.id = lookup_activity_id
      and (private.is_platform_admin() or private.is_club_participant(a.club_id))
  );
$$;

create or replace function private.can_manage_activity(lookup_activity_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.activities a
    where a.id = lookup_activity_id
      and (
        private.is_platform_admin()
        or a.owner_id = (select auth.uid())
        or private.has_permission(a.club_id, 'EVENT_UPDATE')
        or private.has_permission(a.club_id, 'PROJECT_UPDATE')
        or exists (
          select 1 from public.activity_team t
          where t.activity_id = a.id
            and t.profile_id = (select auth.uid())
            and t.team_role in ('CHAIR', 'CO_CHAIR')
        )
      )
  );
$$;

-- ------------------------------------------------------------------------------
-- 6. Row Level Security
-- ------------------------------------------------------------------------------
alter table public.activities enable row level security;
alter table public.activity_project_details enable row level security;
alter table public.activity_areas_of_focus enable row level security;
alter table public.activity_sdgs enable row level security;
alter table public.activity_partners enable row level security;
alter table public.activity_contacts enable row level security;
alter table public.activity_team enable row level security;
alter table public.activity_rsvps enable row level security;
alter table public.activity_media enable row level security;
alter table public.activity_comments enable row level security;
alter table public.activity_comment_reactions enable row level security;
alter table public.activity_followers enable row level security;
alter table public.activity_log enable row level security;

create policy "activities_select" on public.activities
  for select to authenticated
  using (private.is_platform_admin() or private.is_club_participant(club_id));

create policy "activities_insert" on public.activities
  for insert to authenticated
  with check (
    private.has_permission(club_id, 'EVENT_CREATE')
    or private.has_permission(club_id, 'PROJECT_CREATE')
  );

create policy "activities_update" on public.activities
  for update to authenticated
  using (private.can_manage_activity(id))
  with check (private.can_manage_activity(id));

create policy "activities_delete" on public.activities
  for delete to authenticated
  using (private.has_permission(club_id, 'SETTINGS_MANAGE'));

-- Child tables managed by chairs/officers, readable by participants
create policy "activity_project_details_select" on public.activity_project_details
  for select to authenticated using (private.can_view_activity(activity_id));
create policy "activity_project_details_modify" on public.activity_project_details
  for all to authenticated using (private.can_manage_activity(activity_id)) with check (private.can_manage_activity(activity_id));

create policy "activity_areas_of_focus_select" on public.activity_areas_of_focus
  for select to authenticated using (private.can_view_activity(activity_id));
create policy "activity_areas_of_focus_modify" on public.activity_areas_of_focus
  for all to authenticated using (private.can_manage_activity(activity_id)) with check (private.can_manage_activity(activity_id));

create policy "activity_sdgs_select" on public.activity_sdgs
  for select to authenticated using (private.can_view_activity(activity_id));
create policy "activity_sdgs_modify" on public.activity_sdgs
  for all to authenticated using (private.can_manage_activity(activity_id)) with check (private.can_manage_activity(activity_id));

create policy "activity_partners_select" on public.activity_partners
  for select to authenticated using (private.can_view_activity(activity_id));
create policy "activity_partners_modify" on public.activity_partners
  for all to authenticated using (private.can_manage_activity(activity_id)) with check (private.can_manage_activity(activity_id));

create policy "activity_contacts_select" on public.activity_contacts
  for select to authenticated using (private.can_view_activity(activity_id));
create policy "activity_contacts_modify" on public.activity_contacts
  for all to authenticated using (private.can_manage_activity(activity_id)) with check (private.can_manage_activity(activity_id));

create policy "activity_team_select" on public.activity_team
  for select to authenticated using (private.can_view_activity(activity_id));
create policy "activity_team_modify" on public.activity_team
  for all to authenticated using (private.can_manage_activity(activity_id)) with check (private.can_manage_activity(activity_id));

create policy "activity_media_select" on public.activity_media
  for select to authenticated using (private.can_view_activity(activity_id));
create policy "activity_media_modify" on public.activity_media
  for all to authenticated using (private.can_manage_activity(activity_id)) with check (private.can_manage_activity(activity_id));

-- Members manage their own RSVP
create policy "activity_rsvps_select" on public.activity_rsvps
  for select to authenticated using (private.can_view_activity(activity_id));
create policy "activity_rsvps_own" on public.activity_rsvps
  for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()) and private.can_view_activity(activity_id));

-- Comments: participants post; authors edit; authors or managers delete
create policy "activity_comments_select" on public.activity_comments
  for select to authenticated using (private.can_view_activity(activity_id));
create policy "activity_comments_insert" on public.activity_comments
  for insert to authenticated
  with check (author_id = (select auth.uid()) and private.can_view_activity(activity_id));
create policy "activity_comments_update" on public.activity_comments
  for update to authenticated
  using (author_id = (select auth.uid()) or private.can_manage_activity(activity_id))
  with check (author_id = (select auth.uid()) or private.can_manage_activity(activity_id));

create policy "activity_comment_reactions_select" on public.activity_comment_reactions
  for select to authenticated
  using (exists (
    select 1 from public.activity_comments c
    where c.id = comment_id and private.can_view_activity(c.activity_id)
  ));
create policy "activity_comment_reactions_own" on public.activity_comment_reactions
  for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (
    profile_id = (select auth.uid())
    and exists (
      select 1 from public.activity_comments c
      where c.id = comment_id and private.can_view_activity(c.activity_id)
    )
  );

create policy "activity_followers_own" on public.activity_followers
  for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()) and private.can_view_activity(activity_id));

create policy "activity_log_select" on public.activity_log
  for select to authenticated using (private.can_view_activity(activity_id));

-- Attendance rows linked to activities are visible to participants of that club
create policy "attendance_records_activity_select" on public.attendance_records
  for select to authenticated
  using (activity_id is not null and private.can_view_activity(activity_id));

-- ------------------------------------------------------------------------------
-- 7. Private storage bucket for activity photos (served through signed URLs)
-- ------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('activity-media', 'activity-media', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;
