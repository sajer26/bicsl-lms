-- ============================================================================
-- BICSL LMS — Initial Schema Migration
-- ============================================================================
-- Enterprise Healthcare Learning Management System
-- Run this against a fresh Supabase project (SQL Editor or `supabase db push`)
-- ============================================================================

-- Extensions -----------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

create type user_role as enum ('super_admin', 'hospital_admin', 'learner');
create type account_status as enum ('active', 'disabled');
create type hospital_status as enum ('active', 'disabled');
create type language_code as enum ('ar', 'en', 'both');
create type publish_status as enum ('draft', 'published', 'archived');
create type resource_type as enum ('video', 'pdf', 'poster', 'image', 'file', 'external_link');
create type video_provider as enum ('youtube');
create type visibility_status as enum ('visible', 'hidden');
create type module_stage as enum ('locked', 'pre_quiz', 'video', 'resources', 'post_quiz', 'completed');
create type quiz_type as enum ('pre', 'post');

-- ============================================================================
-- HOSPITALS
-- ============================================================================

create table public.hospitals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  status hospital_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_hospitals_status on public.hospitals (status) where deleted_at is null;

-- ============================================================================
-- PROFILES (extends auth.users)
-- ============================================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  national_id text unique,
  date_of_birth date,
  role user_role not null default 'learner',
  hospital_id uuid references public.hospitals (id),
  status account_status not null default 'active',
  preferred_language language_code not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learner_hospital_admin_requires_hospital
    check (role = 'super_admin' or hospital_id is not null)
);

create index idx_profiles_hospital on public.profiles (hospital_id);
create index idx_profiles_role on public.profiles (role);

-- ============================================================================
-- COURSES
-- ============================================================================

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  name_en text not null,
  name_ar text not null,
  description_en text,
  description_ar text,
  status publish_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- MODULES
-- ============================================================================

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  module_code text not null,
  order_index int not null,
  name_en text not null,
  name_ar text not null,
  description_en text,
  description_ar text,
  image_url text,
  status publish_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (course_id, module_code)
);

create index idx_modules_course on public.modules (course_id, order_index) where deleted_at is null;
create index idx_modules_status on public.modules (status) where deleted_at is null;

-- ============================================================================
-- MODULE RESOURCES
-- ============================================================================

create table public.module_resources (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules (id) on delete cascade,
  resource_type resource_type not null,
  title_en text not null,
  title_ar text not null,
  description_en text,
  description_ar text,
  storage_path text,               -- Supabase Storage path (pdf/poster/image/file)
  video_provider video_provider,   -- only for resource_type = 'video'
  video_external_id text,          -- YouTube unlisted video ID
  video_thumbnail_url text,
  language language_code not null default 'both',
  display_order int not null default 0,
  visibility visibility_status not null default 'visible',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint video_requires_external_id
    check (resource_type <> 'video' or video_external_id is not null)
);

create index idx_module_resources_module on public.module_resources (module_id, display_order);

-- ============================================================================
-- QUESTIONS & ANSWER CHOICES
-- ============================================================================

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules (id) on delete cascade,
  question_text_en text not null,
  question_text_ar text not null,
  image_url text,
  explanation_en text,
  explanation_ar text,
  order_index int not null default 0,
  status publish_status not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_questions_module on public.questions (module_id, order_index);

create table public.answer_choices (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  choice_text_en text not null,
  choice_text_ar text not null,
  is_correct boolean not null default false,
  order_index int not null default 0
);

create index idx_answer_choices_question on public.answer_choices (question_id, order_index);

-- Ensure exactly one correct choice per question (enforced at app layer + trigger below)
create or replace function public.enforce_single_correct_choice()
returns trigger as $$
begin
  if new.is_correct then
    update public.answer_choices
    set is_correct = false
    where question_id = new.question_id
      and id <> new.id
      and is_correct = true;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_single_correct_choice
before insert or update on public.answer_choices
for each row execute function public.enforce_single_correct_choice();

-- ============================================================================
-- QUIZ ATTEMPTS
-- ============================================================================

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.profiles (id) on delete cascade,
  module_id uuid not null references public.modules (id) on delete cascade,
  quiz_type quiz_type not null,
  attempt_number int not null,
  score_percentage numeric(5,2) not null default 0,
  passed boolean not null default false,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  unique (learner_id, module_id, quiz_type, attempt_number)
);

create index idx_quiz_attempts_learner_module on public.quiz_attempts (learner_id, module_id, quiz_type);

create table public.quiz_attempt_responses (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  selected_choice_id uuid references public.answer_choices (id),
  is_correct boolean not null default false,
  unique (attempt_id, question_id)
);

-- ============================================================================
-- LEARNER PROGRESS  (one row per learner+module — the resume/unlock engine)
-- ============================================================================

create table public.learner_progress (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.profiles (id) on delete cascade,
  module_id uuid not null references public.modules (id) on delete cascade,
  stage module_stage not null default 'locked',
  best_score numeric(5,2),
  is_completed boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (learner_id, module_id)
);

create index idx_learner_progress_learner on public.learner_progress (learner_id);
create index idx_learner_progress_module on public.learner_progress (module_id);

-- ============================================================================
-- BADGES
-- ============================================================================

create table public.badges (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.profiles (id) on delete cascade,
  module_id uuid not null references public.modules (id) on delete cascade,
  awarded_at timestamptz not null default now(),
  unique (learner_id, module_id)
);

create index idx_badges_learner on public.badges (learner_id);

-- ============================================================================
-- CERTIFICATES
-- ============================================================================

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  certificate_pdf_path text,
  unique (learner_id, course_id)
);

create index idx_certificates_learner on public.certificates (learner_id);

-- ============================================================================
-- AUDIT LOGS
-- ============================================================================

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action_type text not null,
  target_table text,
  target_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index idx_audit_logs_actor on public.audit_logs (actor_id);
create index idx_audit_logs_created on public.audit_logs (created_at desc);

-- ============================================================================
-- updated_at auto-touch trigger (shared)
-- ============================================================================

create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_touch_hospitals before update on public.hospitals for each row execute function public.touch_updated_at();
create trigger trg_touch_profiles before update on public.profiles for each row execute function public.touch_updated_at();
create trigger trg_touch_courses before update on public.courses for each row execute function public.touch_updated_at();
create trigger trg_touch_modules before update on public.modules for each row execute function public.touch_updated_at();
create trigger trg_touch_module_resources before update on public.module_resources for each row execute function public.touch_updated_at();
create trigger trg_touch_questions before update on public.questions for each row execute function public.touch_updated_at();
create trigger trg_touch_learner_progress before update on public.learner_progress for each row execute function public.touch_updated_at();
