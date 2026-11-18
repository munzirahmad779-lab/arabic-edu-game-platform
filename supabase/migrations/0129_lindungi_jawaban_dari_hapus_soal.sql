-- 0129_lindungi_jawaban_dari_hapus_soal.sql
-- Lindungi jawaban latihan siswa dari penghapusan soal bank soal.
--
-- Latar: migrasi 0039 membuat kunci asing
-- student_practice_answers.question_id menuju public.questions
-- dengan aturan ON DELETE CASCADE. Artinya menghapus SATU soal
-- dari bank soal akan menghapus SELURUH baris jawaban latihan
-- siswa untuk soal itu, di semua permainan dan semua tanggal,
-- tanpa peringatan apa pun. Ini risiko sekelas kejadian
-- 17 Nov 2026 pada sisi permainan (diperbaiki migrasi 0127 untuk
-- kolom game_id): pekerjaan siswa yang sudah dikerjakan dan
-- tersimpan bisa lenyap hanya karena satu baris induk dihapus.
-- Menghapus satu soal dari bank soal tidak boleh menghapus
-- jawaban siswa untuk soal itu.
--
-- Migrasi ini mengubah aturan kunci asing itu menjadi
-- ON DELETE RESTRICT: selama masih ada jawaban latihan yang
-- menunjuk ke sebuah soal, baris soal itu TIDAK bisa dihapus
-- sama sekali di tingkat basis data. Penghapusan soal yang belum
-- pernah dijawab siswa tidak terpengaruh.
--
-- Cakupan perubahan hanya kunci asing pada kolom question_id
-- tabel student_practice_answers. Tabel, kolom, data, dan kunci
-- asing lain (student_id, game_id) tidak diubah.
--
-- CATATAN PENERAPAN: berkas ini disiapkan untuk ditinjau dan
-- dijalankan pemilik secara manual di SQL Editor proyek Magguru
-- (zwenvfoolgwlcjprnxlk). Belum diterapkan ke produksi oleh agen.

-- ---------------------------------------------------------------------
-- 1. Jatuhkan kunci asing lama pada kolom question_id, apa pun
--    namanya. Nama bawaan dari migrasi 0039 adalah
--    student_practice_answers_question_id_fkey, tetapi blok ini
--    membaca katalog sistem supaya tetap benar bila namanya
--    berbeda.
-- ---------------------------------------------------------------------
do $$
declare
  v_constraint text;
begin
  for v_constraint in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    join pg_attribute att
      on att.attrelid = con.conrelid
     and att.attnum = any (con.conkey)
    where nsp.nspname = 'public'
      and rel.relname = 'student_practice_answers'
      and con.contype = 'f'
      and att.attname = 'question_id'
  loop
    execute format(
      'alter table public.student_practice_answers drop constraint %I',
      v_constraint
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 2. Pasang kunci asing baru dengan ON DELETE RESTRICT.
-- ---------------------------------------------------------------------
alter table public.student_practice_answers
  add constraint student_practice_answers_question_id_fkey
  foreign key (question_id)
  references public.questions (id)
  on delete restrict;
