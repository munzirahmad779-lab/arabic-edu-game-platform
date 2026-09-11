-- =============================================================================
-- 0001_init_schema.sql
-- Phase 1 — Foundation: core database schema.
--
-- Scope (per PROJECT_CONTEXT.md, Phase 1 / Section 14):
--   profiles, classes, students, question_categories, questions, games,
--   game_questions, rooms, room_participants, submissions.
--
-- room_events is intentionally NOT created in Phase 1: PROJECT_CONTEXT.md
-- marks it optional and the project rules forbid unnecessary event-sourcing
-- complexity. It can be added later if a concrete need appears.
--
-- Locked architectural principles enforced by this schema:
--   - Question Type != Game Type (questions vs games/game_questions are
--     separate tables with no structural coupling beyond game_questions).
--   - MVP question type is MCQ only (enforced via CHECK constraint, not an
--     ENUM, so a future phase can extend the allowed set without a type
--     rewrite).
--   - MCQ answers are graded by option id (submissions.selected_option_id is
--     an opaque id, never free text), avoiding Arabic string-normalization
--     pitfalls (harakat, Unicode, bidi).
--   - rooms.snapshot is an immutable historical copy of the game+questions
--     at room-creation time. Historical results must never depend on the
--     live/current version of a question or game.
--   - submissions are immutable (no UPDATE/DELETE policy is granted to
--     anyone in 0002; enforcement is done at the RLS layer, not just by
--     application convention).
--   - Room capacity defaults to 30 (MVP product constraint) but is a plain
--     column, not a structural limit, so it can be changed later.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
-- gen_random_uuid() for primary keys.
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Shared helper: auto-maintain updated_at on every UPDATE.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- One row per teacher/user account. Mirrors auth.users 1:1.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'teacher' check (role in ('teacher', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Teacher/user account profile. One row per auth.users row, created automatically by handle_new_user().';

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Teachers may edit their own profile fields, but must never self-promote
-- by changing role through the authenticated client. Privileged server-side
-- operations (where auth.uid() is null) may still change the role later.
create or replace function public.prevent_teacher_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and new.role is distinct from old.role then
    raise exception 'profile role cannot be changed by the authenticated user';
  end if;
  return new;
end;
$$;

create trigger trg_profiles_protect_role
  before update on public.profiles
  for each row execute function public.prevent_teacher_role_escalation();

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email, ''), nullif(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- classes
-- Minimal class management, owned by a teacher.
-- ---------------------------------------------------------------------------
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (teacher_id, name)
);

create index idx_classes_teacher_id on public.classes (teacher_id);

create trigger trg_classes_updated_at
  before update on public.classes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- students
-- Persistent, lightweight student identity. Scoped uniquely per class
-- (NOT global — see PROJECT_CONTEXT.md Section 10.2).
-- Students do NOT use Supabase Auth; pin_hash stores a hashed PIN, never
-- plaintext. Hashing and verification are performed by a controlled RPC in a
-- later phase (student join flow is out of scope for Phase 1).
-- ---------------------------------------------------------------------------
create table public.students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  name text not null check (char_length(btrim(name)) > 0),
  pin_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, name)
);

create index idx_students_class_id on public.students (class_id);

create trigger trg_students_updated_at
  before update on public.students
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- question_categories
-- Scoped per teacher (e.g. المفردات، النحو، الصرف). Free-form and expected
-- to grow.
-- ---------------------------------------------------------------------------
create table public.question_categories (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (teacher_id, name)
);

create index idx_question_categories_teacher_id on public.question_categories (teacher_id);

create trigger trg_question_categories_updated_at
  before update on public.question_categories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- questions
-- MVP: MCQ only. payload is JSONB; its internal shape (option ids, correct
-- option id, Arabic text, etc.) is defined and validated by the Question
-- Engine in Phase 2 — Phase 1 only guarantees the column exists and is
-- structurally sound (not null, jsonb).
--
-- media_url is included now (nullable) so the column does not need to be
-- added later, per PROJECT_CONTEXT.md Section 19 ("schema dapat disiapkan
-- agar media URL dapat ditambahkan pada fase berikutnya"). It is unused in
-- the MVP (text-only).
--
-- NOTE: explanation timing (after_each_question / after_game_only / never)
-- is deliberately NOT a column here. PROJECT_CONTEXT.md Section 4.3 states
-- timing is the Game's responsibility, not the Question Engine's — so it
-- lives on game_questions instead.
-- ---------------------------------------------------------------------------
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  category_id uuid references public.question_categories (id) on delete set null,
  type text not null default 'mcq' check (type in ('mcq')),
  payload jsonb not null,
  explanation text,
  tags text[] not null default '{}',
  media_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_questions_teacher_id on public.questions (teacher_id);
create index idx_questions_category_id on public.questions (category_id);
create index idx_questions_tags on public.questions using gin (tags);

create trigger trg_questions_updated_at
  before update on public.questions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- games
-- Teacher-configured game. MVP: a single game_type (arabic_chase_race) and
-- two modes (competitive / learning).
-- ---------------------------------------------------------------------------
create table public.games (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  class_id uuid references public.classes (id) on delete set null,
  name text not null check (char_length(btrim(name)) > 0),
  game_type text not null default 'arabic_chase_race' check (game_type in ('arabic_chase_race')),
  mode text not null check (mode in ('competitive', 'learning')),
  duration_seconds integer not null check (duration_seconds > 0),
  ranking_visibility text not null default 'full' check (ranking_visibility in ('full', 'hidden', 'self_only')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_games_teacher_id on public.games (teacher_id);
create index idx_games_class_id on public.games (class_id);

create trigger trg_games_updated_at
  before update on public.games
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- game_questions
-- Join table: which questions belong to a game, in what order, and (per
-- PROJECT_CONTEXT.md 4.3) with what explanation timing — a Game-level
-- concern, not a Question Engine concern.
-- ---------------------------------------------------------------------------
create table public.game_questions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete restrict,
  position integer not null check (position >= 0),
  explanation_timing text not null default 'after_each_question'
    check (explanation_timing in ('after_each_question', 'after_game_only', 'never')),
  created_at timestamptz not null default now(),
  unique (game_id, position),
  unique (game_id, question_id)
);

create index idx_game_questions_game_id on public.game_questions (game_id);
create index idx_game_questions_question_id on public.game_questions (question_id);

-- ---------------------------------------------------------------------------
-- rooms
-- A live or finished session. snapshot is the immutable historical copy of
-- the game + its questions at the moment the room was created; gameplay and
-- historical results must read from snapshot, never from live games/
-- questions rows.
-- ---------------------------------------------------------------------------
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  game_id uuid references public.games (id) on delete set null,
  class_id uuid references public.classes (id) on delete set null,
  state text not null default 'waiting' check (state in ('waiting', 'running', 'ended', 'locked')),
  snapshot jsonb not null,
  capacity integer not null default 30 check (capacity > 0),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_rooms_teacher_id on public.rooms (teacher_id);
create index idx_rooms_code on public.rooms (code);
create index idx_rooms_state on public.rooms (state);

create trigger trg_rooms_updated_at
  before update on public.rooms
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- room_participants
-- Either a known student (student_id) or a guest (guest_name), never
-- neither. A student may join a given room only once.
-- ---------------------------------------------------------------------------
create table public.room_participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  student_id uuid references public.students (id) on delete set null,
  guest_name text check (guest_name is null or char_length(btrim(guest_name)) > 0),
  connection_state text not null default 'connected' check (connection_state in ('connected', 'disconnected')),
  joined_at timestamptz not null default now(),
  constraint room_participants_identity_present
    check ((student_id is not null) <> (guest_name is not null))
);

create index idx_room_participants_room_id on public.room_participants (room_id);
create index idx_room_participants_student_id on public.room_participants (student_id);

-- A given student can only occupy one participant slot in a given room.
-- (Guests are not de-duplicated: a room may have several distinct guests.)
create unique index uq_room_participants_room_student
  on public.room_participants (room_id, student_id)
  where student_id is not null;

-- ---------------------------------------------------------------------------
-- submissions
-- Immutable student answers. Scoring is computed server-side (Phase 4/5),
-- never trusted from the client. One submission per participant per
-- question (duplicate-submission protection at the constraint level).
-- ---------------------------------------------------------------------------
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete restrict,
  room_participant_id uuid not null references public.room_participants (id) on delete restrict,
  question_id uuid not null references public.questions (id) on delete restrict,
  selected_option_id text not null,
  is_correct boolean not null,
  response_time_ms integer not null check (response_time_ms >= 0),
  score_awarded integer not null,
  submitted_at timestamptz not null default now(),
  unique (room_participant_id, question_id)
);

create index idx_submissions_room_id on public.submissions (room_id);
create index idx_submissions_room_participant_id on public.submissions (room_participant_id);
create index idx_submissions_question_id on public.submissions (question_id);


-- ---------------------------------------------------------------------------
-- Cross-tenant / relationship integrity guards
-- ---------------------------------------------------------------------------
-- RLS controls what a client can see, but RLS alone does not guarantee that
-- foreign keys point to rows owned by the same teacher. These SECURITY
-- DEFINER triggers enforce the business tenancy boundary at the database
-- level, including direct SQL writes and future RPCs.
create or replace function public.assert_project_relationship_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'questions' then
    if new.category_id is not null
       and not exists (
         select 1
         from public.question_categories qc
         where qc.id = new.category_id
           and qc.teacher_id = new.teacher_id
       ) then
      raise exception 'question category must belong to the same teacher';
    end if;

  elsif tg_table_name = 'games' then
    if new.class_id is not null
       and not exists (
         select 1
         from public.classes c
         where c.id = new.class_id
           and c.teacher_id = new.teacher_id
       ) then
      raise exception 'game class must belong to the same teacher';
    end if;

  elsif tg_table_name = 'game_questions' then
    if not exists (
      select 1
      from public.games g
      join public.questions q
        on q.id = new.question_id
       and q.teacher_id = g.teacher_id
      where g.id = new.game_id
    ) then
      raise exception 'game and question must belong to the same teacher';
    end if;

  elsif tg_table_name = 'rooms' then
    if new.game_id is not null
       and not exists (
         select 1
         from public.games g
         where g.id = new.game_id
           and g.teacher_id = new.teacher_id
       ) then
      raise exception 'room game must belong to the same teacher';
    end if;

    if new.class_id is not null
       and not exists (
         select 1
         from public.classes c
         where c.id = new.class_id
           and c.teacher_id = new.teacher_id
       ) then
      raise exception 'room class must belong to the same teacher';
    end if;

    if new.game_id is not null
       and new.class_id is not null
       and exists (
         select 1
         from public.games g
         where g.id = new.game_id
           and g.class_id is not null
           and g.class_id <> new.class_id
       ) then
      raise exception 'room class must match the game class when the game is class-scoped';
    end if;

  elsif tg_table_name = 'room_participants' then
    if new.student_id is not null
       and not exists (
         select 1
         from public.students s
         join public.classes c on c.id = s.class_id
         join public.rooms r on r.id = new.room_id
         where s.id = new.student_id
           and c.teacher_id = r.teacher_id
           and (r.class_id is null or s.class_id = r.class_id)
       ) then
      raise exception 'participant student must belong to the room teacher and class';
    end if;

  elsif tg_table_name = 'submissions' then
    if not exists (
      select 1
      from public.room_participants rp
      where rp.id = new.room_participant_id
        and rp.room_id = new.room_id
    ) then
      raise exception 'submission participant must belong to the submission room';
    end if;

    if not exists (
      select 1
      from public.rooms r
      join public.questions q on q.id = new.question_id
      where r.id = new.room_id
        and q.teacher_id = r.teacher_id
    ) then
      raise exception 'submission question must belong to the room teacher';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_questions_relationship_integrity
  before insert or update on public.questions
  for each row execute function public.assert_project_relationship_integrity();

create trigger trg_games_relationship_integrity
  before insert or update on public.games
  for each row execute function public.assert_project_relationship_integrity();

create trigger trg_game_questions_relationship_integrity
  before insert or update on public.game_questions
  for each row execute function public.assert_project_relationship_integrity();

create trigger trg_rooms_relationship_integrity
  before insert or update on public.rooms
  for each row execute function public.assert_project_relationship_integrity();

create trigger trg_room_participants_relationship_integrity
  before insert or update on public.room_participants
  for each row execute function public.assert_project_relationship_integrity();

create trigger trg_submissions_relationship_integrity
  before insert or update on public.submissions
  for each row execute function public.assert_project_relationship_integrity();
