-- ==============================================================================
-- 0003_projects_reporting_certificates.sql
-- Module 1: Automated Project & District Reporting Engine
-- Certificate Issuance System
-- ==============================================================================

-- 1. Official 7 Rotary Areas of Focus
create table if not exists public.areas_of_focus (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  icon text,
  sort_order int not null default 0
);

-- 2. UN Sustainable Development Goals (1-17)
create table if not exists public.sdgs (
  id uuid primary key default gen_random_uuid(),
  number int not null unique check (number between 1 and 17),
  name text not null,
  description text,
  color_hex text
);

-- 3. Service Categories (Separate from Areas of Focus)
create table if not exists public.service_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text
);

-- 4. Projects
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  host_club_id uuid not null references public.clubs(id) on delete cascade,
  title text not null,
  summary text,
  objective text,
  venue text,
  start_date date not null,
  end_date date not null,
  project_chair_id uuid references public.profiles(id) on delete set null,
  service_category_id uuid references public.service_categories(id) on delete set null,
  rotary_year text not null default '2026-27',
  beneficiary_count int not null default 0,
  beneficiary_type text,
  volunteer_count int not null default 0,
  total_volunteer_hours numeric(8,2) not null default 0.00,
  funds_raised numeric(12,2) not null default 0.00,
  total_expenses numeric(12,2) not null default 0.00,
  partners_and_sponsors text,
  outcomes_summary text,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'ONGOING', 'COMPLETED', 'REPORT_SUBMITTED', 'CANCELLED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. Project Join Tables
create table if not exists public.project_areas_of_focus (
  project_id uuid not null references public.projects(id) on delete cascade,
  area_of_focus_id uuid not null references public.areas_of_focus(id) on delete cascade,
  primary key (project_id, area_of_focus_id)
);

create table if not exists public.project_sdgs (
  project_id uuid not null references public.projects(id) on delete cascade,
  sdg_id uuid not null references public.sdgs(id) on delete cascade,
  primary key (project_id, sdg_id)
);

create table if not exists public.project_clubs (
  project_id uuid not null references public.projects(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  is_host boolean not null default false,
  primary key (project_id, club_id)
);

create table if not exists public.project_photos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  storage_path text not null,
  caption text,
  is_featured boolean not null default false,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 6. Report Templates & Submissions
create table if not exists public.report_templates (
  id uuid primary key default gen_random_uuid(),
  club_id uuid references public.clubs(id) on delete cascade, -- null = global/district template
  name text not null,
  district_code text not null default '3820',
  version text not null default '1.0',
  schema_definition jsonb not null default '{}'::jsonb,
  is_official_validated boolean not null default false, -- Mandatory flag: false until verified against real D3820 forms
  created_at timestamptz not null default now()
);

create table if not exists public.report_submissions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  template_id uuid not null references public.report_templates(id) on delete restrict,
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  reviewer_id uuid references public.profiles(id) on delete set null,
  status text not null default 'DRAFT' check (
    status in ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'REVISION_REQUESTED', 'APPROVED')
  ),
  review_notes text,
  data_snapshot jsonb not null, -- Immutable historical data snapshot used for reproduction
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.generated_reports (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.report_submissions(id) on delete cascade,
  file_format text not null check (file_format in ('PDF', 'DOCX')),
  storage_path text not null,
  file_size_bytes bigint,
  generated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 7. Certificate Templates & Issuances
create table if not exists public.certificate_templates (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null,
  category text not null check (category in ('PARTICIPATION', 'APPRECIATION', 'VOLUNTEER', 'SPEAKER', 'PARTNER')),
  title_text text not null default 'Certificate of Appreciation',
  body_template text not null,
  signatory_1_name text,
  signatory_1_title text,
  signatory_2_name text,
  signatory_2_title text,
  created_at timestamptz not null default now()
);

create table if not exists public.certificate_issuances (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.certificate_templates(id) on delete restrict,
  event_id uuid references public.events(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  issued_by uuid not null references public.profiles(id) on delete restrict,
  issue_date date not null default current_date,
  batch_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.certificate_recipients (
  id uuid primary key default gen_random_uuid(),
  issuance_id uuid not null references public.certificate_issuances(id) on delete cascade,
  recipient_name text not null,
  recipient_email text,
  profile_id uuid references public.profiles(id) on delete set null,
  certificate_number text not null unique,
  storage_path text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- ==============================================================================
-- RLS POLICIES FOR PROJECTS & REPORTING
-- ==============================================================================

alter table public.areas_of_focus enable row level security;
alter table public.sdgs enable row level security;
alter table public.service_categories enable row level security;
alter table public.projects enable row level security;
alter table public.project_areas_of_focus enable row level security;
alter table public.project_sdgs enable row level security;
alter table public.project_clubs enable row level security;
alter table public.project_photos enable row level security;
alter table public.report_templates enable row level security;
alter table public.report_submissions enable row level security;
alter table public.generated_reports enable row level security;
alter table public.certificate_templates enable row level security;
alter table public.certificate_issuances enable row level security;
alter table public.certificate_recipients enable row level security;

-- Reference tables readable by all authenticated users
create policy "reference_areas_of_focus_read" on public.areas_of_focus for select to authenticated using (true);
create policy "reference_sdgs_read" on public.sdgs for select to authenticated using (true);
create policy "reference_service_categories_read" on public.service_categories for select to authenticated using (true);

-- Projects policies
create policy "projects_select" on public.projects
  for select to authenticated
  using (
    private.is_platform_admin()
    or exists (
      select 1 from public.project_clubs pc
      where pc.project_id = public.projects.id
        and private.is_active_member(pc.club_id)
    )
  );

create policy "projects_insert" on public.projects
  for insert to authenticated
  with check (
    private.is_platform_admin()
    or private.has_permission(host_club_id, 'PROJECT_CREATE')
  );

create policy "projects_update" on public.projects
  for update to authenticated
  using (
    private.is_platform_admin()
    or private.has_permission(host_club_id, 'PROJECT_UPDATE')
  )
  with check (
    private.is_platform_admin()
    or private.has_permission(host_club_id, 'PROJECT_UPDATE')
  );

-- Report Submissions policies
create policy "report_submissions_select" on public.report_submissions
  for select to authenticated
  using (
    private.is_platform_admin()
    or exists (
      select 1 from public.projects p
      where p.id = public.report_submissions.project_id
        and private.has_permission(p.host_club_id, 'PROJECT_SUBMIT_REPORT')
    )
  );

create policy "report_submissions_modify" on public.report_submissions
  for all to authenticated
  using (
    private.is_platform_admin()
    or exists (
      select 1 from public.projects p
      where p.id = public.report_submissions.project_id
        and (private.has_permission(p.host_club_id, 'PROJECT_SUBMIT_REPORT') or private.has_permission(p.host_club_id, 'REPORT_APPROVE'))
    )
  )
  with check (
    private.is_platform_admin()
    or exists (
      select 1 from public.projects p
      where p.id = public.report_submissions.project_id
        and (private.has_permission(p.host_club_id, 'PROJECT_SUBMIT_REPORT') or private.has_permission(p.host_club_id, 'REPORT_APPROVE'))
    )
  );
