-- 0101_teacher_daily_report_wita.sql
-- Laporan Harian: jendela hari pada teacher_daily_report sebelumnya
-- dibangun dengan offset +07 (WIB) sementara halaman laporan kini
-- mengirim tanggal WITA (Asia/Makassar, UTC+8) lewat format-wita.
-- Akibatnya sesi yang dimainkan pukul 00:00-00:59 WITA jatuh ke
-- laporan hari sebelumnya dan hilang dari laporan hari berjalan
-- (terbukti live 11 Nov 2026: sesi 00:06 WITA tampil di laporan
-- 10 Nov, laporan 11 Nov kosong). Migrasi ini menyalin definisi
-- 0053 persis dan hanya mengganti offset jendela hari menjadi +08.

drop function if exists public.teacher_daily_report(date);

create or replace function public.teacher_daily_report(p_date date)
returns table (
  source text,
  game_name text,
  game_mode text,
  student_name text,
  final_score int,
  rank_position int,
  correct_count int,
  total_questions int,
  recorded_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_start timestamptz;
  v_end timestamptz;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  v_start := (p_date::text || ' 00:00:00+08')::timestamptz;
  v_end := (p_date::text || ' 23:59:59+08')::timestamptz;

  return query
  select
    'room'::text,
    coalesce(
      g.name,
      r.snapshot->'game'->>'name',
      '—'
    ),
    coalesce(
      g.mode,
      r.snapshot->'game'->>'mode',
      'competitive'
    ),
    rsp.participant_name,
    rsp.final_score,
    rsp.rank,
    rsp.correct_count,
    rsp.total_questions,
    rs.created_at
  from public.room_session_participants rsp
  join public.room_sessions rs on rs.id = rsp.session_id
  join public.rooms r on r.id = rs.room_id
  left join public.games g on g.id = r.game_id
  where r.teacher_id = auth.uid()
    and rs.created_at >= v_start
    and rs.created_at <= v_end;

  return query
  select
    'practice'::text,
    coalesce(g.name, '—'),
    coalesce(g.mode, 'endless'),
    s.name,
    null::int,
    null::int,
    sum(case when spa.is_correct then 1 else 0 end)::int,
    (select count(*)::int from public.game_questions gq where gq.game_id = spa.game_id),
    max(spa.answered_at)
  from public.student_practice_answers spa
  join public.students s on s.id = spa.student_id
  join public.classes c on c.id = s.class_id
  left join public.games g on g.id = spa.game_id
  where c.teacher_id = auth.uid()
    and spa.answered_at >= v_start
    and spa.answered_at <= v_end
  group by s.id, s.name, g.name, g.mode, spa.game_id;
end;
$$;
