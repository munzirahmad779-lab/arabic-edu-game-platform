-- 0032_get_active_audio_settings.sql
-- RPC publik untuk membaca backsound guru aktif (dipakai oleh client
-- component GlobalBackgroundAudio di setiap halaman).

create or replace function public.get_active_audio_settings()
returns table (
  enabled boolean,
  audio_url text,
  volume int,
  play_on_dashboard boolean,
  play_on_login boolean,
  play_on_student boolean,
  play_on_game boolean,
  play_on_final boolean
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    tas.enabled,
    tas.audio_url,
    tas.volume,
    tas.play_on_dashboard,
    tas.play_on_login,
    tas.play_on_student,
    tas.play_on_game,
    tas.play_on_final
  from public.teacher_audio_settings tas
  where tas.enabled = true
    and tas.audio_url is not null
  order by tas.updated_at desc
  limit 1;
$$;

revoke all on function public.get_active_audio_settings() from public;
grant execute on function public.get_active_audio_settings() to anon, authenticated;