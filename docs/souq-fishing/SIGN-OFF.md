# Souq & Fishing Game Module — Production QA Sign-Off (Phase 6 & 6.7 Cleanup)

## 1. Commit Trail

| Fase | Commit Hash | Deskripsi |
|---|---|---|
| Fase 1 | `355ff36` | Spesifikasi teknis v2.1, keputusan arsitektur, kamus Bugis Lontara, dan skeleton modul |
| Fase 2 | `6431e27` | Pure deterministic engine (world, gates, fishing, clock, buffs, active-tilt) |
| Fase 3 | `8899e87` | Proyektor UI (58/42 split horizontal, ProjectorWorldMap, ProjectorFourTeamTables) |
| Fase 4 | `821ffc3` | Mobile Controller HP UI (4-State Switcher) + Active Tilt dynamic tests (`f4bd297`) |
| Fase 5 | `eab5caf` | Real bridge, server checkpoint API, dan 5 core file mounts guarded additive-only |
| Fase 6 | `e3dff21` | Final QA regression matrix, E2E smoke tests, and production documentation |
| Fase 6.5 | `8710004` | Remediation: PostgreSQL atomic merge RPC (`0065`), real DB token, 10-case test suite |
| Fase 6.6 | `f98657e` | Security patch: revoke anon RPC (`0066`), remove session.id backdoor, 11-case test suite |

---

## 2. Test Evolution & Coverage

- **Platform Baseline (Pre-existing)**: 81 tests
- **Fase 2 (Pure Engine)**: +22 tests → 103 passed
- **Fase 3 (Projector UI)**: +18 tests → 121 passed
- **Fase 4 (Mobile Controller)**: +18 tests → 139 passed
- **Fase 5 (Integration & Bridge)**: +21 tests → 160 passed
- **Fase 6 (E2E Headless Smoke)**: +3 tests → 163 passed
- **Fase 6.5 (Atomic RPC & Real DB Auth)**: +6 tests → 169 passed
- **Fase 6.6 (Security Patch & Backdoor Removal)**: +1 test (case 11 backdoor) → **170 passed across 52 test suites** (0 fails, 0 skipped)

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

2. **Per-file Additive Modifications** (with behavioral-equivalent nuance):
   - `src/lib/game-engine/registry.ts`: +22/-3. The -3 is the signature of `GameRegistry.get()` expanded from `(type: NormalizedGameType)` to `(type: NormalizedGameType | string)`. Behavior for non-souq types is IDENTICAL: `DEFINITIONS[type as NormalizedGameType] ?? DEFINITIONS["quiz"]`. Not literal additive but behavior-equivalent when flag OFF.
   - `src/app/dashboard/games/game-mode-selector.tsx`: +47/-1. The -1 is a single line split into 3 lines (nullish coalescing). Behavior identical when flag OFF.
   - Other 3 core files (`projector-screen.tsx`, `controller/page.tsx`, `join/room/page.tsx`): literal additive, zero deletions.

3. **Checkpoint API Atomic Merge & Real DB Auth (Remediated 6.5+6.6)**:
   - Atomic PostgreSQL RPC via migration 0065 (`jsonb_set`).
   - Real DB token validation via `room_participants.join_token`.
   - **Migration 0066**: REVOKE anon/authenticated, GRANT only service_role. Defense against client-side anon key bypass.
   - **Backdoor removal**: `session.id !== token` removed. Test case 11.
   - Payload guard 64 KB (route + DB defense-in-depth).
   - Field isolation: write only to `snapshot.souq_fishing.checkpoint_v1`.

4. **Adapter Architecture Clarification**:
   - `MagguruCheckpointStoreAdapter` (in `adapters/checkpoint-store.ts`) uses in-memory `Map` for testing and local dev. **Not used in production.**
   - Production path: `POST/GET /api/souq-fishing/checkpoint` → `mergeCheckpointIntoSnapshot` → `supabaseAdmin.rpc('souq_fishing_merge_checkpoint')` → atomic PostgreSQL JSONB merge.
   - Do NOT instantiate `MagguruCheckpointStoreAdapter` in production route handlers (lambda cold start would lose state).

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
