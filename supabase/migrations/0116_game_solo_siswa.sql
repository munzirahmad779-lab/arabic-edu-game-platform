-- 0116_game_solo_siswa.sql
-- Game solo untuk siswa: hasil permainan mandiri masuk server.
--
-- Isi:
--   1. Tabel public.student_game_results: satu baris per sesi permainan
--      solo yang diselesaikan siswa dari akun siswanya (nama+PIN).
--   2. RPC student_submit_game_result: siswa mencatat hasil akhirnya
--      (token sesi siswa diselesaikan lewat verify_student_session,
--      pola yang sama dengan RPC student_* lain).
--   3. RPC student_list_class_banks + student_get_class_bank: umpan
--      Bank Soal LMS untuk sesi siswa. Bank yang terlihat HANYA bank
--      milik guru pemilik kelas siswa itu (guru diselesaikan dari
--      kelas siswa, bukan dari pilihan pemanggil). Dipakai rute
--      /api/student/game-bank yang mengumpan LmsBankPicker di mode
--      siswa; pemetaan soal memakai mapBankQuestions yang sama dengan
--      umpan guru (src/lib/game-bank-feed-core.ts).
--   4. student_get_catchup_tasks diperbarui dari 0115: langkah 'game'
--      Tugas Susulan terhitung selesai bila ADA baris
--      student_game_results milik siswa itu untuk game_slug
--      'space-war' (bukan lagi konfirmasi tombol), dan syarat itu
--      masuk ke status 'lulus'. Selain baris tugas, fungsi ini juga
--      mengembalikan satu baris status 'selesai' untuk setiap Dars
--      1 s.d. 8 yang TIDAK punya status I/A pada kedua pertemuannya
--      (dihadiri penuh), supaya halaman siswa menampilkannya sebagai
--      kartu "Sudah Selesai". Status 'selesai' murni keterangan
--      kehadiran: ia BUKAN tugas, tidak dihitung sebagai 'lulus', dan
--      teacher_catchup_overview tetap hanya menghitung dars bolong.
--   5. teacher_catchup_overview diperbarui dari 0115: langkah yang
--      dihitung dari student_catchup_progress hanya baca, kosakata,
--      qawaid (3 langkah); langkah game dibuktikan dari
--      student_game_results 'space-war' (jadi total syarat selesai
--      tetap 4 langkah).
--   6. RPC teacher_student_game_results: hasil permainan mandiri
--      TERBARU per siswa per game_slug untuk halaman guru
--      /dashboard/tugas-susulan.
--
-- Perilaku 0115 lain dipertahankan persis: timer kosakata/qawaid
-- ditegakkan server (selesai ditolak bila belum 7 menit), latihan
-- lulus bila salah maksimal 5 pada permainan minimal 25 soal, dan
-- pemetaan dars ke permainan dari nama permainan.
--
-- CATATAN PENERAPAN: berkas ini disiapkan untuk ditinjau dan
-- dijalankan pemilik secara manual di SQL Editor proyek Magguru
-- (zwenvfoolgwlcjprnxlk). Belum diterapkan ke produksi oleh agen.

-- ---------------------------------------------------------------------
-- Tabel hasil permainan solo siswa
-- ---------------------------------------------------------------------
create table public.student_game_results (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  game_slug text not null,
  score int not null default 0,
  correct_count int not null default 0,
  total_questions int not null default 0,
  finished_at timestamptz not null default now()
);

create index idx_student_game_results_student_slug
  on public.student_game_results (student_id, game_slug, finished_at desc);

alter table public.student_game_results enable row level security;

-- Guru hanya boleh MEMBACA hasil milik siswa di kelasnya sendiri
-- (pola yang sama dengan 0115). Siswa tidak punya akses langsung;
-- sisi siswa menulis lewat RPC SECURITY DEFINER di bawah.
create policy student_game_results_select_via_owned_class
  on public.student_game_results for select
  to authenticated
  using (
    exists (
      select 1
      from public.students s
      join public.classes c on c.id = s.class_id
      where s.id = student_game_results.student_id
        and c.teacher_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- RPC siswa: catat hasil akhir satu sesi permainan solo.
-- Mengembalikan true bila baris tercatat. Nilai divalidasi: slug
-- 1 s.d. 64 karakter, semua angka >= 0, benar tidak melebihi total.
-- ---------------------------------------------------------------------
create or replace function public.student_submit_game_result(
  p_token text,
  p_game_slug text,
  p_score int,
  p_correct int,
  p_total int
)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_student_id uuid;
begin
  select s.student_id
  into v_student_id
  from public.verify_student_session(p_token) s
  limit 1;

  if v_student_id is null then
    raise exception 'invalid_session';
  end if;

  if p_game_slug is null
    or length(btrim(p_game_slug)) = 0
    or length(p_game_slug) > 64 then
    raise exception 'invalid_slug';
  end if;

  if coalesce(p_score, -1) < 0
    or coalesce(p_correct, -1) < 0
    or coalesce(p_total, -1) < 0
    or p_correct > p_total then
    raise exception 'invalid_result';
  end if;

  insert into public.student_game_results
    (student_id, game_slug, score, correct_count, total_questions)
  values
    (v_student_id, btrim(p_game_slug), p_score, p_correct, p_total);

  return true;
end;
$function$;

grant execute on function public.student_submit_game_result(text, text, int, int, int)
  to anon, authenticated;

-- ---------------------------------------------------------------------
-- RPC siswa: daftar bank soal milik guru pemilik kelas siswa.
-- Hitungan soal mengikuti listTeacherBanksForGames sisi guru: soal
-- yang teks dan kunci jawabannya tidak kosong.
-- ---------------------------------------------------------------------
create or replace function public.student_list_class_banks(p_token text)
returns table (
  id uuid,
  name text,
  question_count int
)
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_class_id uuid;
  v_teacher_id uuid;
begin
  select s.class_id
  into v_class_id
  from public.verify_student_session(p_token) s
  limit 1;

  if v_class_id is null then
    raise exception 'invalid_session';
  end if;

  select c.teacher_id
  into v_teacher_id
  from public.classes c
  where c.id = v_class_id;

  return query
  select
    b.id,
    b.name,
    (
      select count(*)::int
      from public.questions q
      where q.teacher_id = v_teacher_id
        and q.question_bank_id = b.id
        and coalesce(btrim(q.question_text), '') <> ''
        and coalesce(btrim(q.correct_option_key), '') <> ''
    ) as question_count
  from public.question_banks b
  where b.teacher_id = v_teacher_id
  order by b.created_at desc;
end;
$function$;

grant execute on function public.student_list_class_banks(text)
  to anon, authenticated;

-- ---------------------------------------------------------------------
-- RPC siswa: baris mentah soal + opsi satu bank milik guru kelasnya,
-- dalam jsonb {questions: [...], options: [...]} dengan urutan yang
-- sama seperti umpan guru (sort_order, lalu created_at). Mengembalikan
-- null bila bank bukan milik guru kelas siswa. Pemetaan ke bentuk
-- netral dilakukan pemanggil dengan mapBankQuestions yang sama
-- seperti jalur guru, jadi saringan soalnya identik.
-- ---------------------------------------------------------------------
create or replace function public.student_get_class_bank(
  p_token text,
  p_bank_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_class_id uuid;
  v_teacher_id uuid;
  v_out jsonb;
begin
  select s.class_id
  into v_class_id
  from public.verify_student_session(p_token) s
  limit 1;

  if v_class_id is null then
    raise exception 'invalid_session';
  end if;

  select c.teacher_id
  into v_teacher_id
  from public.classes c
  where c.id = v_class_id;

  if not exists (
    select 1
    from public.question_banks b
    where b.id = p_bank_id
      and b.teacher_id = v_teacher_id
  ) then
    return null;
  end if;

  select jsonb_build_object(
    'questions',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', q.id,
          'question_text', q.question_text,
          'correct_option_key', q.correct_option_key
        )
        order by q.sort_order asc nulls last, q.created_at asc
      )
      from public.questions q
      where q.teacher_id = v_teacher_id
        and q.question_bank_id = p_bank_id
    ), '[]'::jsonb),
    'options',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'question_id', o.question_id,
          'option_key', o.option_key,
          'option_text', o.option_text
        )
      )
      from public.question_options o
      join public.questions q on q.id = o.question_id
      where q.teacher_id = v_teacher_id
        and q.question_bank_id = p_bank_id
    ), '[]'::jsonb)
  ) into v_out;

  return v_out;
end;
$function$;

grant execute on function public.student_get_class_bank(text, uuid)
  to anon, authenticated;

-- ---------------------------------------------------------------------
-- RPC siswa: daftar tugas susulan (diperbarui dari 0115).
-- Perubahan dari 0115:
--   - game_ok dibaca dari student_game_results game_slug 'space-war'
--     (siswa benar-benar menyelesaikan Space War dari akunnya),
--     bukan dari baris progres konfirmasi tombol.
--   - status 'lulus' kini mensyaratkan game_ok juga.
--   - setiap Dars 1 s.d. 8 selalu menghasilkan tepat satu baris:
--     dars bolong menjadi baris tugas (belum/proses/lulus), dars yang
--     dihadiri penuh menjadi baris status 'selesai' dengan
--     meeting_nos pasangan pertemuannya dan kolom langkah/latihan
--     false/0. Siswa hadir lengkap menerima 8 baris 'selesai'.
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
    select generate_series(1, 8)::int as d
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
      when c.baca_ok and c.kosakata_ok and c.qawaid_ok and c.game_ok
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
-- RPC guru: ringkasan tugas susulan per siswa (diperbarui dari 0115).
-- Perubahan dari 0115: steps_done hanya menghitung langkah baca,
-- kosakata, qawaid dari tabel progres (maksimal 3), dan syarat selesai
-- menambahkan game_ok dari student_game_results 'space-war', jadi
-- satu tugas tetap menuntut 4 langkah tuntas seperti sebelumnya.
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
          and p.step in ('baca', 'kosakata', 'qawaid')
          and p.completed_at is not null
      ) as steps_done,
      exists (
        select 1 from public.student_game_results gr
        where gr.student_id = r.sid
          and gr.game_slug = 'space-war'
      ) as game_ok
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
        and c.game_ok
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

-- ---------------------------------------------------------------------
-- RPC guru: hasil permainan mandiri TERBARU per siswa per game_slug
-- dalam satu kelas milik guru pemanggil. Dipakai halaman
-- /dashboard/tugas-susulan untuk menampilkan, per siswa, permainan
-- terakhir tiap game beserta skor, benar dari total, dan waktunya.
-- ---------------------------------------------------------------------
create or replace function public.teacher_student_game_results(p_class_id uuid)
returns table (
  student_id uuid,
  student_name text,
  game_slug text,
  score int,
  correct_count int,
  total_questions int,
  finished_at timestamptz
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
  select distinct on (gr.student_id, gr.game_slug)
    gr.student_id,
    s.name,
    gr.game_slug,
    gr.score,
    gr.correct_count,
    gr.total_questions,
    gr.finished_at
  from public.student_game_results gr
  join public.students s on s.id = gr.student_id
  where s.class_id = p_class_id
  order by gr.student_id, gr.game_slug, gr.finished_at desc;
end;
$function$;

grant execute on function public.teacher_student_game_results(uuid)
  to authenticated;

-- Verifikasi sesudah migrasi (jalankan terpisah bila perlu):
-- select public.student_submit_game_result('<token siswa uji>', 'space-war', 120, 12, 15);
-- select * from public.student_list_class_banks('<token siswa uji>');
-- select public.student_get_class_bank('<token siswa uji>', '<bank id guru kelas>');
-- select * from public.teacher_student_game_results('<class id kelas guru>');
