-- 0039_student_practice.sql
-- Portal siswa: latihan mandiri (mode endless & practice) tanpa kode room.
-- Data jawaban disimpan untuk laporan harian + review kapan saja.

create table if not exists public.student_practice_answers (
  id uuid primary key default extensions.gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  selected_option_key text not null check (selected_option_key in ('A','B','C','D')),
  is_correct boolean not null,
  answered_at timestamptz not null default now()
);

create unique index if not exists student_practice_answers_unique_idx
  on public.student_practice_answers (student_id, game_id, question_id);

create index if not exists student_practice_answers_student_idx
  on public.student_practice_answers (student_id, answered_at desc);

create index if not exists student_practice_answers_game_idx
  on public.student_practice_answers (game_id, student_id);

alter table public.student_practice_answers enable row level security;

-- Siswa tidak akses langsung via tabel — hanya lewat RPC.
-- RLS deny-by-default (tidak ada policy = tidak bisa diakses).
-- Grant tetap diberikan supaya RPC (SECURITY DEFINER) bisa insert.
grant select, insert, update, delete
  on public.student_practice_answers to anon, authenticated;

-- ============================================================
-- RPC 1: list game practice di kelas siswa
-- ============================================================
create or replace function public.student_list_practice_games(p_token text)
returns table (
  id uuid,
  name text,
  mode text,
  question_count integer
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_student_id uuid;
  v_class_id uuid;
begin
  select s.student_id, s.class_id
    into v_student_id, v_class_id
  from public.verify_student_session(p_token) s
  limit 1;

  if v_student_id is null then
    raise exception 'invalid_session';
  end if;

  return query
  select
    g.id,
    g.name,
    g.mode,
    (
      select count(*)::int
      from public.game_questions gq
      where gq.game_id = g.id
    ) as question_count
  from public.games g
  where g.class_id = v_class_id
    and g.mode in ('endless', 'practice')
  order by g.created_at desc;
end;
$$;

-- ============================================================
-- RPC 2: detail game + soal (tanpa bocorkan kunci jawaban)
-- ============================================================
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

  -- Bangun array soal + options + media (TANPA correct_option_key & explanation)
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
          'public_url', case
            when qm.storage_path is not null
              then '/storage/v1/object/public/question-media/' || qm.storage_path
            else null
          end,
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

-- ============================================================
-- RPC 3: submit jawaban latihan (UPSERT)
-- ============================================================
create or replace function public.student_submit_practice_answer(
  p_token text,
  p_game_id uuid,
  p_question_id uuid,
  p_selected_option_key text
)
returns table (
  accepted boolean,
  is_correct boolean,
  correct_option_key text,
  explanation text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_student_id uuid;
  v_class_id uuid;
  v_correct_key text;
  v_explanation text;
  v_is_correct boolean;
begin
  select s.student_id, s.class_id
    into v_student_id, v_class_id
  from public.verify_student_session(p_token) s
  limit 1;

  if v_student_id is null then
    raise exception 'invalid_session';
  end if;

  if p_selected_option_key not in ('A','B','C','D') then
    raise exception 'invalid_option';
  end if;

  -- Validasi game milik kelas siswa + mode practice
  if not exists (
    select 1 from public.games g
    where g.id = p_game_id
      and g.class_id = v_class_id
      and g.mode in ('endless', 'practice')
  ) then
    raise exception 'game_not_found';
  end if;

  -- Validasi soal bagian dari game
  if not exists (
    select 1 from public.game_questions gq
    where gq.game_id = p_game_id and gq.question_id = p_question_id
  ) then
    raise exception 'question_not_in_game';
  end if;

  select q.correct_option_key, q.explanation
    into v_correct_key, v_explanation
  from public.questions q
  where q.id = p_question_id;

  if v_correct_key is null then
    raise exception 'question_missing_key';
  end if;

  v_is_correct := (p_selected_option_key = v_correct_key);

  insert into public.student_practice_answers (
    student_id, game_id, question_id, selected_option_key, is_correct, answered_at
  ) values (
    v_student_id, p_game_id, p_question_id, p_selected_option_key, v_is_correct, now()
  )
  on conflict (student_id, game_id, question_id)
  do update set
    selected_option_key = excluded.selected_option_key,
    is_correct = excluded.is_correct,
    answered_at = excluded.answered_at;

  return query
  select true, v_is_correct, v_correct_key, v_explanation;
end;
$$;

-- ============================================================
-- RPC 4: reset latihan (hapus semua jawaban siswa untuk game ini)
-- ============================================================
create or replace function public.student_reset_practice(
  p_token text,
  p_game_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_student_id uuid;
  v_class_id uuid;
begin
  select s.student_id, s.class_id
    into v_student_id, v_class_id
  from public.verify_student_session(p_token) s
  limit 1;

  if v_student_id is null then
    raise exception 'invalid_session';
  end if;

  if not exists (
    select 1 from public.games g
    where g.id = p_game_id and g.class_id = v_class_id
  ) then
    raise exception 'game_not_found';
  end if;

  delete from public.student_practice_answers
  where student_id = v_student_id and game_id = p_game_id;
end;
$$;

-- ============================================================
-- RPC 5: ambil progress jawaban sebelumnya (untuk resume/review)
-- ============================================================
create or replace function public.student_get_practice_progress(
  p_token text,
  p_game_id uuid
)
returns table (
  question_id uuid,
  selected_option_key text,
  is_correct boolean,
  answered_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_student_id uuid;
  v_class_id uuid;
begin
  select s.student_id, s.class_id
    into v_student_id, v_class_id
  from public.verify_student_session(p_token) s
  limit 1;

  if v_student_id is null then
    raise exception 'invalid_session';
  end if;

  if not exists (
    select 1 from public.games g
    where g.id = p_game_id and g.class_id = v_class_id
  ) then
    raise exception 'game_not_found';
  end if;

  return query
  select
    spa.question_id,
    spa.selected_option_key,
    spa.is_correct,
    spa.answered_at
  from public.student_practice_answers spa
  where spa.student_id = v_student_id and spa.game_id = p_game_id;
end;
$$;

revoke all on function public.student_list_practice_games(text) from public;
grant execute on function public.student_list_practice_games(text) to anon, authenticated;

revoke all on function public.student_get_practice_game(text, uuid) from public;
grant execute on function public.student_get_practice_game(text, uuid) to anon, authenticated;

revoke all on function public.student_submit_practice_answer(text, uuid, uuid, text) from public;
grant execute on function public.student_submit_practice_answer(text, uuid, uuid, text) to anon, authenticated;

revoke all on function public.student_reset_practice(text, uuid) from public;
grant execute on function public.student_reset_practice(text, uuid) to anon, authenticated;

revoke all on function public.student_get_practice_progress(text, uuid) from public;
grant execute on function public.student_get_practice_progress(text, uuid) to anon, authenticated;