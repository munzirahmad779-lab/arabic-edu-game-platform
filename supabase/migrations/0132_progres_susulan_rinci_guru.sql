-- 0132_progres_susulan_rinci_guru.sql
-- RPC guru baru: rincian progres Tugas Susulan yang sedang
-- berjalan per siswa per dars.
--
-- Perintah pemilik (18 Nov 2026 22:19): "munculkan yang belum
-- muncul tapi sudah mengerjakan". Halaman ringkasan guru selama
-- ini hanya menampilkan hitungan tugas lulus per siswa
-- (teacher_catchup_overview), sehingga siswa yang sudah mulai
-- mengerjakan tetapi belum lulus (misalnya baru selesai membaca,
-- atau latihannya baru terjawab sebagian) tidak terlihat sedang
-- berproses di mana. RPC ini mengembalikan tepat baris-baris
-- yang berstatus 'proses' itu, dengan perhitungan yang SAMA
-- seperti student_get_catchup_tasks versi migrasi 0128:
-- pemetaan latihan per dars, bukti baca/kosakata/qawaid dari
-- student_catchup_progress, dan hitungan jawaban dari
-- student_practice_answers.
--
-- Keamanan mengikuti pola teacher_catchup_overview persis:
-- wajib auth.uid() dan kelas harus milik guru yang masuk.
-- Baris yang dikembalikan hanya dars yang terlewat (ada status
-- I atau A pada pasangan pertemuannya) dan berstatus 'proses':
-- belum lulus, tetapi sudah ada bukti mulai (baca/kosakata/
-- qawaid selesai atau mulai, atau latihan sudah terjawab
-- sebagian). Dars yang dihadiri penuh tidak punya baris di
-- sini, sama seperti di sisi siswa ia tampil sebagai selesai.
--
-- Kolom total_questions disertakan di luar daftar minimum
-- supaya halaman guru bisa menulis "Latihan X dari N terjawab".
--
-- Tabel dan data tidak diubah. RPC ini murni membaca.
--
-- CATATAN PENERAPAN: berkas ini disiapkan untuk ditinjau dan
-- dijalankan pemilik secara manual di SQL Editor proyek Magguru
-- (zwenvfoolgwlcjprnxlk). Belum diterapkan ke produksi oleh agen.

create or replace function public.teacher_catchup_progress_detail(p_class_id uuid)
returns table (
  student_id uuid,
  student_name text,
  dars_no int,
  baca_done boolean,
  kosakata_done boolean,
  qawaid_done boolean,
  answered_count int,
  correct_count int,
  total_questions int
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
      r.gid,
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
      ), 0) as answered_q,
      coalesce((
        select count(*)::int
        from public.student_practice_answers spa
        where spa.student_id = r.sid
          and spa.game_id = r.gid
          and spa.is_correct
      ), 0) as correct_q,
      exists (
        select 1 from public.student_catchup_progress p
        where p.student_id = r.sid and p.dars_no = r.d
          and p.step = 'baca' and p.completed_at is not null
      ) as baca_ok,
      exists (
        select 1 from public.student_catchup_progress p
        where p.student_id = r.sid and p.dars_no = r.d
          and p.step = 'kosakata' and p.completed_at is not null
      ) as kosakata_ok,
      exists (
        select 1 from public.student_catchup_progress p
        where p.student_id = r.sid and p.dars_no = r.d
          and p.step = 'qawaid' and p.completed_at is not null
      ) as qawaid_ok,
      (
        select p.started_at from public.student_catchup_progress p
        where p.student_id = r.sid and p.dars_no = r.d
          and p.step = 'kosakata'
      ) as kosakata_start,
      (
        select p.started_at from public.student_catchup_progress p
        where p.student_id = r.sid and p.dars_no = r.d
          and p.step = 'qawaid'
      ) as qawaid_start
    from resolved r
  )
  select
    s.id,
    s.name,
    c.d,
    c.baca_ok,
    c.kosakata_ok,
    c.qawaid_ok,
    c.answered_q,
    c.correct_q,
    c.total_q
  from counted c
  join public.students s on s.id = c.sid
  where not (
      c.baca_ok
      and c.gid is not null and c.total_q >= 25
      and c.correct_q >= c.total_q - 5
    )
    and (
      c.baca_ok or c.kosakata_ok or c.qawaid_ok
      or c.kosakata_start is not null or c.qawaid_start is not null
      or c.answered_q > 0
    )
  order by s.name, c.d;
end;
$function$;

grant execute on function public.teacher_catchup_progress_detail(uuid)
  to authenticated;
