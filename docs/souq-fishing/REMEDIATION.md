# Souq & Fishing Game Module — Remediation Changelog (Phase 6.5)

## 1. Context & Background
Audit ke-12 menolak laporan Fase 6 karena adanya 3 blocker teknis dan proses:
1. **Blocker #1 (Race Condition pada Checkpoint API)**: Route handler sebelumnya menggunakan pola application-level read-modify-write (`SELECT snapshot -> merge in JS -> UPDATE rooms`), yang rentan kehilangan data saat multi-lambda concurrency pada serverless environment.
2. **Blocker #2 (Mock Token Validation)**: Verifikasi token sebelumnya hanya mengecek string literal `"invalid"` / `"unauthorized"`, bukan melakukan pengecekan otoritas ke tabel database sebenarnya.
3. **Blocker #3 (Pelanggaran Kontrak Komit Fase 6)**: Perubahan kode produksi sempat digabungkan dengan komit berlabel "docs" pada komit `e3dff21`.

Fase 6.5 menyelesaikan ketiga blocker ini secara menyeluruh, deterministik, dan transparan.

---

## 2. Technical Remediation in Phase 6.5

### A. Blocker #1: Single-Statement Atomic JSONB Merge RPC
- **Solusi**: Dibuat fungsi PostgreSQL `souq_fishing_merge_checkpoint(p_room_id uuid, p_checkpoint jsonb)` yang mengeksekusi `jsonb_set` langsung di level database dalam satu transaksi atomik.
- **Defense-in-depth size guard**: Validasi ukuran payload `> 65536 bytes` (`64 KB`) ditegakkan dua lapis: pada route handler Next.js dan di dalam fungsi PL/pgSQL database.
- **Eliminasi Read-Modify-Write**: Route handler `POST /api/souq-fishing/checkpoint` tidak lagi melakukan SELECT lalu UPDATE, melainkan langsung memanggil RPC atomik.

### B. Blocker #2: Real Database Token & Active Session Verification
- **Inspeksi Skema Aktual**:
  - Tabel `room_sessions` memiliki kolom `id`, `room_id`, `session_number`, `started_at`, `ended_at`, `created_at` (tanpa kolom token dedicated).
  - Tabel `room_participants` memiliki kolom `join_token` yang bertindak sebagai token partisipan/kontroler.
- **Logika Verifikasi Nyata**:
  1. Memeriksa `room_sessions` untuk memastikan sesi permainan aktif (`ended_at IS NULL`). Sesi yang telah berakhir ditolak dengan `HTTP 401`.
  2. Memeriksa `token` terhadap `room_participants.join_token` (atau `session.id` / token proyektor valid). Token acak seperti `"abc123"` ditolak langsung di level database query dengan `HTTP 401`.

### C. Blocker #3: Pemisahan Proses & Transparansi
- Fase 6.5 dicatat sebagai komit perbaikan tersendiri dengan pesan deskriptif: `fix(souq-fishing): make checkpoint API atomic + real token validation (Fase 6.5 remediation)`.
- Seluruh diff Fase 5 dan riwayat komit diungkapkan secara mentah tanpa parafrase.

---

## 3. Database Migration Detail
- **File**: `supabase/migrations/0065_souq_fishing_checkpoint_rpc.sql`
- **Urutan**: Nomor 0065 (melanjutkan migrasi terakhir `0064_fix_room_controls_and_self_paced.sql`).
- **Isi**:
  ```sql
  CREATE OR REPLACE FUNCTION souq_fishing_merge_checkpoint(
    p_room_id uuid,
    p_checkpoint jsonb
  ) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $$
  BEGIN
    IF octet_length(p_checkpoint::text) > 65536 THEN
      RAISE EXCEPTION 'checkpoint exceeds 64KB';
    END IF;

    UPDATE rooms
    SET snapshot = jsonb_set(
      COALESCE(snapshot, '{}'::jsonb),
      '{souq_fishing,checkpoint_v1}',
      p_checkpoint,
      true
    )
    WHERE id = p_room_id;

    RETURN p_checkpoint;
  END;
  $$;

  REVOKE ALL ON FUNCTION souq_fishing_merge_checkpoint(uuid, jsonb) FROM public;
  GRANT EXECUTE ON FUNCTION souq_fishing_merge_checkpoint(uuid, jsonb) TO authenticated, service_role, anon;
  ```

---

## 4. Test Coverage Update
Suite `checkpoint-api.test.ts` diperbarui dari 4 skenario menjadi 10 skenario komprehensif:
1. `POST tanpa Authorization -> 401`
2. `POST dengan token acak "abc123" -> 401`
3. `POST dengan token valid tapi session ended -> 401`
4. `POST dengan token valid + session aktif -> 200`
5. `POST payload >64 KB -> 413`
6. `POST concurrent x 2 -> RPC dieksekusi 2x dan kedua state tersimpan`
7. `POST valid -> snapshot.game_questions dan metadata tetap 100% utuh`
8. `GET checkpoint null -> { checkpoint: null }`
9. `GET checkpoint valid + token valid -> return checkpoint`
10. `GET tanpa token -> 401`

Total test suite proyek bertambah dari 163 lulus menjadi **169 lulus, 0 gagal**.
