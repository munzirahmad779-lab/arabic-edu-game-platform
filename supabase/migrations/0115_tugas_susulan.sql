-- 0115_tugas_susulan.sql
-- Fitur Tugas Susulan: siswa yang kehadirannya bolong (Izin/Alfa) pada
-- pertemuan tertentu mendapat tugas mengejar dars pertemuan itu, dengan
-- langkah berurutan:
--   1. Baca materi dars sampai selesai (gulir dibuktikan klien, status
--      disimpan di server).
--   2. Hafalkan kosakata dan pahami qawaid dars itu. Masing-masing
--      memakai timer 10 menit sejak dibuka; tombol selesai baru bisa
--      diklik bila sisa timer 3 menit atau kurang, dan server menolak
--      penyelesaian bila belum 7 menit berlalu sejak langkah dibuka.
--   3. Kerjakan Latihan Mandiri dars itu sampai lulus: jumlah SALAH
--      maksimal 5, dan permainan yang dipakai wajib berisi minimal
--      25 soal (jadi batas benar = jumlah soal - 5; untuk 30 soal,
--      benar minimal 25). Permainan Review 20 soal tidak dipakai.
--   4. Langkah game solo: permainan solo pilihan guru, dikonfirmasi
--      tombol "Sudah Main" (langkah 'game', tanpa timer, dicatat ke
--      tabel progres yang sama). Permainan solo yang bisa dibuka
--      siswa belum ada (semua rute /game memakai gerbang sesi guru),
--      jadi langkah ini diatur dari konfigurasi GAME_STEP di
--      src/modules/tugas-susulan/game-step.ts dengan required = false:
--      langkah game BELUM menjadi syarat lulus di migrasi ini. Bila
--      kelak required diubah menjadi true, tambahkan c.game_ok pada
--      syarat 'lulus' di student_get_catchup_tasks dan naikkan
--      steps_done menjadi 4 di teacher_catchup_overview.
-- Satu tugas berstatus 'lulus' bila baca + kosakata + qawaid tuntas
-- dan latihan lulus. Siswa yang hadir lengkap tidak punya tugas.
--
-- Pasangan pertemuan ke dars: Dars d mencakup pertemuan 2d-1 dan 2d.
-- Tugas susulan mencakup pertemuan 1 s.d. 16 (Dars 1 s.d. 8).
--
-- Pemetaan dars ke permainan Latihan di kelas siswa diselesaikan dari
-- NAMA permainan mode Latihan (mode 'endless'/'practice', pola yang
-- sama dengan student_list_practice_games) dengan isi minimal 25 soal,
-- bukan dari ID tertanam:
--   Dars 1 s.d. 5 -> nama mengandung "Campuran Dars 1-5" (30 soal)
--   Dars 6 s.d. 8 -> nama diawali "Dars N " (mis. "Dars 7 Rumah ...")
--
-- CATATAN PENERAPAN: berkas ini disiapkan untuk ditinjau dan dijalankan
-- pemilik secara manual di SQL Editor proyek Magguru
-- (zwenvfoolgwlcjprnxlk). Belum diterapkan ke produksi oleh agen.

-- ---------------------------------------------------------------------
-- Tabel kehadiran per pertemuan
-- ---------------------------------------------------------------------
create table public.student_meeting_attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  meeting_no int not null check (meeting_no between 1 and 40),
  status text not null check (status in ('H', 'I', 'A')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, meeting_no)
);

create index idx_student_meeting_attendance_student
  on public.student_meeting_attendance (student_id);

create trigger trg_student_meeting_attendance_updated_at
  before update on public.student_meeting_attendance
  for each row execute function public.set_updated_at();

alter table public.student_meeting_attendance enable row level security;

-- Guru hanya boleh MEMBACA baris milik siswa di kelasnya sendiri
-- (pola yang sama dengan students_select_via_owned_class di 0002).
-- Siswa tidak punya akses langsung ke tabel ini; sisi siswa membaca
-- lewat RPC student_get_catchup_tasks di bawah. Penulisan data
-- kehadiran untuk sementara lewat jalur service role / SQL pemilik.
create policy student_meeting_attendance_select_via_owned_class
  on public.student_meeting_attendance for select
  to authenticated
  using (
    exists (
      select 1
      from public.students s
      join public.classes c on c.id = s.class_id
      where s.id = student_meeting_attendance.student_id
        and c.teacher_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- Tabel progres langkah tugas susulan (baca / kosakata / qawaid)
-- ---------------------------------------------------------------------
create table public.student_catchup_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  dars_no int not null check (dars_no between 1 and 8),
  step text not null check (step in ('baca', 'kosakata', 'qawaid', 'game')),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, dars_no, step)
);

create index idx_student_catchup_progress_student
  on public.student_catchup_progress (student_id);

create trigger trg_student_catchup_progress_updated_at
  before update on public.student_catchup_progress
  for each row execute function public.set_updated_at();

alter table public.student_catchup_progress enable row level security;

-- Guru boleh MEMBACA progres siswa di kelasnya (pola 0002 yang sama).
-- Siswa tidak punya akses langsung; semua baca/tulis sisi siswa lewat
-- RPC SECURITY DEFINER di bawah.
create policy student_catchup_progress_select_via_owned_class
  on public.student_catchup_progress for select
  to authenticated
  using (
    exists (
      select 1
      from public.students s
      join public.classes c on c.id = s.class_id
      where s.id = student_catchup_progress.student_id
        and c.teacher_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- RPC siswa: mulai satu langkah (mencatat started_at untuk timer)
-- Idempoten: started_at pertama yang dipertahankan; langkah yang sudah
-- selesai tidak diubah. Mengembalikan started_at yang berlaku.
-- ---------------------------------------------------------------------
create or replace function public.student_catchup_step_start(
  p_token text,
  p_dars int,
  p_step text
)
returns timestamptz
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_student_id uuid;
  v_started timestamptz;
begin
  if p_step not in ('baca', 'kosakata', 'qawaid', 'game') then
    raise exception 'invalid_step';
  end if;
  if p_dars is null or p_dars < 1 or p_dars > 8 then
    raise exception 'invalid_dars';
  end if;

  select s.student_id
  into v_student_id
  from public.verify_student_session(p_token) s
  limit 1;

  if v_student_id is null then
    raise exception 'invalid_session';
  end if;

  insert into public.student_catchup_progress (student_id, dars_no, step, started_at)
  values (v_student_id, p_dars, p_step, now())
  on conflict (student_id, dars_no, step)
  do update set started_at = coalesce(public.student_catchup_progress.started_at, now())
  returning started_at into v_started;

  return v_started;
end;
$function$;

grant execute on function public.student_catchup_step_start(text, int, text)
  to anon, authenticated;

-- ---------------------------------------------------------------------
-- RPC siswa: selesaikan satu langkah.
-- 'baca' langsung diterima (gulir sampai akhir dibuktikan klien);
-- 'game' juga langsung diterima (konfirmasi tombol "Sudah Main").
-- 'kosakata'/'qawaid' DITOLAK (false) bila belum pernah dimulai atau
-- belum 7 menit berlalu sejak started_at; inilah penegakan timer di
-- server, sejalan dengan tombol klien yang baru aktif saat sisa timer
-- 3 menit atau kurang dari total 10 menit.
-- ---------------------------------------------------------------------
create or replace function public.student_catchup_step_complete(
  p_token text,
  p_dars int,
  p_step text
)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_student_id uuid;
  v_started timestamptz;
  v_completed timestamptz;
begin
  if p_step not in ('baca', 'kosakata', 'qawaid', 'game') then
    raise exception 'invalid_step';
  end if;
  if p_dars is null or p_dars < 1 or p_dars > 8 then
    raise exception 'invalid_dars';
  end if;

  select s.student_id
  into v_student_id
  from public.verify_student_session(p_token) s
  limit 1;

  if v_student_id is null then
    raise exception 'invalid_session';
  end if;

  select p.started_at, p.completed_at
  into v_started, v_completed
  from public.student_catchup_progress p
  where p.student_id = v_student_id
    and p.dars_no = p_dars
    and p.step = p_step;

  if v_completed is not null then
    return true;
  end if;

  if p_step in ('kosakata', 'qawaid') then
    if v_started is null then
      return false;
    end if;
    if now() - v_started < interval '7 minutes' then
      return false;
    end if;
  end if;

  insert into public.student_catchup_progress (student_id, dars_no, step, started_at, completed_at)
  values (v_student_id, p_dars, p_step, coalesce(v_started, now()), now())
  on conflict (student_id, dars_no, step)
  do update set completed_at = now(),
                started_at = coalesce(public.student_catchup_progress.started_at, now());

  return true;
end;
$function$;

grant execute on function public.student_catchup_step_complete(text, int, text)
  to anon, authenticated;

-- ---------------------------------------------------------------------
-- RPC siswa: daftar tugas susulan milik siswa pemilik token, lengkap
-- dengan status tiap langkah. Status keseluruhan 'lulus' hanya bila
-- baca + kosakata + qawaid selesai DAN latihan mencapai batas lulus.
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
      and a.meeting_no between 1 and 16
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
          and case
            when m.d between 1 and 5 then g.name ilike '%Campuran Dars 1-5%'
            else g.name ilike ('Dars ' || m.d || ' %')
          end
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
        select 1 from public.student_catchup_progress p
        where p.student_id = v_student_id and p.dars_no = r.d
          and p.step = 'game' and p.completed_at is not null
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
  )
  select
    c.d,
    c.mnos,
    c.gid,
    c.gname,
    c.total_q,
    c.answered_q,
    c.correct_q,
    (c.total_q - 5) as pass_q,
    c.baca_ok,
    c.kosakata_ok,
    c.qawaid_ok,
    c.kosakata_start,
    c.qawaid_start,
    c.game_ok,
    (
      c.gid is not null
      and c.total_q >= 25
      and c.correct_q >= c.total_q - 5
    ) as latihan_ok,
    case
      when c.baca_ok and c.kosakata_ok and c.qawaid_ok
        and c.gid is not null and c.total_q >= 25
        and c.correct_q >= c.total_q - 5
        then 'lulus'
      when c.baca_ok or c.kosakata_ok or c.qawaid_ok or c.game_ok
        or c.kosakata_start is not null or c.qawaid_start is not null
        or c.answered_q > 0
        then 'proses'
      else 'belum'
    end as status
  from counted c
  order by c.d;
end;
$function$;

grant execute on function public.student_get_catchup_tasks(text)
  to anon, authenticated;

-- ---------------------------------------------------------------------
-- RPC guru: ringkasan tugas susulan per siswa dalam satu kelas.
-- done_tasks memakai status keseluruhan yang baru: satu dars terhitung
-- selesai hanya bila baca + kosakata + qawaid tuntas DAN latihan lulus
-- (salah maksimal 5 pada permainan minimal 25 soal). Langkah game
-- belum disyaratkan (lihat catatan GAME_STEP di kepala berkas).
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
      and a.meeting_no between 1 and 16
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
          and case
            when m.d between 1 and 5 then g.name ilike '%Campuran Dars 1-5%'
            else g.name ilike ('Dars ' || m.d || ' %')
          end
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
      (
        select count(distinct p.step)::int
        from public.student_catchup_progress p
        where p.student_id = r.sid
          and p.dars_no = r.d
          and p.completed_at is not null
      ) as steps_done
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
        and c.steps_done = 3
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
-- select * from public.teacher_catchup_overview('<class id kelas guru>');
-- select public.student_catchup_step_start('<token>', 7, 'kosakata');
-- select public.student_catchup_step_complete('<token>', 7, 'kosakata');
--   (harus false bila belum 7 menit sejak start, true sesudahnya)
