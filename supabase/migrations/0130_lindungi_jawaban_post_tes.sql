-- 0130_lindungi_jawaban_post_tes.sql
-- Lindungi jawaban post tes siswa dari penghapusan soal post tes.
--
-- Latar: migrasi 0126 membuat kunci asing
-- post_test_answers.question_id menuju public.post_test_questions
-- dengan aturan ON DELETE CASCADE. Artinya menghapus SATU soal
-- post tes akan menghapus SELURUH baris jawaban VN siswa untuk
-- soal itu, termasuk skor, transkrip, dan catatan penilaian yang
-- sudah diberikan guru, tanpa peringatan apa pun. Risiko ini
-- sekelas kejadian 17 Nov 2026 pada jawaban latihan (diperbaiki
-- migrasi 0127 untuk kolom game_id dan 0129 untuk kolom
-- question_id di tabel student_practice_answers).
--
-- Bahaya paling dekat ada pada berkas seed resmi post tes: pola
-- lama seed adalah menghapus semua soal lalu memasukkan ulang.
-- Sesudah migrasi ini, menjalankan pola hapus-semua seperti itu
-- akan DITOLAK basis data selama masih ada jawaban siswa, dan
-- berkas seed sendiri sudah ditulis ulang menjadi pola upsert
-- per nomor urut yang aman dijalankan ulang.
--
-- Migrasi ini mengubah aturan kunci asing itu menjadi
-- ON DELETE RESTRICT: selama masih ada jawaban post tes yang
-- menunjuk ke sebuah soal, baris soal itu TIDAK bisa dihapus
-- sama sekali di tingkat basis data.
--
-- Cakupan perubahan hanya kunci asing pada kolom question_id
-- tabel post_test_answers. Tabel, kolom, data, dan kunci asing
-- lain (student_id) tidak diubah.
--
-- CATATAN PENERAPAN: berkas ini disiapkan untuk ditinjau dan
-- dijalankan pemilik secara manual di SQL Editor proyek Magguru
-- (zwenvfoolgwlcjprnxlk). Belum diterapkan ke produksi oleh agen.

-- ---------------------------------------------------------------------
-- 1. Jatuhkan kunci asing lama pada kolom question_id, apa pun
--    namanya. Nama bawaan dari migrasi 0126 adalah
--    post_test_answers_question_id_fkey, tetapi blok ini membaca
--    katalog sistem supaya tetap benar bila namanya berbeda.
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
      and rel.relname = 'post_test_answers'
      and con.contype = 'f'
      and att.attname = 'question_id'
  loop
    execute format(
      'alter table public.post_test_answers drop constraint %I',
      v_constraint
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 2. Pasang kunci asing baru dengan ON DELETE RESTRICT.
-- ---------------------------------------------------------------------
alter table public.post_test_answers
  add constraint post_test_answers_question_id_fkey
  foreign key (question_id)
  references public.post_test_questions (id)
  on delete restrict;
