-- =============================================================================
-- 0002_rls_policies.sql
-- Phase 1 — Foundation: Row Level Security.
--
-- Principles enforced (per PROJECT_CONTEXT.md Section 16):
--   - Teacher can only access data that belongs to them (no cross-teacher
--     leakage).
--   - Students never get administrative/direct table access — students are
--     not Supabase Auth users in the MVP, so there is no student JWT to
--     write a student-scoped policy against yet. All student-facing access
--     will go through SECURITY DEFINER RPCs introduced in later phases
--     (room join, submitting answers, etc.), which is the correct place to
--     enforce ranking-privacy and duplicate-submission rules server-side.
--   - Client can never write scores directly: submissions has NO insert/
--     update/delete policy for any client role in Phase 1. Writes will be
--     added only via a controlled RPC in the phase that implements scoring.
--   - No policy is created "to make the app easier to run" — every missing
--     policy below is a deliberate, documented gap, not an oversight.
--
-- With RLS enabled and no matching policy, Postgres denies access by
-- default. That default-deny is intentional for every table/role
-- combination not explicitly listed here.
-- =============================================================================

alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.question_categories enable row level security;
alter table public.questions enable row level security;
alter table public.games enable row level security;
alter table public.game_questions enable row level security;
alter table public.rooms enable row level security;
alter table public.room_participants enable row level security;
alter table public.submissions enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- A teacher may read and update only their own profile row. Insert is done
-- exclusively by the handle_new_user() trigger (SECURITY DEFINER, runs as
-- the function owner and bypasses RLS) — no client-facing insert policy is
-- granted. No delete policy: profile lifecycle follows auth.users deletion
-- (on delete cascade), not a client-initiated delete.
-- ---------------------------------------------------------------------------
create policy profiles_select_own
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Role changes are additionally blocked by the database trigger in 0001.
-- This policy intentionally remains simple because email/name updates should
-- continue to work normally for the owner.

-- ---------------------------------------------------------------------------
-- classes
-- Full CRUD, but only on rows the teacher owns.
-- ---------------------------------------------------------------------------
create policy classes_select_own
  on public.classes for select
  to authenticated
  using (teacher_id = auth.uid());

create policy classes_insert_own
  on public.classes for insert
  to authenticated
  with check (teacher_id = auth.uid());

create policy classes_update_own
  on public.classes for update
  to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

create policy classes_delete_own
  on public.classes for delete
  to authenticated
  using (teacher_id = auth.uid());

-- ---------------------------------------------------------------------------
-- students
-- Only the owning teacher (via the class relationship) may access student
-- rows. Students themselves have no Supabase Auth session in the MVP, so
-- there is intentionally no student-facing policy here — the join/verify
-- flow (name + PIN) must be implemented as a SECURITY DEFINER RPC in a
-- later phase, never as direct table access from an anon/student client.
-- ---------------------------------------------------------------------------
create policy students_select_via_owned_class
  on public.students for select
  to authenticated
  using (
    exists (
      select 1 from public.classes c
      where c.id = students.class_id
        and c.teacher_id = auth.uid()
    )
  );

create policy students_insert_via_owned_class
  on public.students for insert
  to authenticated
  with check (
    exists (
      select 1 from public.classes c
      where c.id = students.class_id
        and c.teacher_id = auth.uid()
    )
  );

create policy students_update_via_owned_class
  on public.students for update
  to authenticated
  using (
    exists (
      select 1 from public.classes c
      where c.id = students.class_id
        and c.teacher_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.classes c
      where c.id = students.class_id
        and c.teacher_id = auth.uid()
    )
  );

create policy students_delete_via_owned_class
  on public.students for delete
  to authenticated
  using (
    exists (
      select 1 from public.classes c
      where c.id = students.class_id
        and c.teacher_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- question_categories
-- ---------------------------------------------------------------------------
create policy question_categories_select_own
  on public.question_categories for select
  to authenticated
  using (teacher_id = auth.uid());

create policy question_categories_insert_own
  on public.question_categories for insert
  to authenticated
  with check (teacher_id = auth.uid());

create policy question_categories_update_own
  on public.question_categories for update
  to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

create policy question_categories_delete_own
  on public.question_categories for delete
  to authenticated
  using (teacher_id = auth.uid());

-- ---------------------------------------------------------------------------
-- questions
-- ---------------------------------------------------------------------------
create policy questions_select_own
  on public.questions for select
  to authenticated
  using (teacher_id = auth.uid());

create policy questions_insert_own
  on public.questions for insert
  to authenticated
  with check (teacher_id = auth.uid());

create policy questions_update_own
  on public.questions for update
  to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

create policy questions_delete_own
  on public.questions for delete
  to authenticated
  using (teacher_id = auth.uid());

-- ---------------------------------------------------------------------------
-- games
-- ---------------------------------------------------------------------------
create policy games_select_own
  on public.games for select
  to authenticated
  using (teacher_id = auth.uid());

create policy games_insert_own
  on public.games for insert
  to authenticated
  with check (teacher_id = auth.uid());

create policy games_update_own
  on public.games for update
  to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

create policy games_delete_own
  on public.games for delete
  to authenticated
  using (teacher_id = auth.uid());

-- ---------------------------------------------------------------------------
-- game_questions
-- Scoped through the parent game's owner.
-- ---------------------------------------------------------------------------
create policy game_questions_select_via_owned_game
  on public.game_questions for select
  to authenticated
  using (
    exists (
      select 1 from public.games g
      where g.id = game_questions.game_id
        and g.teacher_id = auth.uid()
    )
  );

create policy game_questions_insert_via_owned_game
  on public.game_questions for insert
  to authenticated
  with check (
    exists (
      select 1 from public.games g
      where g.id = game_questions.game_id
        and g.teacher_id = auth.uid()
    )
  );

create policy game_questions_update_via_owned_game
  on public.game_questions for update
  to authenticated
  using (
    exists (
      select 1 from public.games g
      where g.id = game_questions.game_id
        and g.teacher_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.games g
      where g.id = game_questions.game_id
        and g.teacher_id = auth.uid()
    )
  );

create policy game_questions_delete_via_owned_game
  on public.game_questions for delete
  to authenticated
  using (
    exists (
      select 1 from public.games g
      where g.id = game_questions.game_id
        and g.teacher_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- rooms
-- Teacher-owner CRUD only in Phase 1. Deliberate gap: there is no
-- anon/student SELECT policy yet (e.g. "look up a room by its join code").
-- Adding one now would mean exposing the full snapshot (all questions +
-- correct answers) to anyone who can read via the anon key, before the
-- room-join RPC exists to mediate that safely. This must be solved with a
-- SECURITY DEFINER RPC (returning only what a joining student needs) in the
-- Room/Session phase, not with a broad SELECT policy.
-- ---------------------------------------------------------------------------
create policy rooms_select_own
  on public.rooms for select
  to authenticated
  using (teacher_id = auth.uid());

create policy rooms_insert_own
  on public.rooms for insert
  to authenticated
  with check (teacher_id = auth.uid());

create policy rooms_update_own
  on public.rooms for update
  to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

create policy rooms_delete_own
  on public.rooms for delete
  to authenticated
  using (teacher_id = auth.uid());

-- ---------------------------------------------------------------------------
-- room_participants
-- Teacher-owner CRUD only (via the room), scoped for Phase 1's dashboard/
-- lobby-viewing needs. Deliberate gap: no anon/student INSERT policy — a
-- student/guest joining a room must go through a controlled RPC (validates
-- PIN, room state = waiting, capacity, etc.), not a direct table insert.
-- ---------------------------------------------------------------------------
create policy room_participants_select_via_owned_room
  on public.room_participants for select
  to authenticated
  using (
    exists (
      select 1 from public.rooms r
      where r.id = room_participants.room_id
        and r.teacher_id = auth.uid()
    )
  );

create policy room_participants_insert_via_owned_room
  on public.room_participants for insert
  to authenticated
  with check (
    exists (
      select 1 from public.rooms r
      where r.id = room_participants.room_id
        and r.teacher_id = auth.uid()
    )
  );

create policy room_participants_update_via_owned_room
  on public.room_participants for update
  to authenticated
  using (
    exists (
      select 1 from public.rooms r
      where r.id = room_participants.room_id
        and r.teacher_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.rooms r
      where r.id = room_participants.room_id
        and r.teacher_id = auth.uid()
    )
  );

create policy room_participants_delete_via_owned_room
  on public.room_participants for delete
  to authenticated
  using (
    exists (
      select 1 from public.rooms r
      where r.id = room_participants.room_id
        and r.teacher_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- submissions
-- Teacher-owner READ ONLY (via the room), for viewing results. No INSERT,
-- UPDATE, or DELETE policy exists for ANY role, including the owning
-- teacher: submissions are immutable and must only ever be written by a
-- SECURITY DEFINER scoring RPC (Phase 4/5), which computes score and
-- correctness server-side and bypasses RLS deliberately and narrowly. This
-- is intentional and must not be "fixed" by adding a broad insert policy.
-- ---------------------------------------------------------------------------
create policy submissions_select_via_owned_room
  on public.submissions for select
  to authenticated
  using (
    exists (
      select 1 from public.rooms r
      where r.id = submissions.room_id
        and r.teacher_id = auth.uid()
    )
  );
