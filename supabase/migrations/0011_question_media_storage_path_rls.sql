-- Keep Storage object creation consistent with the canonical metadata path.
-- Migration 0010 validates attachments; this migration rejects non-canonical
-- objects before they can become private, unreachable storage orphans.
drop policy question_media_storage_insert on storage.objects;
create policy question_media_storage_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'question-media'
    and exists (
      select 1
      from public.question_media qm
      join public.questions q on q.id = qm.question_id
      join public.question_banks qb on qb.id = q.question_bank_id
      where storage.objects.name = q.id::text || '/' || qm.id::text || '/' || qm.expected_filename
        and qb.teacher_id = (select auth.uid())
    )
  );

drop policy question_media_storage_update on storage.objects;
create policy question_media_storage_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'question-media'
    and exists (
      select 1
      from public.question_media qm
      join public.questions q on q.id = qm.question_id
      join public.question_banks qb on qb.id = q.question_bank_id
      where storage.objects.name = q.id::text || '/' || qm.id::text || '/' || qm.expected_filename
        and qb.teacher_id = (select auth.uid())
    )
  )
  with check (
    bucket_id = 'question-media'
    and exists (
      select 1
      from public.question_media qm
      join public.questions q on q.id = qm.question_id
      join public.question_banks qb on qb.id = q.question_bank_id
      where storage.objects.name = q.id::text || '/' || qm.id::text || '/' || qm.expected_filename
        and qb.teacher_id = (select auth.uid())
    )
  );
