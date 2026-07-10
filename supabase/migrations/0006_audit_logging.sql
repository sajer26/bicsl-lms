-- ============================================================================
-- BICSL LMS — Audit Logging
-- ============================================================================
-- Run after 0001-0005.
-- ============================================================================

-- Generic logger any authenticated user can call for their own actions
-- (registration, login, admin content changes, uploads/deletions, etc.)
-- RLS on audit_logs already restricts inserts to actor_id = auth.uid(),
-- this just wraps it in a convenient RPC with a consistent shape.
create or replace function public.log_audit(
  p_action_type text,
  p_target_table text default null,
  p_target_id uuid default null,
  p_metadata jsonb default null
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.audit_logs (actor_id, action_type, target_table, target_id, metadata)
  values (auth.uid(), p_action_type, p_target_table, p_target_id, p_metadata);
$$;

grant execute on function public.log_audit(text, text, uuid, jsonb) to authenticated;

-- ----------------------------------------------------------------------------
-- Extend submit_quiz_attempt with inline audit entries for the events that
-- matter most (quiz submissions, module completion, certificate issuance).
-- These happen inside the trusted function itself so they can never be
-- skipped or spoofed by the client.
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

  insert into public.audit_logs (actor_id, action_type, target_table, target_id, metadata)
  values (
    v_learner_id, 'quiz.submit', 'quiz_attempts', v_attempt_id,
    jsonb_build_object('module_id', p_module_id, 'quiz_type', p_quiz_type, 'score', v_score, 'passed', v_passed)
  );

  perform set_config('bicsl.trusted_write', 'true', true);

  if p_quiz_type = 'pre' then
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

    insert into public.audit_logs (actor_id, action_type, target_table, target_id, metadata)
    values (v_learner_id, 'module.complete', 'modules', p_module_id, jsonb_build_object('score', v_score));

    select id into v_next_module_id
    from public.modules
    where course_id = v_course_id and order_index = v_order_index + 1
      and status = 'published' and deleted_at is null;

    if v_next_module_id is not null then
      insert into public.learner_progress (learner_id, module_id, stage)
      values (v_learner_id, v_next_module_id, 'pre_quiz')
      on conflict (learner_id, module_id) do nothing;
    else
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

        insert into public.audit_logs (actor_id, action_type, target_table, target_id, metadata)
        values (v_learner_id, 'certificate.issued', 'certificates', v_course_id, null);
      end if;
    end if;

  elsif p_quiz_type = 'post' and not v_passed then
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
