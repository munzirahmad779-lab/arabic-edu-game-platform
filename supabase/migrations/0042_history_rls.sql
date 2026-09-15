-- 0042_history_rls.sql
-- RLS policies untuk history (room_sessions, participants, practice answers).

drop policy if exists room_sessions_teacher_select on public.room_sessions;
create policy room_sessions_teacher_select on public.room_sessions
  for select to authenticated
  using (
    exists (
      select 1 from public.rooms r
      where r.id = room_id and r.teacher_id = auth.uid()
    )
  );

drop policy if exists room_session_participants_teacher_select on public.room_session_participants;
create policy room_session_participants_teacher_select on public.room_session_participants
  for select to authenticated
  using (
    exists (
      select 1 from public.room_sessions rs
      join public.rooms r on r.id = rs.room_id
      where rs.id = session_id and r.teacher_id = auth.uid()
    )
  );

drop policy if exists student_practice_answers_teacher_select on public.student_practice_answers;
create policy student_practice_answers_teacher_select on public.student_practice_answers
  for select to authenticated
  using (
    exists (
      select 1 from public.students s
      join public.classes c on c.id = s.class_id
      where s.id = student_id and c.teacher_id = auth.uid()
    )
  );