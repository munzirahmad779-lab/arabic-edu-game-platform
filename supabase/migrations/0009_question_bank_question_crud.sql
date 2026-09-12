-- =============================================================================
-- 0009_question_bank_question_crud.sql
-- Owner-only edit/delete workflow for Question Bank questions.
--
-- Security:
--   - SECURITY DEFINER with empty search_path.
--   - Caller must be authenticated.
--   - Question must belong to a Question Bank owned by caller.
--   - Category must belong to the same caller.
--   - Edit is atomic across question + A-D options.
--   - Delete refuses when media exists or when historical submissions reference
--     the question, preserving media/storage and historical integrity.
-- =============================================================================

create or replace function public.update_question_bank_question(
  p_question_id uuid,
  p_category_id uuid,
  p_question_text text,
  p_difficulty text,
  p_correct_option_key text,
  p_options jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_teacher_id uuid;
  v_bank_id uuid;
  v_option_key text;
  v_option_text text;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required';
  end if;

  if p_question_text is null or char_length(btrim(p_question_text)) = 0
     or char_length(p_question_text) > 5000 then
    raise exception 'question text must contain 1-5000 characters';
  end if;

  if p_difficulty not in ('easy', 'medium', 'hard') then
    raise exception 'invalid difficulty';
  end if;

  if p_correct_option_key not in ('A', 'B', 'C', 'D') then
    raise exception 'invalid correct option key';
  end if;

  if jsonb_typeof(p_options) <> 'object'
     or not (p_options ?& array['A','B','C','D']) then
    raise exception 'options A-D are required';
  end if;

  for v_option_key in select unnest(array['A','B','C','D'])
  loop
    v_option_text := nullif(btrim(p_options ->> v_option_key), '');
    if v_option_text is null or char_length(v_option_text) > 2000 then
      raise exception 'each option must contain 1-2000 characters';
    end if;
  end loop;

  select q.teacher_id, q.question_bank_id
    into v_teacher_id, v_bank_id
  from public.questions q
  where q.id = p_question_id
    and q.question_bank_id is not null;

  if v_teacher_id is null or v_teacher_id <> (select auth.uid()) then
    raise exception 'question not found or access denied';
  end if;

  if not exists (
    select 1
    from public.question_categories qc
    where qc.id = p_category_id
      and qc.teacher_id = (select auth.uid())
  ) then
    raise exception 'category not found or access denied';
  end if;

  update public.questions
  set
    category_id = p_category_id,
    question_text = btrim(p_question_text),
    difficulty = p_difficulty,
    correct_option_key = p_correct_option_key,
    payload = jsonb_build_object(
      'options', jsonb_build_object(
        'A', btrim(p_options ->> 'A'),
        'B', btrim(p_options ->> 'B'),
        'C', btrim(p_options ->> 'C'),
        'D', btrim(p_options ->> 'D')
      ),
      'correct', p_correct_option_key
    ),
    updated_at = now()
  where id = p_question_id;

  for v_option_key in select unnest(array['A','B','C','D'])
  loop
    update public.question_options
    set option_text = btrim(p_options ->> v_option_key)
    where question_id = p_question_id
      and option_key = v_option_key;
  end loop;

  return true;
end;
$$;

create or replace function public.delete_question_bank_question(
  p_question_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_teacher_id uuid;
  v_media_count integer;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required';
  end if;

  select q.teacher_id
    into v_teacher_id
  from public.questions q
  where q.id = p_question_id
    and q.question_bank_id is not null;

  if v_teacher_id is null or v_teacher_id <> (select auth.uid()) then
    raise exception 'question not found or access denied';
  end if;

  select count(*)::integer
    into v_media_count
  from public.question_media qm
  where qm.question_id = p_question_id;

  if v_media_count > 0 then
    raise exception 'question has media attached; remove its media before deleting the question';
  end if;

  -- If historical submissions reference this question, PostgreSQL foreign-key
  -- protection will reject the delete. We intentionally do not bypass it.
  delete from public.question_options
  where question_id = p_question_id;

  delete from public.questions
  where id = p_question_id
    and teacher_id = (select auth.uid());

  if not found then
    raise exception 'question could not be deleted';
  end if;

  return true;
exception
  when foreign_key_violation then
    raise exception 'question is already used by historical game data and cannot be deleted';
end;
$$;

revoke all on function public.update_question_bank_question(uuid, uuid, text, text, text, jsonb) from public, anon;
grant execute on function public.update_question_bank_question(uuid, uuid, text, text, text, jsonb) to authenticated;

revoke all on function public.delete_question_bank_question(uuid) from public, anon;
grant execute on function public.delete_question_bank_question(uuid) to authenticated;
