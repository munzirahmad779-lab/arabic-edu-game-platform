-- ============================================================================
-- Migration 0078: Store bersama state room proyektor / Kontroler HP
--
-- Latar (terverifikasi live 29-30 Okt 2026): state room hotseat proyektor
-- (fase, indeks soal, answeredTeams, events, heartbeats) selama ini hidup di
-- Map in-memory per instance server (src/lib/game-engine/
-- projector-controller-store.ts). Di Vercel serverless, POST jawaban siswa,
-- GET polling stik, POST sync_state proyektor, dan pemeriksaan /join dapat
-- mendarat di instance berbeda yang salinan memorinya berbeda-beda:
--   (a) jawaban yang sudah terkunci di stik hilang di proyektor dan tercatat
--       Waktu Habis (sync_state proyektor menimpa answeredTeams server);
--   (b) stik jatuh kembali ke layar "Menunggu Guru Memulai Kuis" di tengah
--       permainan karena payload sinkron dari instance lain tidak memuat
--       jawaban timnya;
--   (c) /join menolak kode room proyektor dengan room_not_found karena
--       isProjectorRoomActive memeriksa Map instance lokal, dan room hotseat
--       tidak pernah menjadi baris rooms di database.
--
-- Perbaikan: satu tabel public.projector_room_states menjadi sumber
-- kebenaran bersama, satu baris per kode room. Bentuk state TIDAK berubah:
-- kolom state adalah blob jsonb { events, heartbeats, gameState } persis
-- struktur RoomControllerData di TypeScript, sehingga payload API
-- /api/projector/controller tidak berubah sama sekali. Kolom game_id
-- disiapkan untuk id permainan sesi (payload sync saat ini belum
-- mengirimkannya, jadi kolom ini masih kosong dan hanya cadangan).
--
-- RLS mengikuti pola repo: tabel dikunci tanpa policy untuk peran mana pun
-- (seperti tabel submissions), dan seluruh baca/tulis berjalan lewat fungsi
-- SECURITY DEFINER di bawah yang diberi grant ke anon + authenticated,
-- karena stik siswa adalah klien anonim sedangkan proyektor adalah guru
-- yang login. Merge answeredTeams pada sync_state (semantik perbaikan
-- d6ce939) kini dilakukan di dalam SQL secara atomik per baris.
--
-- Kedaluwarsa: baris dianggap tidak aktif bila expires_at <= now().
-- expires_at diperbarui pada setiap penulisan (sync proyektor berkala,
-- press, heartbeat) menjadi now() + 60 detik, mengikuti horizon 60 detik
-- yang sudah dipakai store in-memory untuk retensi events dan jauh di atas
-- irama sync proyektor (sekitar 1 detik). Pembersihan baris kedaluwarsa
-- tidak dilakukan di migrasi ini: satu baris kecil per kode room, tertimpa
-- pemakaian kode yang sama berikutnya.
-- ============================================================================

create table if not exists public.projector_room_states (
  room_code text primary key,
  game_id uuid null,
  state jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '60 seconds'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.projector_room_states is
  'State bersama room hotseat proyektor/Kontroler HP (satu baris per kode room). Akses hanya lewat RPC SECURITY DEFINER migrasi 0078.';

alter table public.projector_room_states enable row level security;

-- Tidak ada policy untuk anon/authenticated: akses langsung ke tabel
-- ditutup rapat; seluruh baca/tulis lewat fungsi SECURITY DEFINER di bawah.
revoke all on table public.projector_room_states from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Baca state room (untuk GET polling stik di /api/projector/controller).
-- Mengembalikan NULL bila room tidak ada atau sudah kedaluwarsa, supaya
-- polling stik tidak lagi mengarang room hantu seperti store lama.
-- ----------------------------------------------------------------------------
create or replace function public.get_projector_room_state(
  p_room_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state jsonb;
begin
  select prs.state
    into v_state
    from public.projector_room_states prs
   where prs.room_code = upper(trim(p_room_code))
     and prs.expires_at > now();

  return v_state;
end;
$$;

grant execute on function public.get_projector_room_state(text)
  to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Pemeriksaan room proyektor aktif (untuk /join). Menggantikan pemeriksaan
-- Map in-memory yang praktis selalu false lintas instance, sehingga kode
-- room proyektor kini benar-benar bisa diarahkan ke /controller.
-- ----------------------------------------------------------------------------
create or replace function public.is_projector_room_active(
  p_room_code text
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.projector_room_states prs
     where prs.room_code = upper(trim(p_room_code))
       and prs.expires_at > now()
  );
$$;

grant execute on function public.is_projector_room_active(text)
  to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Sync state dari layar proyektor. Hanya sub-objek gameState yang ditulis;
-- events dan heartbeats milik server tidak disentuh. Pada indeks soal yang
-- sama, answeredTeams digabung (union, nilai payload menang per tim)
-- sehingga sync proyektor tidak pernah menghapus jawaban yang sudah
-- tercatat lewat jalur press; pada indeks soal baru, gameState payload
-- menggantikan. Baris yang sudah kedaluwarsa diperlakukan sebagai room
-- baru. Mengembalikan gameState otoritatif hasil merge.
-- ----------------------------------------------------------------------------
create or replace function public.sync_projector_room_state(
  p_room_code text,
  p_game_state jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := upper(trim(p_room_code));
  v_existing_state jsonb;
  v_existing_expires timestamptz;
  v_existing_gs jsonb;
  v_merged_gs jsonb;
  v_new_state jsonb;
begin
  select prs.state, prs.expires_at
    into v_existing_state, v_existing_expires
    from public.projector_room_states prs
   where prs.room_code = v_code
   for update;

  v_merged_gs := p_game_state;

  if v_existing_state is not null and v_existing_expires > now() then
    v_existing_gs := v_existing_state -> 'gameState';

    if v_existing_gs is not null
       and (v_existing_gs ->> 'currentQuestionIndex') is not null
       and (v_existing_gs ->> 'currentQuestionIndex')
           = (p_game_state ->> 'currentQuestionIndex') then
      v_merged_gs := jsonb_set(
        p_game_state,
        '{answeredTeams}',
        coalesce(v_existing_gs -> 'answeredTeams', '{}'::jsonb)
          || coalesce(p_game_state -> 'answeredTeams', '{}'::jsonb)
      );
    end if;

    v_new_state := jsonb_set(
      v_existing_state,
      '{gameState}',
      v_merged_gs
    );
  else
    v_new_state := jsonb_build_object(
      'events', '[]'::jsonb,
      'heartbeats', '{}'::jsonb,
      'gameState', v_merged_gs
    );
  end if;

  insert into public.projector_room_states as prs (
    room_code, state, last_seen_at, expires_at, updated_at
  ) values (
    v_code, v_new_state, now(), now() + interval '60 seconds', now()
  )
  on conflict (room_code) do update
    set state = excluded.state,
        last_seen_at = excluded.last_seen_at,
        expires_at = excluded.expires_at,
        updated_at = excluded.updated_at;

  return v_merged_gs;
end;
$$;

grant execute on function public.sync_projector_room_state(text, jsonb)
  to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Tekanan tombol jawaban dari stik siswa. Atomik per baris: heartbeat tim
-- dicatat lebih dulu (sama seperti route lama), lalu jawaban dicatat hanya
-- bila tim belum menjawab pada soal berjalan. Events lama (> 60 detik)
-- dibuang sebelum event baru ditambahkan, mengikuti retensi route lama.
-- Mengembalikan objek hasil yang dipetakan route ke payload HTTP lama:
-- { success: true, eventId, optionKey, timestamp, isLocked } atau
-- { success: false, error: 'ALREADY_ANSWERED', existingAnswer }.
-- ----------------------------------------------------------------------------
create or replace function public.press_projector_button(
  p_room_code text,
  p_team_id text,
  p_player_name text,
  p_option_id text,
  p_option_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := upper(trim(p_room_code));
  v_key text := upper(trim(coalesce(p_option_key, 'A')));
  v_now_ms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_state jsonb;
  v_gs jsonb;
  v_answers jsonb;
  v_event jsonb;
  v_events jsonb;
begin
  -- Room belum ada: buat dengan state bawaan yang sama seperti store
  -- in-memory TypeScript (fase lobby, 1 soal, timer 20 detik).
  insert into public.projector_room_states (
    room_code, state, last_seen_at, expires_at, updated_at
  ) values (
    v_code,
    jsonb_build_object(
      'events', '[]'::jsonb,
      'heartbeats', '{}'::jsonb,
      'gameState', jsonb_build_object(
        'phase', 'lobby',
        'currentQuestionIndex', 0,
        'timerSeconds', 20,
        'totalQuestions', 1,
        'answeredTeams', '{}'::jsonb,
        'lastUpdated', v_now_ms
      )
    ),
    now(), now() + interval '60 seconds', now()
  )
  on conflict (room_code) do nothing;

  select prs.state
    into v_state
    from public.projector_room_states prs
   where prs.room_code = v_code
   for update;

  v_gs := coalesce(v_state -> 'gameState', '{}'::jsonb);
  v_answers := coalesce(v_gs -> 'answeredTeams', '{}'::jsonb);

  -- Heartbeat tim dicatat pada setiap press, termasuk press yang ditolak.
  v_state := jsonb_set(
    v_state,
    '{heartbeats}',
    coalesce(v_state -> 'heartbeats', '{}'::jsonb)
      || jsonb_build_object(p_team_id, v_now_ms)
  );

  if v_answers ? p_team_id then
    update public.projector_room_states prs
       set state = v_state,
           last_seen_at = now(),
           expires_at = now() + interval '60 seconds',
           updated_at = now()
     where prs.room_code = v_code;

    return jsonb_build_object(
      'success', false,
      'error', 'ALREADY_ANSWERED',
      'existingAnswer', v_answers -> p_team_id ->> 'optionKey'
    );
  end if;

  v_answers := v_answers || jsonb_build_object(
    p_team_id,
    jsonb_build_object('optionKey', v_key, 'timestamp', v_now_ms)
  );
  v_gs := jsonb_set(v_gs, '{answeredTeams}', v_answers);
  v_state := jsonb_set(v_state, '{gameState}', v_gs);

  v_event := jsonb_build_object(
    'id', 'evt-' || v_now_ms::text || '-'
      || substr(md5(random()::text || clock_timestamp()::text), 1, 4),
    'roomCode', v_code,
    'teamId', p_team_id,
    'playerName', coalesce(p_player_name, 'Pemain'),
    'optionId', p_option_id,
    'optionKey', v_key,
    'action', 'press',
    'timestamp', v_now_ms
  );

  select coalesce(
           jsonb_agg(e order by (e ->> 'timestamp')::bigint),
           '[]'::jsonb
         )
    into v_events
    from jsonb_array_elements(coalesce(v_state -> 'events', '[]'::jsonb)) as e
   where (e ->> 'timestamp')::bigint > v_now_ms - 60000;

  v_state := jsonb_set(
    v_state,
    '{events}',
    v_events || jsonb_build_array(v_event)
  );

  update public.projector_room_states prs
     set state = v_state,
         last_seen_at = now(),
         expires_at = now() + interval '60 seconds',
         updated_at = now()
   where prs.room_code = v_code;

  return jsonb_build_object(
    'success', true,
    'eventId', v_event ->> 'id',
    'optionKey', v_key,
    'timestamp', v_now_ms,
    'isLocked', true
  );
end;
$$;

grant execute on function public.press_projector_button(text, text, text, text, text)
  to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Heartbeat stik (POST /api/projector/controller tanpa press/sync):
-- mencatat last-seen tim dan memperbarui kedaluwarsa room. Mengembalikan
-- timestamp server dalam milidetik epoch, sama seperti route lama.
-- ----------------------------------------------------------------------------
create or replace function public.touch_projector_controller(
  p_room_code text,
  p_team_id text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := upper(trim(p_room_code));
  v_now_ms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  insert into public.projector_room_states as prs (
    room_code, state, last_seen_at, expires_at, updated_at
  ) values (
    v_code,
    jsonb_build_object(
      'events', '[]'::jsonb,
      'heartbeats', jsonb_build_object(p_team_id, v_now_ms),
      'gameState', jsonb_build_object(
        'phase', 'lobby',
        'currentQuestionIndex', 0,
        'timerSeconds', 20,
        'totalQuestions', 1,
        'answeredTeams', '{}'::jsonb,
        'lastUpdated', v_now_ms
      )
    ),
    now(), now() + interval '60 seconds', now()
  )
  on conflict (room_code) do update
    set state = jsonb_set(
          prs.state,
          '{heartbeats}',
          coalesce(prs.state -> 'heartbeats', '{}'::jsonb)
            || jsonb_build_object(p_team_id, v_now_ms)
        ),
        last_seen_at = now(),
        expires_at = now() + interval '60 seconds',
        updated_at = now();

  return v_now_ms;
end;
$$;

grant execute on function public.touch_projector_controller(text, text)
  to anon, authenticated;
