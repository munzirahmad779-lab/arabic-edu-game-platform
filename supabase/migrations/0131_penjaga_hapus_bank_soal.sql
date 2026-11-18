-- 0131_penjaga_hapus_bank_soal.sql
-- Penjaga jawaban latihan siswa pada RPC delete_question_bank.
--
-- Latar: sejak migrasi 0129, kunci asing
-- student_practice_answers.question_id memakai ON DELETE
-- RESTRICT. RPC delete_question_bank (definisi berjalan dari
-- migrasi 0024) tidak mengetahui pagar itu: menghapus bank yang
-- soalnya sudah dijawab siswa lewat Latihan Mandiri akan gagal
-- di langkah 5 dengan galat kunci asing PostgreSQL mentah, dan
-- sisi aplikasi menampilkannya apa adanya ke guru. Guru tidak
-- tahu bank tertahan karena ada pekerjaan siswa di dalamnya.
--
-- Migrasi ini membuat ulang RPC delete_question_bank PERSIS
-- seperti definisi 0024, dengan SATU tambahan di awal (sesudah
-- pemeriksaan kepemilikan, sebelum penghapusan apa pun):
--
--   SELISIH TERHADAP 0024:
--   1. Dihitung jumlah jawaban latihan siswa
--      (student_practice_answers) untuk semua soal di bank ini.
--   2. Bila jumlahnya lebih dari 0, fungsi berhenti dengan
--      raise exception berawalan token "bank_has_practice_answers"
--      diikuti pesan Bahasa Indonesia yang menyebut jumlahnya.
--      Tidak ada satu baris pun yang terhapus.
--   3. Selain tambahan itu, seluruh langkah 0024 dipertahankan
--      apa adanya, termasuk langkah 1 yang menghapus submissions
--      (jawaban ruangan) untuk soal di bank ini. Penghapusan
--      submissions itu memang bagian dari desain 0024 dan
--      dipertahankan; yang berubah adalah sisi aplikasi kini
--      MENYEBUTKAN jumlah submissions yang akan ikut terhapus
--      pada modal konfirmasi hapus bank, jadi guru tahu sebelum
--      menyetujui.
--
-- CATATAN PENERAPAN: berkas ini disiapkan untuk ditinjau dan
-- dijalankan pemilik secara manual di SQL Editor proyek Magguru
-- (zwenvfoolgwlcjprnxlk). Belum diterapkan ke produksi oleh agen.

create or replace function public.delete_question_bank(p_bank_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_teacher_id uuid;
  v_practice_count bigint;
begin
  select teacher_id into v_teacher_id
  from public.question_banks
  where id = p_bank_id;

  if v_teacher_id is null then
    raise exception 'bank_not_found';
  end if;

  if v_teacher_id <> auth.uid() then
    raise exception 'forbidden';
  end if;

  -- Penjaga jawaban latihan siswa (tambahan 0131, satu-satunya
  -- selisih dari 0024): bank yang soalnya sudah dijawab siswa
  -- lewat Latihan Mandiri tidak boleh dihapus, karena jawaban
  -- mereka menunjuk ke soal-soal itu dan migrasi 0129 membuat
  -- basis data menolaknya di tengah jalan dengan pesan mentah.
  -- Penolakan di sini terjadi sebelum penghapusan apa pun dan
  -- membawa pesan yang bisa dibaca guru.
  select count(*) into v_practice_count
  from public.student_practice_answers spa
  join public.questions q on q.id = spa.question_id
  where q.question_bank_id = p_bank_id;

  if v_practice_count > 0 then
    raise exception 'bank_has_practice_answers: Bank soal ini tidak bisa dihapus karena sudah ada % jawaban latihan siswa untuk soal di dalamnya. Jawaban siswa adalah hasil pekerjaan mereka dan tidak boleh ikut terhapus.', v_practice_count;
  end if;

  -- 1. Hapus submissions (jawaban siswa) untuk soal di bank ini
  delete from public.submissions
  where question_id in (
    select id from public.questions where question_bank_id = p_bank_id
  );

  -- 2. Hapus game_questions (relasi game ke soal)
  delete from public.game_questions
  where question_id in (
    select id from public.questions where question_bank_id = p_bank_id
  );

  -- 3. Hapus question_media
  delete from public.question_media
  where question_id in (
    select id from public.questions where question_bank_id = p_bank_id
  );

  -- 4. Hapus question_options
  delete from public.question_options
  where question_id in (
    select id from public.questions where question_bank_id = p_bank_id
  );

  -- 5. Hapus questions
  delete from public.questions where question_bank_id = p_bank_id;

  -- 6. Hapus bank
  delete from public.question_banks where id = p_bank_id;
end;
$$;

revoke all on function public.delete_question_bank(uuid) from public;
grant execute on function public.delete_question_bank(uuid) to authenticated;
