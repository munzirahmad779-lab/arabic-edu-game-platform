# PROMPT SIAP PAKAI — satu game per sesi

## Cara pakai (3 langkah)

1. Pilih game yang mau dikerjakan (lihat tabel di [`README.md`](README.md) atau `registry.json`).
2. Cetak prompt-nya:

   ```powershell
   node scripts/game-prompt.cjs 3            # pakai nomor
   node scripts/game-prompt.cjs cocok-logi   # atau pakai slug
   ```

   Perintah itu menulis file `docs/games/prompts/GAME-03-ai-basketball.md` **dan** mencetak isinya ke terminal.
3. Buka **sesi baru**, tempel seluruh isi file tersebut sebagai pesan pertama. Selesai — sesi baru sudah tahu semua aturan.

Kalau mau langsung tanpa file, tempel blok di bagian **TEMPLATE** di bawah dan ganti sendiri bagian `{{...}}`.

---

## TEMPLATE (yang ditempel ke sesi baru)

````markdown
# TUGAS: Bangun GAME #{{NO}} — {{NAME}} (`{{SLUG}}`)

Kamu bekerja di repo: `C:\Users\munzi\arabic-edu-game-platform`
Next.js 14 (App Router) · TypeScript strict · Tailwind 3 · canvas 2D + localStorage.
Sesi ini mengerjakan **satu game saja**: `{{SLUG}}`. Jangan menyentuh game lain.

## 1. Baca dulu sebelum menulis kode (wajib, berurutan)

1. `docs/games/RULES.md` — kontrak wajib (alur layar, fitur wajib, aturan visual, DoD, larangan).
2. `docs/games/registry.json` → cari entri `"slug": "{{SLUG}}"` untuk tahu nama, fokus belajar, dan cara bermain.
3. `docs/papaninteraktif-audit/game-{{SLUG}}/` → `audit.json` (teks landing: target audiens, konteks edukasi, fokus belajar, cara bermain, manfaat) dan `deep-flow.json` (isi layar permainan sebenarnya: HUD, tombol, mode).
4. Game contoh yang sudah jadi dan menjadi **acuan mutu**: `components/games/adu-tarik-dino/` (`Game.tsx`, `logic.ts`, `render.ts`) + `src/app/game/adu-tarik-dino/`.
5. `components/games/engines/{{SLUG}}.tsx` dan `src/app/games/{{SLUG}}/page.tsx` — stub lama yang harus dirapikan/diarahkan ulang.

## 2. Target game ini

- Nama: **{{NAME}}**
- Fokus belajar: {{FOKUS}}
- Cara bermain (referensi): {{CARA}}
- Slug & key localStorage: `{{SLUG}}:bank:v1`, `{{SLUG}}:scores:v1`, `{{SLUG}}:settings:v1`

## 3. Yang harus dibangun

Buat implementasi penuh (bukan stub) di:

```
components/games/{{SLUG}}/Game.tsx
components/games/{{SLUG}}/logic.ts
components/games/{{SLUG}}/render.ts      # kalau memakai canvas
components/games/{{SLUG}}/sprites.ts     # kalau memakai sprite
src/app/game/{{SLUG}}/page.tsx           # landing game
src/app/game/{{SLUG}}/play/page.tsx      # memuat <Game />
```

dan sesuaikan `src/app/games/{{SLUG}}/page.tsx` agar memakai game asli.

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
6. Tambah skrip uji: `scripts/check-{{SLUG}}-layout.cjs`, `scripts/check-{{SLUG}}-features.cjs`, `scripts/capture-{{SLUG}}.cjs`.
7. Jalankan: `npx tsc --noEmit` → 0 error, lalu `npm run build:prod` → BUILD=0, lalu restart server prod.
8. Uji dev `http://localhost:3000/game/{{SLUG}}/play` dan prod `http://localhost:3200/game/{{SLUG}}/play`, jalankan skrip uji, ambil screenshot.
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
GAME #{{NO}} {{NAME}} ({{SLUG}})
tsc            : 0 error
build:prod     : 0
dev 3000       : 200 | prod 3200 : 200
viewport       : 1366/1280/1024/820/390 → PASS (panel 4, opsi 16/16)
fitur          : KELUAR ✓ | acak ✓ (3/3 beda) | tambah soal ✓ (8→9) | bank persist ✓ | skor ✓ | timer ✓
console_errors : 0 | request_gagal : 0
screenshot     : docs/papaninteraktif-audit/game-{{SLUG}}-final.png
registry       : status → selesai
URL            : http://localhost:3000/game/{{SLUG}}/play
```

Kalau ada bagian yang tidak bisa dipenuhi, sebut alasan teknisnya dan apa rencana penggantinya — jangan diam-diam mengubah kontrak.
````

---

## Catatan penting

- **Penomoran:** `registry.json` memuat 33 game unik. **#1 `adu-tarik-dino` = selesai**, #2..#33 belum (32 game sisa). Game internal `souq-fishing` selesai tapi tidak termasuk daftar referensi. Satu halaman referensi (`belajar-angka`) adalah duplikat `mewarnai`, jadi tidak dihitung.
- Kalau game butuh **kamera / sensor gerak** (mis. `ai-basketball`, `detektif-cilik`, `jejak-angka`), tulis di rencana bagaimana perilaku saat kamera ditolak/izin tidak ada (fallback keyboard/mouse). Game tidak boleh mati total tanpa kamera.
- Kalau game di situs referensi ternyata **iframe ke domain lain** (lihat kolom `externalHost` di registry), bangun ulang versi sendiri; jangan menyematkan iframe.
- Setelah selesai, jalankan lagi `node scripts/extract-game-registry.cjs` **hanya** kalau data audit berubah; untuk menandai selesai cukup edit `status` di `registry.json`.
- Regenerasi tabel di `README.md`:
  ```powershell
  node scripts/games-index.cjs
  ```
