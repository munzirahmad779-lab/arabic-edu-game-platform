-- =============================================================================
-- 0006_question_media.sql
-- Phase 3C — Question media metadata and private Storage foundation.
--
-- Media binaries are NOT stored in PostgreSQL.
-- Excel stores media metadata/expected filename; actual MP3/MP4/images are
-- uploaded separately and linked to a question_media row.
--
-- Product limits:
--   audio  : 10 MB
--   image  : 5 MB
--   video  : 50 MB
--   playable media (audio/video) may have a per-student play limit.
--
-- The Storage bucket has a 50 MB hard upper bound. The application/server must
-- enforce the stricter type-specific limits before upload.
-- =============================================================================

create table public.question_media (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete restrict,
  media_type text not null
    check (media_type in ('audio', 'image', 'video')),
  expected_filename text not null
    check (char_length(btrim(expected_filename)) > 0),
  storage_path text,
  original_filename text,
  mime_type text,
  size_bytes bigint
    check (size_bytes is null or size_bytes > 0),
  max_play_count integer
    check (max_play_count is null or max_play_count between 1 and 20),
  attached_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint question_media_play_count_by_type
    check (
      (media_type in ('audio', 'video') and max_play_count is not null)
      or
      (media_type = 'image' and max_play_count is null)
    ),

  constraint question_media_attachment_consistency
    check (
      (storage_path is null
        and original_filename is null
        and mime_type is null
        and size_bytes is null
        and attached_at is null)
      or
      (storage_path is not null
        and original_filename is not null
        and mime_type is not null
        and size_bytes is not null
        and attached_at is not null)
    ),

  unique (question_id, expected_filename)
);

create index idx_question_media_question_id
  on public.question_media (question_id);

create trigger trg_question_media_updated_at
  before update on public.question_media
  for each row execute function public.set_updated_at();

comment on table public.question_media is
  'Question media metadata. Binary files live in the private Supabase Storage bucket question-media.';

comment on column public.question_media.expected_filename is
  'Exact filename declared by Excel/import metadata. Upload matching is exact; the system never fuzzy-matches filenames.';

comment on column public.question_media.max_play_count is
  'Per-student maximum playback count for audio/video. This is configuration, not a global counter.';

-- ---------------------------------------------------------------------------
-- Relationship integrity and tenant ownership
-- ---------------------------------------------------------------------------

create or replace function public.assert_question_media_relationship_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  question_teacher_id uuid;
  media_limit bigint;
begin
  select qb.teacher_id
    into question_teacher_id
  from public.questions q
  join public.question_banks qb
    on qb.id = q.question_bank_id
  where q.id = new.question_id;

  if question_teacher_id is null then
    raise exception 'question media must belong to a Question Bank question';
  end if;

  if new.storage_path is not null then
    if new.media_type = 'audio' then
      media_limit := 10 * 1024 * 1024;
    elsif new.media_type = 'image' then
      media_limit := 5 * 1024 * 1024;
    elsif new.media_type = 'video' then
      media_limit := 50 * 1024 * 1024;
    end if;

    if new.size_bytes > media_limit then
      raise exception 'media file exceeds the allowed size for its media type';
    end if;
  end if;

  if new.media_type = 'audio'
     and new.mime_type is not null
     and new.mime_type not in ('audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm', 'audio/mp4') then
    raise exception 'unsupported audio MIME type';
  end if;

  if new.media_type = 'image'
     and new.mime_type is not null
     and new.mime_type not in ('image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml') then
    raise exception 'unsupported image MIME type';
  end if;

  if new.media_type = 'video'
     and new.mime_type is not null
     and new.mime_type not in ('video/mp4', 'video/webm', 'video/ogg', 'video/quicktime') then
    raise exception 'unsupported video MIME type';
  end if;

  return new;
end;
$$;

create trigger trg_question_media_relationship_integrity
  before insert or update on public.question_media
  for each row
  execute function public.assert_question_media_relationship_integrity();

-- ---------------------------------------------------------------------------
-- RLS
--
-- Owner: full CRUD.
-- Approved recipient: SELECT only when the share is active.
-- The recipient does not receive INSERT/UPDATE/DELETE privileges.
-- ---------------------------------------------------------------------------

alter table public.question_media enable row level security;

create policy question_media_select_owner_or_sharee
  on public.question_media
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.questions q
      join public.question_banks qb
        on qb.id = q.question_bank_id
      where q.id = question_media.question_id
        and (
          qb.teacher_id = (select auth.uid())
          or exists (
            select 1
            from public.question_bank_shares qbs
            where qbs.question_bank_id = qb.id
              and qbs.shared_with_user_id = (select auth.uid())
              and qbs.status = 'active'
          )
        )
    )
  );

create policy question_media_insert_owner
  on public.question_media
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.questions q
      join public.question_banks qb
        on qb.id = q.question_bank_id
      where q.id = question_media.question_id
        and qb.teacher_id = (select auth.uid())
    )
  );

create policy question_media_update_owner
  on public.question_media
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.questions q
      join public.question_banks qb
        on qb.id = q.question_bank_id
      where q.id = question_media.question_id
        and qb.teacher_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.questions q
      join public.question_banks qb
        on qb.id = q.question_bank_id
      where q.id = question_media.question_id
        and qb.teacher_id = (select auth.uid())
    )
  );

create policy question_media_delete_owner
  on public.question_media
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.questions q
      join public.question_banks qb
        on qb.id = q.question_bank_id
      where q.id = question_media.question_id
        and qb.teacher_id = (select auth.uid())
    )
  );

revoke all on table public.question_media
  from anon, authenticated;

grant select, insert, update, delete
  on table public.question_media
  to authenticated;

-- ---------------------------------------------------------------------------
-- Private Storage bucket.
--
-- 50 MB is the hard bucket ceiling. The type-specific limits above are
-- stricter for audio/images and are enforced again by the upload workflow.
-- ---------------------------------------------------------------------------

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'question-media',
  'question-media',
  false,
  52428800,
  array[
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/ogg',
    'audio/webm',
    'audio/mp4',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/svg+xml',
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage object path format:
--   <question_id>/<media_id>/<exact-filename>
--
-- The first path component is the question UUID and the second is the
-- question_media UUID. This lets Storage RLS connect an object to the
-- question -> question bank -> owner/share relationship.

create policy question_media_storage_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'question-media'
    and exists (
      select 1
      from public.question_media qm
      join public.questions q
        on q.id = qm.question_id
      join public.question_banks qb
        on qb.id = q.question_bank_id
      where qm.storage_path = storage.objects.name
        and (
          qb.teacher_id = (select auth.uid())
          or exists (
            select 1
            from public.question_bank_shares qbs
            where qbs.question_bank_id = qb.id
              and qbs.shared_with_user_id = (select auth.uid())
              and qbs.status = 'active'
          )
        )
    )
  );

create policy question_media_storage_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'question-media'
    and exists (
      select 1
      from public.question_media qm
      join public.questions q
        on q.id = qm.question_id
      join public.question_banks qb
        on qb.id = q.question_bank_id
      where qm.id::text = split_part(storage.objects.name, '/', 2)
        and storage.filename(storage.objects.name) = qm.expected_filename
        and qb.teacher_id = (select auth.uid())
    )
  );

create policy question_media_storage_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'question-media'
    and exists (
      select 1
      from public.question_media qm
      join public.questions q
        on q.id = qm.question_id
      join public.question_banks qb
        on qb.id = q.question_bank_id
      where qm.storage_path = storage.objects.name
        and qb.teacher_id = (select auth.uid())
    )
  )
  with check (
    bucket_id = 'question-media'
    and exists (
      select 1
      from public.question_media qm
      join public.questions q
        on q.id = qm.question_id
      join public.question_banks qb
        on qb.id = q.question_bank_id
      where qm.id::text = split_part(storage.objects.name, '/', 2)
        and storage.filename(storage.objects.name) = qm.expected_filename
        and qb.teacher_id = (select auth.uid())
    )
  );

create policy question_media_storage_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'question-media'
    and exists (
      select 1
      from public.question_media qm
      join public.questions q
        on q.id = qm.question_id
      join public.question_banks qb
        on qb.id = q.question_bank_id
      where qm.storage_path = storage.objects.name
        and qb.teacher_id = (select auth.uid())
    )
  );

comment on policy question_media_storage_select on storage.objects is
  'Question media is readable by the owner or an active approved Question Bank share recipient.';

comment on policy question_media_storage_insert on storage.objects is
  'Only the Question Bank owner may upload question media.';

comment on policy question_media_storage_update on storage.objects is
  'Only the Question Bank owner may replace/update question media.';

comment on policy question_media_storage_delete on storage.objects is
  'Only the Question Bank owner may delete question media.';
