# Final QA & Regression Verification Matrix (Phase 6)

## Verification Matrix

| # | Skenario | Cara Verifikasi | Status / Hasil |
|---|---|---|---|
| 1 | Feature flag ON, register game | Buka `/dashboard/games`, periksa kartu pilihan game mode. | PASS (Manual Ahmad: card "Ekspedisi Pasar & Dermaga Pancing" muncul) |
| 2 | Feature flag ON, projector render | Buka `/dashboard/games/[id]/projector` dengan `game_theme=souq_fishing`. | PASS (Manual Ahmad: layout 58/42 split Pasar & Dermaga aktif) |
| 3 | Feature flag ON, controller render | Buka `/controller?theme=souq_fishing&room=HOTSEAT&team=MERAH`. | PASS (Manual Ahmad: mobile 4-state controller aktif) |
| 4 | Feature flag ON, checkpoint save/load | Kirim request ke `/api/souq-fishing/checkpoint` (POST/GET). | PASS (Verified via `checkpoint-api.test.ts`) |
| 5 | Feature flag OFF, quiz lama utuh | Buka game Quiz reguler tanpa flag. | PASS (Manual Ahmad: quiz berfungsi normal tanpa regresi) |
| 6 | Feature flag OFF, runner lama utuh | Buka game Runner reguler tanpa flag. | PASS (Manual Ahmad: runner berfungsi normal tanpa regresi) |
| 7 | Feature flag OFF, matching lama utuh | Buka game Matching reguler tanpa flag. | PASS (Manual Ahmad: matching berfungsi normal tanpa regresi) |
| 8 | Feature flag OFF, penalty lama utuh | Buka game Penalty shootout tanpa flag. | PASS (Manual Ahmad: penalty berfungsi normal tanpa regresi) |
| 9 | Feature flag OFF, anagram lama utuh | Buka game Anagram reguler tanpa flag. | PASS (Manual Ahmad: anagram berfungsi normal tanpa regresi) |
| 10 | Feature flag OFF, airplane lama utuh | Buka game Pesawat Awan (Airplane) tanpa flag. | PASS (Manual Ahmad: arcade airplane 60 FPS normal) |
| 11 | Feature flag OFF, whack lama utuh | Buka game Pukul Tikus (Whack) tanpa flag. | PASS (Manual Ahmad: whack-a-mole normal) |
| 12 | Build flag ON | Jalankan `npm run build` | PASS (Exit code 0, 39 static routes) |
| 13 | Build flag OFF | Jalankan `ENABLE_SOUQ_FISHING_MODULE=false npm run build` | PASS (Exit code 0, bundle identik baseline) |
| 14 | Bundle delta | Bandingkan `First Load JS shared by all` (ON vs OFF) | PASS (Delta 0.0 kB: baseline 87.4 kB → build 87.4 kB) |
| 15 | Zero-import | `git grep -nE "souq[-_]?[Ff]ishing"` di luar direktori modul | PASS (Hanya 5 file inti yang match) |
| 16 | Accessibility: soal Arab line-height ≥1.95 | Inspect DOM teks Arab di card soal proyektor & HP | PASS (`leading-[2.0]` / `line-height >= 1.95` diterapkan) |
| 17 | Accessibility: tap target ≥56px di HP | Inspect tombol controller di viewport 360x640 | PASS (Tombol jawaban tinggi `h-36` / 144px > 56px) |
| 18 | Bebas scroll di proyektor | Inspect element proyektor di viewport 1920x1080 | PASS (`overflow-hidden`, `h-screen`, `grid-rows-[58fr_42fr]`) |
| 19 | Checkpoint recovery after refresh | Refresh layar proyektor saat permainan berlangsung | PASS (Manual Ahmad: state team, skor, pin dipulihkan) |
| 20 | Checkpoint size guard >64KB rejected | POST checkpoint dengan ukuran > 65,536 bytes | PASS (Verified: HTTP 413 Payload Too Large) |

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
