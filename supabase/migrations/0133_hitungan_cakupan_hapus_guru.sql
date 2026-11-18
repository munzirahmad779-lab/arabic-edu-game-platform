-- 0133_hitungan_cakupan_hapus_guru.sql
-- RPC guru baru: hitungan cakupan pekerjaan siswa untuk modal
-- penjaga hapus (kelas, siswa, bank soal, permainan).
--
-- AKAR MASALAH (terverifikasi dari kode dan layar, 18 Nov 2026):
-- paket penjaga hapus (migrasi 0130-0132) menampilkan hitungan
-- pekerjaan siswa pada modal konfirmasi hapus, tetapi halaman
-- dasbor menghitungnya dengan klien Supabase guru biasa
-- (permintaan SELECT langsung ke tabel). Tabel pekerjaan siswa
-- tidak mengizinkan guru membaca baris siswa lewat RLS:
-- student_practice_answers di produksi berstatus RLS aktif
-- TANPA policy sama sekali (lihat catatan tangkapan skema
-- migrasi 0090), dan tabel lain yang sejenis hanya bisa dibaca
-- siswa sendiri lewat RPC SECURITY DEFINER. Akibatnya hitungan
-- di sisi aplikasi diam-diam terbaca 0 padahal datanya ada:
-- modal hapus kelas Mangkoso menampilkan "0 jawaban latihan
-- siswa, 0 progres Tugas Susulan, 0 hasil game solo" padahal
-- ada ratusan jawaban, modal hapus bank tidak menampilkan
-- catatan jawaban sama sekali, dan modal hapus siswa
-- menampilkan 0 progres susulan untuk siswa yang jelas punya
-- baris progres. Angka 0 palsu pada modal penjaga hapus lebih
-- berbahaya daripada tidak ada angka, karena guru bisa
-- menyetujui penghapusan dengan keyakinan keliru bahwa tidak
-- ada pekerjaan siswa yang hilang.
--
-- PERBAIKAN: empat RPC SECURITY DEFINER di berkas ini
-- menghitung cakupan dari dalam basis data (melewati RLS
-- dengan sah, seperti RPC guru yang sudah ada), dan halaman
-- dasbor kini memanggil RPC ini. Pemeriksaan kepemilikan
-- mengikuti pola teacher_catchup_overview persis: wajib
-- auth.uid(), dan kelas/bank/permainan/siswa yang dihitung
-- harus milik guru yang masuk, selain itu fungsi berhenti
-- dengan AUTH_REQUIRED / *_NOT_OWNED. Bila panggilan RPC
-- gagal di sisi aplikasi (misalnya migrasi ini belum
-- dijalankan), halaman menampilkan modal TANPA angka, bukan
-- angka 0 palsu.
--
-- Empat fungsi:
--   1. teacher_scope_counts_class(p_class_id): jumlah siswa
--      kelas itu beserta jawaban latihan, progres Tugas
--      Susulan, hasil game solo (student_game_results, tabel
--      yang sama seperti yang dihitung modal kelas selama
--      ini), dan pengumpulan esai mereka.
--   2. teacher_scope_counts_student(p_student_id): jawaban
--      latihan, progres Tugas Susulan, baris kehadiran, hasil
--      game solo, jawaban post tes, dan pengumpulan esai
--      milik satu siswa.
--   3. teacher_scope_counts_bank(p_bank_id): jumlah soal di
--      bank itu, jawaban ruangan (submissions) untuk semua
--      soal di bank itu, dan jawaban latihan siswa untuk
--      semua soal di bank itu.
--   4. teacher_scope_counts_game(p_game_id): sesi arsip
--      (room_sessions) dari semua room permainan itu, dan
--      jawaban ruangan (submissions) dari room-room itu.
--
-- Tabel dan data tidak diubah. Keempat RPC ini murni membaca.
--
-- CATATAN PENERAPAN: berkas ini disiapkan untuk ditinjau dan
-- dijalankan pemilik secara manual di SQL Editor proyek Magguru
-- (zwenvfoolgwlcjprnxlk). Belum diterapkan ke produksi oleh agen.

-- ---------------------------------------------------------------------
-- 1. Hitungan cakupan satu kelas untuk modal hapus kelas.
-- ---------------------------------------------------------------------
create or replace function public.teacher_scope_counts_class(p_class_id uuid)
returns table (
  students bigint,
  practice_answers bigint,
  catchup_progress bigint,
  solo_results bigint,
  essay_submissions bigint
)
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not exists (
    select 1 from public.classes c
    where c.id = p_class_id
      and c.teacher_id = auth.uid()
  ) then
    raise exception 'CLASS_NOT_OWNED';
  end if;

  return query
  select
    (select count(*) from public.students s
      where s.class_id = p_class_id),
    (select count(*) from public.student_practice_answers spa
      join public.students s on s.id = spa.student_id
      where s.class_id = p_class_id),
    (select count(*) from public.student_catchup_progress scp
      join public.students s on s.id = scp.student_id
      where s.class_id = p_class_id),
    (select count(*) from public.student_game_results sgr
      join public.students s on s.id = sgr.student_id
      where s.class_id = p_class_id),
    (select count(*) from public.essay_submissions es
      join public.students s on s.id = es.student_id
      where s.class_id = p_class_id);
end;
$function$;

grant execute on function public.teacher_scope_counts_class(uuid)
  to authenticated;

-- ---------------------------------------------------------------------
-- 2. Hitungan cakupan satu siswa untuk modal hapus siswa.
-- ---------------------------------------------------------------------
create or replace function public.teacher_scope_counts_student(p_student_id uuid)
returns table (
  practice_answers bigint,
  catchup_progress bigint,
  attendance bigint,
  solo_results bigint,
  post_test_answers bigint,
  essay_submissions bigint
)
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not exists (
    select 1 from public.students s
    join public.classes c on c.id = s.class_id
    where s.id = p_student_id
      and c.teacher_id = auth.uid()
  ) then
    raise exception 'STUDENT_NOT_OWNED';
  end if;

  return query
  select
    (select count(*) from public.student_practice_answers spa
      where spa.student_id = p_student_id),
    (select count(*) from public.student_catchup_progress scp
      where scp.student_id = p_student_id),
    (select count(*) from public.student_meeting_attendance sma
      where sma.student_id = p_student_id),
    (select count(*) from public.student_game_results sgr
      where sgr.student_id = p_student_id),
    (select count(*) from public.post_test_answers pta
      where pta.student_id = p_student_id),
    (select count(*) from public.essay_submissions es
      where es.student_id = p_student_id);
end;
$function$;

grant execute on function public.teacher_scope_counts_student(uuid)
  to authenticated;

-- ---------------------------------------------------------------------
-- 3. Hitungan cakupan satu bank soal untuk modal hapus bank:
--    submissions dan jawaban latihan dihitung untuk semua soal
--    yang ada di bank itu.
-- ---------------------------------------------------------------------
create or replace function public.teacher_scope_counts_bank(p_bank_id uuid)
returns table (
  questions bigint,
  submissions bigint,
  practice_answers bigint
)
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not exists (
    select 1 from public.question_banks qb
    where qb.id = p_bank_id
      and qb.teacher_id = auth.uid()
  ) then
    raise exception 'BANK_NOT_OWNED';
  end if;

  return query
  select
    (select count(*) from public.questions q
      where q.question_bank_id = p_bank_id),
    (select count(*) from public.submissions sub
      join public.questions q on q.id = sub.question_id
      where q.question_bank_id = p_bank_id),
    (select count(*) from public.student_practice_answers spa
      join public.questions q on q.id = spa.question_id
      where q.question_bank_id = p_bank_id);
end;
$function$;

grant execute on function public.teacher_scope_counts_bank(uuid)
  to authenticated;

-- ---------------------------------------------------------------------
-- 4. Hitungan cakupan satu permainan untuk modal hapus
--    permainan: sesi arsip room_sessions dari semua room
--    permainan itu, dan submissions dari room-room itu.
-- ---------------------------------------------------------------------
create or replace function public.teacher_scope_counts_game(p_game_id uuid)
returns table (
  archived_sessions bigint,
  room_submissions bigint
)
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not exists (
    select 1 from public.games g
    where g.id = p_game_id
      and g.teacher_id = auth.uid()
  ) then
    raise exception 'GAME_NOT_OWNED';
  end if;

  return query
  select
    (select count(*) from public.room_sessions rs
      join public.rooms r on r.id = rs.room_id
      where r.game_id = p_game_id),
    (select count(*) from public.submissions sub
      join public.rooms r on r.id = sub.room_id
      where r.game_id = p_game_id);
end;
$function$;

grant execute on function public.teacher_scope_counts_game(uuid)
  to authenticated;
