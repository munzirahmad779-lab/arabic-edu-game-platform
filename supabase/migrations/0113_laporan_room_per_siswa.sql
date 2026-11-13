-- 0113_laporan_room_per_siswa.sql
-- Laporan Harian: tampilkan nilai PER SISWA untuk permainan room, dan
-- bersihkan baris tim dobel warisan jalur simpan proyektor.
--
-- Latar (terbukti live 13 Nov 2026, kelas Dars 8 PPMK Barru):
-- 1. Permainan room yang dimainkan siswa per orang (gabung pakai kode,
--    menjawab di HP masing-masing) hanya masuk Laporan Harian bila guru
--    menekan tombol Arsipkan di halaman room sesudah permainan berakhir.
--    Bila langkah itu terlewat, jawaban siswa tetap tersimpan di tabel
--    submissions tetapi tidak tampil di laporan mana pun, sehingga guru
--    menyangka riwayatnya hilang.
-- 2. Jalur simpan proyektor (saveProjectorReport) menulis DUA baris per
--    tim ke room_session_participants: baris tim "Tim Kuning (Ana)" dan
--    baris anggota "Ana [Tim]" yang menyalin skor serta jumlah benar TIM
--    seolah-olah nilai pribadi siswa. Akibatnya laporan menggandakan
--    setiap tim dan memuat angka per siswa yang bukan milik siswa itu.
--    Penulisan baris anggota dihentikan di kode (projector-save-report);
--    migrasi ini menyaring baris warisan yang sudah telanjur tersimpan.
--
-- Perubahan pada teacher_daily_report (menyalin definisi 0101, jendela
-- hari WITA +08 dipertahankan):
-- a. Cabang sesi terarsip: baris anggota warisan berakhiran "[...]" yang
--    meniru persis (skor, jumlah benar, peringkat) baris tim di sesi yang
--    sama dan yang nama dasarnya tercantum dalam label baris tim itu
--    tidak lagi ditampilkan.
-- b. Cabang BARU "room langsung": untuk room milik guru yang dimainkan
--    hari ini dan BELUM mempunyai sesi laporan pada hari yang sama,
--    hasil per siswa dihitung langsung dari submissions dengan rumus
--    skor yang sama persis seperti archive_room_session (bobot 80 dari
--    skor berbobot + sampai 20 dari kecepatan, memakai
--    game_total_weight dan game_avg_limit_ms atas snapshot room).
--    Begitu sesi tersimpan (arsip manual atau simpan proyektor),
--    submissions terhapus atau sesi hari itu ada, sehingga cabang ini
--    berhenti menampilkan room tersebut dan tidak pernah menggandakan
--    cabang sesi. Catatan: bila satu room dipakai dua permainan pada
--    hari yang sama tanpa diarsipkan di antaranya, jawaban keduanya
--    terbaca sebagai satu gabungan; arsipkan di antara dua permainan
--    untuk memisahkannya.
-- c. Cabang latihan mandiri tidak berubah, hanya urutan blok.
--
-- Bentuk hasil fungsi TIDAK berubah dari 0101.

drop function if exists public.teacher_daily_report(date);

create or replace function public.teacher_daily_report(p_date date)
returns table (
  source text,
  game_name text,
  game_mode text,
  student_name text,
  final_score int,
  rank_position int,
  correct_count int,
  total_questions int,
  recorded_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_start timestamptz;
  v_end timestamptz;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  v_start := (p_date::text || ' 00:00:00+08')::timestamptz;
  v_end := (p_date::text || ' 23:59:59+08')::timestamptz;

  -- a. Sesi room yang sudah tersimpan (arsip manual atau proyektor),
  --    tanpa baris anggota warisan pengganda dari jalur proyektor lama.
  return query
  select
    'room'::text,
    coalesce(
      g.name,
      r.snapshot->'game'->>'name',
      '—'
    ),
    coalesce(
      g.mode,
      r.snapshot->'game'->>'mode',
      'competitive'
    ),
    rsp.participant_name,
    rsp.final_score,
    rsp.rank,
    rsp.correct_count,
    rsp.total_questions,
    rs.created_at
  from public.room_session_participants rsp
  join public.room_sessions rs on rs.id = rsp.session_id
  join public.rooms r on r.id = rs.room_id
  left join public.games g on g.id = r.game_id
  where r.teacher_id = auth.uid()
    and rs.created_at >= v_start
    and rs.created_at <= v_end
    and not (
      rsp.participant_name ~ '\[[^\]]+\]\s*$'
      and exists (
        select 1
        from public.room_session_participants t
        where t.session_id = rsp.session_id
          and t.id <> rsp.id
          and t.final_score = rsp.final_score
          and t.correct_count = rsp.correct_count
          and t.rank = rsp.rank
          and (
            t.participant_name like '%(' || regexp_replace(rsp.participant_name, '\s*\[[^\]]+\]\s*$', '') || ')%'
            or t.participant_name like '%(' || regexp_replace(rsp.participant_name, '\s*\[[^\]]+\]\s*$', '') || ',%'
            or t.participant_name like '%, ' || regexp_replace(rsp.participant_name, '\s*\[[^\]]+\]\s*$', '') || ')%'
            or t.participant_name like '%, ' || regexp_replace(rsp.participant_name, '\s*\[[^\]]+\]\s*$', '') || ',%'
          )
      )
    );

  -- b. Room yang dimainkan hari ini tetapi belum tersimpan sebagai
  --    sesi: hitung hasil per siswa langsung dari submissions.
  return query
  with room_calc as (
    select
      r.id as room_id,
      jsonb_array_length(coalesce(r.snapshot->'questions', '[]'::jsonb)) as total_q,
      public.game_total_weight(coalesce(r.snapshot->'questions', '[]'::jsonb)) as total_weight,
      public.game_avg_limit_ms(coalesce(r.snapshot->'questions', '[]'::jsonb)) as avg_limit
    from public.rooms r
    where r.teacher_id = auth.uid()
      and exists (
        select 1
        from public.submissions s0
        where s0.room_id = r.id
          and s0.submitted_at >= v_start
          and s0.submitted_at <= v_end
      )
      and not exists (
        select 1
        from public.room_sessions rs0
        where rs0.room_id = r.id
          and rs0.created_at >= v_start
          and rs0.created_at <= v_end
      )
  ),
  stats as (
    select
      rc.room_id,
      coalesce(
        (select s.name from public.students s where s.id = rp.student_id),
        rp.guest_name,
        'طالب'
      ) as p_name,
      sum(case when sub.is_correct then 1 else 0 end)::int as correct_count,
      coalesce(sum(sub.score_awarded), 0)::int as weighted_correct,
      coalesce(avg(sub.response_time_ms), rc.avg_limit)::int as avg_resp,
      max(sub.submitted_at) as last_at,
      rc.total_weight,
      rc.avg_limit,
      rc.total_q
    from room_calc rc
    join public.room_participants rp on rp.room_id = rc.room_id
    join public.submissions sub
      on sub.room_participant_id = rp.id
      and sub.room_id = rc.room_id
      and sub.submitted_at >= v_start
      and sub.submitted_at <= v_end
    group by
      rc.room_id, rp.id, rp.student_id, rp.guest_name,
      rc.total_weight, rc.avg_limit, rc.total_q
  ),
  scored as (
    select st.*,
      case
        when st.total_weight = 0 then 0
        else round(
          (st.weighted_correct::numeric / st.total_weight) * 80
          + case
            when st.avg_limit = 0 then 0
            else greatest(0, least(20,
              ((st.avg_limit - st.avg_resp)::numeric / st.avg_limit) * 20
            ))
          end
        )::int
      end as fscore
    from stats st
  ),
  ranked as (
    select s.*,
      row_number() over (
        partition by s.room_id
        order by s.fscore desc, s.avg_resp asc
      )::int as rnk
    from scored s
  )
  select
    'room'::text,
    coalesce(
      g.name,
      r.snapshot->'game'->>'name',
      '—'
    ),
    coalesce(
      g.mode,
      r.snapshot->'game'->>'mode',
      'competitive'
    ),
    rk.p_name,
    rk.fscore,
    rk.rnk,
    rk.correct_count,
    rk.total_q,
    rk.last_at
  from ranked rk
  join public.rooms r on r.id = rk.room_id
  left join public.games g on g.id = r.game_id;

  -- c. Latihan mandiri (tidak berubah dari 0101).
  return query
  select
    'practice'::text,
    coalesce(g.name, '—'),
    coalesce(g.mode, 'endless'),
    s.name,
    null::int,
    null::int,
    sum(case when spa.is_correct then 1 else 0 end)::int,
    (select count(*)::int from public.game_questions gq where gq.game_id = spa.game_id),
    max(spa.answered_at)
  from public.student_practice_answers spa
  join public.students s on s.id = spa.student_id
  join public.classes c on c.id = s.class_id
  left join public.games g on g.id = spa.game_id
  where c.teacher_id = auth.uid()
    and spa.answered_at >= v_start
    and spa.answered_at <= v_end
  group by s.id, s.name, g.name, g.mode, spa.game_id;
end;
$$;

-- Verifikasi sesudah migrasi (jalankan terpisah bila perlu):
-- select source, game_name, student_name, final_score, correct_count
-- from public.teacher_daily_report(current_date)
-- order by recorded_at;
