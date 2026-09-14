-- 0026_allow_empty_category_on_import.sql
-- Hapus trigger yang memaksa soal di bank wajib punya kategori.
-- Sekarang soal boleh tanpa kategori (mis. kolom Topik di Excel dikosongkan).

drop trigger if exists trg_question_bank_category_present on public.questions;
drop function if exists public.assert_question_bank_category_present();