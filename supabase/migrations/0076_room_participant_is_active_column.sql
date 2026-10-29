-- ============================================================================
-- Migration 0076: Kolom status aktif peserta yang hilang
--
-- get_game_session dan submit_game_answer (sejak 0063/0064, terakhir
-- dibangun ulang di 0068/0074) membaca public.room_participants.is_active
-- pada pemeriksaan penyelesaian sesi, tetapi kolom itu TIDAK PERNAH dibuat
-- oleh rantai migrasi mana pun (0001 tanpa is_active; perubahan berikutnya
-- hanya join_token 0017, last_seen_at 0030, score 0075). Terbukti di
-- produksi 29 Okt 2026 lewat pemanggilan langsung fungsi (room ARHYFB,
-- sesudah 0075 menutup lubang kolom score):
--   ERROR 42703: column rp.is_active does not exist
--   (submit_game_answer line 220)
-- Karena pemeriksaan itu berjalan pada setiap pengiriman jawaban mode
-- kompetitif, fungsi tetap gugur sebagai transaksi dan jawaban tidak
-- pernah tersimpan. Tidak ada kode yang menulis is_active; ia hanya
-- dibaca sebagai "= true", jadi nilai bawaan true untuk semua baris
-- adalah semantik yang benar (keaktifan koneksi dilacak terpisah lewat
-- connection_state dan last_seen_at).
-- ============================================================================

alter table public.room_participants
  add column if not exists is_active boolean not null default true;
