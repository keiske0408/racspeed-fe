-- ==============================================================================
-- 0009_engagement_and_notifications.sql
-- Rewards ledger, badges, web push subscriptions and notification de-duplication.
-- ==============================================================================

-- 1. Notifications: new types + idempotency key
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (
  type in (
    'INVOICE_REMINDER', 'PAYMENT_STATUS', 'BUDGET_ACTION', 'REPORT_REVIEW', 'ATTENDANCE_ALERT', 'GENERAL',
    'ACTIVITY_REMINDER', 'RSVP_REMINDER', 'MIN_MEMBERS_ALERT', 'MENTION', 'COMMENT',
    'RETENTION_NUDGE', 'REPORT_DUE', 'BADGE_EARNED', 'MEMBERSHIP_UPDATE'
  )
);
alter table public.notifications add column if not exists dedupe_key text unique;
alter table public.notifications add column if not exists club_id uuid references public.clubs(id) on delete cascade;
create index if not exists notifications_profile_unread_idx on public.notifications (profile_id, is_read, created_at desc);

alter table public.notification_preferences add column if not exists push_enabled boolean not null default true;
alter table public.notification_preferences add column if not exists email_retention_nudges boolean not null default true;
alter table public.notification_preferences add column if not exists email_activity_updates boolean not null default true;
alter table public.notification_preferences add column if not exists email_mentions boolean not null default true;

-- 2. Web push subscriptions
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create table if not exists public.push_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  notification_id uuid references public.notifications(id) on delete set null,
  endpoint_hash text not null,
  status text not null check (status in ('SENT', 'FAILED', 'SKIPPED')),
  provider_status_code int,
  error_details text,
  created_at timestamptz not null default now()
);

-- 3. Engagement points ledger (one award per member per source)
create table if not exists public.engagement_points_ledger (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  source_type text not null check (
    source_type in ('CHECK_IN', 'SERVICE_CHECK_IN', 'RSVP_HONORED', 'NO_SHOW', 'TASK_COMPLETED', 'BADGE_BONUS', 'MANUAL_ADJUSTMENT')
  ),
  source_id text not null,
  points int not null,
  reason text,
  rotary_year text not null,
  created_at timestamptz not null default now(),
  unique (profile_id, source_type, source_id)
);

create index if not exists engagement_points_club_year_idx on public.engagement_points_ledger (club_id, rotary_year, profile_id);

create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text not null,
  icon text not null default 'award',
  criteria jsonb not null default '{}'::jsonb,
  sort_order int not null default 0
);

create table if not exists public.member_badges (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  badge_id uuid not null references public.badges(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  awarded_at timestamptz not null default now(),
  primary key (profile_id, badge_id)
);

insert into public.badges (key, name, description, icon, criteria, sort_order) values
  ('FIRST_CHECK_IN', 'First Step', 'Checked in to your first club activity', 'footprints', '{"checkIns": 1}', 1),
  ('FIRST_SERVICE', 'Servant Leader', 'Attended your first service project', 'heart-handshake', '{"serviceCheckIns": 1}', 2),
  ('SERVICE_10', 'Service Above Self', 'Attended 10 service projects', 'medal', '{"serviceCheckIns": 10}', 3),
  ('GA_STREAK_3', 'Regular', 'Attended 3 General Assemblies in a row', 'flame', '{"gaStreak": 3}', 4),
  ('GA_STREAK_6', 'Pillar of the Club', 'Attended 6 General Assemblies in a row', 'trophy', '{"gaStreak": 6}', 5),
  ('TASK_FINISHER', 'Finisher', 'Completed 10 tasks', 'check-check', '{"tasksCompleted": 10}', 6)
on conflict (key) do nothing;

alter table public.app_settings add column if not exists engagement_points_config jsonb not null default
  '{"CHECK_IN": 10, "SERVICE_CHECK_IN": 20, "RSVP_HONORED": 2, "TASK_COMPLETED": 5, "NO_SHOW": -3}'::jsonb;

-- 4. RLS
alter table public.push_subscriptions enable row level security;
alter table public.push_delivery_logs enable row level security;
alter table public.engagement_points_ledger enable row level security;
alter table public.badges enable row level security;
alter table public.member_badges enable row level security;

drop policy if exists "push_subscriptions_own" on public.push_subscriptions;
drop policy if exists "push_delivery_logs_own" on public.push_delivery_logs;
drop policy if exists "engagement_points_select" on public.engagement_points_ledger;
drop policy if exists "badges_read" on public.badges;
drop policy if exists "member_badges_select" on public.member_badges;

create policy "push_subscriptions_own" on public.push_subscriptions
  for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create policy "push_delivery_logs_own" on public.push_delivery_logs
  for select to authenticated
  using (profile_id = (select auth.uid()));

-- Leaderboard is visible to club participants; writes go through the service role only
create policy "engagement_points_select" on public.engagement_points_ledger
  for select to authenticated
  using (private.is_platform_admin() or private.is_club_participant(club_id));

create policy "badges_read" on public.badges
  for select to authenticated using (true);

create policy "member_badges_select" on public.member_badges
  for select to authenticated
  using (private.is_platform_admin() or private.is_club_participant(club_id));
