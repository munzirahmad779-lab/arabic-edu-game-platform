-- =============================================================================
-- 0004_question_bank_foundation.sql
-- Phase 3A — Question Bank foundation.
--
-- Scope:
--   - question_banks
--   - question_options
--   - extend questions with bank/text/difficulty/correct option
--   - owner-only RLS for the initial Question Bank foundation
--   - explicit Data API grants
--
-- Sharing, Excel import, RPC write workflow, and UI are intentionally deferred
-- to later Phase 3 steps.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- question_banks
-- ---------------------------------------------------------------------------
create table public.question_banks (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) > 0),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (teacher_id, name)
);

create index idx_question_banks_teacher_id
  on public.question_banks (teacher_id);

create trigger trg_question_banks_updated_at
  before update on public.question_banks
  for each row execute function public.set_updated_at();

comment on table public.question_banks is
  'Teacher-owned question bank. Sharing is implemented separately in a later Phase 3 migration.';

-- ---------------------------------------------------------------------------
-- Extend questions
-- ---------------------------------------------------------------------------
alter table public.questions
  add column question_bank_id uuid
    references public.question_banks (id) on delete cascade,
  add column question_text text,
  add column difficulty text
    check (difficulty in ('easy', 'medium', 'hard')),
  add column correct_option_key text
    check (correct_option_key in ('A', 'B', 'C', 'D'));

create index idx_questions_question_bank_id
  on public.questions (question_bank_id);

-- ---------------------------------------------------------------------------
-- question_options
-- ---------------------------------------------------------------------------
create table public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  option_key text not null check (option_key in ('A', 'B', 'C', 'D')),
  option_text text not null check (char_length(btrim(option_text)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (question_id, option_key)
);

create index idx_question_options_question_id
  on public.question_options (question_id);

create trigger trg_question_options_updated_at
  before update on public.question_options
  for each row execute function public.set_updated_at();

comment on table public.question_options is
  'Normalized MCQ options. Exactly four options A-D are required for a valid Question Bank question; validation is handled by the controlled write workflow introduced later.';

-- ---------------------------------------------------------------------------
-- Relationship integrity
-- ---------------------------------------------------------------------------
create or replace function public.assert_question_bank_relationship_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'question_banks' then
    if not exists (
      select 1
      from public.profiles p
      where p.id = new.teacher_id
    ) then
      raise exception 'question bank teacher must reference an existing profile';
    end if;

  elsif tg_table_name = 'questions' then
    if new.question_bank_id is null then
      raise exception 'new questions must belong to a question bank';
    end if;

    if not exists (
      select 1
      from public.question_banks qb
      where qb.id = new.question_bank_id
        and qb.teacher_id = new.teacher_id
    ) then
      raise exception 'question bank must belong to the same teacher as the question';
    end if;

    if new.question_text is null
       or char_length(btrim(new.question_text)) = 0 then
      raise exception 'question text is required for Question Bank questions';
    end if;

    if new.difficulty is null then
      raise exception 'difficulty is required for Question Bank questions';
    end if;

    if new.correct_option_key is null then
      raise exception 'correct option is required for Question Bank questions';
    end if;

  elsif tg_table_name = 'question_options' then
    if not exists (
      select 1
      from public.questions q
      join public.question_banks qb
        on qb.id = q.question_bank_id
      where q.id = new.question_id
    ) then
      raise exception 'question option must belong to a Question Bank question';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_question_banks_relationship_integrity
  before insert or update on public.question_banks
  for each row
  execute function public.assert_question_bank_relationship_integrity();

create trigger trg_questions_question_bank_integrity
  before insert or update on public.questions
  for each row
  execute function public.assert_question_bank_relationship_integrity();

create trigger trg_question_options_relationship_integrity
  before insert or update on public.question_options
  for each row
  execute function public.assert_question_bank_relationship_integrity();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.question_banks enable row level security;
alter table public.question_options enable row level security;

-- question_banks: owner only for Phase 3A.
create policy question_banks_select_own
  on public.question_banks
  for select
  to authenticated
  using (teacher_id = (select auth.uid()));

create policy question_banks_insert_own
  on public.question_banks
  for insert
  to authenticated
  with check (teacher_id = (select auth.uid()));

create policy question_banks_update_own
  on public.question_banks
  for update
  to authenticated
  using (teacher_id = (select auth.uid()))
  with check (teacher_id = (select auth.uid()));

create policy question_banks_delete_own
  on public.question_banks
  for delete
  to authenticated
  using (teacher_id = (select auth.uid()));

-- questions: owner-only SELECT for now.
-- Writes are deliberately withheld from the client. Controlled RPCs will
-- perform validated/atomic Question Bank writes in a later Phase 3 step.
create policy questions_select_own_bank
  on public.questions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.question_banks qb
      where qb.id = questions.question_bank_id
        and qb.teacher_id = (select auth.uid())
    )
  );

-- question_options: owner-only SELECT for now.
create policy question_options_select_own_bank
  on public.question_options
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.questions q
      join public.question_banks qb
        on qb.id = q.question_bank_id
      where q.id = question_options.question_id
        and qb.teacher_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Explicit Data API grants
--
-- Grants and RLS intentionally work together. The table is reachable only
-- through authenticated requests, and the policies above determine which
-- rows are visible.
-- ---------------------------------------------------------------------------
revoke all on table public.question_banks
  from anon, authenticated;

grant select, insert, update, delete
  on table public.question_banks
  to authenticated;

revoke all on table public.questions
  from anon, authenticated;

grant select
  on table public.questions
  to authenticated;

revoke all on table public.question_options
  from anon, authenticated;

grant select
  on table public.question_options
  to authenticated;

-- Anonymous users receive no Question Bank access.
