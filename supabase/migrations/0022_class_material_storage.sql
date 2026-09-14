-- 0022_class_material_storage.sql
-- Tambah policy storage untuk path `materials/{class_id}/...` di bucket
-- `question-media`. Dipakai guru saat upload gambar/PDF materi kelas.
-- Policy lama (untuk path {question_bank_id}/{question_id}/...) TIDAK diubah.

-- Helper: cek apakah user (guru) memiliki kelas ini
create or replace function public.can_manage_class_material_storage(
  p_class_id_text text
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.classes c
    where c.id::text = p_class_id_text
      and c.teacher_id = auth.uid()
  );
$$;

revoke all on function public.can_manage_class_material_storage(text) from public;
grant execute on function public.can_manage_class_material_storage(text)
  to authenticated;

-- INSERT: guru boleh upload ke materials/{classId}/...
drop policy if exists class_media_storage_insert on storage.objects;
create policy class_media_storage_insert on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'question-media'
    and split_part(name, '/', 1) = 'materials'
    and split_part(name, '/', 2) <> ''
    and split_part(name, '/', 3) <> ''
    and public.can_manage_class_material_storage(split_part(name, '/', 2))
  );

-- UPDATE: guru boleh overwrite file di materials/{classId}/...
drop policy if exists class_media_storage_update on storage.objects;
create policy class_media_storage_update on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'question-media'
    and split_part(name, '/', 1) = 'materials'
    and public.can_manage_class_material_storage(split_part(name, '/', 2))
  )
  with check (
    bucket_id = 'question-media'
    and split_part(name, '/', 1) = 'materials'
    and split_part(name, '/', 2) <> ''
    and split_part(name, '/', 3) <> ''
    and public.can_manage_class_material_storage(split_part(name, '/', 2))
  );

-- DELETE: guru boleh hapus file di materials/{classId}/...
drop policy if exists class_media_storage_delete on storage.objects;
create policy class_media_storage_delete on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'question-media'
    and split_part(name, '/', 1) = 'materials'
    and public.can_manage_class_material_storage(split_part(name, '/', 2))
  );