-- 0127_lindungi_jawaban_latihan.sql
-- Lindungi jawaban latihan siswa dari penghapusan entri permainan.
--
-- Latar (kejadian nyata 17 Nov 2026): migrasi 0039 membuat kunci asing
-- student_practice_answers.game_id menuju public.games dengan aturan
-- ON DELETE CASCADE. Pada 17 Nov 2026 entri permainan "Campuran
-- Dars 1-5 — Latihan Siswa" dihapus dari daftar permainan, dan aturan
-- cascade itu menghapus SELURUH baris jawaban latihan siswa untuk
-- permainan tersebut, milik semua siswa dan semua tanggal, tanpa
-- peringatan apa pun. Pekerjaan siswa yang sudah tersimpan lenyap
-- hanya karena satu entri permainan dihapus.
--
-- Migrasi ini mengubah aturan kunci asing itu menjadi
-- ON DELETE RESTRICT: selama masih ada jawaban latihan yang menunjuk
-- ke sebuah permainan, baris permainan itu TIDAK bisa dihapus sama
-- sekali di tingkat basis data. Sisi aplikasi (deleteGame) juga sudah
-- diperkuat untuk menolak lebih dulu dengan pesan yang jelas untuk
-- guru; kunci RESTRICT ini adalah pagar terakhir di basis data.
--
-- Cakupan perubahan hanya kunci asing pada kolom game_id tabel
-- student_practice_answers. Tabel, kolom, data, dan kunci asing lain
-- (student_id, question_id) tidak diubah.
--
-- CATATAN PENERAPAN: berkas ini disiapkan untuk ditinjau dan
-- dijalankan pemilik secara manual di SQL Editor proyek Magguru
-- (zwenvfoolgwlcjprnxlk). Belum diterapkan ke produksi oleh agen.

-- ---------------------------------------------------------------------
-- 1. Jatuhkan kunci asing lama pada kolom game_id, apa pun namanya.
--    Nama bawaan dari migrasi 0039 adalah
--    student_practice_answers_game_id_fkey, tetapi blok ini membaca
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
      and rel.relname = 'student_practice_answers'
      and con.contype = 'f'
      and att.attname = 'game_id'
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
  add constraint student_practice_answers_game_id_fkey
  foreign key (game_id)
  references public.games (id)
  on delete restrict;
