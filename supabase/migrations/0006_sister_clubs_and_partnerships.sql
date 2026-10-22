-- ==============================================================================
-- 0006_sister_clubs_and_partnerships.sql
-- Module: Sister Clubs, Twinning Agreements & Cross-District Partnerships
-- ==============================================================================

create table if not exists public.sister_clubs (
  id uuid primary key default gen_random_uuid(),
  home_club_id uuid not null references public.clubs(id) on delete cascade,
  partner_club_name text not null,
  district text not null default '3820',
  country text not null default 'Philippines',
  partnership_type text not null default 'SISTER_CLUB_MOA' check (
    partnership_type in ('SISTER_CLUB_MOA', 'DISTRICT_TWIN_CLUB', 'PROJECT_PARTNER', 'SPONSOR_ROTARY_CLUB')
  ),
  agreement_signed_date date,
  renewal_date date,
  liaison_officer_name text,
  liaison_email text,
  liaison_phone text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'PENDING_MOA', 'INACTIVE', 'ARCHIVED')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.partnership_initiatives (
  id uuid primary key default gen_random_uuid(),
  sister_club_id uuid not null references public.sister_clubs(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  description text,
  rotary_year text not null default '2026-27',
  joint_volunteer_count integer not null default 0,
  shared_funding_centavos bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS
alter table public.sister_clubs enable row level security;
alter table public.partnership_initiatives enable row level security;

create policy "sister_clubs_select" on public.sister_clubs
  for select using (private.is_active_member(home_club_id) or private.is_platform_admin());

create policy "sister_clubs_insert" on public.sister_clubs
  for insert with check (private.has_permission(home_club_id, 'SETTINGS_MANAGE') or private.is_platform_admin());

create policy "sister_clubs_update" on public.sister_clubs
  for update using (private.has_permission(home_club_id, 'SETTINGS_MANAGE') or private.is_platform_admin());

create policy "partnership_initiatives_select" on public.partnership_initiatives
  for select using (true);

create policy "partnership_initiatives_insert" on public.partnership_initiatives
  for insert with check (true);
