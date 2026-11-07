-- ==============================================================================
-- 0013_project_committee_and_notifications.sql
-- Optimizations and constraints for Project Committee members,
-- project notification subscriptions, and discussion reactions.
-- ==============================================================================

-- 1. Ensure activity_team has indexes for fast committee member and project lookups
create index if not exists activity_team_activity_profile_idx
  on public.activity_team (activity_id, profile_id);

create index if not exists activity_team_profile_idx
  on public.activity_team (profile_id, team_role);

-- 2. Ensure activity_followers has index for fast project subscriber lookups
create index if not exists activity_followers_activity_idx
  on public.activity_followers (activity_id, profile_id);

-- 3. Ensure notifications table has an index on profile_id and created_at
create index if not exists notifications_profile_created_idx
  on public.notifications (profile_id, created_at desc);

-- 4. Comments for clarity
comment on table public.activity_team is
  'Roster of appointed project committee members, chairs, co-chairs, and volunteers for an activity.';
comment on table public.activity_comment_reactions is
  'Emoji reactions left on project discussion group comments with notifications sent to authors.';
