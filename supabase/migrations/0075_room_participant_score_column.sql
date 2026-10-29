-- ============================================================================
-- Migration 0075: Kolom skor peserta yang hilang
--
-- submit_game_answer (sejak 0062, terakhir dibangun ulang di 0074)
-- menjalankan:
--   update public.room_participants set score = score + v_score
-- tetapi kolom "score" TIDAK PERNAH dibuat oleh rantai migrasi mana pun:
-- 0001 membuat room_participants tanpa score; perubahan berikutnya hanya
-- menambah join_token (0017) dan last_seen_at (0030). Terbukti di produksi
-- 29 Okt 2026 lewat pemanggilan langsung fungsi (room Y9G7GJ):
--   ERROR 42703: column "score" does not exist (submit_game_answer line 211)
-- Akibatnya SETIAP pengiriman jawaban gugur sebagai transaksi: jawaban
-- tidak pernah tersimpan di submissions dan siswa selalu menerima vonis
-- salah dari jalur cadangan aplikasi.
--
-- Perbaikan: buat kolomnya, lalu isi dari total skor submissions yang
-- sudah tercatat per peserta (skor peserta memang turunan dari situ).
-- ============================================================================

alter table public.room_participants
  add column if not exists score integer not null default 0;

update public.room_participants rp
set score = coalesce((
  select sum(s.score_awarded)::integer
  from public.submissions s
  where s.room_participant_id = rp.id
), 0);
