-- ============================================================================
-- GELOMBANG 2 — 0082_skor_esai_hanya_jalur_ai.sql
-- DITERAPKAN ke produksi (proyek zwenvfoolgwlcjprnxlk) 10 Nov 2026
-- lewat SQL Editor Supabase oleh Muse atas perintah pemilik; verifikasi
-- katalog sesudah penerapan: sesuai harapan (lihat INDEKS gelombang 2).
-- Status: SIAP TERAP (menunggu persetujuan pemilik per berkas).
-- Bila dipindah ke supabase/migrations, nomor diganti mengikuti
-- INDEKS.md (0084).
--
-- Temuan yang ditutup:
-- - W7-M3 (Mayor, audit wilayah 7): siswa dapat menulis sendiri skor AI
--   esainya dengan nilai arbitrer.
--
-- Objek yang diubah:
-- - public.student_set_ai_grade(text, uuid, int, text, jsonb, text) —
--   definisi satu-satunya di 0054_essay.sql:254-288, grant ke
--   anon, authenticated di 0054:290-291. Versi lama memvalidasi token
--   sesi siswa dan membatasi update ke submission milik siswa itu
--   (0054:283-285, bagian yang benar), tetapi p_ai_score, p_ai_feedback,
--   p_ai_scores_json, dan p_ai_model diterima mentah: tanpa bukti
--   penilaian AI sungguh terjadi, tanpa batas rentang, tanpa pemeriksaan
--   status. Token sesi siswa adalah kredensial milik pihak yang dinilai,
--   jadi pada dasarnya yang dinilai menandatangani nilainya sendiri.
-- - Kolom tujuannya: essay_submissions.ai_score int (0054:46) TANPA
--   check constraint. Batas sahnya terbaca dari rubrik assignment:
--   rubric_content 40 + rubric_grammar 30 + rubric_vocabulary 30 = 100
--   (0054:16-18, dan ketiganya kolom per assignment yang dapat diubah
--   guru, jadi batas subskor dibaca dari baris assignment, bukan angka
--   tetap).
--
-- Isi perubahan:
-- - Tanda tangan fungsi DIPERTAHANKAN persis (termasuk p_token), supaya
--   tidak ada pemanggil yang putus karena perubahan bentuk; tetapi
--   p_token TIDAK LAGI menjadi dasar wewenang dan tidak lagi diperiksa.
-- - Wewenang menulis sekarang hanya dua:
--   (a) konteks service_role (klaim role pada JWT = 'service_role'),
--       yaitu jalur server tepercaya, mengikuti pola penguncian 0066;
--   (b) guru pemilik assignment dari submission itu (auth.uid() sama
--       dengan essay_assignments.teacher_id).
--   Pemanggil lain, termasuk siswa pemilik submission dengan token
--   sesi yang sah, ditolak FORBIDDEN.
-- - p_ai_score wajib 0-100 (SCORE_OUT_OF_RANGE). Subskor di
--   p_ai_scores_json, bila kuncinya ada, wajib dalam 0..rubrik
--   assignment-nya: content <= rubric_content, grammar <=
--   rubric_grammar, vocabulary <= rubric_vocabulary
--   (SUBSCORE_OUT_OF_RANGE:<kunci>).
-- - Penulisan ditolak bila guru sudah memberi nilai akhir
--   (teacher_graded_at terisi): ALREADY_TEACHER_GRADED, sesuai saran
--   minimal audit wilayah 7.
-- - Submission yang tidak ada kini menjawab SUBMISSION_NOT_FOUND
--   secara eksplisit (versi lama diam-diam mengubah 0 baris).
-- - Grant diperketat: execute dicabut dari public dan anon; diberikan
--   hanya ke authenticated dan service_role, dan badan fungsi tetap
--   memeriksa wewenang (pola kunci 0066_souq_fishing_checkpoint_rpc_
--   lockdown.sql:5-6 untuk gagasan service-role-only).
--
-- Mengapa ini aman diterapkan tanpa perubahan aplikasi:
-- - Grep atas src/: TIDAK ADA pemanggil fungsi ini di kode aplikasi;
--   satu-satunya kemunculan adalah entri tipe tergenerasi
--   src/types/database.ts:291. Alur penilaian yang hidup menulis skor
--   lewat update tabel langsung dari route server
--   src/app/api/grade-essay/route.ts:157-172 (komentar di kode:
--   "server client = auth guru/siswa"), yang tunduk pada policy
--   essay_submissions_teacher_all (0054:74-86) dan gerbang route
--   gelombang 1. Berkas ini menutup jalur tulis paralel yang tidak
--   terjaga, bukan mengubah alur yang hidup.
-- - Yang BELUM TERVERIFIKASI dari repo: apakah ada klien di luar repo
--   ini (misalnya aplikasi lama yang masih terpasang) yang memanggil
--   RPC ini dengan token siswa. Bila ada, pemanggil itu akan menerima
--   FORBIDDEN sesudah migrasi ini; tidak ada bukti keberadaannya di
--   repo.
--
-- Risiko / efek samping:
-- - Check constraint tabel untuk ai_score SENGAJA tidak ditambahkan:
--   baris produksi yang sudah tertulis lewat celah ini bisa berada di
--   luar rentang, dan constraint akan membuat migrasi gagal. Periksa
--   dulu dengan:
--     select count(*) from public.essay_submissions
--     where ai_score < 0 or ai_score > 100;
--   Bila hasilnya 0 dan pemilik menghendaki, constraint dapat
--   ditambahkan pada migrasi susulan.
-- - auth.jwt() bisa melempar galat pada konteks tanpa JWT; klaim role
--   dibaca dalam blok pengecualian dan hasilnya dianggap bukan
--   service_role (gagal tertutup).
--
-- Verifikasi sesudah diterapkan:
-- 1. Sebagai siswa (atau dengan kunci anon + token sesi siswa yang sah):
--    panggil student_set_ai_grade untuk submission sendiri dengan skor
--    100: harus error FORBIDDEN (sebelumnya berhasil).
-- 2. Sebagai guru pemilik assignment: pemanggilan dengan skor 85 harus
--    berhasil; dengan skor 101 harus SCORE_OUT_OF_RANGE; sesudah guru
--    memberi nilai akhir, pemanggilan berikutnya harus
--    ALREADY_TEACHER_GRADED.
-- 3. information_schema.routine_privileges untuk fungsi ini: grantee
--    hanya authenticated dan service_role (selain pemilik fungsi).
--
-- Rollback: terapkan ulang definisi 0054:254-288 beserta grant
-- 0054:290-291.
-- ============================================================================

create or replace function public.student_set_ai_grade(
  p_token text,
  p_submission_id uuid,
  p_ai_score int,
  p_ai_feedback text,
  p_ai_scores_json jsonb,
  p_ai_model text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_sub public.essay_submissions%rowtype;
  v_assignment public.essay_assignments%rowtype;
  v_role text;
  v_is_service boolean := false;
  v_is_owner boolean := false;
begin
  -- p_token dipertahankan demi kompatibilitas tanda tangan, tetapi
  -- tidak lagi diperiksa: token sesi siswa bukan bukti wewenang untuk
  -- menulis nilai (lihat kepala berkas).

  select * into v_sub
  from public.essay_submissions
  where id = p_submission_id;

  if not found then
    raise exception 'SUBMISSION_NOT_FOUND';
  end if;

  select * into v_assignment
  from public.essay_assignments
  where id = v_sub.assignment_id;

  begin
    v_role := auth.jwt() ->> 'role';
  exception when others then
    v_role := null;
  end;
  v_is_service := coalesce(v_role = 'service_role', false);
  v_is_owner := coalesce(
    auth.uid() is not null and v_assignment.teacher_id = auth.uid(),
    false
  );

  if not (v_is_service or v_is_owner) then
    raise exception 'FORBIDDEN';
  end if;

  if v_sub.teacher_graded_at is not null then
    raise exception 'ALREADY_TEACHER_GRADED';
  end if;

  if p_ai_score is null or p_ai_score < 0 or p_ai_score > 100 then
    raise exception 'SCORE_OUT_OF_RANGE';
  end if;

  if p_ai_scores_json is not null then
    if (p_ai_scores_json ? 'content')
       and ((p_ai_scores_json ->> 'content')::numeric < 0
            or (p_ai_scores_json ->> 'content')::numeric > v_assignment.rubric_content) then
      raise exception 'SUBSCORE_OUT_OF_RANGE:content';
    end if;
    if (p_ai_scores_json ? 'grammar')
       and ((p_ai_scores_json ->> 'grammar')::numeric < 0
            or (p_ai_scores_json ->> 'grammar')::numeric > v_assignment.rubric_grammar) then
      raise exception 'SUBSCORE_OUT_OF_RANGE:grammar';
    end if;
    if (p_ai_scores_json ? 'vocabulary')
       and ((p_ai_scores_json ->> 'vocabulary')::numeric < 0
            or (p_ai_scores_json ->> 'vocabulary')::numeric > v_assignment.rubric_vocabulary) then
      raise exception 'SUBSCORE_OUT_OF_RANGE:vocabulary';
    end if;
  end if;

  update public.essay_submissions
  set ai_score = p_ai_score,
      ai_feedback = p_ai_feedback,
      ai_scores_json = p_ai_scores_json,
      ai_model = p_ai_model,
      graded_at = now(),
      updated_at = now()
  where id = p_submission_id;
end;
$$;

revoke all on function public.student_set_ai_grade(text, uuid, int, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.student_set_ai_grade(text, uuid, int, text, jsonb, text) to authenticated, service_role;
