-- ============================================================================
-- 0091_asesmen_rpc_server.sql
-- Status: DRAF — BELUM diterapkan ke produksi. Menunggu persetujuan
-- pemilik per berkas. Terapkan bersamaan dengan deploy player baru
-- (src/app/assessment/[attemptToken]/player.tsx + page.tsx di cabang
-- fix/assessment); player lama tidak memanggil fungsi-fungsi ini.
--
-- Temuan yang ditutup: W3-K3 mega-audit (wilayah 3, Kritis 3) —
-- penilaian asesmen dikerjakan di peramban siswa. Player lama:
-- membaca correct_answer dari assessment_questions sebagai anon
-- (player.tsx:245 versi lama), menulis is_correct per jawaban dari
-- klien (:265), menghitung lalu menulis score_listening/
-- score_structure/score_reading/score_total dan status "completed"
-- ke assessment_attempts dari klien (:292-311), dan menulis
-- started_at/finished_at/time_spent_seconds assessment_attempt_sections
-- dari jam perangkat (:177-211). Kunci jawaban, skor akhir, dan batas
-- waktu section semuanya dapat diatur pemegang attempt_token.
--
-- Perbaikan (meniru pola fungsi student_* produksi, tangkapan 0090
-- Bagian 3: SECURITY DEFINER, search_path 'public','extensions',
-- exception berkode pendek, penilaian di server):
-- Empat RPC bergerbang attempt_token (attempt_token adalah kredensial
-- sesi ujian; siswa ujian tidak mempunyai sesi Supabase, jadi execute
-- dibuka untuk anon + authenticated dan keamanan bertumpu pada token
-- yang tak tertebak + status attempt):
-- 1. assessment_get_payload(text) -> jsonb
--    Memvalidasi attempt ada + in_progress + token belum kedaluwarsa;
--    mengembalikan assessment, sections, questions TANPA
--    correct_answer, passages, audio_groups, jawaban tersimpan siswa
--    (untuk resume), dan attempt_sections termasuk remaining_seconds
--    yang dihitung SERVER dari started_at + duration_minutes.
-- 2. assessment_submit_answer(text, uuid, text) -> boolean
--    Memvalidasi attempt in_progress, soal milik assessment attempt,
--    section sedang berjalan dan belum lewat batas waktunya; menilai
--    di server terhadap correct_answer; upsert assessment_answers
--    dengan is_correct hasil server. Mengembalikan boolean accepted
--    saja: correct_answer DAN is_correct tidak pernah meninggalkan
--    server selama ujian (player saat ini tidak mempunyai mode
--    review di tengah ujian, dan nilai kembalian ini tidak dibaca
--    player resmi), supaya RPC tidak menjadi oracle coba-salah.
-- 3. assessment_set_section_state(text, uuid, text) -> jsonb
--    Aksi 'start'/'finish' dengan cap waktu SERVER. 'finish' menutup
--    section berjalan (time_spent_seconds dibatasi durasi, seperti
--    hitungan klien lama), menaikkan current_section_order, dan
--    memulai section berikutnya dalam satu transaksi — tiga penulisan
--    yang dulu dilakukan peramban di finishSection player lama.
--    Urutan ditegakkan terhadap current_section_order.
-- 4. assessment_finish(text) -> jsonb
--    Menilai ulang semua jawaban tersimpan di server, menghitung raw
--    per section_type, mengonversi ke skor skala, menulis score_* +
--    status 'completed' + finished_at di server, mengembalikan
--    ringkasan skor untuk layar selesai. Idempoten: panggilan kedua
--    mengembalikan ringkasan tersimpan tanpa mengubah apa pun.
--
-- Rumus skor yang dipindah (persis logika peramban lama, berkas
-- player.tsx versi lama):
-- - is_correct = (selected_answer = correct_answer) (:257-265).
--   Dulu dihitung dari answerMap klien; di sini dari baris
--   assessment_answers tersimpan — himpunan yang sama, karena
--   answerMap lama memang dimuat dari tabel itu (page.tsx lama).
-- - scaled per tipe = public.assessment_convert_section(tipe, raw)
--   (:276-286), bawaan 31 untuk tipe yang tidak mempunyai jawaban
--   sama sekali atau bila konversi mengembalikan null (:269-271, :283).
-- - score_total = round(((scaledL + scaledS + scaledR) / 3) * 10) (:288).
-- - raw_* ditulis per tipe (:292-311).
-- - time_spent_seconds = min(durasi_detik, elapsed) (:177-181).
-- CATATAN raw: player lama mengelompokkan raw per section_id lalu
-- mengambil section PERTAMA per tipe untuk kolom raw_* dan memanggil
-- konversi per section. Di sini raw diagregasi per section_type dan
-- konversi dipanggil sekali per tipe. Untuk format yang hidup (satu
-- section per tipe: listening/structure/reading — halaman hasil pun
-- mengasumsikan ini) hasilnya identik; untuk asesmen kustom dengan
-- dua section bertipe sama, agregasi per tipe adalah penjumlahan
-- yang masuk akal, bukan angka section pertama saja.
--
-- scoring_config: kolom assessments.scoring_config TIDAK dibaca kode
-- aplikasi mana pun untuk penghitungan skor (terverifikasi grep src/:
-- hanya definisi tipe ScoringConfig di src/lib/assessments/types.ts:17
-- dan :24-30). Konversi hidup sepenuhnya di dalam fungsi produksi
-- assessment_convert_section, jadi assessment_finish memanggil fungsi
-- yang sama persis dengan yang dipanggil player lama — rumus tidak
-- berubah sedikit pun. Bila konversi suatu hari digerakkan
-- scoring_config, ubah isi assessment_convert_section, bukan RPC ini.
--
-- Gerbang kedaluwarsa: attempt ditolak 'token_expired' bila
-- assessment_tokens.expires_at milik token pembuat attempt sudah
-- lewat. Alur masuk lama hanya memeriksa kedaluwarsa saat attempt
-- DIBUAT (src/app/assessment/page.tsx:36-38). Penegakan di RPC adalah
-- pengetatan yang disengaja: attempt yang dirésumé sesudah token
-- masuknya kedaluwarsa kini berhenti di gerbang ini. (Token kelas
-- berlaku 7 hari, jadi dampak praktisnya kecil.)
--
-- Risiko:
-- - assessment_finish bergantung pada fungsi produksi
--   public.assessment_convert_section(text, int): definisinya tidak
--   ada di repo (hanya pemakaiannya yang tertangkap, player lama
--   :279). Bila fungsi itu tidak ada di lingkungan target, finish
--   error saat runtime, bukan saat migrasi diterapkan.
-- - assessment_submit_answer memakai on conflict (attempt_id,
--   question_id): bergantung pada constraint unik itu di produksi —
--   upsert peramban lama (player.tsx:166-175) sudah bergantung pada
--   target konflik yang sama, jadi constraint itu terbukti ada.
-- - PERINGATAN URUTAN: pengetatan policy anon pada tabel assessment_*
--   (berkas 0092 terpisah) TIDAK BOLEH diterapkan sebelum player baru
--   live dan terverifikasi; player lama akan putus total. Urutan
--   wajib: migrasi ini -> deploy player baru -> verifikasi -> 0092.
--
-- Cara verifikasi sesudah diterapkan (pakai attempt token uji):
-- 1. select assessment_get_payload('<token>'); — jsonb questions
--    TIDAK memuat correct_answer; attempt_sections memuat
--    remaining_seconds dari server.
-- 2. select assessment_submit_answer('<token>', '<question_id>', 'A');
--    — baris assessment_answers ter-upsert, is_correct dari server.
-- 3. Submit untuk section yang belum mulai -> 'section_not_started';
--    sesudah batas waktu -> 'section_time_expired'; soal asing ->
--    'question_not_in_assessment'; token acak -> 'attempt_not_found'.
-- 4. select assessment_set_section_state('<token>', '<section_id>',
--    'finish'); — section tertutup dengan cap waktu server dan
--    section berikutnya mulai; loncat urutan -> 'section_out_of_order'.
-- 5. select assessment_finish('<token>'); dua kali — hasil kedua
--    identik dengan pertama, score_* terisi, status 'completed'.
-- 6. select assessment_get_payload('<token>'); sesudah selesai ->
--    'attempt_completed' (halaman mengarahkannya ke halaman hasil).
-- ============================================================================

create or replace function public.assessment_get_payload(p_attempt_token text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare
v_attempt record;
v_expires timestamptz;
v_payload jsonb;
begin
select * into v_attempt
from public.assessment_attempts a
where a.attempt_token = p_attempt_token;

if not found then
 raise exception 'attempt_not_found';
end if;

if v_attempt.status = 'completed' then
 raise exception 'attempt_completed';
end if;

if v_attempt.token_id is not null then
 select t.expires_at into v_expires
 from public.assessment_tokens t
 where t.id = v_attempt.token_id;

 if v_expires is not null and v_expires < now() then
  raise exception 'token_expired';
 end if;
end if;

if v_attempt.status <> 'in_progress' then
 raise exception 'attempt_not_in_progress';
end if;

select jsonb_build_object(
 'attempt', jsonb_build_object(
  'id', v_attempt.id,
  'attempt_token', v_attempt.attempt_token,
  'assessment_id', v_attempt.assessment_id,
  'student_name', v_attempt.student_name,
  'status', v_attempt.status,
  'started_at', v_attempt.started_at,
  'current_section_order', v_attempt.current_section_order,
  'current_question_number', v_attempt.current_question_number
 ),
 'assessment', (
  select jsonb_build_object(
   'id', x.id,
   'title', x.title,
   'description', x.description
  )
  from public.assessments x
  where x.id = v_attempt.assessment_id
 ),
 'sections', coalesce((
  select jsonb_agg(
   jsonb_build_object(
    'id', s.id,
    'section_order', s.section_order,
    'section_type', s.section_type,
    'title', s.title,
    'instructions', s.instructions,
    'duration_minutes', s.duration_minutes,
    'audio_play_once', s.audio_play_once,
    'allow_review', s.allow_review
   ) order by s.section_order
  )
  from public.assessment_sections s
  where s.assessment_id = v_attempt.assessment_id
 ), '[]'::jsonb),
 'questions', coalesce((
  select jsonb_agg(
   jsonb_build_object(
    'id', q.id,
    'section_id', q.section_id,
    'question_number', q.question_number,
    'question_text', q.question_text,
    'option_a', q.option_a,
    'option_b', q.option_b,
    'option_c', q.option_c,
    'option_d', q.option_d,
    'passage_id', q.passage_id,
    'audio_group_id', q.audio_group_id
   ) order by q.question_number
  )
  from public.assessment_questions q
  where q.assessment_id = v_attempt.assessment_id
 ), '[]'::jsonb),
 'passages', coalesce((
  select jsonb_agg(
   jsonb_build_object(
    'id', p.id,
    'section_id', p.section_id,
    'passage_order', p.passage_order,
    'title', p.title,
    'content', p.content
   ) order by p.passage_order
  )
  from public.assessment_passages p
  where p.assessment_id = v_attempt.assessment_id
 ), '[]'::jsonb),
 'audio_groups', coalesce((
  select jsonb_agg(
   jsonb_build_object(
    'id', g.id,
    'section_id', g.section_id,
    'group_order', g.group_order,
    'title', g.title,
    'audio_url', g.audio_url,
    'storage_path', g.storage_path
   ) order by g.group_order
  )
  from public.assessment_audio_groups g
  where g.assessment_id = v_attempt.assessment_id
 ), '[]'::jsonb),
 'answers', coalesce((
  select jsonb_agg(
   jsonb_build_object(
    'question_id', an.question_id,
    'selected_answer', an.selected_answer
   )
  )
  from public.assessment_answers an
  where an.attempt_id = v_attempt.id
 ), '[]'::jsonb),
 'attempt_sections', coalesce((
  select jsonb_agg(
   jsonb_build_object(
    'section_id', ats.section_id,
    'status', ats.status,
    'started_at', ats.started_at,
    'finished_at', ats.finished_at,
    'time_spent_seconds', ats.time_spent_seconds,
    'remaining_seconds',
     case
      when ats.status = 'completed' then 0
      when ats.started_at is null then null
      else greatest(0, s.duration_minutes * 60
       - floor(extract(epoch from (now() - ats.started_at)))::int)
     end
   ) order by s.section_order
  )
  from public.assessment_attempt_sections ats
  join public.assessment_sections s on s.id = ats.section_id
  where ats.attempt_id = v_attempt.id
 ), '[]'::jsonb)
) into v_payload;

return v_payload;
end;
$function$;

create or replace function public.assessment_submit_answer(p_attempt_token text, p_question_id uuid, p_answer text)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare
v_attempt record;
v_expires timestamptz;
v_question record;
v_state record;
v_is_correct boolean;
begin
select * into v_attempt
from public.assessment_attempts a
where a.attempt_token = p_attempt_token;

if not found then
 raise exception 'attempt_not_found';
end if;

if v_attempt.status = 'completed' then
 raise exception 'attempt_completed';
end if;

if v_attempt.token_id is not null then
 select t.expires_at into v_expires
 from public.assessment_tokens t
 where t.id = v_attempt.token_id;

 if v_expires is not null and v_expires < now() then
  raise exception 'token_expired';
 end if;
end if;

if v_attempt.status <> 'in_progress' then
 raise exception 'attempt_not_in_progress';
end if;

if p_answer is null or p_answer not in ('A', 'B', 'C', 'D') then
 raise exception 'invalid_answer';
end if;

select q.id, q.section_id, q.correct_answer
into v_question
from public.assessment_questions q
where q.id = p_question_id
and q.assessment_id = v_attempt.assessment_id;

if not found then
 raise exception 'question_not_in_assessment';
end if;

select ats.status, ats.started_at, s.duration_minutes
into v_state
from public.assessment_attempt_sections ats
join public.assessment_sections s on s.id = ats.section_id
where ats.attempt_id = v_attempt.id
and ats.section_id = v_question.section_id;

if not found then
 raise exception 'section_state_not_found';
end if;

if v_state.status = 'completed' then
 raise exception 'section_already_completed';
end if;

if v_state.status <> 'in_progress' or v_state.started_at is null then
 raise exception 'section_not_started';
end if;

if now() > v_state.started_at
 + make_interval(secs => v_state.duration_minutes * 60) then
 raise exception 'section_time_expired';
end if;

v_is_correct := (p_answer = v_question.correct_answer);

insert into public.assessment_answers (
 attempt_id, question_id, selected_answer, is_correct, answered_at
) values (
 v_attempt.id, p_question_id, p_answer, v_is_correct, now()
) on conflict (attempt_id, question_id) do update set
 selected_answer = excluded.selected_answer,
 is_correct = excluded.is_correct,
 answered_at = excluded.answered_at;

-- Mengembalikan accepted saja, BUKAN is_correct: nilai benar/salah
-- tidak pernah meninggalkan server selama ujian berjalan, supaya RPC
-- ini tidak bisa dipakai sebagai oracle coba-salah per soal oleh
-- klien yang dimodifikasi. Player resmi memang tidak membaca nilai
-- kembalian ini (hanya error). Keputusan penelaah saat penerapan.
return true;
end;
$function$;

create or replace function public.assessment_set_section_state(p_attempt_token text, p_section_id uuid, p_action text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare
v_attempt record;
v_expires timestamptz;
v_section record;
v_state record;
v_next record;
v_now timestamptz := now();
v_time_spent int;
v_is_last boolean := false;
begin
select * into v_attempt
from public.assessment_attempts a
where a.attempt_token = p_attempt_token;

if not found then
 raise exception 'attempt_not_found';
end if;

if v_attempt.status = 'completed' then
 raise exception 'attempt_completed';
end if;

if v_attempt.token_id is not null then
 select t.expires_at into v_expires
 from public.assessment_tokens t
 where t.id = v_attempt.token_id;

 if v_expires is not null and v_expires < v_now then
  raise exception 'token_expired';
 end if;
end if;

if v_attempt.status <> 'in_progress' then
 raise exception 'attempt_not_in_progress';
end if;

if p_action is null or p_action not in ('start', 'finish') then
 raise exception 'invalid_action';
end if;

select s.id, s.section_order, s.duration_minutes
into v_section
from public.assessment_sections s
where s.id = p_section_id
and s.assessment_id = v_attempt.assessment_id;

if not found then
 raise exception 'section_not_in_assessment';
end if;

select ats.status, ats.started_at, ats.finished_at, ats.time_spent_seconds
into v_state
from public.assessment_attempt_sections ats
where ats.attempt_id = v_attempt.id
and ats.section_id = p_section_id;

if not found then
 raise exception 'section_state_not_found';
end if;

if p_action = 'start' then
 if v_section.section_order <> v_attempt.current_section_order then
  raise exception 'section_out_of_order';
 end if;

 if v_state.status = 'completed' then
  raise exception 'section_already_completed';
 end if;

 if v_state.status = 'pending' then
  update public.assessment_attempt_sections
  set status = 'in_progress',
      started_at = v_now
  where attempt_id = v_attempt.id
  and section_id = p_section_id;

  v_state.status := 'in_progress';
  v_state.started_at := v_now;
 end if;

 -- status in_progress: idempoten, started_at tidak digeser
 return jsonb_build_object(
  'section_id', p_section_id,
  'action', p_action,
  'status', v_state.status,
  'started_at', v_state.started_at,
  'finished_at', v_state.finished_at,
  'time_spent_seconds', v_state.time_spent_seconds,
  'remaining_seconds', greatest(0, v_section.duration_minutes * 60
   - floor(extract(epoch from (v_now - v_state.started_at)))::int),
  'current_section_order', v_attempt.current_section_order,
  'next_section_id', null,
  'next_started_at', null,
  'next_remaining_seconds', null,
  'is_last_section', false
 );
end if;

-- p_action = 'finish'
select s.id, s.duration_minutes
into v_next
from public.assessment_sections s
where s.assessment_id = v_attempt.assessment_id
and s.section_order = v_section.section_order + 1;

v_is_last := v_next.id is null;

if v_state.status = 'completed' then
 -- panggilan ganda (tombol + timer): kembalikan keadaan tersimpan
 -- tanpa mengubah apa pun
 return jsonb_build_object(
  'section_id', p_section_id,
  'action', p_action,
  'status', v_state.status,
  'started_at', v_state.started_at,
  'finished_at', v_state.finished_at,
  'time_spent_seconds', v_state.time_spent_seconds,
  'remaining_seconds', 0,
  'current_section_order', v_attempt.current_section_order,
  'next_section_id', null,
  'next_started_at', null,
  'next_remaining_seconds', null,
  'is_last_section', v_is_last
 );
end if;

if v_section.section_order <> v_attempt.current_section_order then
 raise exception 'section_out_of_order';
end if;

v_time_spent := least(
 v_section.duration_minutes * 60,
 greatest(0, floor(extract(epoch from (
  v_now - coalesce(v_state.started_at, v_now)
 )))::int)
);

update public.assessment_attempt_sections
set status = 'completed',
    started_at = coalesce(v_state.started_at, v_now),
    finished_at = v_now,
    time_spent_seconds = v_time_spent
where attempt_id = v_attempt.id
and section_id = p_section_id;

if v_next.id is not null then
 update public.assessment_attempts
 set current_section_order = v_section.section_order + 1
 where id = v_attempt.id;

 update public.assessment_attempt_sections
 set status = 'in_progress',
     started_at = v_now
 where attempt_id = v_attempt.id
 and section_id = v_next.id;
else
 v_is_last := true;
end if;

return jsonb_build_object(
 'section_id', p_section_id,
 'action', p_action,
 'status', 'completed',
 'started_at', coalesce(v_state.started_at, v_now),
 'finished_at', v_now,
 'time_spent_seconds', v_time_spent,
 'remaining_seconds', 0,
 'current_section_order',
  case when v_is_last
   then v_section.section_order
   else v_section.section_order + 1
  end,
 'next_section_id',
  case when v_is_last then null else v_next.id end,
 'next_started_at',
  case when v_is_last then null else v_now end,
 'next_remaining_seconds',
  case when v_is_last then null else v_next.duration_minutes * 60 end,
 'is_last_section', v_is_last
);
end;
$function$;

create or replace function public.assessment_finish(p_attempt_token text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare
v_attempt record;
v_expires timestamptz;
v_now timestamptz := now();
v_raw_listening int := 0;
v_raw_structure int := 0;
v_raw_reading int := 0;
v_scaled_listening int := 31;
v_scaled_structure int := 31;
v_scaled_reading int := 31;
v_total int;
v_rec record;
v_scaled numeric;
begin
select * into v_attempt
from public.assessment_attempts a
where a.attempt_token = p_attempt_token;

if not found then
 raise exception 'attempt_not_found';
end if;

if v_attempt.status = 'completed' then
 -- idempoten: kembalikan ringkasan tersimpan, jangan hitung ulang
 return jsonb_build_object(
  'status', v_attempt.status,
  'raw_listening', v_attempt.raw_listening,
  'raw_structure', v_attempt.raw_structure,
  'raw_reading', v_attempt.raw_reading,
  'score_listening', v_attempt.score_listening,
  'score_structure', v_attempt.score_structure,
  'score_reading', v_attempt.score_reading,
  'score_total', v_attempt.score_total,
  'finished_at', v_attempt.finished_at
 );
end if;

if v_attempt.token_id is not null then
 select t.expires_at into v_expires
 from public.assessment_tokens t
 where t.id = v_attempt.token_id;

 if v_expires is not null and v_expires < v_now then
  raise exception 'token_expired';
 end if;
end if;

if v_attempt.status <> 'in_progress' then
 raise exception 'attempt_not_in_progress';
end if;

-- tutup section yang masih berjalan dengan cap waktu server
update public.assessment_attempt_sections ats
set status = 'completed',
    finished_at = v_now,
    time_spent_seconds = least(
     s.duration_minutes * 60,
     greatest(0, floor(extract(epoch from (
      v_now - coalesce(ats.started_at, v_now)
     )))::int)
    )
from public.assessment_sections s
where ats.section_id = s.id
and ats.attempt_id = v_attempt.id
and ats.status = 'in_progress';

-- nilai ulang seluruh jawaban tersimpan, di server
update public.assessment_answers a
set is_correct = (a.selected_answer = q.correct_answer) is true
from public.assessment_questions q
where a.question_id = q.id
and a.attempt_id = v_attempt.id;

-- raw per section_type + konversi skala (fungsi produksi yang sama
-- dengan yang dipanggil player lama)
for v_rec in
 select s.section_type as section_type,
        count(a.id) as answered,
        count(a.id) filter (where a.is_correct) as raw
 from public.assessment_sections s
 left join public.assessment_questions q on q.section_id = s.id
 left join public.assessment_answers a
  on a.question_id = q.id and a.attempt_id = v_attempt.id
 where s.assessment_id = v_attempt.assessment_id
 group by s.section_type
loop
 if v_rec.section_type = 'listening' then
  v_raw_listening := v_rec.raw::int;
  if v_rec.answered > 0 then
   v_scaled := public.assessment_convert_section('listening', v_rec.raw::int);
   v_scaled_listening := coalesce(v_scaled, 31)::int;
  end if;
 elsif v_rec.section_type = 'structure' then
  v_raw_structure := v_rec.raw::int;
  if v_rec.answered > 0 then
   v_scaled := public.assessment_convert_section('structure', v_rec.raw::int);
   v_scaled_structure := coalesce(v_scaled, 31)::int;
  end if;
 elsif v_rec.section_type = 'reading' then
  v_raw_reading := v_rec.raw::int;
  if v_rec.answered > 0 then
   v_scaled := public.assessment_convert_section('reading', v_rec.raw::int);
   v_scaled_reading := coalesce(v_scaled, 31)::int;
  end if;
 end if;
end loop;

v_total := round(((v_scaled_listening + v_scaled_structure
 + v_scaled_reading) / 3.0) * 10)::int;

update public.assessment_attempts
set status = 'completed',
    finished_at = v_now,
    raw_listening = v_raw_listening,
    raw_structure = v_raw_structure,
    raw_reading = v_raw_reading,
    score_listening = v_scaled_listening,
    score_structure = v_scaled_structure,
    score_reading = v_scaled_reading,
    score_total = v_total
where id = v_attempt.id;

return jsonb_build_object(
 'status', 'completed',
 'raw_listening', v_raw_listening,
 'raw_structure', v_raw_structure,
 'raw_reading', v_raw_reading,
 'score_listening', v_scaled_listening,
 'score_structure', v_scaled_structure,
 'score_reading', v_scaled_reading,
 'score_total', v_total,
 'finished_at', v_now
);
end;
$function$;

-- ----------------------------------------------------------------------------
-- Grant: siswa ujian tidak mempunyai sesi Supabase; keamanan bertumpu
-- pada attempt_token di dalam fungsi (pola yang sama dengan fungsi
-- student_* pada tangkapan 0088: grant execute ke anon, authenticated).
-- ----------------------------------------------------------------------------
revoke all on function public.assessment_get_payload(text) from public;
revoke all on function public.assessment_submit_answer(text, uuid, text) from public;
revoke all on function public.assessment_set_section_state(text, uuid, text) from public;
revoke all on function public.assessment_finish(text) from public;

grant execute on function public.assessment_get_payload(text) to anon, authenticated;
grant execute on function public.assessment_submit_answer(text, uuid, text) to anon, authenticated;
grant execute on function public.assessment_set_section_state(text, uuid, text) to anon, authenticated;
grant execute on function public.assessment_finish(text) to anon, authenticated;
