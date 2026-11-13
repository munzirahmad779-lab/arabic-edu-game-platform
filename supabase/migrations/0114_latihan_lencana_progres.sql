-- 0114_latihan_lencana_progres.sql
-- Daftar Latihan Mandiri di sisi siswa: tampilkan progres per permainan.
--
-- Latar (keluhan guru, terbukti live 13 Nov 2026): jawaban latihan
-- tersimpan baik di server (student_practice_answers) dan terbaca di
-- Laporan Harian guru, tetapi kartu permainan di halaman
-- /student/practice tidak memuat tanda apa pun bahwa sebuah latihan
-- sudah selesai atau sedang berprogres. Dari kursi siswa, pekerjaan
-- yang sudah selesai tampak seperti tidak tersimpan.
--
-- Perubahan: student_list_practice_games (definisi dasar diabadikan di
-- 0090) ditambah dua kolom hasil, answered_count dan correct_count,
-- dihitung dari student_practice_answers milik siswa itu sendiri.
-- Karena bentuk hasil berubah, fungsi lama di-drop lebih dulu.
-- Halaman daftar membaca dua kolom ini sebagai lencana "Selesai" atau
-- "Berprogres"; halaman tetap aman sebelum migrasi ini dijalankan
-- (kolom dianggap 0, lencana tidak tampil).

drop function if exists public.student_list_practice_games(text);

create or replace function public.student_list_practice_games(p_token text)
returns table (
  id uuid,
  name text,
  mode text,
  question_count integer,
  answered_count integer,
  correct_count integer
)
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
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
    ) as question_count,
    (
      select count(*)::int
      from public.student_practice_answers spa
      where spa.student_id = v_student_id
        and spa.game_id = g.id
    ) as answered_count,
    (
      select count(*)::int
      from public.student_practice_answers spa
      where spa.student_id = v_student_id
        and spa.game_id = g.id
        and spa.is_correct
    ) as correct_count
  from public.games g
  where g.class_id = v_class_id
    and g.mode in ('endless', 'practice')
  order by g.created_at desc;
end;
$function$;

-- Verifikasi sesudah migrasi (jalankan terpisah bila perlu, ganti
-- <token> dengan token sesi siswa uji):
-- select name, question_count, answered_count, correct_count
-- from public.student_list_practice_games('<token>');
