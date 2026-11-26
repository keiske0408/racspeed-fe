-- Allow each member to opt in/out of receiving Telegram copies for their own actions
alter table public.notification_preferences
  add column if not exists telegram_self_actions boolean not null default false;

