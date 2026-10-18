# Final QA & Regression Verification Matrix (Phase 6 & 6.7 Cleanup)

## Verification Matrix

| # | Skenario | Cara Verifikasi | Status / Hasil |
|---|---|---|---|
| 1 | Feature flag ON, register game | Buka `/dashboard/games`, periksa kartu pilihan game mode. | PENDING — menunggu verifikasi Ahmad di browser |
| 2 | Feature flag ON, projector render | Buka `/dashboard/games/[id]/projector` dengan `game_theme=souq_fishing`. | PENDING — menunggu verifikasi Ahmad di browser |
| 3 | Feature flag ON, controller render | Buka `/controller?theme=souq_fishing&room=HOTSEAT&team=MERAH`. | PENDING — menunggu verifikasi Ahmad di browser |
| 4 | Feature flag ON, checkpoint save/load | Kirim request ke `/api/souq-fishing/checkpoint` (POST/GET). | PASS (Verified via `checkpoint-api.test.ts`) |
| 5 | Feature flag OFF, quiz lama utuh | Buka game Quiz reguler tanpa flag. | PENDING — menunggu verifikasi Ahmad di browser |
| 6 | Feature flag OFF, runner lama utuh | Buka game Runner reguler tanpa flag. | PENDING — menunggu verifikasi Ahmad di browser |
| 7 | Feature flag OFF, matching lama utuh | Buka game Matching reguler tanpa flag. | PENDING — menunggu verifikasi Ahmad di browser |
| 8 | Feature flag OFF, penalty lama utuh | Buka game Penalty shootout tanpa flag. | PENDING — menunggu verifikasi Ahmad di browser |
| 9 | Feature flag OFF, anagram lama utuh | Buka game Anagram reguler tanpa flag. | PENDING — menunggu verifikasi Ahmad di browser |
| 10 | Feature flag OFF, airplane lama utuh | Buka game Pesawat Awan (Airplane) tanpa flag. | PENDING — menunggu verifikasi Ahmad di browser |
| 11 | Feature flag OFF, whack lama utuh | Buka game Pukul Tikus (Whack) tanpa flag. | PENDING — menunggu verifikasi Ahmad di browser |
| 12 | Build flag ON | Jalankan `npm run build` | PASS (Exit code 0, 39 static routes) |
| 13 | Build flag OFF | Jalankan `ENABLE_SOUQ_FISHING_MODULE=false npm run build` | PASS (Exit code 0, bundle identik baseline) |
| 14 | Bundle delta | Bandingkan `First Load JS shared by all` (ON vs OFF) | PASS (Delta 0.0 kB: baseline 87.4 kB → build 87.4 kB) |
| 15 | Zero-import | `git grep -nE "souq[-_]?[Ff]ishing"` di luar direktori modul | PASS (Hanya 5 file inti yang match) |
| 16 | Accessibility: soal Arab line-height ≥1.95 | Inspect DOM teks Arab di card soal proyektor & HP | PASS (code inspection) — Ahmad verify disarankan |
| 17 | Accessibility: tap target ≥56px di HP | Inspect tombol controller di viewport 360x640 | PASS (code inspection) — Ahmad verify disarankan |
| 18 | Bebas scroll di proyektor | Inspect element proyektor di viewport 1920x1080 | PASS (code inspection) — Ahmad verify disarankan |
| 19 | Checkpoint recovery after refresh | Refresh layar proyektor saat permainan berlangsung | PENDING — menunggu verifikasi Ahmad di browser |
| 20 | Checkpoint size guard >64KB rejected | POST checkpoint dengan ukuran > 65,536 bytes | PASS (Verified: HTTP 413 Payload Too Large via 64 KB guard) |
| 21 | Checkpoint real DB token validation | POST checkpoint dengan token acak "abc123" / session ended | PASS (Verified: HTTP 401 Unauthorized via real DB query) |
| 22 | Checkpoint concurrent atomic merge | POST concurrent x 2 ke endpoint checkpoint | PASS (Verified: RPC souq_fishing_merge_checkpoint dieksekusi 2x, both persisted) |
| 23 | Checkpoint session UUID backdoor rejected | POST checkpoint dengan token = session.id (UUID sesi) | PASS (Verified: HTTP 401 Unauthorized, backdoor ditutup) |
| 24 | Checkpoint RPC role lockdown | Query information_schema.routine_privileges untuk RPC | PASS (Verified: anon/auth revoked, service_role only via 0066) |

---

## Panduan Verifikasi Manual untuk Ahmad

### A. Uji Coba Pilot (Feature Flag ON)
Tambahkan ke `.env.local`:
```bash
NEXT_PUBLIC_ENABLE_SOUQ_FISHING_MODULE=true
ENABLE_SOUQ_FISHING_MODULE=true
```
1. **Pilih Game Baru**: Buka `http://localhost:3000/dashboard/games`. Pilih kartu "Ekspedisi Pasar & Dermaga Pancing" (ikon 🎣).
2. **Layar Proyektor**: Buka `http://localhost:3000/dashboard/games/<gameId>/projector?game_theme=souq_fishing`. Pastikan terbagi 58vh peta (Pasar kiri, Dermaga kanan) dan 42vh tabel tim (Active Tilt flex 55/15/15/15 saat 1 tim aktif).
3. **Remote Siswa (HP)**: Buka `http://localhost:3000/controller?theme=souq_fishing&room=<roomCode>&team=MERAH` di browser mobile / device emulation (360×640). Pastikan 4 state (Waiting, Walking, Gate Soal, Fishing) berjalan bergantian secara eksklusif.

### B. Uji Coba Produksi (Feature Flag OFF)
Hapus atau set ke `false` di `.env.local`:
```bash
NEXT_PUBLIC_ENABLE_SOUQ_FISHING_MODULE=false
ENABLE_SOUQ_FISHING_MODULE=false
```
1. Buka dashboard game dan pastikan kartu Souq Fishing **tidak muncul**.
2. Buka semua rute game lama (Quiz, Runner, Kahoot, Airplane, dll.) dan pastikan berfungsi 100% normal tanpa perubahan apapun.

---

## Sign-off Condition

Sign-off final HANYA sah jika Ahmad sudah membuka 11 skenario manual
(skenario 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 19) di browser pada commit
Fase 6.6 (`f98657e`) atau lebih baru.

Sebelum itu, tanda tangan sign-off = TIDAK SAH.

Checklist manual Ahmad (buka satu per satu):
- [ ] Skenario 1: card muncul di /dashboard/games
- [ ] Skenario 2: projector 58/42 render
- [ ] Skenario 3: controller 4-state mobile render
- [ ] Skenario 5: quiz lama utuh
- [ ] Skenario 6: runner lama utuh
- [ ] Skenario 7: matching lama utuh
- [ ] Skenario 8: penalty lama utuh
- [ ] Skenario 9: anagram lama utuh
- [ ] Skenario 10: airplane lama utuh
- [ ] Skenario 11: whack lama utuh
- [ ] Skenario 19: checkpoint recovery after refresh

Setelah semua [x], Ahmad meng-update FINAL-QA.md dengan tanggal verifikasi.
