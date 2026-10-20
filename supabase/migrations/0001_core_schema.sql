-- ==============================================================================
-- 0001_core_schema.sql
-- Rotaract Club Operations Platform — Core Entities, Scopes & Authorization
-- ==============================================================================

-- Create private schema for non-exposed security helpers
create schema if not exists private;

-- 1. Clubs
create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  club_id_number text unique,
  district_code text not null default '3820',
  sponsor_rotary_club text,
  charter_date date,
  logo_url text,
  timezone text not null default 'Asia/Manila',
  currency text not null default 'PHP',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Profiles (Extends auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  avatar_url text,
  is_platform_admin boolean not null default false,
  status text not null default 'PENDING' check (status in ('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Club Memberships
create table if not exists public.club_memberships (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  rotary_id text,
  membership_status text not null default 'ACTIVE' check (membership_status in ('ACTIVE', 'ALUMNI', 'HONORARY', 'LEAVE_OF_ABSENCE', 'TERMINATED')),
  joined_date date default current_date,
  classification text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, profile_id)
);

-- 4. Roles & Permissions
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  is_system boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  category text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

-- 5. Membership Roles (Maps a member in a club to roles)
create table if not exists public.membership_roles (
  membership_id uuid not null references public.club_memberships(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  primary key (membership_id, role_id)
);

-- 6. Member Private Details (Restricted health & personal data under PH DPA)
create table if not exists public.member_private_details (
  membership_id uuid primary key references public.club_memberships(id) on delete cascade,
  birthdate date,
  contact_number text,
  emergency_contact_name text,
  emergency_contact_phone text,
  shirt_size text,
  blood_type text, -- Optional, collected only with explicit consent
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 7. Member Consents
create table if not exists public.member_consents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  consent_type text not null, -- e.g. DATA_PRIVACY_TERMS, BLOOD_TYPE_COLLECTION, PHOTO_RELEASE
  consented boolean not null default true,
  consented_at timestamptz not null default now(),
  ip_address text,
  unique (profile_id, consent_type)
);

-- 8. App Settings (Per-club configurations)
create table if not exists public.app_settings (
  club_id uuid primary key references public.clubs(id) on delete cascade,
  current_rotary_year text not null default '2026-27',
  require_registration_approval boolean not null default true,
  allow_budget_self_approval boolean not null default false,
  budget_approval_policy text not null default 'PRESIDENT_AND_TREASURER' check (budget_approval_policy in ('PRESIDENT_AND_TREASURER', 'PRESIDENT_ONLY', 'TREASURER_ONLY', 'EITHER')),
  retention_consecutive_gas_threshold int not null default 3,
  retention_service_days_threshold int not null default 60,
  updated_at timestamptz not null default now()
);

-- 9. Audit Logs
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  club_id uuid references public.clubs(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  details jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

-- ==============================================================================
-- AUTHORIZATION & SECURITY DEFINER HELPERS
-- ==============================================================================

create or replace function private.is_platform_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and is_platform_admin = true
      and status = 'ACTIVE'
  );
$$;

create or replace function private.is_active_member(lookup_club_id uuid)
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
      and cm.membership_status = 'ACTIVE'
      and p.status = 'ACTIVE'
  );
$$;

create or replace function private.has_permission(lookup_club_id uuid, perm_key text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select private.is_platform_admin() or exists (
    select 1 from public.club_memberships cm
    join public.membership_roles mr on mr.membership_id = cm.id
    join public.role_permissions rp on rp.role_id = mr.role_id
    join public.permissions perm on perm.id = rp.permission_id
    where cm.club_id = lookup_club_id
      and cm.profile_id = (select auth.uid())
      and cm.membership_status = 'ACTIVE'
      and perm.key = perm_key
  );
$$;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

alter table public.clubs enable row level security;
alter table public.profiles enable row level security;
alter table public.club_memberships enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.membership_roles enable row level security;
alter table public.member_private_details enable row level security;
alter table public.member_consents enable row level security;
alter table public.app_settings enable row level security;
alter table public.audit_logs enable row level security;

-- Clubs policies
create policy "clubs_select_policy" on public.clubs
  for select to authenticated
  using (true); -- Authenticated users can view clubs list for joint activities

create policy "clubs_admin_all" on public.clubs
  for all to authenticated
  using (private.is_platform_admin())
  with check (private.is_platform_admin());

-- Profiles policies
create policy "profiles_select_self_or_member" on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or private.is_platform_admin()
    or exists (
      select 1 from public.club_memberships cm1
      join public.club_memberships cm2 on cm1.club_id = cm2.club_id
      where cm1.profile_id = (select auth.uid())
        and cm2.profile_id = public.profiles.id
        and cm1.membership_status = 'ACTIVE'
    )
  );

create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and is_platform_admin = false);

create policy "profiles_admin_update" on public.profiles
  for update to authenticated
  using (private.is_platform_admin())
  with check (private.is_platform_admin());

-- Member Private Details policies
create policy "private_details_select" on public.member_private_details
  for select to authenticated
  using (
    exists (
      select 1 from public.club_memberships cm
      where cm.id = public.member_private_details.membership_id
        and (cm.profile_id = (select auth.uid()) or private.has_permission(cm.club_id, 'MEMBER_SENSITIVE_VIEW'))
    )
  );

create policy "private_details_modify" on public.member_private_details
  for all to authenticated
  using (
    exists (
      select 1 from public.club_memberships cm
      where cm.id = public.member_private_details.membership_id
        and (cm.profile_id = (select auth.uid()) or private.has_permission(cm.club_id, 'MEMBER_UPDATE'))
    )
  )
  with check (
    exists (
      select 1 from public.club_memberships cm
      where cm.id = public.member_private_details.membership_id
        and (cm.profile_id = (select auth.uid()) or private.has_permission(cm.club_id, 'MEMBER_UPDATE'))
    )
  );

-- Club Memberships policies
create policy "memberships_select" on public.club_memberships
  for select to authenticated
  using (
    profile_id = (select auth.uid())
    or private.is_active_member(club_id)
    or private.is_platform_admin()
  );

create policy "memberships_manage" on public.club_memberships
  for all to authenticated
  using (private.has_permission(club_id, 'MEMBER_UPDATE') or private.has_permission(club_id, 'MEMBER_CREATE'))
  with check (private.has_permission(club_id, 'MEMBER_UPDATE') or private.has_permission(club_id, 'MEMBER_CREATE'));

-- Audit Logs policies
create policy "audit_logs_select" on public.audit_logs
  for select to authenticated
  using (
    private.is_platform_admin()
    or (club_id is not null and private.has_permission(club_id, 'AUDIT_LOG_VIEW'))
  );

-- App Settings policies
create policy "app_settings_select" on public.app_settings
  for select to authenticated
  using (private.is_active_member(club_id) or private.is_platform_admin());

create policy "app_settings_update" on public.app_settings
  for update to authenticated
  using (private.has_permission(club_id, 'SETTINGS_MANAGE'))
  with check (private.has_permission(club_id, 'SETTINGS_MANAGE'));
