-- ============================================================================
-- 0093_asesmen_masuk_dan_hasil_rpc.sql
-- Status: DITERAPKAN ke produksi 10 Nov 2026 (16:25-16:50 WITA) lewat
-- SQL Editor oleh Muse atas perintah pemilik, sesudah 0091 sukses,
-- bersama deploy aplikasi gabungan 5e47a44; verifikasi katalog: kedua
-- fungsi ada dengan tanda tangan tepat; uji ujung-ke-ujung LULUS.
-- Status awal saat penyusunan: DRAF menunggu persetujuan
-- pemilik per berkas. Terapkan bersamaan dengan deploy aplikasi baru
-- (src/app/assessment/page.tsx + src/app/assessment/[attemptToken]/
-- result/page.tsx di cabang fix/assessment); halaman lama tidak
-- memanggil fungsi-fungsi ini. Pasangan migrasi 0091 (RPC player).
--
-- Temuan yang ditutup (lanjutan W3-K3 mega-audit, wilayah 3):
-- 1. Pintu masuk ujian masih akses tabel langsung sebagai anon.
--    Server action lama di src/app/assessment/page.tsx membaca
--    assessment_tokens (policy anon_read_tokens), membaca assessments
--    (anon_read_assessment), menyisipkan assessment_attempts
--    (anon_insert_attempts), membaca assessment_sections
--    (anon_read_sections), dan menyisipkan
--    assessment_attempt_sections (anon_all_attempt_sections) — semua
--    dari klien SSR ber-role anon untuk tamu.
-- 2. used_count token TIDAK PERNAH naik di produksi. Policy
--    assessment_tokens hanya memberi ALL ke pemilik guru
--    (teacher_own_tokens); tidak ada policy UPDATE untuk anon, jadi
--    update used_count dari server action lama ditolak RLS dan
--    gagal DIAM-DIAM (error tidak diperiksa di kode lama). Akibatnya
--    batas max_uses tidak pernah ditegakkan: satu token kelas bisa
--    dipakai tanpa batas, berapa pun max_uses yang dipasang guru.
-- 3. Halaman hasil membaca assessment_attempts langsung sebagai anon
--    (src/app/assessment/[attemptToken]/result/page.tsx), dan policy
--    anon_read_attempts ber-qual true: siapa pun yang memegang anon
--    key (tercetak di bundle klien) bisa membaca SEMUA baris attempt
--    — nama siswa dan seluruh skor — tanpa mengetahui attempt_token
--    satu pun.
-- 4. attempt_token lama dibangkitkan dengan Math.random di peramban
--    server action (64 karakter heksa, tetapi bukan sumber acak
--    kriptografis). Di sini diganti gen_random_bytes(32) — format
--    sama (64 heksa), kekuatan setara token sesi siswa pada
--    student_login produksi.
--
-- Perbaikan (meniru pola 0091 dan fungsi student_* produksi:
-- SECURITY DEFINER, search_path 'public','extensions', exception
-- berkode pendek):
-- 1. assessment_start_attempt(text, text) -> text
--    Seluruh logika server action lama dipindah ke server:
--    normalisasi token (trim + huruf besar) dan nama (trim); nama
--    atau token kosong -> 'missing'; token aktif tidak ditemukan ->
--    'token_invalid'; expires_at lewat -> 'token_expired';
--    used_count >= max_uses -> 'token_limit'; assessment tidak ada
--    atau belum terbit -> 'not_published'. Urutan pemeriksaan dan
--    kode exception persis urutan redirect ?error= halaman lama,
--    supaya pemetaan di aplikasi satu-satu. Sesudah lolos: buat
--    attempt (status in_progress, current_section_order 1,
--    current_question_number 1, token_id dan student_name dari
--    masukan), buat baris assessment_attempt_sections (section
--    pertama menurut section_order berstatus in_progress dengan
--    started_at server, sisanya pending — persis baris yang dulu
--    disisipkan halaman lama), lalu naikkan used_count token di
--    transaksi yang sama dengan penjaga used_count < max_uses,
--    supaya batas tetap tegak di bawah percobaan bersamaan (bila
--    penjaga gagal, exception 'token_limit' membatalkan seluruh
--    transaksi termasuk attempt yang baru dibuat). Mengembalikan
--    attempt_token baru.
-- 2. assessment_get_result(text) -> jsonb
--    Attempt tidak ditemukan -> 'attempt_not_found'. Mengembalikan
--    {attempt, assessment} dengan kolom PERSIS yang dibaca halaman
--    hasil lama: attempt (id, attempt_token, assessment_id,
--    student_name, status, started_at, finished_at, raw_listening,
--    raw_structure, raw_reading, score_listening, score_structure,
--    score_reading, score_total) dan assessment (id, title,
--    assessment_type, level). assessment bernilai null bila baris
--    asesmennya hilang (halaman hasil memetakannya ke notFound,
--    sama seperti perilaku lama).
--
-- Catatan hasil grep src/ (10 Nov 2026, untuk berkas 0092): sesudah
-- aplikasi baru live, TIDAK ADA lagi pembaca anon yang sah untuk
-- kesembilan tabel assessment_* dari kode aplikasi. Pemakai tabel
-- langsung yang tersisa hanya dashboard guru (sesi authenticated,
-- di balik middleware /dashboard, berjalan di policy teacher_*):
-- src/app/dashboard/assessments/** dan src/app/dashboard/page.tsx.
-- Tidak ada route API yang menyentuh tabel-tabel ini.
--
-- PERINGATAN URUTAN: pengetatan policy anon pada tabel assessment_*
-- (berkas 0092 terpisah) TIDAK BOLEH diterapkan sebelum aplikasi
-- baru (0091 + 0093) live dan terverifikasi; halaman lama akan putus
-- total. Urutan wajib: migrasi 0091 -> migrasi ini -> deploy
-- aplikasi baru -> verifikasi -> 0092.
--
-- Cara verifikasi sesudah diterapkan (pakai token kelas uji):
-- 1. select assessment_start_attempt('<TOKEN>', 'Siswa Uji');
--    — mengembalikan 64 heksa; baris attempt + attempt_sections
--    terbentuk; used_count token naik 1.
-- 2. Token acak -> 'token_invalid'; token kedaluwarsa ->
--    'token_expired'; token yang used_count-nya mencapai max_uses
--    -> 'token_limit'; token untuk asesmen belum terbit ->
--    'not_published'; nama kosong -> 'missing'.
-- 3. select assessment_get_result('<attempt_token>'); — jsonb
--    attempt + assessment; token acak -> 'attempt_not_found'.
-- ============================================================================

create or replace function public.assessment_start_attempt(p_token text, p_student_name text)
 returns text
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare
v_token text := upper(btrim(coalesce(p_token, '')));
v_name text := btrim(coalesce(p_student_name, ''));
v_token_row record;
v_published boolean;
v_now timestamptz := now();
v_attempt_token text;
v_attempt_id uuid;
v_updated int;
begin
if v_token = '' or v_name = '' then
 raise exception 'missing';
end if;

select t.id, t.assessment_id, t.expires_at, t.max_uses, t.used_count
into v_token_row
from public.assessment_tokens t
where t.token = v_token
and t.is_active = true;

if not found then
 raise exception 'token_invalid';
end if;

if v_token_row.expires_at < v_now then
 raise exception 'token_expired';
end if;

if v_token_row.used_count >= v_token_row.max_uses then
 raise exception 'token_limit';
end if;

select a.is_published into v_published
from public.assessments a
where a.id = v_token_row.assessment_id;

if not found or v_published is distinct from true then
 raise exception 'not_published';
end if;

v_attempt_token := encode(extensions.gen_random_bytes(32), 'hex');

insert into public.assessment_attempts (
 attempt_token, assessment_id, token_id, student_name,
 status, current_section_order, current_question_number
) values (
 v_attempt_token, v_token_row.assessment_id, v_token_row.id, v_name,
 'in_progress', 1, 1
)
returning id into v_attempt_id;

-- baris per section: pertama (menurut section_order) langsung
-- berjalan dengan cap waktu server, sisanya pending — persis baris
-- yang disisipkan halaman masuk lama
insert into public.assessment_attempt_sections (
 attempt_id, section_id, status, started_at
)
select v_attempt_id, s.id,
 case when s.rn = 1 then 'in_progress' else 'pending' end,
 case when s.rn = 1 then v_now else null end
from (
 select id, row_number() over (order by section_order) as rn
 from public.assessment_sections
 where assessment_id = v_token_row.assessment_id
) s;

-- kenaikan used_count atomik di transaksi yang sama, dengan
-- penjaga batas supaya percobaan bersamaan tidak bisa melewati
-- max_uses; gagal penjaga membatalkan seluruh transaksi
update public.assessment_tokens
set used_count = used_count + 1
where id = v_token_row.id
and used_count < max_uses;

get diagnostics v_updated = row_count;

if v_updated = 0 then
 raise exception 'token_limit';
end if;

return v_attempt_token;
end;
$function$;

create or replace function public.assessment_get_result(p_attempt_token text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare
v_attempt record;
begin
select * into v_attempt
from public.assessment_attempts a
where a.attempt_token = p_attempt_token;

if not found then
 raise exception 'attempt_not_found';
end if;

return jsonb_build_object(
 'attempt', jsonb_build_object(
  'id', v_attempt.id,
  'attempt_token', v_attempt.attempt_token,
  'assessment_id', v_attempt.assessment_id,
  'student_name', v_attempt.student_name,
  'status', v_attempt.status,
  'started_at', v_attempt.started_at,
  'finished_at', v_attempt.finished_at,
  'raw_listening', v_attempt.raw_listening,
  'raw_structure', v_attempt.raw_structure,
  'raw_reading', v_attempt.raw_reading,
  'score_listening', v_attempt.score_listening,
  'score_structure', v_attempt.score_structure,
  'score_reading', v_attempt.score_reading,
  'score_total', v_attempt.score_total
 ),
 'assessment', (
  select jsonb_build_object(
   'id', x.id,
   'title', x.title,
   'assessment_type', x.assessment_type,
   'level', x.level
  )
  from public.assessments x
  where x.id = v_attempt.assessment_id
 )
);
end;
$function$;

-- ----------------------------------------------------------------------------
-- Grant: siswa ujian tidak mempunyai sesi Supabase; keamanan bertumpu
-- pada token kelas (start) dan attempt_token (result) di dalam
-- fungsi (pola yang sama dengan 0091 dan fungsi student_*).
-- ----------------------------------------------------------------------------
revoke all on function public.assessment_start_attempt(text, text) from public;
revoke all on function public.assessment_get_result(text) from public;

grant execute on function public.assessment_start_attempt(text, text) to anon, authenticated;
grant execute on function public.assessment_get_result(text) to anon, authenticated;
