-- 0034_multiple_audio_tracks.sql
-- Redesign: multiple audio tracks per teacher.
-- Drop tabel lama (kosong, aman), buat tabel baru.

drop table if exists public.teacher_audio_settings cascade;

create table if not exists public.teacher_audio_tracks (
  id uuid primary key default extensions.gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  audio_path text not null,
  audio_url text not null,
  volume int not null default 50 check (volume between 0 and 100),
  enabled boolean not null default true,
  pages text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists teacher_audio_tracks_teacher_idx
  on public.teacher_audio_tracks (teacher_id, created_at desc);

alter table public.teacher_audio_tracks enable row level security;

drop policy if exists teacher_audio_tracks_own on public.teacher_audio_tracks;
create policy teacher_audio_tracks_own on public.teacher_audio_tracks
  for all
  to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

grant select, insert, update, delete
  on public.teacher_audio_tracks to authenticated;

create or replace function public.get_active_audio_tracks()
returns table (
  id uuid,
  name text,
  audio_url text,
  volume int,
  pages text[]
)
language sql
security definer
set search_path = ''
stable
as $$
  select t.id, t.name, t.audio_url, t.volume, t.pages
  from public.teacher_audio_tracks t
  where t.enabled = true
    and coalesce(array_length(t.pages, 1), 0) > 0
  order by t.created_at asc;
$$;

revoke all on function public.get_active_audio_tracks() from public;
grant execute on function public.get_active_audio_tracks() to anon, authenticated;