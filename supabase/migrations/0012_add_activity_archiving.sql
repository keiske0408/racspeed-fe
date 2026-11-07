-- ==============================================================================
-- 0012_add_activity_archiving.sql
-- Adds non-destructive soft-archiving support to activities (Project Center)
-- so old projects and activities can be archived and restored cleanly while
-- preserving lifecycle status, attendance records, tasks, and reports.
-- ==============================================================================

alter table public.activities
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id) on delete set null;

create index if not exists activities_club_archived_idx
  on public.activities (club_id, is_archived, start_at desc);

comment on column public.activities.is_archived is
  'True when the project or activity has been archived from the active Project Center workspace.';
comment on column public.activities.archived_at is
  'Timestamp when the activity was moved to the archive.';
comment on column public.activities.archived_by is
  'Profile ID of the officer or project owner who archived the activity.';

