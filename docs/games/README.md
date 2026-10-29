# DAFTAR 34 GAME — indeks & status

Sumber referensi: papaninteraktif.com (folder audit: `docs/papaninteraktif-audit/game-<slug>/`).
Kontrak pengerjaan: [`RULES.md`](RULES.md) · Prompt per game: [`PROMPT.md`](PROMPT.md) · Data mentah: [`registry.json`](registry.json)

**Progres: 1 selesai · 32 belum** (total 33 game unik).

> Game internal tambahan yang sudah selesai tapi tidak termasuk daftar referensi: `souq-fishing` (`src/modules/souq-fishing`).
>
> Halaman referensi yang **duplikat** (tidak dihitung sebagai game): `belajar-angka` → sama dengan `mewarnai`.

## Tabel

| # | Slug | Nama | Fokus belajar | Teknologi | Status |
|---|---|---|---|---|---|
| 01 | `adu-tarik-dino` | Tarik Dino | Pengenalan konsep logika dasar dan perbandingan | dom | ✅ selesai |
| 02 | `ai-basketball` | AI Basketball | Aktivitas fisik, koordinasi gerak, dan motorik kasar | dom · ref: gamebasket.papaninteraktif.com | ⬜ belum |
| 03 | `banua-fruit-blast` | Banua Fruit Blast | Berhitung cepat, penjumlahan, dan pengurangan | canvas | ⬜ belum |
| 04 | `celestial-weaver` | Celestial Weaver | Menyusun dan menghafal ayat Al-Qur'an | dom | ⬜ belum |
| 05 | `cocok-logi` | Cocok Logi | Pengenalan bentuk, warna, dan motorik halus | dom | ⬜ belum |
| 06 | `color-link-junior` | Color Link Junior | Pengenalan warna, penalaran spasial, pemecahan masalah logika, dan koordinasi motorik halu | dom | ⬜ belum |
| 07 | `detektif-cilik` | Detektif | Fokus, konsentrasi, dan pengenalan kosakata benda | canvas · ref: gamedetektif.papaninteraktif.com | ⬜ belum |
| 08 | `doodle` | Doodle AI | Kreativitas, ekspresi seni, dan motorik halus | dom | ⬜ belum |
| 09 | `dunia-hewan` | Dunia Hewan | Pengetahuan alam dasar dan logika mencocokkan | dom | ⬜ belum |
| 10 | `gabung-ceria` | Gabung Ceria | Logika ruang dan fisika sederhana | canvas | ⬜ belum |
| 11 | `geo-squad` | Geo Squad | Pengenalan bentuk ruang dan bangun datar | canvas | ⬜ belum |
| 12 | `helirescue` | HELI RESCUE | Ketangkasan, Logika, Pengambilan Keputusan | dom | ⬜ belum |
| 13 | `jagoan-kata` | Jagoan Kata | Penguasaan kosa kata dan ejaan baku | dom | ⬜ belum |
| 14 | `jejak-angka` | Jejak Angka | Ketelitian berhitung, penjumlahan, strategi memilih angka, pengambilan keputusan, dan logi | dom · ref: gamejejakangka.papaninteraktif.com | ⬜ belum |
| 15 | `kancil` | Jalan Kancil | Berpikir komputasional dan pemecahan masalah | dom | ⬜ belum |
| 16 | `mancing-kata` | Mancing Kata | Pengenalan kosa kata dan ketelitian | dom | ⬜ belum |
| 17 | `martabak-pecahan` | Martabak Pecahan | Pemahaman konsep dasar pecahan matematika | dom | ⬜ belum |
| 18 | `math-domino-arena` | Math Domino Arena | Numerasi, penalaran matematika, strategi, dan pemecahan masalah | dom | ⬜ belum |
| 19 | `mesin-koleksi` | Mesin Gacha | Mengenal konsep sebab-akibat sederhana | canvas | ⬜ belum |
| 20 | `mewarnai` | Sayuran | Kreativitas seni, pengenalan warna, dan literasi nama sayur | dom | ⬜ belum |
| 21 | `nusaboard` | NusaBoard | Pengorganisasian ide dan visualisasi konsep | dom | ⬜ belum |
| 22 | `pendekar-balon` | Pendekar Balon | Pengenalan dasar huruf alfabet dan angka | dom | ⬜ belum |
| 23 | `porogapit-arena` | Porogapit Arena | Operasi pembagian bersusun (porogapit), aritmetika dasar, penalaran numerasi, dan keteliti | dom · ref: game-porogapit.papaninteraktif.com | ⬜ belum |
| 24 | `puzzle` | Puzzle Gambar | Pemecahan masalah, pengenalan pola, dan ketelitian | canvas · ref: gamepuzzle.papaninteraktif.com | ⬜ belum |
| 25 | `rimba-pedia` | Rimba Pedia | Pengenalan hewan dan kemampuan literasi dasar | dom | ⬜ belum |
| 26 | `ruang-io` | Ruang.io | Pemahaman bangun ruang dan spasial 3D | dom | ⬜ belum |
| 27 | `sciencelink` | SCIENCELINK | IPA, pemahaman konsep sains, logika penalaran | dom | ⬜ belum |
| 28 | `si-pemanah` | Si Pemanah | Ketangkasan operasi hitung matematika | dom | ⬜ belum |
| 29 | `si-taktik` | Si Taktik | Logika matematika dan pemahaman garis bilangan | canvas | ⬜ belum |
| 30 | `space-war` | Perang Antariksa | Berhitung cepat di bawah tekanan waktu | dom | ⬜ belum |
| 31 | `tanzib` | Tanzib | Logika dan pengetahuan dasar agama Islam | dom | ⬜ belum |
| 32 | `tatap-hap` | Tatap Hap | Ketelitian, fokus visual, dan observasi | dom | ⬜ belum |
| 33 | `traditional` | Lomba 17an | Ketangkasan dan perayaan budaya lokal | dom · ref: script.google.com | ⬜ belum |

## Cara memakai

1. Pilih game (boleh urut, boleh lompat).
2. Cetak prompt:
   ```powershell
   node scripts/game-prompt.cjs 3
   node scripts/game-prompt.cjs cocok-logi
   ```
3. Buka sesi baru, tempel isi `docs/games/prompts/GAME-<nn>-<slug>.md`.
4. Sesudah game selesai, ubah `status` di `registry.json` menjadi `"selesai"` lalu jalankan:
   ```powershell
   node scripts/games-index.cjs
   ```

## Urutan yang disarankan

Kerjakan dari mekanik termudah → tersulit supaya pola kode makin matang:

1. **Kuis pilihan ganda / lempar jawaban**: `ai-basketball` (02), `si-pemanah` (29), `pendekar-balon` (23), `martabak-pecahan` (18)
2. **Cocokkan / pasangkan**: `cocok-logi` (06), `color-link-junior` (07), `math-domino-arena` (19), `nusaboard` (22)
3. **Susun kata / jigsaw**: `jagoan-kata` (14), `mancing-kata` (17), `puzzle` (25), `gabung-ceria` (11)
4. **Arena canvas + fisika**: `banua-fruit-blast` (03), `space-war` (31), `helirescue` (13), `si-taktik` (30)
5. **Eksplorasi / peta / papan**: `geo-squad` (12), `rimba-pedia` (26), `ruang-io` (27), `sciencelink` (28), `mesin-koleksi` (20), `kancil` (16)
6. **Kreatif & sensor**: `mewarnai` (21), `doodle` (09), `traditional` (34), `tatap-hap` (33), `tanzib` (32), `celestial-weaver` (05), `detektif-cilik` (08), `jejak-angka` (15)

## Game yang butuh kamera (baca dulu)

- `ai-basketball` — referensi berjalan di domain terpisah; wajib punya fallback keyboard/mouse bila kamera ditolak.
- `detektif-cilik` — referensi berjalan di domain terpisah; wajib punya fallback keyboard/mouse bila kamera ditolak.
- `jejak-angka` — referensi berjalan di domain terpisah; wajib punya fallback keyboard/mouse bila kamera ditolak.
- `porogapit-arena` — referensi berjalan di domain terpisah; wajib punya fallback keyboard/mouse bila kamera ditolak.
- `puzzle` — referensi berjalan di domain terpisah; wajib punya fallback keyboard/mouse bila kamera ditolak.
- `traditional` — referensi berjalan di domain terpisah; wajib punya fallback keyboard/mouse bila kamera ditolak.

## Aturan singkat yang paling sering dilupakan

- Tailwind `content` wajib mencakup `./components/**` (kalau tidak, semua warna panel hilang).
- Panel default **bawah**; tombol ganti layout hanya muncul di layar ≥ 1024 px.
- Kotak soal panjang: `max-h` + `overflow-y-auto` di pembungkus luar, `min-h` + `flex flex-col justify-center` di dalam — jangan flex-center + overflow pada elemen yang sama (bikin scroll ke atas rusak).
- Produksi selalu lewat `npm run build:prod` / `npm run start:prod` (folder `.next-prod`), supaya tidak bentrok dengan dev.
- Selesai = angka dilaporkan (tsc 0, build 0, matriks viewport PASS, fitur PASS), bukan klaim.
