-- Add first-class priority support to Project Center activities & projects.

alter table public.activities
  add column if not exists priority text not null default 'MEDIUM'
  check (priority in ('LOW', 'MEDIUM', 'HIGH', 'URGENT'));

create index if not exists activities_club_priority_idx
  on public.activities (club_id, priority, start_at);

comment on column public.activities.priority is
  'Urgency/priority level of the project or club activity (LOW, MEDIUM, HIGH, URGENT).';

