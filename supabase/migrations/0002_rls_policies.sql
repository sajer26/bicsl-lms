-- ============================================================================
-- BICSL LMS — Row Level Security Policies
-- ============================================================================
-- Run after 0001_init_schema.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER so they bypass RLS on `profiles` and
-- avoid infinite-recursion when profiles' own policies call them)
-- ----------------------------------------------------------------------------

create or replace function public.current_role()
returns user_role
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_hospital_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select hospital_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.current_role() = 'super_admin';
$$;

-- ----------------------------------------------------------------------------
-- Enable RLS everywhere
-- ----------------------------------------------------------------------------

alter table public.hospitals enable row level security;
alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.modules enable row level security;
alter table public.module_resources enable row level security;
alter table public.questions enable row level security;
alter table public.answer_choices enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_attempt_responses enable row level security;
alter table public.learner_progress enable row level security;
alter table public.badges enable row level security;
alter table public.certificates enable row level security;
alter table public.audit_logs enable row level security;

-- ============================================================================
-- HOSPITALS
-- ============================================================================

create policy "super_admin full access to hospitals"
  on public.hospitals for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "hospital_admin can view own hospital"
  on public.hospitals for select
  using (id = public.current_hospital_id());

create policy "learner can view own hospital"
  on public.hospitals for select
  using (id = public.current_hospital_id());

-- Public (including unauthenticated) read of active hospitals — needed to
-- populate the hospital dropdown on the Registration screen, before the
-- learner has an account. Only non-sensitive fields (name/code/status).
create policy "anyone can view active hospitals for registration"
  on public.hospitals for select
  to anon, authenticated
  using (status = 'active');

-- ============================================================================
-- PROFILES
-- ============================================================================

create policy "super_admin full access to profiles"
  on public.profiles for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "user can view own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "user can update own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = public.current_role()); -- cannot self-promote role

create policy "hospital_admin can view learners in own hospital"
  on public.profiles for select
  using (
    public.current_role() = 'hospital_admin'
    and hospital_id = public.current_hospital_id()
  );

-- Self-registration: a newly authenticated user may create exactly one
-- profile row for themselves, and only as a 'learner' — Hospital Admin and
-- Super Admin accounts must be provisioned by an existing Super Admin.
create policy "user can insert own learner profile"
  on public.profiles for insert
  with check (id = auth.uid() and role = 'learner');

-- ============================================================================
-- COURSES / MODULES / RESOURCES  (published content readable by all
-- authenticated users; only super_admin can write)
-- ============================================================================

create policy "super_admin manages courses"
  on public.courses for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "authenticated can view published courses"
  on public.courses for select
  using (status = 'published' or public.is_super_admin());

create policy "super_admin manages modules"
  on public.modules for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "authenticated can view published modules"
  on public.modules for select
  using ((status = 'published' and deleted_at is null) or public.is_super_admin());

create policy "super_admin manages module_resources"
  on public.module_resources for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "authenticated can view visible resources of published modules"
  on public.module_resources for select
  using (
    public.is_super_admin()
    or (
      visibility = 'visible'
      and exists (
        select 1 from public.modules m
        where m.id = module_id and m.status = 'published' and m.deleted_at is null
      )
    )
  );

-- ============================================================================
-- QUESTIONS / ANSWER CHOICES
-- Learners may READ questions for published modules, but must never see
-- `is_correct` directly — enforced via the `quiz_questions_public` view below,
-- which the frontend should query instead of the raw table during an attempt.
-- ============================================================================

create policy "super_admin manages questions"
  on public.questions for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "authenticated can view questions of published modules"
  on public.questions for select
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.modules m
      where m.id = module_id and m.status = 'published' and m.deleted_at is null
    )
  );

create policy "super_admin manages answer_choices"
  on public.answer_choices for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- NOTE: intentionally no SELECT policy here for learner/hospital_admin.
-- `is_correct` must never be directly queryable by a learner mid-attempt.
-- Learners read choices through `quiz_questions_public` (below), and grading
-- happens server-side in `public.submit_quiz_attempt` (see migration 0004).

-- View that hides `is_correct` and only exposes choices for published
-- modules. Created by the migration-running role, so it runs with that
-- role's privileges (not the querying user's) and can read the full table
-- even though `authenticated` has no direct SELECT policy on it above.
create or replace view public.quiz_questions_public as
  select ac.id, ac.question_id, ac.choice_text_en, ac.choice_text_ar, ac.order_index
  from public.answer_choices ac
  join public.questions q on q.id = ac.question_id
  join public.modules m on m.id = q.module_id
  where m.status = 'published' and m.deleted_at is null;

grant select on public.quiz_questions_public to authenticated;

-- ============================================================================
-- QUIZ ATTEMPTS / RESPONSES
-- ============================================================================

create policy "super_admin full access to quiz_attempts"
  on public.quiz_attempts for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "learner views own quiz_attempts"
  on public.quiz_attempts for select
  using (learner_id = auth.uid());

create policy "hospital_admin views hospital quiz_attempts"
  on public.quiz_attempts for select
  using (
    public.current_role() = 'hospital_admin'
    and exists (
      select 1 from public.profiles p
      where p.id = learner_id and p.hospital_id = public.current_hospital_id()
    )
  );

create policy "super_admin full access to quiz_attempt_responses"
  on public.quiz_attempt_responses for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "learner views own quiz_attempt_responses"
  on public.quiz_attempt_responses for select
  using (
    exists (
      select 1 from public.quiz_attempts qa
      where qa.id = attempt_id and qa.learner_id = auth.uid()
    )
  );

-- ============================================================================
-- LEARNER PROGRESS
-- ============================================================================

create policy "super_admin full access to learner_progress"
  on public.learner_progress for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "learner manages own progress"
  on public.learner_progress for all
  using (learner_id = auth.uid())
  with check (learner_id = auth.uid());

create policy "hospital_admin views hospital progress"
  on public.learner_progress for select
  using (
    public.current_role() = 'hospital_admin'
    and exists (
      select 1 from public.profiles p
      where p.id = learner_id and p.hospital_id = public.current_hospital_id()
    )
  );

-- ============================================================================
-- BADGES
-- ============================================================================

create policy "super_admin full access to badges"
  on public.badges for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "learner views own badges"
  on public.badges for select
  using (learner_id = auth.uid());

create policy "hospital_admin views hospital badges"
  on public.badges for select
  using (
    public.current_role() = 'hospital_admin'
    and exists (
      select 1 from public.profiles p
      where p.id = learner_id and p.hospital_id = public.current_hospital_id()
    )
  );

-- ============================================================================
-- CERTIFICATES
-- ============================================================================

create policy "super_admin full access to certificates"
  on public.certificates for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "learner views own certificates"
  on public.certificates for select
  using (learner_id = auth.uid());

create policy "hospital_admin views hospital certificates"
  on public.certificates for select
  using (
    public.current_role() = 'hospital_admin'
    and exists (
      select 1 from public.profiles p
      where p.id = learner_id and p.hospital_id = public.current_hospital_id()
    )
  );

-- ============================================================================
-- AUDIT LOGS  (Super Admin only, insert-only from app via server-side calls)
-- ============================================================================

create policy "super_admin views audit_logs"
  on public.audit_logs for select
  using (public.is_super_admin());

create policy "authenticated can insert own audit entries"
  on public.audit_logs for insert
  with check (actor_id = auth.uid());
