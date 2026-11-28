-- Add structured recurring & multi-session schedule support to activities
-- Nullable JSONB keeps existing single-event rows unaffected and backward compatible.
alter table public.activities
  add column if not exists recurrence jsonb default null;

comment on column public.activities.recurrence is
  'Optional recurring / multi-session schedule config: { frequency, until?, dates?, sessionEndTime? }';

