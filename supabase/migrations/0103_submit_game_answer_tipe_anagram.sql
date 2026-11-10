-- 0103_submit_game_answer_tipe_anagram.sql
-- Pasangan 0102 untuk sisi penilaian: submit_game_answer menghitung
-- v_game_type dengan pola coalesce yang sama cacatnya — nilai
-- tersimpan 'quiz' tidak pernah NULL sehingga cabang anagram tidak
-- pernah terpilih, dan setiap kiriman jawaban teks (selected_option_id
-- NULL, sebagaimana mestinya untuk anagram) jatuh ke cabang pilihan
-- dan ditolak dengan INVALID_OPTION. Terbukti live 11 Nov 2026:
-- empat kiriman "BUKU" pada room anagram ditolak INVALID_OPTION
-- (log Vercel /api/rooms/answer 01:07-01:14 WITA), skor siswa 0.
--
-- Migrasi ini BEDAH seperti 0102: badan fungsi live dibaca lewat
-- pg_get_functiondef, tepat satu potongan perhitungan v_game_type
-- diganti dengan ekspresi yang sama seperti 0102 (mode anagram
-- menang lebih dulu, lalu token tema whack, lalu tipe tersimpan),
-- lalu hasilnya dijalankan kembali. Bila pola lama tidak ditemukan,
-- migrasi berhenti dengan exception dan tidak mengubah apa pun.

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
  where n.nspname = 'public' and p.proname = 'submit_game_answer';

  if v_def is null then
    raise exception 'SUBMIT_GAME_ANSWER_TIDAK_DITEMUKAN';
  end if;

  v_new := regexp_replace(v_def, v_pattern, v_replacement);

  if v_new = v_def then
    raise exception 'POLA_LAMA_TIDAK_DITEMUKAN: definisi live berubah dari yang diperkirakan, migrasi dibatalkan';
  end if;

  execute v_new;
end $$;
