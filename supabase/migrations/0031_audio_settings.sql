-- 0031_audio_settings.sql
-- Setting backsound per guru + policy storage untuk path backdrops/.

create table if not exists public.teacher_audio_settings (
  teacher_id uuid primary key references public.profiles(id) on delete cascade,
  enabled boolean not null default false,
  audio_path text,
  audio_url text,
  volume integer not null default 50 check (volume between 0 and 100),
  play_on_dashboard boolean not null default true,
  play_on_login boolean not null default true,
  play_on_student boolean not null default true,
  play_on_game boolean not null default true,
  play_on_final boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.teacher_audio_settings enable row level security;

-- RLS: guru hanya bisa akses barisnya sendiri
drop policy if exists teacher_audio_settings_own on public.teacher_audio_settings;
create policy teacher_audio_settings_own on public.teacher_audio_settings
  for all
  to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

-- Storage policy untuk path backdrops/{teacher_id}/...
drop policy if exists audio_storage_insert on storage.objects;
create policy audio_storage_insert on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'question-media'
    and split_part(name, '/', 1) = 'backdrops'
    and split_part(name, '/', 2) = auth.uid()::text
  );

drop policy if exists audio_storage_update on storage.objects;
create policy audio_storage_update on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'question-media'
    and split_part(name, '/', 1) = 'backdrops'
    and split_part(name, '/', 2) = auth.uid()::text
  )
  with check (
    bucket_id = 'question-media'
    and split_part(name, '/', 1) = 'backdrops'
    and split_part(name, '/', 2) = auth.uid()::text
  );

drop policy if exists audio_storage_delete on storage.objects;
create policy audio_storage_delete on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'question-media'
    and split_part(name, '/', 1) = 'backdrops'
    and split_part(name, '/', 2) = auth.uid()::text
  );

drop policy if exists audio_storage_select on storage.objects;
create policy audio_storage_select on storage.objects
  for select
  to public
  using (
    bucket_id = 'question-media'
    and split_part(name, '/', 1) = 'backdrops'
  );

-- Tambah mp3 ke allowed_mime_types kalau belum ada
update storage.buckets
set allowed_mime_types = array(
  select distinct unnest(
    coalesce(allowed_mime_types, '{}'::text[])
      || 'audio/mpeg'::text
      || 'audio/mp3'::text
  )
)
where id = 'question-media';