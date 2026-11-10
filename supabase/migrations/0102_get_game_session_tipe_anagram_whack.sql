-- 0102_get_game_session_tipe_anagram_whack.sql
-- get_game_session adalah jalur utama sesi siswa (route
-- /api/rooms/session meneruskan hasil RPC ini apa adanya), dan blok
-- perhitungan v_game_type di dalamnya membuat dua tipe tidak pernah
-- sampai ke HP siswa (terbukti live 11 Nov 2026):
--   1. Mode anagram: v_game_type := coalesce(v_game->>'game_type',
--      case when v_mode='anagram' ...) — nilai tersimpan 'quiz'
--      tidak pernah NULL sehingga cabang anagram tidak pernah
--      terpilih; siswa menerima QuizPlayer, bukan AnagramPlayer.
--   2. Tema whack: token [THEME:whack] pada nama game (cara dasbor
--      menyimpan pilihan mesin Pukul Tikus) tidak dibaca sama
--      sekali; siswa menerima QuizPlayer, bukan WhackPlayer.
--
-- Migrasi ini BEDAH, bukan tulis ulang: badan fungsi live dibaca
-- lewat pg_get_functiondef, tepat satu potongan perhitungan itu
-- diganti dengan regexp_replace, lalu hasilnya dijalankan kembali.
-- Seluruh sisa definisi live dipertahankan byte-identik, sehingga
-- tidak ada risiko regresi dari penyalinan ulang manual. Bila pola
-- lama tidak ditemukan, migrasi berhenti dengan exception dan tidak
-- mengubah apa pun.
--
-- Logika baru menyamai helper resolveSessionGameType pada route
-- sesi (jalur cadangan): mode anagram menang lebih dulu, lalu token
-- tema whack, lalu tipe tersimpan dengan cadangan 'quiz'.

do $$
declare
  v_def text;
  v_new text;
  v_pattern text := 'v_game_type := coalesce\(\s*v_game->>''game_type'',\s*case when v_mode = ''anagram'' then ''anagram'' else ''quiz'' end\s*\);';
  v_replacement text := 'v_game_type := case when v_mode = ''anagram'' then ''anagram'' when position(''[theme:whack]'' in lower(coalesce(v_game->>''name'', ''''))) > 0 then ''whack_mole'' else coalesce(v_game->>''game_type'', ''quiz'') end;';
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'get_game_session';

  if v_def is null then
    raise exception 'GET_GAME_SESSION_TIDAK_DITEMUKAN';
  end if;

  v_new := regexp_replace(v_def, v_pattern, v_replacement);

  if v_new = v_def then
    raise exception 'POLA_LAMA_TIDAK_DITEMUKAN: definisi live berubah dari yang diperkirakan, migrasi dibatalkan';
  end if;

  execute v_new;
end $$;
