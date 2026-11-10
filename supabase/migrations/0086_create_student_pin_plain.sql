-- ============================================================================
-- GELOMBANG 2 — 0084_create_student_pin_plain.sql
-- DITERAPKAN ke produksi (proyek zwenvfoolgwlcjprnxlk) 10 Nov 2026
-- lewat SQL Editor Supabase oleh Muse atas perintah pemilik; verifikasi
-- katalog sesudah penerapan: sesuai harapan (lihat INDEKS gelombang 2).
-- Status: SIAP TERAP (menunggu persetujuan pemilik per berkas).
-- Bila dipindah ke supabase/migrations, nomor diganti mengikuti
-- INDEKS.md (0086).
--
-- Temuan yang ditutup:
-- - W2-Ma5 sisi RPC (Mayor, audit wilayah 2): siswa yang dibuat lewat
--   formulir satuan tidak pernah mendapat pin_plain, sehingga PIN-nya
--   tidak tampil dan kartu cetaknya kosong. (Sisi aplikasinya sudah
--   ditambal di gelombang 1 dengan menulis pin_plain sesudah RPC;
--   berkas ini menutup akarnya di dalam RPC.)
-- - Bagian 2 berkas ini juga menutup bentuk ideal W2-Ma7 sisi basis
--   data: sinkronisasi pin_plain dipindah ke dalam RPC reset PIN dalam
--   satu transaksi, menggantikan penulisan terpisah dari aplikasi yang
--   bertumpu pada grant kolom 0044.
--
-- Objek yang diubah dan keadaan sebenarnya (dibaca, bukan ditebak):
-- - public.create_student(uuid, text, text), 0019_student_management.
--   sql:14-72. Insert-nya (0019:58-68) hanya menulis class_id, name,
--   pin_hash. Inilah akar Ma5.
-- - public.reset_student_pin(uuid, text), 0019:78-117. Update-nya
--   (0019:108-114) juga hanya menulis pin_hash dan updated_at; fungsi
--   ini sendiri TIDAK menulis pin_plain.
-- - Pola penulisan pin_plain yang sudah hidup ada di update_student:
--   pin_plain diisi dalam pernyataan yang sama dengan pin_hash
--   (0071_update_student.sql:69; badan terakhir dengan kualifikasi
--   extensions.crypt di 0073_fix_crypt_schema_qualification.sql:224).
--   Berkas ini meniru pola itu persis: satu pernyataan, dua kolom.
-- - Kolom pin_plain ditambahkan oleh 0028:7. Grant kolom untuk
--   penulisan aplikasi ada di 0044_grant_students.sql:4.
--
-- Isi perubahan:
-- Bagian 1 — create_student: badan sama persis dengan 0019:14-72,
--   hanya daftar kolom insert ditambah pin_plain = v_pin (PIN yang
--   sudah divalidasi format '^[0-9]{4,6}$' di 0019:33 dan yang sama
--   dengan yang di-hash). Sesudah ini, pin_plain terisi atomik untuk
--   SEMUA jalur pembuatan siswa satuan, dan tambalan gelombang 1 di
--   aplikasi menjadi tidak berbahaya bila tetap ada (menulis nilai
--   yang sama).
-- Bagian 2 — reset_student_pin: badan sama persis dengan 0019:78-117,
--   hanya update-nya ditambah pin_plain = p_pin (PIN yang sudah
--   divalidasi), sehingga hash dan teks terbaca tidak pernah lagi
--   berbeda versi. Bagian ini terpisah jelas: bila pemilik hanya
--   menghendaki Bagian 1, Bagian 2 dapat dihapus dari berkas sebelum
--   diterapkan tanpa memengaruhi Bagian 1.
-- Grant kedua fungsi diterbitkan ulang persis seperti 0019
-- (revoke dari public, anon; grant execute ke authenticated).
-- Badan fungsi sengaja TIDAK diubah di bagian lain, termasuk gaya
-- crypt() tanpa kualifikasi skema seperti aslinya di 0019; perbaikan
-- kualifikasi (pola 0073) di luar cakupan temuan ini.
--
-- Risiko / efek samping:
-- - Tidak ada perubahan tanda tangan, nilai kembali, atau pesan galat.
-- - pin_plain kini selalu terisi untuk siswa baru dan setiap reset.
--   Keputusan desain W2-K2 tentang keberadaan kolom pin_plain itu
--   sendiri tidak diubah berkas ini (lihat draf 0081).
--
-- Verifikasi sesudah diterapkan:
-- 1. Buat siswa uji lewat formulir satuan (atau panggil create_student
--    sebagai guru pemilik kelas): baris barunya harus mempunyai
--    pin_plain terisi dan sama dengan PIN yang dimasukkan.
-- 2. Reset PIN siswa uji: pin_plain harus berubah mengikuti PIN baru
--    dalam pemanggilan yang sama.
-- 3. Cetak kartu PIN siswa uji: tidak lagi kosong.
--
-- Rollback: terapkan ulang definisi 0019:14-72 dan 0019:78-117 beserta
-- grant-nya.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Bagian 1: create_student menulis pin_plain (dasar: 0019:14-72)
-- ----------------------------------------------------------------------------
create or replace function public.create_student(
  p_class_id uuid,
  p_name text,
  p_pin text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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
    crypt(v_pin, gen_salt('bf')),
    v_pin
  )
  returning id into v_student_id;

  return v_student_id;
end;
$$;

revoke all on function public.create_student(uuid, text, text) from public, anon;
grant execute on function public.create_student(uuid, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- Bagian 2: reset_student_pin menyinkronkan pin_plain dalam satu
-- pernyataan (dasar: 0019:78-117; pola sinkron: 0071:69, 0073:224)
-- ----------------------------------------------------------------------------
create or replace function public.reset_student_pin(
  p_student_id uuid,
  p_pin text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
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
    pin_hash = crypt(p_pin, gen_salt('bf')),
    pin_plain = p_pin,
    updated_at = now()
  where id = p_student_id;

  return true;
end;
$$;

revoke all on function public.reset_student_pin(uuid, text) from public, anon;
grant execute on function public.reset_student_pin(uuid, text) to authenticated;
