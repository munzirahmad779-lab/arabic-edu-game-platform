-- ============================================================================
-- Migration 0077: delete_student membersihkan baris room lebih dulu
--
-- Fungsi bawaan 0019 hanya menghapus baris students. Untuk siswa yang
-- pernah bergabung ke room sebagai peserta terdaftar, kunci asing
-- room_participants.student_id (ON DELETE SET NULL) mencoba mengosongkan
-- student_id, dan check constraint room_participants_identity_present
-- menolaknya karena guest_name juga kosong: ERROR 23514, siswa tidak
-- pernah bisa dihapus lewat UI (error=failed). Perbaikan: fungsi yang
-- sama, ditambah penghapusan submissions lalu participants milik siswa
-- sebelum baris siswanya dihapus. Riwayat sesi terarsip tidak disentuh
-- (room_session_participants.student_id memang SET NULL secara desain).
-- ============================================================================

create or replace function public.delete_student(
  p_student_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.students s
    join public.classes c on c.id = s.class_id
    where s.id = p_student_id
      and c.teacher_id = (select auth.uid())
  ) then
    raise exception 'STUDENT_NOT_FOUND';
  end if;

  -- Baris peserta room milik siswa harus dibuang lebih dulu: kunci asing
  -- room_participants.student_id memakai ON DELETE SET NULL, tetapi
  -- constraint identitas tabel itu melarang student_id dan guest_name
  -- sama-sama kosong, sehingga penghapusan siswa yang pernah ikut room
  -- selalu gugur (terbukti produksi 29 Okt 2026, ERROR 23514).
  -- Urutan wajib: submissions (restrict) -> participants -> students.
  delete from public.submissions
  where room_participant_id in (
    select id from public.room_participants where student_id = p_student_id
  );

  delete from public.room_participants
  where student_id = p_student_id;

  delete from public.students
  where id = p_student_id;

  return true;
end;
$$;

revoke all on function public.delete_student(uuid) from public, anon;
grant execute on function public.delete_student(uuid) to authenticated;
