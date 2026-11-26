-- Add configurable Notification & Deadline SLA settings on app_settings
-- and expand notification types for task assignment, task updates, and task/project deadlines.

alter table public.app_settings
  add column if not exists notification_sla_config jsonb not null default
    '{"taskDueSoonHours":48,"taskOverdueReminderEnabled":true,"projectNearbyHours":48,"projectDeadlineHours":24,"draftReadinessDays":7,"reportDueSlaDays":7,"notifyOnTaskAssigned":true,"notifyOnTaskMarked":true}'::jsonb;

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check check (
    type in (
      'INVOICE_REMINDER', 'PAYMENT_STATUS', 'BUDGET_ACTION', 'REPORT_REVIEW',
      'ATTENDANCE_ALERT', 'GENERAL', 'ACTIVITY_REMINDER', 'RSVP_REMINDER',
      'MIN_MEMBERS_ALERT', 'MENTION', 'COMMENT', 'RETENTION_NUDGE',
      'REPORT_DUE', 'BADGE_EARNED', 'MEMBERSHIP_UPDATE', 'PUBLIC_ANNOUNCEMENT',
      'TASK_ASSIGNED', 'TASK_UPDATED', 'TASK_DEADLINE', 'PROJECT_DEADLINE'
    )
  );

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.notification_templates'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%type%'
  loop
    execute format('alter table public.notification_templates drop constraint if exists %I', constraint_name);
  end loop;
end $$;

alter table public.notification_templates
  add constraint notification_templates_type_check check (
    type in (
      'INVOICE_REMINDER', 'PAYMENT_STATUS', 'BUDGET_ACTION', 'REPORT_REVIEW',
      'ATTENDANCE_ALERT', 'GENERAL', 'ACTIVITY_REMINDER', 'RSVP_REMINDER',
      'MIN_MEMBERS_ALERT', 'MENTION', 'COMMENT', 'RETENTION_NUDGE',
      'REPORT_DUE', 'BADGE_EARNED', 'MEMBERSHIP_UPDATE', 'PUBLIC_ANNOUNCEMENT',
      'TASK_ASSIGNED', 'TASK_UPDATED', 'TASK_DEADLINE', 'PROJECT_DEADLINE'
    )
  );

