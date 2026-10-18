# Souq & Fishing Game Module — Production QA Sign-Off (Phase 6 & 6.5 Remediation)

## 1. Commit Trail

| Fase | Commit Hash | Deskripsi |
|---|---|---|
| Fase 1 | `355ff36` | Spesifikasi teknis v2.1, keputusan arsitektur, kamus Bugis Lontara, dan skeleton modul |
| Fase 2 | `6431e27` | Pure deterministic engine (world, gates, fishing, clock, buffs, active-tilt) |
| Fase 3 | `8899e87` | Proyektor UI (58/42 split horizontal, ProjectorWorldMap, ProjectorFourTeamTables) |
| Fase 4 | `821ffc3` | Mobile Controller HP UI (4-State Switcher) + Active Tilt dynamic tests (`f4bd297`) |
| Fase 5 | `eab5caf` | Real bridge, server checkpoint API, dan 5 core file mounts guarded additive-only |
| Fase 6 | `e3dff21` | Final QA regression matrix, E2E smoke tests, and production documentation |
| Fase 6.5 | `8710004` | Remediation: PostgreSQL atomic merge RPC (`0065`), real DB token & session auth, 10-case test suite |
| Fase 6.6 | *(current)* | Security Patch: RPC anon/authenticated revoke (`0066`), session.id backdoor removal, 11-case test suite |

---

## 2. Test Evolution & Coverage

- **Platform Baseline (Pre-existing)**: 81 tests
- **Fase 2 (Pure Engine)**: +22 tests → 103 passed
- **Fase 3 (Projector UI)**: +18 tests → 121 passed
- **Fase 4 (Mobile Controller)**: +18 tests → 139 passed
- **Fase 5 (Integration & Bridge)**: +21 tests → 160 passed
- **Fase 6 (E2E Headless Smoke)**: +3 tests → 163 passed
- **Fase 6.5 (Atomic RPC & Real DB Auth)**: +6 tests → 169 passed
- **Fase 6.6 (Security Patch & Backdoor Removal)**: +1 test → **170 passed across 52 test suites** (0 fails, 0 skipped)

---

## 3. Feature Flag Operational Matrix

| Environment Variable | Nilai | Status Modul | Perilaku Dashboard & Gameplay |
|---|---|---|---|
| `NEXT_PUBLIC_ENABLE_SOUQ_FISHING_MODULE` | unset / `false` | **OFF (Default Produksi)** | Modul terisolasi total. Dashboard hanya merender 15 game lama. Zero bundle contamination. |
| `NEXT_PUBLIC_ENABLE_SOUQ_FISHING_MODULE` | `true` | **ON (Pilot Mode)** | Kartu "Ekspedisi Pasar & Dermaga Pancing" muncul. Rute proyektor, controller, & self-paced aktif. |

---

## 4. Technical Disclosures & Audited Items

1. **Komponen Shell di 5 Core Files**:
   - `SouqFishingProjectorShell`: Alias import dari `@/modules/souq-fishing/ui/projector` (`ProjectorShell`).
   - `SouqFishingControllerShell`: Alias import dari `@/modules/souq-fishing/ui/controller` (`ControllerShell`).
   - `SouqFishingSelfPacedView`: Diekspor dari bridge `@/modules/souq-fishing/bridge/magguru-bridge`.
   - *Konfirmasi*: Zero inline function definitions di dalam 5 file inti. Semua modifikasi additive-only.

2. **Per-file Additive Modifications**:
   - `src/lib/game-engine/registry.ts`: Additive lookup and definition getter.
   - `src/app/dashboard/games/game-mode-selector.tsx`: Additive card render and fallback.
   - `src/app/dashboard/games/[gameId]/projector/projector-screen.tsx`: Additive conditional render.
   - `src/app/controller/page.tsx`: Additive conditional controller render.
   - `src/app/join/room/page.tsx`: Additive conditional self-paced render.

3. **Checkpoint API Atomic Merge & Real DB Auth (Remediated)**:
   - **Atomic PostgreSQL RPC**: Merge JSONB dieksekusi melalui single-statement RPC `souq_fishing_merge_checkpoint` (`jsonb_set` langsung pada level database) via migrasi `0065_souq_fishing_checkpoint_rpc.sql`. Eliminasi total pola read-modify-write.
   - **Real DB Token & Active Session Verification**: Otoritas diperiksa terhadap `room_sessions` (`ended_at IS NULL`) dan `room_participants.join_token`. Token palsu/acak ditolak di level query database dengan `HTTP 401`.
   - **Payload Guard**: Ukuran payload divalidasi `Buffer.byteLength(JSON.stringify(cp)) <= 64 * 1024` bytes (HTTP 413) di route handler serta constraint guard di fungsi PL/pgSQL.
   - **Field Isolation**: Penulisan JSONB terisolasi murni ke `rooms.snapshot.souq_fishing.checkpoint_v1`. Field `snapshot.game_questions` dan metadata snapshot lainnya tidak pernah ditimpa.

---

## 5. Rollback Runbook (Zero-Downtime Instant Rollback)

Jika sewaktu-waktu modul perlu dinonaktifkan di lingkungan produksi:
1. Masuk ke dashboard hosting (mis. Vercel Project Settings → Environment Variables).
2. Set:
   ```env
   NEXT_PUBLIC_ENABLE_SOUQ_FISHING_MODULE=false
   ENABLE_SOUQ_FISHING_MODULE=false
   ```
3. Trigger redeploy (atau biarkan instant env refresh).
4. **Hasil**: Modul 100% inert tanpa memerlukan `git revert` atau deployment kode darurat. Seluruh 6 game lama tetap beroperasi tanpa interupsi.
