-- 0125_tugas_susulan_15_dars.sql
-- Perintah pemilik (17 Nov 2026): cakupan Tugas Susulan diperluas
-- dari 8 dars menjadi 15 dars.
--
-- Berkas ini MEMPERLUAS migrasi
-- 0118_tugas_susulan_wajib_dua_langkah.sql dan TIDAK mengubah
-- aturan lulus di dalamnya. Kedua fungsi RPC dari 0118
-- (student_get_catchup_tasks dan teacher_catchup_overview) dibuat
-- ulang penuh (create or replace) dengan SATU perubahan cakupan
-- saja:
--
--   1. Baris dars yang selalu dikembalikan RPC siswa menjadi
--      Dars 1 s.d. 15: generate_series(1, 8) menjadi
--      generate_series(1, 15).
--   2. Rentang pertemuan yang dibaca dari
--      student_meeting_attendance menjadi pertemuan 1 s.d. 30:
--      meeting_no between 1 and 16 menjadi meeting_no between 1
--      and 30, pada kedua fungsi.
--
-- Semua hal lain identik dengan 0118: syarat lulus tetap hanya
-- Baca Materi selesai dan Latihan dars itu sendiri lulus (pola
-- nama per dars, permainan mode 'endless' atau 'practice' di kelas
-- yang sama, minimal 25 soal, benar >= total soal - 5); kosakata,
-- qawaid, dan game tetap tidak wajib dan tetap memicu status
-- 'proses'; cabang 'selesai' untuk dars yang dihadiri penuh
-- memakai pasangan pertemuan (2d-1, 2d) yang sama, kini sampai
-- pasangan pertemuan 29 dan 30 untuk Dars 15; done_tasks dan
-- total_tasks pada overview guru dihitung dari rentang yang sama.
-- RPC lain dari 0115/0116 (step_start, step_complete,
-- submit_game_result, list/get class bank,
-- teacher_student_game_results) tidak disentuh. Data kosakata dan
-- qawaid Dars 11 s.d. 15 menyertai perubahan ini pada
-- src/modules/tugas-susulan/kosakata.ts dan qawaid.ts, dan penjaga
-- nomor dars pada halaman baca siswa diperluas menjadi 1 s.d. 15.
--
-- CATATAN PENERAPAN: berkas ini disiapkan untuk ditinjau dan
-- dijalankan pemilik secara manual di SQL Editor proyek Magguru
-- (zwenvfoolgwlcjprnxlk). Belum diterapkan ke produksi oleh agen.

-- ---------------------------------------------------------------------
-- RPC siswa: daftar tugas susulan (dibuat ulang dari 0118).
-- Perubahan dari 0118 hanya cakupan: baris dars menjadi
-- generate_series(1, 15) dan rentang pertemuan menjadi 1 s.d. 30.
-- Aturan lulus (baca + latihan per dars) dan pemetaan latihan per
-- dars tidak berubah.
-- ---------------------------------------------------------------------
create or replace function public.student_get_catchup_tasks(p_token text)
returns table (
  dars_no int,
  meeting_nos int[],
  game_id uuid,
  game_name text,
  total_questions int,
  answered_count int,
  correct_count int,
  pass_correct int,
  baca_done boolean,
  kosakata_done boolean,
  qawaid_done boolean,
  kosakata_started_at timestamptz,
  qawaid_started_at timestamptz,
  game_done boolean,
  latihan_lulus boolean,
  status text
)
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_student_id uuid;
  v_class_id uuid;
begin
  select s.student_id, s.class_id
  into v_student_id, v_class_id
  from public.verify_student_session(p_token) s
  limit 1;

  if v_student_id is null then
    raise exception 'invalid_session';
  end if;

  return query
  with missed as (
    select
      ((a.meeting_no + 1) / 2)::int as d,
      array_agg(a.meeting_no order by a.meeting_no) as mnos
    from public.student_meeting_attendance a
    where a.student_id = v_student_id
      and a.status in ('I', 'A')
      and a.meeting_no between 1 and 30
    group by ((a.meeting_no + 1) / 2)
  ),
  resolved as (
    select
      m.d,
      m.mnos,
      (
        select g.id
        from public.games g
        where g.class_id = v_class_id
          and g.mode in ('endless', 'practice')
          and g.name ilike ('Dars ' || m.d || ' %')
          and (
            select count(*) from public.game_questions gq
            where gq.game_id = g.id
          ) >= 25
        order by g.created_at desc
        limit 1
      ) as gid
    from missed m
  ),
  counted as (
    select
      r.d,
      r.mnos,
      r.gid,
      (select g.name from public.games g where g.id = r.gid) as gname,
      coalesce((
        select count(*)::int
        from public.game_questions gq
        where gq.game_id = r.gid
      ), 0) as total_q,
      coalesce((
        select count(*)::int
        from public.student_practice_answers spa
        where spa.student_id = v_student_id
          and spa.game_id = r.gid
      ), 0) as answered_q,
      coalesce((
        select count(*)::int
        from public.student_practice_answers spa
        where spa.student_id = v_student_id
          and spa.game_id = r.gid
          and spa.is_correct
      ), 0) as correct_q,
      exists (
        select 1 from public.student_catchup_progress p
        where p.student_id = v_student_id and p.dars_no = r.d
          and p.step = 'baca' and p.completed_at is not null
      ) as baca_ok,
      exists (
        select 1 from public.student_catchup_progress p
        where p.student_id = v_student_id and p.dars_no = r.d
          and p.step = 'kosakata' and p.completed_at is not null
      ) as kosakata_ok,
      exists (
        select 1 from public.student_catchup_progress p
        where p.student_id = v_student_id and p.dars_no = r.d
          and p.step = 'qawaid' and p.completed_at is not null
      ) as qawaid_ok,
      exists (
        select 1 from public.student_game_results gr
        where gr.student_id = v_student_id
          and gr.game_slug = 'space-war'
      ) as game_ok,
      (
        select p.started_at from public.student_catchup_progress p
        where p.student_id = v_student_id and p.dars_no = r.d
          and p.step = 'kosakata'
      ) as kosakata_start,
      (
        select p.started_at from public.student_catchup_progress p
        where p.student_id = v_student_id and p.dars_no = r.d
          and p.step = 'qawaid'
      ) as qawaid_start
    from resolved r
  ),
  all_dars as (
    select generate_series(1, 15)::int as d
  )
  select
    ad.d,
    coalesce(c.mnos, array[ad.d * 2 - 1, ad.d * 2]),
    c.gid,
    c.gname,
    coalesce(c.total_q, 0),
    coalesce(c.answered_q, 0),
    coalesce(c.correct_q, 0),
    coalesce(c.total_q - 5, 0) as pass_q,
    coalesce(c.baca_ok, false),
    coalesce(c.kosakata_ok, false),
    coalesce(c.qawaid_ok, false),
    c.kosakata_start,
    c.qawaid_start,
    coalesce(c.game_ok, false),
    coalesce((
      c.gid is not null
      and c.total_q >= 25
      and c.correct_q >= c.total_q - 5
    ), false) as latihan_ok,
    case
      when c.d is null then 'selesai'
      when c.baca_ok
        and c.gid is not null and c.total_q >= 25
        and c.correct_q >= c.total_q - 5
        then 'lulus'
      when c.baca_ok or c.kosakata_ok or c.qawaid_ok or c.game_ok
        or c.kosakata_start is not null or c.qawaid_start is not null
        or c.answered_q > 0
        then 'proses'
      else 'belum'
    end as status
  from all_dars ad
  left join counted c on c.d = ad.d
  order by ad.d;
end;
$function$;

grant execute on function public.student_get_catchup_tasks(text)
  to anon, authenticated;

-- ---------------------------------------------------------------------
-- RPC guru: ringkasan tugas susulan per siswa (dibuat ulang dari
-- 0118). Perubahan dari 0118 hanya cakupan: rentang pertemuan
-- menjadi 1 s.d. 30. Aturan selesai (baca + latihan per dars)
-- tidak berubah.
-- ---------------------------------------------------------------------
create or replace function public.teacher_catchup_overview(p_class_id uuid)
returns table (
  student_id uuid,
  student_name text,
  total_tasks int,
  done_tasks int
)
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not exists (
    select 1 from public.classes c
    where c.id = p_class_id
      and c.teacher_id = auth.uid()
  ) then
    raise exception 'CLASS_NOT_OWNED';
  end if;

  return query
  with missed as (
    select
      a.student_id as sid,
      ((a.meeting_no + 1) / 2)::int as d
    from public.student_meeting_attendance a
    join public.students st on st.id = a.student_id
    where st.class_id = p_class_id
      and a.status in ('I', 'A')
      and a.meeting_no between 1 and 30
    group by a.student_id, ((a.meeting_no + 1) / 2)
  ),
  resolved as (
    select
      m.sid,
      m.d,
      (
        select g.id
        from public.games g
        where g.class_id = p_class_id
          and g.mode in ('endless', 'practice')
          and g.name ilike ('Dars ' || m.d || ' %')
          and (
            select count(*) from public.game_questions gq
            where gq.game_id = g.id
          ) >= 25
        order by g.created_at desc
        limit 1
      ) as gid
    from missed m
  ),
  counted as (
    select
      r.sid,
      r.d,
      coalesce((
        select count(*)::int
        from public.game_questions gq
        where gq.game_id = r.gid
      ), 0) as total_q,
      coalesce((
        select count(*)::int
        from public.student_practice_answers spa
        where spa.student_id = r.sid
          and spa.game_id = r.gid
          and spa.is_correct
      ), 0) as correct_q,
      exists (
        select 1 from public.student_catchup_progress p
        where p.student_id = r.sid
          and p.dars_no = r.d
          and p.step = 'baca'
          and p.completed_at is not null
      ) as baca_ok
    from resolved r
  )
  select
    s.id,
    s.name,
    (select count(*)::int from missed m where m.sid = s.id) as total_tasks,
    (
      select count(*)::int
      from counted c
      where c.sid = s.id
        and c.baca_ok
        and c.total_q >= 25
        and c.correct_q >= c.total_q - 5
    ) as done_tasks
  from public.students s
  where s.class_id = p_class_id
  order by s.name;
end;
$function$;

grant execute on function public.teacher_catchup_overview(uuid)
  to authenticated;

-- Verifikasi sesudah migrasi (jalankan terpisah bila perlu):
-- select * from public.student_get_catchup_tasks('<token siswa uji>');
--   (harus selalu tepat 15 baris Dars 1 s.d. 15; siswa yang bacanya
--    tuntas dan latihan darsnya lulus harus berstatus 'lulus' walau
--    kosakata, qawaid, dan game belum dikerjakan; dars yang dihadiri
--    penuh tampil sebagai baris 'selesai')
-- select * from public.teacher_catchup_overview('<class id kelas guru>');
--   (done_tasks siswa itu harus sama dengan hitungan status 'lulus'
--    di sisi siswa)
