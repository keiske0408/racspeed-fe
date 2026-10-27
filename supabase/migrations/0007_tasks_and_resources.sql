-- ==============================================================================
-- 0007_tasks_and_resources.sql
-- Module: Committee Tasks & Club Resource Hub
-- ==============================================================================

create table if not exists public.tasks (
  id text primary key,
  club_id uuid not null references public.clubs(id) on delete cascade,
  title text not null,
  description text default '',
  committee text not null check (
    committee in (
      'CLUB_SERVICE',
      'COMMUNITY_SERVICE',
      'VOCATIONAL',
      'INTERNATIONAL',
      'PUBLIC_IMAGE',
      'FINANCE',
      'SECRETARIAT',
      'BOARD'
    )
  ),
  status text not null default 'TODO' check (
    status in ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED')
  ),
  priority text not null default 'MEDIUM' check (
    priority in ('LOW', 'MEDIUM', 'HIGH', 'URGENT')
  ),
  due_date date not null,
  assigned_member_ids jsonb not null default '[]'::jsonb,
  assigned_member_names jsonb not null default '[]'::jsonb,
  checklist jsonb not null default '[]'::jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.resources (
  id text primary key,
  club_id uuid not null references public.clubs(id) on delete cascade,
  title text not null,
  description text default '',
  url text not null,
  category text not null check (
    category in ('SOCIAL_MEDIA', 'DISTRICT_PORTAL', 'DESIGN_BRAND', 'DRIVE_DOCUMENTS')
  ),
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS
alter table public.tasks enable row level security;
alter table public.resources enable row level security;

-- Tasks Policies
create policy "tasks_select" on public.tasks
  for select using (private.is_active_member(club_id) or private.is_platform_admin());

create policy "tasks_insert" on public.tasks
  for insert with check (private.is_active_member(club_id) or private.is_platform_admin());

create policy "tasks_update" on public.tasks
  for update using (private.is_active_member(club_id) or private.is_platform_admin());

create policy "tasks_delete" on public.tasks
  for delete using (private.has_permission(club_id, 'SETTINGS_MANAGE') or private.is_platform_admin());

-- Resources Policies
create policy "resources_select" on public.resources
  for select using (private.is_active_member(club_id) or private.is_platform_admin());

create policy "resources_insert" on public.resources
  for insert with check (private.has_permission(club_id, 'SETTINGS_MANAGE') or private.is_platform_admin());

create policy "resources_update" on public.resources
  for update using (private.has_permission(club_id, 'SETTINGS_MANAGE') or private.is_platform_admin());

create policy "resources_delete" on public.resources
  for delete using (private.has_permission(club_id, 'SETTINGS_MANAGE') or private.is_platform_admin());
