-- 0040_fix_practice_media.sql
-- Perbaiki RPC: return storage_path, bukan relative public_url.

drop function if exists public.student_get_practice_game(text, uuid);

create or replace function public.student_get_practice_game(
  p_token text,
  p_game_id uuid
)
returns table (
  game_id uuid,
  game_name text,
  game_mode text,
  questions jsonb
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_student_id uuid;
  v_class_id uuid;
  v_game record;
  v_questions jsonb;
begin
  select s.student_id, s.class_id
    into v_student_id, v_class_id
  from public.verify_student_session(p_token) s
  limit 1;

  if v_student_id is null then
    raise exception 'invalid_session';
  end if;

  select g.id, g.name, g.mode
    into v_game
  from public.games g
  where g.id = p_game_id
    and g.class_id = v_class_id
    and g.mode in ('endless', 'practice');

  if not found then
    raise exception 'game_not_found';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', q.id,
      'question_text', q.question_text,
      'difficulty', q.difficulty,
      'options', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', qo.id,
          'option_key', qo.option_key,
          'option_text', qo.option_text
        ) order by qo.option_key)
        from public.question_options qo
        where qo.question_id = q.id
      ), '[]'::jsonb),
      'media', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', qm.id,
          'media_type', qm.media_type,
          'storage_path', qm.storage_path,
          'mime_type', qm.mime_type,
          'max_play_count', qm.max_play_count
        ))
        from public.question_media qm
        where qm.question_id = q.id and qm.storage_path is not null
      ), '[]'::jsonb)
    ) order by gq.position
  ), '[]'::jsonb)
  into v_questions
  from public.game_questions gq
  join public.questions q on q.id = gq.question_id
  where gq.game_id = p_game_id;

  return query
  select v_game.id, v_game.name, v_game.mode, v_questions;
end;
$$;

revoke all on function public.student_get_practice_game(text, uuid) from public;
grant execute on function public.student_get_practice_game(text, uuid) to anon, authenticated;