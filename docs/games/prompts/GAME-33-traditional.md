> Catatan: game referensi berjalan di `script.google.com` (iframe). Bangun versi sendiri, jangan sematkan iframe.
> Catatan: audit tidak menemukan elemen <canvas>; arena kemungkinan DOM/CSS — bebas memilih canvas atau SVG/DOM.

# TUGAS: Bangun GAME #33 — Lomba 17an (`traditional`)

Kamu bekerja di repo: `C:\Users\munzi\arabic-edu-game-platform`
Next.js 14 (App Router) · TypeScript strict · Tailwind 3 · canvas 2D + localStorage.
Sesi ini mengerjakan **satu game saja**: `traditional`. Jangan menyentuh game lain.

## 1. Baca dulu sebelum menulis kode (wajib, berurutan)

1. `docs/games/RULES.md` — kontrak wajib (alur layar, fitur wajib, aturan visual, DoD, larangan).
2. `docs/games/registry.json` → cari entri `"slug": "traditional"` untuk tahu nama, fokus belajar, dan cara bermain.
3. `docs/papaninteraktif-audit/game-traditional/` → `audit.json` (teks landing: target audiens, konteks edukasi, fokus belajar, cara bermain, manfaat) dan `deep-flow.json` (isi layar permainan sebenarnya: HUD, tombol, mode).
4. Game contoh yang sudah jadi dan menjadi **acuan mutu**: `components/games/adu-tarik-dino/` (`Game.tsx`, `logic.ts`, `render.ts`) + `src/app/game/adu-tarik-dino/`.
5. `components/games/engines/traditional.tsx` dan `src/app/games/traditional/page.tsx` — stub lama yang harus dirapikan/diarahkan ulang.

## 2. Target game ini

- Nama: **Lomba 17an**
- Fokus belajar: Ketangkasan dan perayaan budaya lokal
- Cara bermain (referensi): Pilih jenis alat musik gamelan yang ingin dimainkan. Sentuh atau ketuk bilah/instrumen di layar untuk menghasilkan suara. Ikuti panduan nada untuk memainkan lagu tradisional sederhana. Eksplorasi harmoni dengan membunyikan beberapa instrumen.
- Slug & key localStorage: `traditional:bank:v1`, `traditional:scores:v1`, `traditional:settings:v1`

## 3. Yang harus dibangun

Buat implementasi penuh (bukan stub) di:

```
components/games/traditional/Game.tsx
components/games/traditional/logic.ts
components/games/traditional/render.ts      # kalau memakai canvas
components/games/traditional/sprites.ts     # kalau memakai sprite
src/app/game/traditional/page.tsx           # landing game
src/app/game/traditional/play/page.tsx      # memuat <Game />
```

dan sesuaikan `src/app/games/traditional/page.tsx` agar memakai game asli.

Wajib memenuhi **seluruh** isi `docs/games/RULES.md`, terutama:

- 7 layar: home → mode/topik → hitung mundur → bermain → hasil → skor → bank soal
- KELUAR + dialog konfirmasi + ESC (keluar tidak menyimpan skor)
- Acak soal, tambah soal, bank soal persist, skor + CSV, pengaturan persist
- Timer `m:ss` yang berhenti saat permainan berakhir
- Warna/tema berbeda per peserta (kalau multi-peserta), gradien unik = jumlah peserta
- Panel soal: default **panel bawah**, ada 3 mode (bawah / samping lebar / samping sedang), teks 11–13 px, kotak soal bisa di-scroll **tanpa bug scroll ke atas**
- Responsif lulus 5 viewport: 1366×820, 1280×720, 1024×768, 820×1180, 390×844

## 4. Urutan kerja

1. **Jelaskan rencana** 5–10 baris: mekanik inti, data soal, tampilan arena, cara menang, cara skor. Tunggu aku menyetujui sebelum menulis kode besar.
2. Tulis `logic.ts` (tipe + `RULES` + bank soal ≥ 8 soal/subjek × 4 pilihan + helper).
3. Tulis `Game.tsx` (semua layar, fitur wajib, `data-*` hook).
4. Tulis `render.ts`/`sprites.ts` kalau game butuh arena canvas.
5. Tulis route `page.tsx`/`play/page.tsx`.
6. Tambah skrip uji: `scripts/check-traditional-layout.cjs`, `scripts/check-traditional-features.cjs`, `scripts/capture-traditional.cjs`.
7. Jalankan: `npx tsc --noEmit` → 0 error, lalu `npm run build:prod` → BUILD=0, lalu restart server prod.
8. Uji dev `http://localhost:3000/game/traditional/play` dan prod `http://localhost:3200/game/traditional/play`, jalankan skrip uji, ambil screenshot.
9. Update `docs/games/registry.json`: entri game ini → `"status": "selesai"`.
10. Laporkan angka hasil uji (lihat format di bawah).

## 5. Cara menjalankan server (jangan sampai error)

```powershell
npm run dev -- -p 3000      # dev, folder .next
npm run build:prod          # build produksi, folder .next-prod
npm run start:prod          # produksi, port 3200
npx tsc --noEmit            # type check
```

Jangan menjalankan `npm run build` biasa saat dev hidup — dua proses akan saling menimpa `.next` dan kedua server error.

## 6. Larangan

- Mengubah game lain / `components/games/game-stage.tsx` / `src/lib/**` / `src/modules/souq-fishing/**`.
- Menambah dependency, memakai CDN, memanggil API eksternal, memakai aset situs referensi.
- Menyembunyikan atau menghapus fitur wajib supaya uji lulus.
- Menyatakan selesai tanpa angka.

## 7. Format laporan akhir

```
GAME #33 Lomba 17an (traditional)
tsc            : 0 error
build:prod     : 0
dev 3000       : 200 | prod 3200 : 200
viewport       : 1366/1280/1024/820/390 → PASS (panel 4, opsi 16/16)
fitur          : KELUAR ✓ | acak ✓ (3/3 beda) | tambah soal ✓ (8→9) | bank persist ✓ | skor ✓ | timer ✓
console_errors : 0 | request_gagal : 0
screenshot     : docs/papaninteraktif-audit/game-traditional-final.png
registry       : status → selesai
URL            : http://localhost:3000/game/traditional/play
```

Kalau ada bagian yang tidak bisa dipenuhi, sebut alasan teknisnya dan apa rencana penggantinya — jangan diam-diam mengubah kontrak.
