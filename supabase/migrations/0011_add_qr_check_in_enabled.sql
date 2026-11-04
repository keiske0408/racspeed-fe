-- ==============================================================================
-- 0011_add_qr_check_in_enabled.sql
-- Allow activities and events to toggle QR attendance check-in on or off.
-- For promotional campaigns, recruitment drives, and asynchronous initiatives,
-- QR check-in can be disabled to avoid unnecessary roster and scanner prompts.
-- ==============================================================================

alter table public.activities
  add column if not exists qr_check_in_enabled boolean not null default true;

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'events') then
    alter table public.events add column if not exists qr_check_in_enabled boolean not null default true;
  end if;
end $$;

