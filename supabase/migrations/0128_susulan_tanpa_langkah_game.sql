-- 0128_susulan_tanpa_langkah_game.sql
-- Perintah pemilik (18 Nov 2026): langkah Game DIHILANGKAN dari
-- kartu Tugas Susulan sepenuhnya. Permainan Game Solo dipindah ke
-- bagian paling depan halaman Tugas Susulan sebagai jalan masuk
-- bermain tersendiri (diatur sisi aplikasi dengan kunci 7 dars yang
-- sama seperti halaman Latihan Mandiri), dan tidak lagi terhubung
-- ke status tugas apa pun.
--
-- Berkas ini membuat ulang DUA fungsi dari migrasi
-- 0125_tugas_susulan_15_dars.sql dengan selisih yang sangat sempit.
-- Ringkasan selisih terhadap badan 0125 (dibuktikan dengan diff
-- atas kedua berkas saat berkas ini ditulis):
--
--   student_get_catchup_tasks:
--   1. Kolom keluaran game_done DIHAPUS dari daftar returns.
--      Karena tipe kembali berubah, fungsi lama dijatuhkan dulu
--      (drop function if exists) lalu dibuat ulang; create or
--      replace saja tidak cukup untuk mengubah tipe kembali.
--   2. Bukti game (game_ok), yaitu subquery exists atas
--      public.student_game_results untuk game_slug 'space-war'
--      pada CTE counted, DIHAPUS. Fungsi ini tidak lagi membaca
--      tabel hasil game sama sekali.
--   3. Cabang status 'proses' tidak lagi memuat c.game_ok.
--      Pemicu 'proses' yang tersisa: baca_ok, kosakata_ok,
--      qawaid_ok, kosakata_started_at terisi, qawaid_started_at
--      terisi, dan answered_q > 0.
--   Selain tiga titik itu badan fungsi IDENTIK dengan 0125:
--   cakupan generate_series(1, 15), rentang pertemuan 1 s.d. 30,
--   pemetaan latihan per dars, dan syarat lulus (baca selesai dan
--   latihan dars itu sendiri lulus: total soal >= 25 dan benar
--   >= total soal - 5) tidak berubah.
--
--   teacher_catchup_overview:
--   Badan fungsi IDENTIK dengan 0125, tanpa satu baris pun
--   berubah. Fungsi pada 0125 memang sudah tidak menghitung bukti
--   game (selesai hanya dari baca + latihan); ia dibuat ulang di
--   sini hanya supaya pasangan RPC siswa dan guru tetap satu
--   paket rilis.
--
-- Tabel dan data tidak diubah. Tabel student_game_results dan RPC
-- pencatat hasil game (student_submit_game_result,
-- teacher_student_game_results) TIDAK disentuh: hasil bermain
-- tetap tercatat dan tetap tampil di halaman guru, hanya saja
-- tidak lagi menjadi bukti langkah pada kartu tugas.
--
-- CATATAN PENERAPAN: berkas ini disiapkan untuk ditinjau dan
-- dijalankan pemilik secara manual di SQL Editor proyek Magguru
-- (zwenvfoolgwlcjprnxlk). Belum diterapkan ke produksi oleh agen.

-- ---------------------------------------------------------------------
-- RPC siswa: daftar tugas susulan (dibuat ulang dari 0125).
-- Fungsi dijatuhkan dulu karena kolom keluaran game_done dihapus
-- (tipe kembali berubah), lalu dibuat ulang tanpa bukti game.
-- ---------------------------------------------------------------------
drop function if exists public.student_get_catchup_tasks(text);

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
      when c.baca_ok or c.kosakata_ok or c.qawaid_ok
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
-- 0125, badan fungsi IDENTIK dengan 0125 karena fungsi itu memang
-- sudah tidak menghitung bukti game).
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
--   (harus selalu tepat 15 baris Dars 1 s.d. 15, tanpa kolom
--    game_done; siswa yang hanya bermain game solo tanpa menyentuh
--    langkah tugas harus berstatus 'belum', bukan 'proses'; siswa
--    yang bacanya tuntas dan latihan darsnya lulus harus berstatus
--    'lulus' walau kosakata dan qawaid belum dikerjakan; dars yang
--    dihadiri penuh tampil sebagai baris 'selesai')
-- select * from public.teacher_catchup_overview('<class id kelas guru>');
--   (done_tasks siswa itu harus sama dengan hitungan status 'lulus'
--    di sisi siswa, sama seperti sebelum migrasi ini)
