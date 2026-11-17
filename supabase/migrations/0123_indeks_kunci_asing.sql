-- ============================================================================
-- 0123_indeks_kunci_asing.sql
-- Status: DISIAPKAN, BELUM DITERAPKAN. Menunggu pemilik menjalankan berkas
-- ini di Supabase SQL Editor (alur tetap proyek ini). Berkas ini bebas
-- dijalankan kapan pun (menambah indeks tidak mengubah perilaku).
--
-- Tujuan: menutup temuan Info Performance Advisor "Unindexed foreign
-- keys" (17 Nov 2026: 13 baris pada tabel assessment_attempts,
-- assessment_audio_groups, assessment_passages, assessment_questions,
-- assessment_tokens, rooms, student_practice_answers). Ekspor CSV
-- Advisor tidak memuat rincian per kolom untuk temuan Info, jadi
-- daftar kolom di bawah dibangun dari dua jangkar:
-- (1) tiga FK yang terbukti tanpa indeks pendukung dari penelusuran
--     migrasi repo (rooms.game_id, rooms.class_id,
--     student_practice_answers.question_id);
-- (2) kolom FK tabel asesmen sesuai dokumentasi kolom tangkapan
--     produksi 0090 Bagian 1 (baris 41-95) untuk tabel yang disebut
--     Advisor, termasuk assessment_sections sebagai tabel induknya.
-- Total 15 pernyataan. Jumlahnya bisa berbeda satu-dua dari hitungan
-- Advisor (13) karena keadaan indeks produksi tidak sepenuhnya sama
-- dengan repo; semua pernyataan memakai if not exists berdasarkan
-- NAMA indeks, jadi sebelum menjalankan, periksa dulu kolom yang
-- mungkin sudah terindeks di produksi dengan nama lain memakai kueri
-- pada komentar di akhir berkas, dan lewati baris yang duplikat.
-- ============================================================================

-- Jangkar repo
-- FK rooms.game_id terdefinisi di 0001; rooms hanya punya indeks teacher_id/code/state (0001:279-281)
create index if not exists idx_rooms_game_id on public.rooms (game_id);
-- FK rooms.class_id terdefinisi di 0001; tidak ada indeks berawalan class_id
create index if not exists idx_rooms_class_id on public.rooms (class_id);
-- FK di 0039; indeks yang ada berawalan student_id dan (game_id, student_id) saja (0039:15-22)
create index if not exists idx_student_practice_answers_question_id on public.student_practice_answers (question_id);

-- Jangkar tangkapan produksi 0090 (tabel asesmen hanya ada di produksi)
create index if not exists idx_assessment_tokens_assessment_id on public.assessment_tokens (assessment_id);
create index if not exists idx_assessment_sections_assessment_id on public.assessment_sections (assessment_id);
create index if not exists idx_assessment_passages_assessment_id on public.assessment_passages (assessment_id);
create index if not exists idx_assessment_passages_section_id on public.assessment_passages (section_id);
create index if not exists idx_assessment_audio_groups_assessment_id on public.assessment_audio_groups (assessment_id);
create index if not exists idx_assessment_audio_groups_section_id on public.assessment_audio_groups (section_id);
create index if not exists idx_assessment_questions_assessment_id on public.assessment_questions (assessment_id);
create index if not exists idx_assessment_questions_section_id on public.assessment_questions (section_id);
create index if not exists idx_assessment_questions_passage_id on public.assessment_questions (passage_id);
create index if not exists idx_assessment_questions_audio_group_id on public.assessment_questions (audio_group_id);
create index if not exists idx_assessment_attempts_assessment_id on public.assessment_attempts (assessment_id);
create index if not exists idx_assessment_attempts_token_id on public.assessment_attempts (token_id);

-- Kueri baca-saja pra-periksa (jalankan terpisah): daftar indeks yang
-- sudah ada pada tabel terkait.
-- select tablename, indexname, indexdef from pg_indexes
-- where schemaname = 'public' and tablename in ('rooms',
-- 'student_practice_answers', 'assessment_tokens',
-- 'assessment_sections', 'assessment_passages',
-- 'assessment_audio_groups', 'assessment_questions',
-- 'assessment_attempts') order by tablename, indexname;
