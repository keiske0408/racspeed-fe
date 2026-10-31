-- ==============================================================================
-- 0010_activity_sister_clubs.sql
-- Link Project Center joint projects directly to registered sister clubs.
-- ==============================================================================

alter table public.activity_partners
  add column if not exists sister_club_id uuid references public.sister_clubs(id) on delete set null;

create index if not exists activity_partners_sister_club_idx
  on public.activity_partners (sister_club_id)
  where sister_club_id is not null;

create unique index if not exists activity_partners_activity_sister_club_key
  on public.activity_partners (activity_id, sister_club_id)
  where sister_club_id is not null;
