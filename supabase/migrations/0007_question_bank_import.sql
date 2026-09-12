-- =============================================================================
-- 0007_question_bank_import.sql
-- Phase 3C — Atomic Question Bank Excel import RPC.
--
-- The browser performs a strict preview, but the database re-validates every
-- field and performs the entire import in one transaction. Direct client
-- INSERT/UPDATE/DELETE access to questions/options remains disabled.
-- =============================================================================

create or replace function public.import_question_bank_rows(
  p_question_bank_id uuid,
  p_rows jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  bank_teacher_id uuid;
  row_item jsonb;
  row_no integer;
  row_index integer := 0;
  row_count integer;
  expected_no integer := 1;
  question_id uuid;
  category_id uuid;
  topic text;
  question_text text;
  difficulty text;
  correct_key text;
  has_media boolean;
  media_type text;
  media_filename text;
  max_play_count integer;
  option_key text;
  option_text text;
  option_position integer;
  existing_count integer;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required';
  end if;

  select qb.teacher_id
    into bank_teacher_id
  from public.question_banks qb
  where qb.id = p_question_bank_id;

  if bank_teacher_id is null then
    raise exception 'question bank not found';
  end if;

  if bank_teacher_id <> (select auth.uid()) then
    raise exception 'only the question bank owner may import questions';
  end if;

  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'import payload must be a JSON array';
  end if;

  row_count := jsonb_array_length(p_rows);
  if row_count < 1 or row_count > 40 then
    raise exception 'import must contain between 1 and 40 questions';
  end if;

  select count(*)
    into existing_count
  from public.questions q
  where q.question_bank_id = p_question_bank_id;

  if existing_count + row_count > 40 then
    raise exception 'a question bank may contain at most 40 questions';
  end if;

  -- Full validation pass: no rows are inserted until every row passes.
  for row_item in select value from jsonb_array_elements(p_rows) loop
    row_index := row_index + 1;

    if jsonb_typeof(row_item) <> 'object' then
      raise exception 'row % must be an object', row_index;
    end if;

    if not (row_item ? 'no' and row_item ? 'question' and row_item ? 'options'
      and row_item ? 'correctOptionKey' and row_item ? 'topic'
      and row_item ? 'difficulty' and row_item ? 'hasMedia'
      and row_item ? 'mediaType' and row_item ? 'mediaFilename'
      and row_item ? 'maxPlayCount') then
      raise exception 'row % has an invalid structure', row_index;
    end if;

    row_no := (row_item ->> 'no')::integer;
    if row_no <> expected_no then
      raise exception 'No must be sequential starting at 1; expected %, got %', expected_no, row_no;
    end if;
    expected_no := expected_no + 1;

    question_text := btrim(coalesce(row_item ->> 'question', ''));
    if question_text = '' or char_length(question_text) > 5000 then
      raise exception 'row % has invalid question text', row_index;
    end if;

    if jsonb_typeof(row_item -> 'options') <> 'object' then
      raise exception 'row % options must be an object', row_index;
    end if;

    foreach option_key in array array['A','B','C','D'] loop
      option_text := btrim(coalesce(row_item -> 'options' ->> option_key, ''));
      if option_text = '' or char_length(option_text) > 2000 then
        raise exception 'row % option % is invalid', row_index, option_key;
      end if;
    end loop;

    correct_key := row_item ->> 'correctOptionKey';
    if correct_key not in ('A','B','C','D') then
      raise exception 'row % has an invalid correct option key', row_index;
    end if;

    topic := btrim(coalesce(row_item ->> 'topic', ''));
    if topic = '' or char_length(topic) > 200 then
      raise exception 'row % has an invalid topic', row_index;
    end if;

    difficulty := row_item ->> 'difficulty';
    if difficulty not in ('easy','medium','hard') then
      raise exception 'row % has an invalid difficulty', row_index;
    end if;

    if jsonb_typeof(row_item -> 'hasMedia') <> 'boolean' then
      raise exception 'row % has an invalid media flag', row_index;
    end if;
    has_media := (row_item ->> 'hasMedia')::boolean;

    if not has_media then
      if row_item ->> 'mediaType' is not null
         or row_item ->> 'mediaFilename' is not null
         or row_item ->> 'maxPlayCount' is not null then
        raise exception 'row % contains media metadata while hasMedia is false', row_index;
      end if;
    else
      media_type := row_item ->> 'mediaType';
      media_filename := btrim(coalesce(row_item ->> 'mediaFilename', ''));
      if media_type not in ('audio','image','video') then
        raise exception 'row % has an invalid media type', row_index;
      end if;
      if media_filename = '' or char_length(media_filename) > 255
         or position('/' in media_filename) > 0
         or strpos(media_filename, chr(92)) > 0 then
        raise exception 'row % has an invalid media filename', row_index;
      end if;

      if media_type = 'image' then
        if row_item ->> 'maxPlayCount' is not null then
          raise exception 'row % image media must not have a play count', row_index;
        end if;
      else
        if row_item ->> 'maxPlayCount' is null then
          raise exception 'row % playable media requires maxPlayCount', row_index;
        end if;
        max_play_count := (row_item ->> 'maxPlayCount')::integer;
        if max_play_count < 1 or max_play_count > 20 then
          raise exception 'row % has invalid maxPlayCount', row_index;
        end if;
      end if;
    end if;

    if not exists (
      select 1
      from public.question_categories qc
      where qc.teacher_id = bank_teacher_id
        and qc.name = topic
    ) then
      raise exception 'row % topic does not exist for this teacher: %', row_index, topic;
    end if;
  end loop;

  -- Insert only after the complete validation pass succeeds.
  row_index := 0;
  for row_item in select value from jsonb_array_elements(p_rows) loop
    row_index := row_index + 1;
    topic := btrim(row_item ->> 'topic');
    select qc.id
      into category_id
    from public.question_categories qc
    where qc.teacher_id = bank_teacher_id
      and qc.name = topic;

    question_id := extensions.gen_random_uuid();
    correct_key := row_item ->> 'correctOptionKey';
    difficulty := row_item ->> 'difficulty';

    insert into public.questions (
      id,
      teacher_id,
      category_id,
      type,
      payload,
      explanation,
      tags,
      media_url,
      question_bank_id,
      question_text,
      difficulty,
      correct_option_key
    ) values (
      question_id,
      bank_teacher_id,
      category_id,
      'mcq',
      jsonb_build_object(
        'options', row_item -> 'options',
        'correct_option_key', correct_key,
        'source_order', (row_item ->> 'no')::integer
      ),
      null,
      '{}',
      null,
      p_question_bank_id,
      btrim(row_item ->> 'question'),
      difficulty,
      correct_key
    );

    option_position := 0;
    foreach option_key in array array['A','B','C','D'] loop
      option_position := option_position + 1;
      if exists (
        select 1
        from information_schema.columns c
        where c.table_schema = 'public'
          and c.table_name = 'question_options'
          and c.column_name = 'position'
      ) then
        execute
          'insert into public.question_options (question_id, option_key, option_text, position) values ($1, $2, $3, $4)'
          using question_id, option_key, btrim(row_item -> 'options' ->> option_key), option_position;
      else
        execute
          'insert into public.question_options (question_id, option_key, option_text) values ($1, $2, $3)'
          using question_id, option_key, btrim(row_item -> 'options' ->> option_key);
      end if;
    end loop;

    has_media := (row_item ->> 'hasMedia')::boolean;
    if has_media then
      media_type := row_item ->> 'mediaType';
      media_filename := btrim(row_item ->> 'mediaFilename');
      max_play_count := null;
      if media_type in ('audio','video') then
        max_play_count := (row_item ->> 'maxPlayCount')::integer;
      end if;

      insert into public.question_media (
        question_id,
        media_type,
        expected_filename,
        max_play_count
      ) values (
        question_id,
        media_type,
        media_filename,
        max_play_count
      );
    end if;
  end loop;

  return row_count;
end;
$$;

revoke execute on function public.import_question_bank_rows(uuid, jsonb) from public, anon;
grant execute on function public.import_question_bank_rows(uuid, jsonb) to authenticated;
