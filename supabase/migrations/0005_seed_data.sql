-- ==============================================================================
-- 0005_seed_data.sql
-- Seed Official Rotary Reference Data, Roles, Permissions, and Default Club
-- ==============================================================================

-- 1. Official 7 Rotary Areas of Focus
insert into public.areas_of_focus (code, name, description, sort_order) values
  ('PEACEBUILDING', 'Peacebuilding and Conflict Prevention', 'Carrying out service projects that foster peace and conflict resolution in communities.', 1),
  ('DISEASE_PREVENTION', 'Disease Prevention and Treatment', 'Improving health, educating communities, and combating life-threatening diseases.', 2),
  ('WATER_SANITATION', 'Water, Sanitation, and Hygiene', 'Providing clean water and sanitation to sustain healthy, thriving communities.', 3),
  ('MATERNAL_CHILD_HEALTH', 'Maternal and Child Health', 'Ensuring mothers and children receive proper care, nutrition, and healthcare access.', 4),
  ('BASIC_EDUCATION', 'Basic Education and Literacy', 'Empowering communities through reading, writing, schooling, and adult literacy.', 5),
  ('ECONOMIC_DEVELOPMENT', 'Community Economic Development', 'Strengthening local entrepreneurship, skills training, and poverty reduction.', 6),
  ('ENVIRONMENT', 'Environment', 'Protecting our planet through conservation, tree planting, cleanups, and sustainability.', 7)
on conflict (code) do update set name = excluded.name, description = excluded.description;

-- 2. UN Sustainable Development Goals (1-17)
insert into public.sdgs (number, name, description, color_hex) values
  (1, 'No Poverty', 'End poverty in all its forms everywhere.', '#E5243B'),
  (2, 'Zero Hunger', 'End hunger, achieve food security and improved nutrition.', '#DDA63A'),
  (3, 'Good Health and Well-being', 'Ensure healthy lives and promote well-being for all at all ages.', '#4C9F38'),
  (4, 'Quality Education', 'Ensure inclusive and equitable quality education and promote lifelong learning.', '#C5192D'),
  (5, 'Gender Equality', 'Achieve gender equality and empower all women and girls.', '#FF3A21'),
  (6, 'Clean Water and Sanitation', 'Ensure availability and sustainable management of water and sanitation.', '#26BDE2'),
  (7, 'Affordable and Clean Energy', 'Ensure access to affordable, reliable, sustainable and modern energy.', '#FCC30B'),
  (8, 'Decent Work and Economic Growth', 'Promote sustained, inclusive and sustainable economic growth.', '#A21942'),
  (9, 'Industry, Innovation and Infrastructure', 'Build resilient infrastructure and foster innovation.', '#FD6925'),
  (10, 'Reduced Inequalities', 'Reduce inequality within and among countries.', '#DD1367'),
  (11, 'Sustainable Cities and Communities', 'Make cities and human settlements inclusive, safe, resilient.', '#FD9D24'),
  (12, 'Responsible Consumption and Production', 'Ensure sustainable consumption and production patterns.', '#BF8B2E'),
  (13, 'Climate Action', 'Take urgent action to combat climate change and its impacts.', '#3F7E44'),
  (14, 'Life Below Water', 'Conserve and sustainably use the oceans, seas and marine resources.', '#0A97D9'),
  (15, 'Life on Land', 'Protect, restore and promote sustainable use of terrestrial ecosystems.', '#56C02B'),
  (16, 'Peace, Justice and Strong Institutions', 'Promote peaceful and inclusive societies for sustainable development.', '#00689D'),
  (17, 'Partnerships for the Goals', 'Strengthen global partnerships for sustainable development.', '#19486A')
on conflict (number) do update set name = excluded.name, color_hex = excluded.color_hex;

-- 3. Service Categories
insert into public.service_categories (code, name, description) values
  ('CLUB_SERVICE', 'Club Service', 'Actions to strengthen fellowship and ensure the effective functioning of the club.'),
  ('COMMUNITY_SERVICE', 'Community Service', 'Projects and activities that improve life in the local community.'),
  ('INTERNATIONAL_SERVICE', 'International Service', 'Activities to expand Rotaract global reach and promote world understanding.'),
  ('PROFESSIONAL_DEVELOPMENT', 'Professional Development', 'Workshops and mentorship to build vocational leadership.'),
  ('YOUTH_SERVICE', 'Youth Service', 'Engaging youth through Interact, leadership awards, and student mentoring.'),
  ('FELLOWSHIP', 'Fellowship & Socials', 'Social bonds, team building, and member bonding gatherings.')
on conflict (code) do update set name = excluded.name;

-- 4. Seed Roles
insert into public.roles (key, name, description) values
  ('PRESIDENT', 'Club President', 'Chief executive officer of the club with strategic oversight.'),
  ('VICE_PRESIDENT', 'Vice President', 'Executive officer supporting the President and committee operations.'),
  ('SECRETARY', 'Secretary', 'Keeper of club records, meeting minutes, attendance, and district reporting.'),
  ('TREASURER', 'Treasurer', 'Custodian of club funds, dues collections, budget disbursements, and liquidation reviews.'),
  ('PROJECT_CHAIR', 'Project Chair', 'Officer leading specific service initiatives and accomplishment reporting.'),
  ('MEMBERSHIP_CHAIR', 'Membership Chair', 'Leader of recruitment pipelines, prospect onboarding, and member retention.'),
  ('BOARD_OFFICER', 'Board Officer', 'Member of the Club Board of Directors.'),
  ('GENERAL_MEMBER', 'General Member', 'Active Rotaractor with participation and voting privileges.'),
  ('AUDITOR', 'Club Auditor', 'Independent reviewer of financial records, disbursements, and liquidations.')
on conflict (key) do update set name = excluded.name;

-- 5. Seed Permissions (34 Keys)
insert into public.permissions (key, name, category, description) values
  ('MEMBER_VIEW', 'View Members', 'Membership', 'View member roster and basic public directory.'),
  ('MEMBER_CREATE', 'Create Member', 'Membership', 'Add member records to the club roster.'),
  ('MEMBER_UPDATE', 'Update Member', 'Membership', 'Edit member records and profiles.'),
  ('MEMBER_APPROVE', 'Approve Registration', 'Membership', 'Review and approve new member registration requests.'),
  ('MEMBER_SUSPEND', 'Suspend Member', 'Membership', 'Suspend or terminate active club membership.'),
  ('MEMBER_SENSITIVE_VIEW', 'View Sensitive Member Data', 'Privacy', 'Access restricted health, emergency contact, and birthdate info.'),
  ('ROLE_ASSIGN', 'Assign Club Roles', 'Administration', 'Assign or revoke officer and committee roles.'),
  ('RECRUITMENT_MANAGE', 'Manage Recruitment', 'Recruitment', 'Track prospects through onboarding stages and log follow-ups.'),
  ('EVENT_VIEW', 'View Events', 'Events', 'Browse club calendar and public event details.'),
  ('EVENT_CREATE', 'Create Events', 'Events', 'Schedule new club meetings and service activities.'),
  ('EVENT_UPDATE', 'Update Events', 'Events', 'Edit event information and schedule.'),
  ('ATTENDANCE_MANAGE', 'Manage Attendance', 'Attendance', 'Generate QR check-in sessions and record manual attendances.'),
  ('RETENTION_ALERT_VIEW', 'View Retention Alerts', 'Retention', 'Inspect private engagement flags and attendance drop-offs.'),
  ('PROJECT_CREATE', 'Create Projects', 'Projects', 'Register new community service and club projects.'),
  ('PROJECT_UPDATE', 'Update Projects', 'Projects', 'Edit project metrics, beneficiaries, and milestones.'),
  ('PROJECT_SUBMIT_REPORT', 'Submit Accomplishment Report', 'Reporting', 'Submit completed project report for review.'),
  ('REPORT_APPROVE', 'Approve Reports', 'Reporting', 'Review and approve project accomplishment reports.'),
  ('REPORT_TEMPLATE_MANAGE', 'Manage Report Templates', 'Reporting', 'Configure accomplishment report templates.'),
  ('CERTIFICATE_GENERATE', 'Generate Certificates', 'Certificates', 'Create and issue PDF certificates of recognition.'),
  ('TREASURY_VIEW', 'View Treasury Ledger', 'Treasury', 'Inspect club balance sheets, collection history, and invoices.'),
  ('INVOICE_CREATE', 'Create Invoices', 'Treasury', 'Issue membership dues and event payment requests.'),
  ('PAYMENT_SUBMIT', 'Submit Payment Proof', 'Treasury', 'Upload receipts and reference numbers against invoices.'),
  ('PAYMENT_VERIFY', 'Verify Payments', 'Treasury', 'Approve proof-of-payment submissions and post to ledger.'),
  ('LEDGER_ADJUST', 'Make Ledger Adjustments', 'Treasury', 'Apply auditable debits or credits with explanation.'),
  ('BUDGET_REQUEST', 'Request Project Budget', 'Budget', 'Submit formal funding and expenditure proposals.'),
  ('BUDGET_APPROVE_PRESIDENT', 'Presidential Budget Approval', 'Budget', 'Approve or reject budget requests as Club President.'),
  ('BUDGET_APPROVE_TREASURER', 'Treasurer Budget Approval', 'Budget', 'Approve or reject budget requests as Club Treasurer.'),
  ('DISBURSEMENT_RECORD', 'Record Fund Disbursement', 'Treasury', 'Log disbursement of approved funds with transaction reference.'),
  ('LIQUIDATION_SUBMIT', 'Submit Liquidation', 'Budget', 'Provide actual expense receipts against disbursed budgets.'),
  ('LIQUIDATION_VERIFY', 'Verify Liquidation', 'Treasury', 'Audit and approve expense liquidations and receipts.'),
  ('NOTIFICATION_SEND', 'Broadcast Notifications', 'Communication', 'Send transactional email reminders and notifications.'),
  ('AUDIT_LOG_VIEW', 'View Audit Logs', 'Administration', 'Inspect system mutation history and judicial logs.'),
  ('SETTINGS_MANAGE', 'Manage Club Settings', 'Administration', 'Configure Rotary year, approval policies, and thresholds.'),
  ('DATA_EXPORT', 'Export Club Data', 'Administration', 'Generate CSV exports of club rosters, attendance, and finances.')
on conflict (key) do update set name = excluded.name;

-- 6. Map Role Permissions
-- General Member
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r, public.permissions p
where r.key = 'GENERAL_MEMBER' and p.key in ('EVENT_VIEW', 'PAYMENT_SUBMIT')
on conflict do nothing;

-- Project Chair
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r, public.permissions p
where r.key = 'PROJECT_CHAIR' and p.key in (
  'EVENT_VIEW', 'PAYMENT_SUBMIT', 'PROJECT_CREATE', 'PROJECT_UPDATE',
  'PROJECT_SUBMIT_REPORT', 'BUDGET_REQUEST', 'LIQUIDATION_SUBMIT',
  'EVENT_CREATE', 'EVENT_UPDATE', 'ATTENDANCE_MANAGE', 'CERTIFICATE_GENERATE'
)
on conflict do nothing;

-- Treasurer
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r, public.permissions p
where r.key = 'TREASURER' and p.key in (
  'EVENT_VIEW', 'PAYMENT_SUBMIT', 'MEMBER_VIEW', 'RETENTION_ALERT_VIEW',
  'PROJECT_CREATE', 'PROJECT_UPDATE', 'PROJECT_SUBMIT_REPORT',
  'BUDGET_REQUEST', 'LIQUIDATION_SUBMIT', 'EVENT_CREATE', 'EVENT_UPDATE',
  'ATTENDANCE_MANAGE', 'TREASURY_VIEW', 'INVOICE_CREATE', 'PAYMENT_VERIFY',
  'LEDGER_ADJUST', 'BUDGET_APPROVE_TREASURER', 'DISBURSEMENT_RECORD',
  'LIQUIDATION_VERIFY', 'NOTIFICATION_SEND', 'DATA_EXPORT'
)
on conflict do nothing;

-- Secretary
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r, public.permissions p
where r.key = 'SECRETARY' and p.key in (
  'EVENT_VIEW', 'PAYMENT_SUBMIT', 'MEMBER_VIEW', 'MEMBER_CREATE', 'MEMBER_UPDATE',
  'MEMBER_APPROVE', 'RECRUITMENT_MANAGE', 'RETENTION_ALERT_VIEW', 'PROJECT_CREATE',
  'PROJECT_UPDATE', 'PROJECT_SUBMIT_REPORT', 'BUDGET_REQUEST', 'LIQUIDATION_SUBMIT',
  'EVENT_CREATE', 'EVENT_UPDATE', 'ATTENDANCE_MANAGE', 'REPORT_APPROVE',
  'REPORT_TEMPLATE_MANAGE', 'CERTIFICATE_GENERATE', 'NOTIFICATION_SEND', 'DATA_EXPORT'
)
on conflict do nothing;

-- President
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r, public.permissions p
where r.key = 'PRESIDENT' and p.key in (
  'EVENT_VIEW', 'PAYMENT_SUBMIT', 'MEMBER_VIEW', 'MEMBER_CREATE', 'MEMBER_UPDATE',
  'MEMBER_APPROVE', 'MEMBER_SUSPEND', 'MEMBER_SENSITIVE_VIEW', 'ROLE_ASSIGN',
  'RECRUITMENT_MANAGE', 'RETENTION_ALERT_VIEW', 'PROJECT_CREATE', 'PROJECT_UPDATE',
  'PROJECT_SUBMIT_REPORT', 'REPORT_APPROVE', 'REPORT_TEMPLATE_MANAGE',
  'CERTIFICATE_GENERATE', 'TREASURY_VIEW', 'BUDGET_REQUEST', 'BUDGET_APPROVE_PRESIDENT',
  'LIQUIDATION_SUBMIT', 'LIQUIDATION_VERIFY', 'EVENT_CREATE', 'EVENT_UPDATE',
  'ATTENDANCE_MANAGE', 'NOTIFICATION_SEND', 'AUDIT_LOG_VIEW', 'SETTINGS_MANAGE', 'DATA_EXPORT'
)
on conflict do nothing;

-- Auditor
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r, public.permissions p
where r.key = 'AUDITOR' and p.key in (
  'EVENT_VIEW', 'MEMBER_VIEW', 'TREASURY_VIEW', 'AUDIT_LOG_VIEW'
)
on conflict do nothing;

-- 7. Default Host Club: Rotaract San Pedro East (District 3820)
insert into public.clubs (id, name, club_id_number, district_code, sponsor_rotary_club, charter_date, timezone, currency)
values (
  '00000000-0000-0000-0000-000000000001',
  'Rotaract Club of San Pedro East',
  'RAC-SPE-3820',
  '3820',
  'Rotary Club of San Pedro East',
  '2018-03-13',
  'Asia/Manila',
  'PHP'
)
on conflict (id) do update set name = excluded.name;

-- Default App Settings for San Pedro East
insert into public.app_settings (club_id, current_rotary_year, require_registration_approval, allow_budget_self_approval, budget_approval_policy)
values (
  '00000000-0000-0000-0000-000000000001',
  '2026-27',
  true,
  false,
  'PRESIDENT_AND_TREASURER'
)
on conflict (club_id) do nothing;

-- Default Report Template
insert into public.report_templates (id, club_id, name, district_code, version, is_official_validated)
values (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'Standard Club Accomplishment Report (Configurable)',
  '3820',
  '1.0',
  false -- Non-validated until confirmed with District 3820
)
on conflict (id) do nothing;
