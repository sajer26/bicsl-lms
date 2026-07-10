-- ============================================================================
-- BICSL LMS — Quiz Grading, Unlock & Certification Logic
-- ============================================================================
-- Run after 0001, 0002, 0003.
--
-- Why this exists: `learner_progress` has an "all" RLS policy so learners can
-- freely move between pre_quiz/video/resources/post_quiz as they navigate a
-- module. But completion (`is_completed`, `completed_at`, `best_score`,
-- `stage = 'completed'`) must NEVER be settable by the client directly —
-- otherwise a learner could mark a module complete without passing the
-- Post-Quiz. The guard trigger below blocks that; only this migration's
-- SECURITY DEFINER function is allowed to write those fields, via a
-- transaction-local trusted flag.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Guard trigger: block direct client writes to completion fields
-- ----------------------------------------------------------------------------

create or replace function public.guard_learner_progress_write()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('bicsl.trusted_write', true), '') <> 'true' then
    if new.is_completed is true
       or new.completed_at is not null
       or new.best_score is not null
       or new.stage = 'completed' then
      raise exception 'learner_progress completion fields can only be set by submit_quiz_attempt()';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_guard_learner_progress
before insert or update on public.learner_progress
for each row execute function public.guard_learner_progress_write();

-- ----------------------------------------------------------------------------
-- 2. submit_quiz_attempt — the only path to grading, unlocking, badges,
--    and certificate issuance. Called by the frontend via
--    supabase.rpc('submit_quiz_attempt', { p_module_id, p_quiz_type, p_responses }).
--
--    p_responses shape: [{ "question_id": "uuid", "choice_id": "uuid" }, ...]
-- ----------------------------------------------------------------------------

create or replace function public.submit_quiz_attempt(
  p_module_id uuid,
  p_quiz_type quiz_type,
  p_responses jsonb
)
returns table (attempt_id uuid, score_percentage numeric, passed boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_learner_id uuid := auth.uid();
  v_course_id uuid;
  v_order_index int;
  v_total_questions int;
  v_correct_count int := 0;
  v_score numeric(5,2);
  v_passed boolean := false;
  v_attempt_number int;
  v_attempt_id uuid;
  v_prev_completed boolean;
  v_next_module_id uuid;
  v_total_modules int;
  v_completed_modules int;
  r jsonb;
  v_choice_correct boolean;
  v_response_correct boolean;
begin
  if v_learner_id is null then
    raise exception 'Not authenticated';
  end if;

  select course_id, order_index into v_course_id, v_order_index
  from public.modules
  where id = p_module_id and status = 'published' and deleted_at is null;

  if v_course_id is null then
    raise exception 'Module not found or not published';
  end if;

  -- Post-Quiz gating: module 1 is always open; any other module requires
  -- the previous module (by order_index) to already be completed.
  if p_quiz_type = 'post' and v_order_index > 1 then
    select coalesce(is_completed, false) into v_prev_completed
    from public.learner_progress lp
    join public.modules m on m.id = lp.module_id
    where lp.learner_id = v_learner_id
      and m.course_id = v_course_id
      and m.order_index = v_order_index - 1;

    if not coalesce(v_prev_completed, false) then
      raise exception 'Previous module not yet completed — this module is locked';
    end if;
  end if;

  v_total_questions := (select count(*) from public.questions where module_id = p_module_id and status = 'published');
  if v_total_questions = 0 then
    raise exception 'This module has no active questions';
  end if;

  select coalesce(max(attempt_number), 0) + 1 into v_attempt_number
  from public.quiz_attempts
  where learner_id = v_learner_id and module_id = p_module_id and quiz_type = p_quiz_type;

  insert into public.quiz_attempts (learner_id, module_id, quiz_type, attempt_number, score_percentage, passed, submitted_at)
  values (v_learner_id, p_module_id, p_quiz_type, v_attempt_number, 0, false, now())
  returning id into v_attempt_id;

  for r in select * from jsonb_array_elements(p_responses)
  loop
    select is_correct into v_choice_correct
    from public.answer_choices
    where id = (r ->> 'choice_id')::uuid and question_id = (r ->> 'question_id')::uuid;

    v_response_correct := coalesce(v_choice_correct, false);
    if v_response_correct then
      v_correct_count := v_correct_count + 1;
    end if;

    insert into public.quiz_attempt_responses (attempt_id, question_id, selected_choice_id, is_correct)
    values (v_attempt_id, (r ->> 'question_id')::uuid, (r ->> 'choice_id')::uuid, v_response_correct);
  end loop;

  v_score := round((v_correct_count::numeric / v_total_questions) * 100, 2);
  v_passed := (p_quiz_type = 'post' and v_score >= 80);

  update public.quiz_attempts
  set score_percentage = v_score, passed = v_passed
  where id = v_attempt_id;

  -- Everything below writes trusted fields on learner_progress —
  -- flag this transaction so the guard trigger allows it.
  perform set_config('bicsl.trusted_write', 'true', true);

  if p_quiz_type = 'pre' then
    -- Pre-Quiz never affects progression; just make sure a progress row
    -- exists so the learner can move into the Video stage.
    insert into public.learner_progress (learner_id, module_id, stage)
    values (v_learner_id, p_module_id, 'video')
    on conflict (learner_id, module_id)
      do update set stage = 'video'
      where public.learner_progress.stage = 'pre_quiz' or public.learner_progress.stage = 'locked';

  elsif p_quiz_type = 'post' and v_passed then
    insert into public.learner_progress (learner_id, module_id, stage, is_completed, best_score, completed_at)
    values (v_learner_id, p_module_id, 'completed', true, v_score, now())
    on conflict (learner_id, module_id) do update
      set stage = 'completed',
          is_completed = true,
          best_score = greatest(coalesce(public.learner_progress.best_score, 0), v_score),
          completed_at = now();

    insert into public.badges (learner_id, module_id)
    values (v_learner_id, p_module_id)
    on conflict (learner_id, module_id) do nothing;

    select id into v_next_module_id
    from public.modules
    where course_id = v_course_id and order_index = v_order_index + 1
      and status = 'published' and deleted_at is null;

    if v_next_module_id is not null then
      insert into public.learner_progress (learner_id, module_id, stage)
      values (v_learner_id, v_next_module_id, 'pre_quiz')
      on conflict (learner_id, module_id) do nothing;
    else
      -- This was the last module in the course — check full completion.
      select count(*) into v_total_modules
      from public.modules
      where course_id = v_course_id and status = 'published' and deleted_at is null;

      select count(*) into v_completed_modules
      from public.learner_progress lp
      join public.modules m on m.id = lp.module_id
      where lp.learner_id = v_learner_id
        and m.course_id = v_course_id
        and m.status = 'published' and m.deleted_at is null
        and lp.is_completed = true;

      if v_completed_modules >= v_total_modules then
        insert into public.certificates (learner_id, course_id, issued_at, expires_at)
        values (v_learner_id, v_course_id, now(), now() + interval '2 years')
        on conflict (learner_id, course_id) do nothing;
      end if;
    end if;

  elsif p_quiz_type = 'post' and not v_passed then
    -- Failed attempt: stay on post_quiz stage so the UI shows Retry.
    insert into public.learner_progress (learner_id, module_id, stage)
    values (v_learner_id, p_module_id, 'post_quiz')
    on conflict (learner_id, module_id)
      do update set stage = 'post_quiz'
      where public.learner_progress.is_completed = false;
  end if;

  return query select v_attempt_id, v_score, v_passed;
end;
$$;

grant execute on function public.submit_quiz_attempt(uuid, quiz_type, jsonb) to authenticated;

-- ----------------------------------------------------------------------------
-- 3. advance_module_stage — lightweight, trusted-free helper for simple
--    forward navigation (pre_quiz -> video -> resources -> post_quiz).
--    Plain client-side table writes already work for this via the existing
--    "learner manages own progress" policy (the guard trigger only blocks
--    completion fields), so this function is a convenience wrapper the
--    frontend can call instead of hand-rolling upserts.
-- ----------------------------------------------------------------------------

create or replace function public.advance_module_stage(p_module_id uuid, p_stage module_stage)
returns void
language plpgsql
security invoker
as $$
begin
  if p_stage = 'completed' or p_stage = 'locked' then
    raise exception 'Use submit_quiz_attempt to complete a module';
  end if;

  insert into public.learner_progress (learner_id, module_id, stage)
  values (auth.uid(), p_module_id, p_stage)
  on conflict (learner_id, module_id) do update
    set stage = p_stage
    where public.learner_progress.is_completed = false;
end;
$$;

grant execute on function public.advance_module_stage(uuid, module_stage) to authenticated;
