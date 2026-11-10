-- ============================================================================
-- 0099_sync_proyektor_pengecualian_masuk_soal.sql
-- Samakan union-merge SQL sync_projector_room_state dengan pengecualian
-- "masuk fase question" yang sudah ada di lapisan JS (temuan K35).
--
-- Masalah (terbukti dari kode, diagnosis anomali penilaian 10 Nov
-- 2026): buildSyncedGameState di projector-controller-store.ts
-- mengganti peta answeredTeams (bukan meng-union) bila sync membawa
-- permainan masuk fase question dari fase bukan-question pada indeks
-- yang sama, supaya jawaban permainan sebelumnya tidak bangkit.
-- Tetapi badan SQL produksi fungsi ini (tangkapan 0094) meng-union
-- peta lama || baru pada indeks yang sama TANPA pengecualian fase,
-- sehingga pengecualian JS gugur di lapisan SQL: jawaban permainan
-- lama pada kode room yang sama bisa bangkit lagi di store server
-- dan mengunci stik (hasMyTeamAnswered / ALREADY_ANSWERED) pada
-- permainan baru.
--
-- Badan fungsi di berkas ini PERSIS tangkapan live 0094 dengan satu
-- perubahan pada syarat union: union hanya berlaku bila BUKAN
-- transisi masuk-question (fase tersimpan bukan 'question' dan fase
-- masuk adalah 'question' pada indeks yang sama). Pada transisi itu
-- peta pada p_game_state dipakai apa adanya, sama seperti JS.
--
-- Verifikasi sesudah penerapan:
-- 1. pg_get_functiondef memuat teks "masuk-question" (komentar
--    penanda di badan) atau pemeriksaan fase pada syarat union.
-- 2. Live: dua permainan berurutan pada kode room yang sama; stik
--    permainan kedua tidak terkunci oleh jawaban permainan pertama.
--
-- Rollback: terapkan ulang badan fungsi dari tangkapan 0094.
-- ============================================================================

create or replace function public.sync_projector_room_state(
  p_room_code text,
  p_game_state jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
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

    -- Union hanya pada indeks sama DAN bukan transisi masuk-question
    -- (0099): pada transisi lobby/reveal -> question di indeks yang
    -- sama, peta jawaban payload menggantikan peta lama apa adanya,
    -- menyamai pengecualian enteringQuestion di lapisan JS (K35).
    if v_existing_gs is not null
    and (v_existing_gs ->> 'currentQuestionIndex') is not null
    and (v_existing_gs ->> 'currentQuestionIndex')
      = (p_game_state ->> 'currentQuestionIndex')
    and not (
      coalesce(v_existing_gs ->> 'phase', '') <> 'question'
      and coalesce(p_game_state ->> 'phase', '') = 'question'
    ) then
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
$function$;
