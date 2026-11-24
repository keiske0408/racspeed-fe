-- Additive notification delivery, Telegram account linking, and club templates.

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check check (
    type in (
      'INVOICE_REMINDER', 'PAYMENT_STATUS', 'BUDGET_ACTION', 'REPORT_REVIEW',
      'ATTENDANCE_ALERT', 'GENERAL', 'ACTIVITY_REMINDER', 'RSVP_REMINDER',
      'MIN_MEMBERS_ALERT', 'MENTION', 'COMMENT', 'RETENTION_NUDGE',
      'REPORT_DUE', 'BADGE_EARNED', 'MEMBERSHIP_UPDATE', 'PUBLIC_ANNOUNCEMENT'
    )
  );

alter table public.notification_preferences
  add column if not exists telegram_enabled boolean not null default false,
  add column if not exists telegram_membership_updates boolean not null default true,
  add column if not exists telegram_activity_updates boolean not null default true,
  add column if not exists telegram_treasury_updates boolean not null default false,
  add column if not exists telegram_reporting_updates boolean not null default true,
  add column if not exists telegram_admin_updates boolean not null default true,
  add column if not exists telegram_frequency text not null default 'IMMEDIATE'
    check (telegram_frequency in ('IMMEDIATE', 'DAILY_DIGEST'));

create table if not exists public.telegram_connections (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  chat_id text not null unique check (chat_id ~ '^-?[0-9]+$'),
  username text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.telegram_link_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists telegram_link_tokens_profile_expiry_idx
  on public.telegram_link_tokens (profile_id, expires_at desc)
  where consumed_at is null;

create table if not exists public.telegram_group_link_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists telegram_group_link_tokens_expiry_idx
  on public.telegram_group_link_tokens (expires_at)
  where consumed_at is null;

create table if not exists public.telegram_group_destinations (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  chat_id text not null unique check (chat_id ~ '^-?[0-9]+$'),
  title text not null check (length(title) between 1 and 80),
  enabled boolean not null default true,
  linked_by uuid not null references public.profiles(id) on delete restrict,
  linked_at timestamptz not null default now()
);

create index if not exists telegram_group_destinations_club_enabled_idx
  on public.telegram_group_destinations (club_id, enabled);

create table if not exists public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  type text not null,
  title_template text not null check (length(title_template) between 1 and 120),
  message_template text not null check (length(message_template) between 1 and 2000),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (club_id, type),
  check (type in (
    'INVOICE_REMINDER', 'PAYMENT_STATUS', 'BUDGET_ACTION', 'REPORT_REVIEW',
    'ATTENDANCE_ALERT', 'GENERAL', 'ACTIVITY_REMINDER', 'RSVP_REMINDER',
    'MIN_MEMBERS_ALERT', 'MENTION', 'COMMENT', 'RETENTION_NUDGE',
    'REPORT_DUE', 'BADGE_EARNED', 'MEMBERSHIP_UPDATE', 'PUBLIC_ANNOUNCEMENT'
  ))
);

create table if not exists public.telegram_webhook_updates (
  update_id bigint primary key,
  received_at timestamptz not null default now()
);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('EMAIL', 'WEB_PUSH', 'TELEGRAM')),
  target_type text not null check (
    target_type in ('PROFILE', 'PUSH_SUBSCRIPTION', 'TELEGRAM_GROUP')
  ),
  target_id text not null,
  delivery_mode text not null default 'IMMEDIATE'
    check (delivery_mode in ('IMMEDIATE', 'DAILY_DIGEST')),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'SKIPPED')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  locked_until timestamptz,
  provider_message_id text,
  error_code text,
  error_details text check (error_details is null or length(error_details) <= 1000),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (notification_id, provider, target_type, target_id),
  check (
    (target_type = 'TELEGRAM_GROUP' and provider = 'TELEGRAM')
    or (target_type = 'PUSH_SUBSCRIPTION' and provider = 'WEB_PUSH')
    or (target_type = 'PROFILE' and provider in ('EMAIL', 'TELEGRAM'))
  )
);

create index if not exists notification_deliveries_due_idx
  on public.notification_deliveries (next_attempt_at, created_at)
  where status in ('PENDING', 'PROCESSING');

create index if not exists notification_deliveries_profile_idx
  on public.notification_deliveries (profile_id, created_at desc)
  where profile_id is not null;

alter table public.telegram_connections enable row level security;
alter table public.telegram_link_tokens enable row level security;
alter table public.telegram_group_link_tokens enable row level security;
alter table public.telegram_group_destinations enable row level security;
alter table public.notification_templates enable row level security;
alter table public.telegram_webhook_updates enable row level security;
alter table public.notification_deliveries enable row level security;

revoke all on public.telegram_connections from anon, authenticated;
revoke all on public.telegram_link_tokens from anon, authenticated;
revoke all on public.telegram_group_link_tokens from anon, authenticated;
revoke all on public.telegram_group_destinations from anon, authenticated;
revoke all on public.notification_templates from anon, authenticated;
revoke all on public.telegram_webhook_updates from anon, authenticated;
revoke all on public.notification_deliveries from anon, authenticated;

grant all on public.telegram_connections to service_role;
grant all on public.telegram_link_tokens to service_role;
grant all on public.telegram_group_link_tokens to service_role;
grant all on public.telegram_group_destinations to service_role;
grant all on public.notification_templates to service_role;
grant all on public.telegram_webhook_updates to service_role;
grant all on public.notification_deliveries to service_role;

create or replace function public.consume_telegram_link_token(
  p_token_hash text,
  p_chat_id text,
  p_username text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  link_token public.telegram_link_tokens%rowtype;
begin
  select * into link_token
  from public.telegram_link_tokens
  where token_hash = p_token_hash
    and consumed_at is null
    and expires_at > now()
  for update;

  if not found then
    return null;
  end if;

  begin
    insert into public.telegram_connections (profile_id, chat_id, username, updated_at)
    values (link_token.profile_id, p_chat_id, p_username, now())
    on conflict (profile_id) do update
      set chat_id = excluded.chat_id,
          username = excluded.username,
          updated_at = now();

    insert into public.notification_preferences (profile_id, telegram_enabled)
    values (link_token.profile_id, true)
    on conflict (profile_id) do update
      set telegram_enabled = true,
          updated_at = now();

    update public.telegram_link_tokens
    set consumed_at = now()
    where id = link_token.id;
  exception when unique_violation then
    return null;
  end;

  return link_token.profile_id;
end;
$$;

create or replace function public.consume_telegram_group_link_token(
  p_token_hash text,
  p_chat_id text,
  p_title text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  link_token public.telegram_group_link_tokens%rowtype;
  destination_id uuid;
begin
  select * into link_token
  from public.telegram_group_link_tokens
  where token_hash = p_token_hash
    and consumed_at is null
    and expires_at > now()
  for update;

  if not found then
    return null;
  end if;

  begin
    insert into public.telegram_group_destinations
      (club_id, chat_id, title, linked_by)
    values
      (link_token.club_id, p_chat_id, left(p_title, 80), link_token.profile_id)
    returning id into destination_id;

    update public.telegram_group_link_tokens
    set consumed_at = now()
    where id = link_token.id;
  exception when unique_violation then
    return null;
  end;

  return destination_id;
end;
$$;

revoke all on function public.consume_telegram_link_token(text, text, text)
  from public, anon, authenticated;
revoke all on function public.consume_telegram_group_link_token(text, text, text)
  from public, anon, authenticated;
grant execute on function public.consume_telegram_link_token(text, text, text)
  to service_role;
grant execute on function public.consume_telegram_group_link_token(text, text, text)
  to service_role;

create or replace function public.claim_notification_deliveries(batch_size integer default 50)
returns setof public.notification_deliveries
language sql
security invoker
set search_path = ''
as $$
  with due as (
    select id
    from public.notification_deliveries
    where
      (status = 'PENDING' and next_attempt_at <= now())
      or (status = 'PROCESSING' and locked_until < now())
    order by next_attempt_at, created_at
    limit greatest(1, least(coalesce(batch_size, 50), 200))
    for update skip locked
  )
  update public.notification_deliveries as delivery
  set
    status = 'PROCESSING',
    attempt_count = delivery.attempt_count + 1,
    locked_until = now() + interval '2 minutes',
    updated_at = now()
  from due
  where delivery.id = due.id
  returning delivery.*;
$$;

revoke all on function public.claim_notification_deliveries(integer)
  from public, anon, authenticated;
grant execute on function public.claim_notification_deliveries(integer)
  to service_role;