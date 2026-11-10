-- ============================================================================
-- 0096_perbaiki_kualifikasi_crypt_siswa.sql
-- Perbaikan temuan audit live 10 Nov 2026 tahap C: formulir tambah
-- siswa satuan selalu gagal dengan pesan umum "Tindakan gagal
-- diproses" (?error=failed), dan atur ulang PIN satuan gagal dengan
-- cara yang sama.
--
-- Akar masalah (terbukti dari definisi live, diekspor tahap 23):
-- create_student dan reset_student_pin memanggil crypt() dan
-- gen_salt() TANPA kualifikasi skema sementara badannya memakai
-- SET search_path = '', dan ekstensi pgcrypto terpasang di skema
-- extensions. Saat dijalankan, kedua nama itu tidak ditemukan
-- (galat 42883), yang oleh aplikasi dipetakan ke pesan "failed".
-- Kelas bug yang sama pernah diperbaiki migrasi 0073 untuk
-- join_room dan update_student; dua fungsi ini tidak ikut.
-- Pola benar yang ditiru: extensions.crypt(...) seperti pada
-- reconnect_room_participant (0087) dan join_room (0073).
--
-- Isi perubahan: kedua fungsi ditulis ulang PERSIS seperti definisi
-- live-nya (tahap 23), satu-satunya perbedaan adalah kualifikasi
-- extensions. pada crypt dan gen_salt. Tidak ada perubahan perilaku
-- lain: validasi, gerbang kepemilikan kelas, penulisan pin_plain,
-- dan grant tidak berubah.
--
-- Verifikasi sesudah penerapan:
-- 1. Katalog: pg_get_functiondef untuk kedua fungsi memuat
--    "extensions.crypt" dan "extensions.gen_salt".
-- 2. Live: formulir "+ Siswa" di dasbor guru berhasil membuat satu
--    siswa uji di kelas uji, dan atur ulang PIN siswa itu berhasil;
--    keduanya sebelumnya gagal.
--
-- Rollback: terapkan ulang definisi dari migrasi 0086 (badan dengan
-- crypt tanpa kualifikasi) — tidak dianjurkan, mengembalikan bug.
-- ============================================================================

create or replace function public.create_student(
  p_class_id uuid,
  p_name text,
  p_pin text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_student_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_pin text := btrim(coalesce(p_pin, ''));
begin
  if (select auth.uid()) is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if v_name = '' or char_length(v_name) > 100 then
    raise exception 'INVALID_NAME';
  end if;

  if v_pin !~ '^[0-9]{4,6}$' then
    raise exception 'INVALID_PIN_FORMAT';
  end if;

  if not exists (
    select 1
    from public.classes c
    where c.id = p_class_id
      and c.teacher_id = (select auth.uid())
  ) then
    raise exception 'CLASS_NOT_FOUND';
  end if;

  if exists (
    select 1
    from public.students s
    where s.class_id = p_class_id
      and lower(btrim(s.name)) = lower(v_name)
  ) then
    raise exception 'DUPLICATE_STUDENT';
  end if;

  insert into public.students (
    class_id,
    name,
    pin_hash,
    pin_plain
  )
  values (
    p_class_id,
    v_name,
    extensions.crypt(v_pin, extensions.gen_salt('bf')),
    v_pin
  )
  returning id into v_student_id;

  return v_student_id;
end;
$function$;

create or replace function public.reset_student_pin(
  p_student_id uuid,
  p_pin text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if (select auth.uid()) is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_pin !~ '^[0-9]{4,6}$' then
    raise exception 'INVALID_PIN_FORMAT';
  end if;

  if not exists (
    select 1
    from public.students s
    join public.classes c on c.id = s.class_id
    where s.id = p_student_id
      and c.teacher_id = (select auth.uid())
  ) then
    raise exception 'STUDENT_NOT_FOUND';
  end if;

  update public.students
  set
    pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf')),
    pin_plain = p_pin,
    updated_at = now()
  where id = p_student_id;

  return true;
end;
$function$;
