-- ============================================================================
-- GELOMBANG 2 — 0081_pin_impor_acak.sql
-- DITERAPKAN ke produksi (proyek zwenvfoolgwlcjprnxlk) 10 Nov 2026
-- lewat SQL Editor Supabase oleh Muse atas perintah pemilik; verifikasi
-- katalog sesudah penerapan: sesuai harapan (lihat INDEKS gelombang 2).
-- Status: SIAP TERAP (menunggu persetujuan pemilik per berkas).
-- Bila dipindah ke supabase/migrations, nomor diganti mengikuti
-- INDEKS.md (0083).
--
-- Temuan yang ditutup:
-- - W2-K2 bagian skema (Kritis, audit wilayah 2): PIN siswa hasil impor
--   dibangkitkan BERURUTAN sehingga dapat ditebak. (W2-K2 keseluruhan
--   juga menyangkut kolom pin_plain dan tampilannya; berkas ini hanya
--   menghentikan pola tertebaknya, sesuai batas tugas. Kolom pin_plain
--   TIDAK dihapus di sini; itu keputusan desain terpisah.)
--
-- Objek yang diubah:
-- - public.import_students_to_class(uuid, jsonb) — definisi terakhir di
--   0028_import_students_simple.sql:12-108 (0027 adalah versi sebelumnya
--   yang sudah digantikan 0028). Pola lamanya:
--   - 0028:83-86: v_start_pin := 1001 + (jumlah siswa yang sudah ada);
--   - 0028:92: v_pin := (v_start_pin + v_index - 1)::text;
--   jadi PIN satu kelas selalu berupa deret yang dapat dihitung siapa
--   pun yang tahu satu PIN dan urutan nama.
--   Insert-nya di 0028:94-101 menulis pin_hash (extensions.crypt) dan
--   pin_plain sekaligus; kolom pin_plain sendiri ditambahkan 0028:7.
--
-- Isi perubahan:
-- - Tanda tangan, nilai kembali (student_name, student_pin), semua
--   validasi lama (kelas milik pemanggil, bentuk payload, batas
--   1-200 baris, nama sah, duplikat di berkas, duplikat di kelas), dan
--   grant (0028:110-111) dipertahankan persis.
-- - PIN kini dibangkitkan ACAK 6 digit (100000-999999) per siswa dari
--   extensions.gen_random_bytes (pgcrypto, sumber acak kriptografis;
--   modulo 900000 memberi bias yang dapat diabaikan untuk konteks ini).
-- - Setiap kandidat diperiksa tabrakannya terhadap pin_plain siswa lain
--   DI KELAS YANG SAMA, termasuk baris yang baru disisipkan pada impor
--   yang sedang berjalan (transaksi yang sama, jadi terlihat). Maksimal
--   25 percobaan per siswa; sesudah itu fungsi gagal dengan
--   PIN_GENERATION_FAILED dan seluruh impor batal (transaksional),
--   bukan menghasilkan PIN duplikat.
--
-- Risiko / efek samping:
-- - Pemeriksaan tabrakan hanya dapat membaca pin_plain. Siswa lama yang
--   dibuat lewat create_student sebelum draf 0084 diterapkan mempunyai
--   pin_plain NULL, jadi PIN asli mereka tidak dapat ikut diperiksa.
--   Dampaknya terbatas: verifikasi login bersifat per siswa (nama
--   dicocokkan dulu, lalu crypt PIN terhadap pin_hash siswa itu,
--   pola di join_room 0019 dan 0079), sehingga kesamaan angka antar
--   dua siswa dalam satu kelas bukan celah masuk; keunikan di sini
--   untuk kejelasan kartu PIN yang dicetak guru.
-- - PIN hasil impor berubah format dari 4+ digit berurutan menjadi
--   selalu 6 digit acak. Format ini sah menurut validasi PIN repo
--   ('^[0-9]{4,6}$', 0019:33). Guru yang sudah hafal pola lama perlu
--   tahu pola barunya; PIN tetap tampil di hasil impor seperti semula.
--
-- Verifikasi sesudah diterapkan:
-- 1. Impor 5 nama uji ke kelas uji: kelima PIN yang kembali harus
--    6 digit, tidak berurutan, dan tidak ada yang sama.
-- 2. select pin_plain from public.students where class_id = <kelas uji>
--    tidak memuat deret 1001, 1002, ... untuk baris baru.
--
-- Rollback: terapkan ulang definisi dari 0028:12-108 beserta grant
-- 0028:110-111.
-- ============================================================================

create or replace function public.import_students_to_class(
  p_class_id uuid,
  p_names jsonb
)
returns table (student_name text, student_pin text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_teacher_id uuid;
  v_name text;
  v_index int := 0;
  v_total int;
  v_pin text;
  v_candidate text;
  v_attempts int;
  v_bytes bytea;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select c.teacher_id into v_teacher_id
  from public.classes c where c.id = p_class_id;

  if v_teacher_id is null then
    raise exception 'CLASS_NOT_FOUND';
  end if;

  if v_teacher_id <> auth.uid() then
    raise exception 'FORBIDDEN';
  end if;

  if jsonb_typeof(p_names) <> 'array' then
    raise exception 'INVALID_PAYLOAD';
  end if;

  v_total := jsonb_array_length(p_names);
  if v_total < 1 or v_total > 200 then
    raise exception 'INVALID_ROW_COUNT';
  end if;

  v_index := 0;
  for v_name in select jsonb_array_elements_text(p_names) loop
    v_index := v_index + 1;
    v_name := btrim(v_name);
    if v_name = '' or char_length(v_name) > 100 then
      raise exception 'INVALID_NAME:baris %', v_index;
    end if;
  end loop;

  if exists (
    select 1 from (
      select btrim(lower(value::text)) as n
      from jsonb_array_elements_text(p_names) as value
    ) t
    group by n having count(*) > 1
  ) then
    raise exception 'DUPLICATE_STUDENT_IN_FILE';
  end if;

  if exists (
    select 1 from public.students s
    where s.class_id = p_class_id
      and lower(s.name) in (
        select lower(btrim(value::text))
        from jsonb_array_elements_text(p_names) as value
      )
  ) then
    raise exception 'DUPLICATE_STUDENT';
  end if;

  v_index := 0;
  for v_name in select jsonb_array_elements_text(p_names) loop
    v_index := v_index + 1;
    v_name := btrim(v_name);

    -- PIN acak 6 digit, unik di dalam kelas (menggantikan deret
    -- berurutan 0028:86 dan 0028:92).
    v_pin := null;
    v_attempts := 0;
    while v_pin is null and v_attempts < 25 loop
      v_attempts := v_attempts + 1;
      v_bytes := extensions.gen_random_bytes(3);
      v_candidate := (
        100000 + (
          (get_byte(v_bytes, 0) << 16)
          | (get_byte(v_bytes, 1) << 8)
          | get_byte(v_bytes, 2)
        ) % 900000
      )::text;

      if not exists (
        select 1 from public.students s
        where s.class_id = p_class_id
          and s.pin_plain = v_candidate
      ) then
        v_pin := v_candidate;
      end if;
    end loop;

    if v_pin is null then
      raise exception 'PIN_GENERATION_FAILED';
    end if;

    insert into public.students (class_id, name, pin_hash, pin_plain)
    values (
      p_class_id,
      v_name,
      extensions.crypt(v_pin, extensions.gen_salt('bf')),
      v_pin
    );

    student_name := v_name;
    student_pin := v_pin;
    return next;
  end loop;
end;
$$;

revoke all on function public.import_students_to_class(uuid, jsonb) from public, anon;
grant execute on function public.import_students_to_class(uuid, jsonb) to authenticated;
