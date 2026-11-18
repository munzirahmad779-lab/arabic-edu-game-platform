-- 0126_post_tes_vn.sql
-- Fitur Post Tes VN (ujian akhir dengan jawaban rekaman suara):
-- siswa menjawab soal post tes dengan merekam suaranya (voice note)
-- dari halaman /student/post-tes. Berkas audio TIDAK disimpan di
-- Supabase Storage maupun Cloudflare; berkas diunggah ke Google Drive
-- lewat rute POST /api/student/post-test/upload, dan basis data hanya
-- menyimpan ID berkas serta tautan Drive-nya.
--
-- Alur:
--   1. Guru membuka post tes dari halaman /dashboard/post-tes (saklar
--      memanggil teacher_set_post_test_open). Selama tertutup, halaman
--      siswa hanya menampilkan pemberitahuan dan RPC simpan menolak.
--   2. Siswa membuka /student/post-tes, merekam jawaban tiap soal,
--      mengunggah audio ke Drive lewat rute unggah, lalu menyimpan
--      hasilnya lewat student_save_post_test_answer. Satu jawaban per
--      soal (unique student_id + question_id); kirim ulang mengganti
--      jawaban lama dan mengosongkan nilai lama karena audio berubah.
--   3. Guru memantau kemajuan dari /dashboard/post-tes
--      (teacher_post_test_overview dan teacher_post_test_student).
--   4. Penilaian dilakukan dengan menulis skor, transkrip, dan catatan
--      lewat teacher_set_post_test_grade.
--
-- Soal dibaca siswa TANPA jawaban model: student_get_post_test tidak
-- pernah mengembalikan kolom jawaban_model. Jawaban model hanya
-- keluar lewat RPC guru teacher_post_test_student.
--
-- Isi 50 soal (urutan, dars, pertanyaan, jawaban_model) TIDAK disertakan
-- di migrasi ini; soal dimasukkan pemilik lewat SQL terpisah sesudah
-- migrasi ini diterapkan.
--
-- CATATAN PENERAPAN: berkas ini disiapkan untuk ditinjau dan dijalankan
-- pemilik secara manual di SQL Editor proyek Magguru
-- (zwenvfoolgwlcjprnxlk). Belum diterapkan ke produksi oleh agen.

-- ---------------------------------------------------------------------
-- Tabel soal post tes
-- ---------------------------------------------------------------------
create table public.post_test_questions (
  id uuid primary key default gen_random_uuid(),
  urutan int not null unique,
  dars int not null,
  pertanyaan text not null,
  jawaban_model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_post_test_questions_updated_at
  before update on public.post_test_questions
  for each row execute function public.set_updated_at();

alter table public.post_test_questions enable row level security;

-- Tanpa policy: akses langsung ke tabel ditolak untuk semua peran.
-- Siswa membaca soal hanya lewat RPC student_get_post_test (yang tidak
-- mengembalikan jawaban_model); guru membaca lewat RPC guru.

-- ---------------------------------------------------------------------
-- Tabel jawaban post tes (satu baris per siswa per soal)
-- ---------------------------------------------------------------------
create table public.post_test_answers (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  question_id uuid not null references public.post_test_questions (id) on delete cascade,
  drive_file_id text not null,
  drive_link text not null,
  durasi_detik int,
  skor numeric,
  transkrip text,
  catatan text,
  graded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, question_id)
);

create index idx_post_test_answers_student
  on public.post_test_answers (student_id);

create trigger trg_post_test_answers_updated_at
  before update on public.post_test_answers
  for each row execute function public.set_updated_at();

alter table public.post_test_answers enable row level security;

-- Guru hanya boleh MEMBACA jawaban milik siswa di kelasnya sendiri
-- (pola yang sama dengan student_game_results di 0116). Siswa tidak
-- punya akses langsung ke tabel ini; baca dan tulis sisi siswa lewat
-- RPC SECURITY DEFINER di bawah.
create policy post_test_answers_select_via_owned_class
  on public.post_test_answers for select
  to authenticated
  using (
    exists (
      select 1
      from public.students s
      join public.classes c on c.id = s.class_id
      where s.id = post_test_answers.student_id
        and c.teacher_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- Tabel pengaturan post tes (satu baris: id = 1)
-- ---------------------------------------------------------------------
create table public.post_test_settings (
  id int primary key default 1 check (id = 1),
  is_open boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.post_test_settings (id, is_open)
values (1, false)
on conflict (id) do nothing;

create trigger trg_post_test_settings_updated_at
  before update on public.post_test_settings
  for each row execute function public.set_updated_at();

alter table public.post_test_settings enable row level security;

-- Tanpa policy: keadaan buka/tutup hanya dibaca dan diubah lewat RPC.

-- ---------------------------------------------------------------------
-- RPC siswa: keadaan post tes + daftar soal + status jawaban siswa.
-- Mengembalikan JSON: is_open, total_questions, answered_count, dan
-- questions[] berisi id, urutan, dars, pertanyaan, answered,
-- drive_link, durasi_detik. jawaban_model TIDAK pernah disertakan.
-- ---------------------------------------------------------------------
create or replace function public.student_get_post_test(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_student_id uuid;
  v_open boolean;
begin
  select s.student_id
  into v_student_id
  from public.verify_student_session(p_token) s
  limit 1;

  if v_student_id is null then
    raise exception 'invalid_session';
  end if;

  select coalesce(
    (select st.is_open from public.post_test_settings st where st.id = 1),
    false
  ) into v_open;

  return jsonb_build_object(
    'is_open', v_open,
    'total_questions', (
      select count(*)::int from public.post_test_questions
    ),
    'answered_count', (
      select count(*)::int
      from public.post_test_answers a
      where a.student_id = v_student_id
    ),
    'questions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', q.id,
          'urutan', q.urutan,
          'dars', q.dars,
          'pertanyaan', q.pertanyaan,
          'answered', a.id is not null,
          'drive_link', a.drive_link,
          'durasi_detik', a.durasi_detik
        )
        order by q.urutan
      )
      from public.post_test_questions q
      left join public.post_test_answers a
        on a.question_id = q.id
        and a.student_id = v_student_id
    ), '[]'::jsonb)
  );
end;
$function$;

grant execute on function public.student_get_post_test(text)
  to anon, authenticated;

-- ---------------------------------------------------------------------
-- RPC siswa: simpan (atau ganti) jawaban satu soal.
-- DITOLAK dengan pengecualian 'post_test_closed' bila post tes sedang
-- tertutup. Upsert pada unique (student_id, question_id); penggantian
-- jawaban mengosongkan skor, transkrip, catatan, dan graded_at karena
-- audio yang dinilai sudah berubah.
-- ---------------------------------------------------------------------
create or replace function public.student_save_post_test_answer(
  p_token text,
  p_question_id uuid,
  p_drive_file_id text,
  p_drive_link text,
  p_durasi_detik int
)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_student_id uuid;
  v_open boolean;
begin
  select s.student_id
  into v_student_id
  from public.verify_student_session(p_token) s
  limit 1;

  if v_student_id is null then
    raise exception 'invalid_session';
  end if;

  select coalesce(
    (select st.is_open from public.post_test_settings st where st.id = 1),
    false
  ) into v_open;

  if not v_open then
    raise exception 'post_test_closed';
  end if;

  if p_question_id is null
    or not exists (
      select 1 from public.post_test_questions q where q.id = p_question_id
    ) then
    raise exception 'invalid_question';
  end if;

  if p_drive_file_id is null
    or length(btrim(p_drive_file_id)) = 0
    or p_drive_link is null
    or length(btrim(p_drive_link)) = 0 then
    raise exception 'invalid_drive_file';
  end if;

  if p_durasi_detik is not null and p_durasi_detik < 0 then
    raise exception 'invalid_duration';
  end if;

  insert into public.post_test_answers
    (student_id, question_id, drive_file_id, drive_link, durasi_detik)
  values
    (v_student_id, p_question_id, btrim(p_drive_file_id), btrim(p_drive_link), p_durasi_detik)
  on conflict (student_id, question_id)
  do update set
    drive_file_id = excluded.drive_file_id,
    drive_link = excluded.drive_link,
    durasi_detik = excluded.durasi_detik,
    skor = null,
    transkrip = null,
    catatan = null,
    graded_at = null;

  return true;
end;
$function$;

grant execute on function public.student_save_post_test_answer(text, uuid, text, text, int)
  to anon, authenticated;

-- ---------------------------------------------------------------------
-- RPC guru: keadaan post tes (untuk saklar di halaman guru).
-- ---------------------------------------------------------------------
create or replace function public.teacher_post_test_status()
returns table (
  is_open boolean,
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

  return query
  select
    coalesce(
      (select st.is_open from public.post_test_settings st where st.id = 1),
      false
    ),
    (select count(*)::int from public.post_test_questions);
end;
$function$;

grant execute on function public.teacher_post_test_status()
  to authenticated;

-- ---------------------------------------------------------------------
-- RPC guru: buka atau tutup post tes. Mengembalikan keadaan terbaru.
-- ---------------------------------------------------------------------
create or replace function public.teacher_set_post_test_open(p_open boolean)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_open boolean;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  insert into public.post_test_settings (id, is_open)
  values (1, coalesce(p_open, false))
  on conflict (id)
  do update set is_open = excluded.is_open
  returning is_open into v_open;

  return v_open;
end;
$function$;

grant execute on function public.teacher_set_post_test_open(boolean)
  to authenticated;

-- ---------------------------------------------------------------------
-- RPC guru: ringkasan post tes per siswa dalam satu kelas milik guru
-- pemanggil: jumlah jawaban terkirim dari total soal dan jumlah yang
-- sudah dinilai.
-- ---------------------------------------------------------------------
create or replace function public.teacher_post_test_overview(p_class_id uuid)
returns table (
  student_id uuid,
  student_name text,
  sent_count int,
  graded_count int,
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
  select
    s.id,
    s.name,
    (
      select count(*)::int
      from public.post_test_answers a
      where a.student_id = s.id
    ) as sent_count,
    (
      select count(*)::int
      from public.post_test_answers a
      where a.student_id = s.id
        and a.graded_at is not null
    ) as graded_count,
    (select count(*)::int from public.post_test_questions) as total_questions
  from public.students s
  where s.class_id = p_class_id
  order by s.name;
end;
$function$;

grant execute on function public.teacher_post_test_overview(uuid)
  to authenticated;

-- ---------------------------------------------------------------------
-- RPC guru: rincian jawaban satu siswa untuk semua soal, termasuk
-- jawaban model dan hasil penilaian. Siswa harus berada di kelas
-- milik guru pemanggil.
-- ---------------------------------------------------------------------
create or replace function public.teacher_post_test_student(p_student_id uuid)
returns table (
  student_name text,
  question_id uuid,
  urutan int,
  dars int,
  pertanyaan text,
  jawaban_model text,
  answer_id uuid,
  drive_file_id text,
  drive_link text,
  durasi_detik int,
  skor numeric,
  transkrip text,
  catatan text,
  graded_at timestamptz,
  answered_at timestamptz
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
    select 1
    from public.students s
    join public.classes c on c.id = s.class_id
    where s.id = p_student_id
      and c.teacher_id = auth.uid()
  ) then
    raise exception 'STUDENT_NOT_OWNED';
  end if;

  return query
  select
    (select s.name from public.students s where s.id = p_student_id),
    q.id,
    q.urutan,
    q.dars,
    q.pertanyaan,
    q.jawaban_model,
    a.id,
    a.drive_file_id,
    a.drive_link,
    a.durasi_detik,
    a.skor,
    a.transkrip,
    a.catatan,
    a.graded_at,
    a.created_at
  from public.post_test_questions q
  left join public.post_test_answers a
    on a.question_id = q.id
    and a.student_id = p_student_id
  order by q.urutan;
end;
$function$;

grant execute on function public.teacher_post_test_student(uuid)
  to authenticated;

-- ---------------------------------------------------------------------
-- RPC guru: tulis nilai satu jawaban (skor 0 s.d. 100, transkrip
-- isi rekaman, catatan penilai). graded_at diisi saat skor diberikan
-- dan dikosongkan bila skor dihapus (p_skor null).
-- ---------------------------------------------------------------------
create or replace function public.teacher_set_post_test_grade(
  p_answer_id uuid,
  p_skor numeric,
  p_transkrip text,
  p_catatan text
)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_skor is not null and (p_skor < 0 or p_skor > 100) then
    raise exception 'invalid_score';
  end if;

  if not exists (
    select 1
    from public.post_test_answers a
    join public.students s on s.id = a.student_id
    join public.classes c on c.id = s.class_id
    where a.id = p_answer_id
      and c.teacher_id = auth.uid()
  ) then
    raise exception 'ANSWER_NOT_OWNED';
  end if;

  update public.post_test_answers
  set skor = p_skor,
      transkrip = p_transkrip,
      catatan = p_catatan,
      graded_at = case when p_skor is null then null else now() end
  where id = p_answer_id;

  return true;
end;
$function$;

grant execute on function public.teacher_set_post_test_grade(uuid, numeric, text, text)
  to authenticated;

-- Verifikasi sesudah migrasi (jalankan terpisah bila perlu):
-- select * from public.student_get_post_test('<token siswa uji>');
-- select public.student_save_post_test_answer('<token>', '<question id>', 'fileId', 'https://drive.google.com/file/d/fileId/view', 42);
--   (harus gagal dengan post_test_closed selama is_open false)
-- select * from public.teacher_post_test_status();
-- select public.teacher_set_post_test_open(true);
-- select * from public.teacher_post_test_overview('<class id kelas guru>');
-- select * from public.teacher_post_test_student('<student id>');
