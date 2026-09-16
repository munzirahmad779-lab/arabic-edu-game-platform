-- 0055_essay.sql
-- Essay assignments + submissions + AI grading.

-- ============================================================
-- SOAL ESSAY (buatan guru)
-- ============================================================
create table if not exists public.essay_assignments (
  id uuid primary key default extensions.gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  title text not null,
  question_text text not null,
  ideal_answer text,
  duration_minutes int not null default 30 check (duration_minutes between 5 and 180),
  is_published boolean not null default false,
  rubric_content int not null default 40,
  rubric_grammar int not null default 30,
  rubric_vocabulary int not null default 30,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists essay_assignments_teacher_idx
  on public.essay_assignments (teacher_id, created_at desc);
create index if not exists essay_assignments_class_idx
  on public.essay_assignments (class_id);

alter table public.essay_assignments enable row level security;
grant select, insert, update, delete on public.essay_assignments to authenticated;

drop policy if exists essay_assignments_teacher_all on public.essay_assignments;
create policy essay_assignments_teacher_all on public.essay_assignments
  for all to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

-- ============================================================
-- JAWABAN SISWA + HASIL KOREKSI AI
-- ============================================================
create table if not exists public.essay_submissions (
  id uuid primary key default extensions.gen_random_uuid(),
  assignment_id uuid not null references public.essay_assignments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  answer_text text not null,
  duration_seconds int,
  ai_score int,
  ai_feedback text,
  ai_scores_json jsonb,
  ai_model text,
  graded_at timestamptz,
  teacher_override_score int,
  teacher_override_feedback text,
  teacher_graded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists essay_submissions_unique_idx
  on public.essay_submissions (assignment_id, student_id);

create index if not exists essay_submissions_student_idx
  on public.essay_submissions (student_id, created_at desc);
create index if not exists essay_submissions_assignment_idx
  on public.essay_submissions (assignment_id);

alter table public.essay_submissions enable row level security;
grant select, insert, update, delete on public.essay_submissions to authenticated;

drop policy if exists essay_submissions_teacher_all on public.essay_submissions;
create policy essay_submissions_teacher_all on public.essay_submissions
  for all to authenticated
  using (
    exists (
      select 1 from public.essay_assignments ea
      where ea.id = assignment_id and ea.teacher_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.essay_assignments ea
      where ea.id = assignment_id and ea.teacher_id = auth.uid()
    )
  );

-- ============================================================
-- RPC SISWA: List essay assignments untuk kelasnya
-- ============================================================
create or replace function public.student_list_essays(p_token text)
returns table (
  id uuid,
  title text,
  duration_minutes int,
  has_submission boolean,
  ai_score int,
  submitted_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_student_id uuid;
  v_class_id uuid;
begin
  select s.student_id, s.class_id into v_student_id, v_class_id
  from public.verify_student_session(p_token) s
  limit 1;

  if v_student_id is null then
    raise exception 'invalid_session';
  end if;

  return query
  select
    ea.id,
    ea.title,
    ea.duration_minutes,
    (sub.id is not null) as has_submission,
    coalesce(sub.teacher_override_score, sub.ai_score)::int,
    sub.created_at
  from public.essay_assignments ea
  left join public.essay_submissions sub
    on sub.assignment_id = ea.id and sub.student_id = v_student_id
  where ea.class_id = v_class_id and ea.is_published = true
  order by ea.created_at desc;
end;
$$;

revoke all on function public.student_list_essays(text) from public;
grant execute on function public.student_list_essays(text) to anon, authenticated;

-- ============================================================
-- RPC SISWA: Detail assignment
-- ============================================================
create or replace function public.student_get_essay(p_token text, p_essay_id uuid)
returns table (
  id uuid,
  title text,
  question_text text,
  duration_minutes int,
  my_answer text,
  my_score int,
  my_feedback text,
  my_scores_json jsonb,
  submitted_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_student_id uuid;
  v_class_id uuid;
begin
  select s.student_id, s.class_id into v_student_id, v_class_id
  from public.verify_student_session(p_token) s
  limit 1;

  if v_student_id is null then
    raise exception 'invalid_session';
  end if;

  return query
  select
    ea.id,
    ea.title,
    ea.question_text,
    ea.duration_minutes,
    sub.answer_text,
    coalesce(sub.teacher_override_score, sub.ai_score)::int,
    coalesce(sub.teacher_override_feedback, sub.ai_feedback),
    sub.ai_scores_json,
    sub.created_at
  from public.essay_assignments ea
  left join public.essay_submissions sub
    on sub.assignment_id = ea.id and sub.student_id = v_student_id
  where ea.id = p_essay_id
    and ea.class_id = v_class_id
    and ea.is_published = true;
end;
$$;

revoke all on function public.student_get_essay(text, uuid) from public;
grant execute on function public.student_get_essay(text, uuid) to anon, authenticated;

-- ============================================================
-- RPC SISWA: Submit
-- ============================================================
create or replace function public.student_submit_essay(
  p_token text,
  p_essay_id uuid,
  p_answer_text text,
  p_duration_seconds int
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_student_id uuid;
  v_class_id uuid;
  v_sub_id uuid;
begin
  select s.student_id, s.class_id into v_student_id, v_class_id
  from public.verify_student_session(p_token) s
  limit 1;

  if v_student_id is null then
    raise exception 'invalid_session';
  end if;

  if p_answer_text is null or length(btrim(p_answer_text)) < 10 then
    raise exception 'answer_too_short';
  end if;

  if length(p_answer_text) > 20000 then
    raise exception 'answer_too_long';
  end if;

  if not exists (
    select 1 from public.essay_assignments ea
    where ea.id = p_essay_id
      and ea.class_id = v_class_id
      and ea.is_published = true
  ) then
    raise exception 'essay_not_found';
  end if;

  if exists (
    select 1 from public.essay_submissions
    where assignment_id = p_essay_id and student_id = v_student_id
  ) then
    raise exception 'already_submitted';
  end if;

  insert into public.essay_submissions (
    assignment_id, student_id, answer_text, duration_seconds
  ) values (
    p_essay_id, v_student_id, btrim(p_answer_text), p_duration_seconds
  )
  returning id into v_sub_id;

  return v_sub_id;
end;
$$;

revoke all on function public.student_submit_essay(text, uuid, text, int) from public;
grant execute on function public.student_submit_essay(text, uuid, text, int) to anon, authenticated;

-- ============================================================
-- RPC SISWA: Set AI grade
-- ============================================================
create or replace function public.student_set_ai_grade(
  p_token text,
  p_submission_id uuid,
  p_ai_score int,
  p_ai_feedback text,
  p_ai_scores_json jsonb,
  p_ai_model text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_student_id uuid;
begin
  select s.student_id into v_student_id
  from public.verify_student_session(p_token) s
  limit 1;

  if v_student_id is null then
    raise exception 'invalid_session';
  end if;

  update public.essay_submissions
  set ai_score = p_ai_score,
      ai_feedback = p_ai_feedback,
      ai_scores_json = p_ai_scores_json,
      ai_model = p_ai_model,
      graded_at = now(),
      updated_at = now()
  where id = p_submission_id
    and student_id = v_student_id;
end;
$$;

revoke all on function public.student_set_ai_grade(text, uuid, int, text, jsonb, text) from public;
grant execute on function public.student_set_ai_grade(text, uuid, int, text, jsonb, text) to anon, authenticated;

-- ============================================================
-- RPC GURU: List essay assignments
-- ============================================================
create or replace function public.teacher_list_essays(p_class_id uuid)
returns table (
  id uuid,
  title text,
  duration_minutes int,
  is_published boolean,
  submission_count int,
  avg_score numeric,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not exists (
    select 1 from public.classes c
    where c.id = p_class_id and c.teacher_id = auth.uid()
  ) then
    raise exception 'FORBIDDEN';
  end if;

  return query
  select
    ea.id,
    ea.title,
    ea.duration_minutes,
    ea.is_published,
    (select count(*)::int from public.essay_submissions es where es.assignment_id = ea.id),
    (select round(avg(coalesce(es.teacher_override_score, es.ai_score))::numeric, 1)
       from public.essay_submissions es
      where es.assignment_id = ea.id),
    ea.created_at
  from public.essay_assignments ea
  where ea.class_id = p_class_id
  order by ea.created_at desc;
end;
$$;

revoke all on function public.teacher_list_essays(uuid) from public;
grant execute on function public.teacher_list_essays(uuid) to authenticated;

-- ============================================================
-- RPC GURU: Lihat submissions
-- ============================================================
create or replace function public.teacher_essay_submissions(p_essay_id uuid)
returns table (
  submission_id uuid,
  student_id uuid,
  student_name text,
  answer_text text,
  duration_seconds int,
  ai_score int,
  ai_feedback text,
  ai_scores_json jsonb,
  teacher_override_score int,
  teacher_override_feedback text,
  submitted_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not exists (
    select 1 from public.essay_assignments ea
    where ea.id = p_essay_id and ea.teacher_id = auth.uid()
  ) then
    raise exception 'FORBIDDEN';
  end if;

  return query
  select
    es.id,
    es.student_id,
    s.name,
    es.answer_text,
    es.duration_seconds,
    es.ai_score,
    es.ai_feedback,
    es.ai_scores_json,
    es.teacher_override_score,
    es.teacher_override_feedback,
    es.created_at
  from public.essay_submissions es
  join public.students s on s.id = es.student_id
  where es.assignment_id = p_essay_id
  order by es.created_at desc;
end;
$$;

revoke all on function public.teacher_essay_submissions(uuid) from public;
grant execute on function public.teacher_essay_submissions(uuid) to authenticated;