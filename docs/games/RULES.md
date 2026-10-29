# ATURAN WAJIB SETIAP GAME (Kontrak Platform)

> Dokumen ini adalah **kontrak**. Setiap sesi baru yang mengerjakan satu game **wajib** mengikuti isi dokumen ini.
> Kalau ada aturan yang bertabrakan dengan keinginan sesaat, aturan di dokumen ini yang menang.

Repo: `C:\Users\munzi\arabic-edu-game-platform`
Stack: Next.js 14 (App Router) · TypeScript strict · Tailwind CSS 3 · canvas 2D · localStorage

---

## 0. Prinsip dasar

1. **Satu game, satu sesi.** Satu sesi hanya mengerjakan **satu** game. Jangan menyinggung game lain.
2. **Tiru referensi, jangan jiplak aset.** Semua gameplay, warna, dan teks ditulis ulang sendiri. Aset (gambar/audio) dibuat sendiri atau di-generate; jangan mengunduh aset situs referensi.
3. **Jangan menambah dependency** tanpa instruksi eksplisit. Yang tersedia cukup (Next, React, Tailwind, Playwright untuk uji).
4. **Jangan menyentuh** `components/games/adu-tarik-dino/**`, `components/games/game-stage.tsx`, `src/modules/souq-fishing/**`, atau game lain yang sudah jadi.
5. **Tanpa Supabase/env.** Game harus jalan penuh dengan build kosong (tanpa `.env.local`). Semua progres di localStorage.
6. Bahasa UI: **Indonesia**. Konten soal boleh Indonesia/Arab/Inggris sesuai mata pelajaran.

---

## 1. Struktur file yang wajib ada

```
components/games/<slug>/
  Game.tsx        # komponen utama ("use client"), semua layar
  logic.ts        # tipe, konstanta aturan, bank soal, skor, helper
  render.ts       # (kalau pakai canvas) renderer + fisika
  sprites.ts      # (kalau pakai sprite) daftar frame & anchor
src/app/game/<slug>/
  page.tsx        # landing: judul, cara main, tombol "Mulai" → /game/<slug>/play
  play/page.tsx   # memuat <Game /> dari components/games/<slug>/Game
src/app/games/<slug>/page.tsx   # tetap ada; arahkan ke engine di components/games/engines/<slug>
components/games/engines/<slug>.tsx  # boleh tetap stub GameStage ATAU memakai Game asli
```

Aturan penamaan: `slug` = kebab-case, sama persis dengan nomor di `docs/games/registry.json`.

---

## 2. Alur layar wajib

Setiap game harus punya state layar ini (nama boleh beda, **jumlah dan urutannya tidak**):

| # | Layar | Isi minimal |
|---|---|---|
| 1 | `home` | judul game, subjudul, 1 tombol utama (Mulai), tombol Bank Soal, tombol Skor |
| 2 | `mode`/`settings` | pilih mode (mis. 1v1 / 2v2 / solo), pilih mata pelajaran, pilih jumlah soal, toggle suara |
| 3 | `countdown` | hitungan 3-2-1 sebelum mulai (boleh 1 layar dengan playing) |
| 4 | `playing` | arena permainan + panel soal (kalau ada) + timer + skor + tombol KELUAR |
| 5 | `result` | pemenang / hasil, alasan berakhir (menang, waktu habis, keluar), ringkasan skor, tombol Main Lagi / Ganti Topik / Home |
| 6 | `score` | riwayat skor (maks 50), tombol hapus, ekspor CSV |
| 7 | `bank` | kelola soal: daftar, tambah, hapus, reset ke bawaan, ekspor/impor JSON |

**Aturan:** tidak boleh ada jalan buntu. Dari layar mana pun harus ada jalan ke `home`.

---

## 3. Fitur wajib (tidak boleh dilewat)

| Fitur | Ketentuan |
|---|---|
| **KELUAR** | Tombol di header **setiap** layar bermain. Membuka dialog konfirmasi ("Yakin keluar? Poin tidak disimpan"). Ada tombol ESC sebagai jalan pintas. Keluar **tidak** mencatat skor. |
| **Acak soal** | Urutan soal diacak per pemain/panel (Fisher-Yates, seed bebas). Bukti uji: 3 sesi → 3 urutan berbeda. |
| **Tambah soal** | Dari layar `bank`: form (soal, 4 pilihan, jawaban benar, subjek). Setelah simpan, jumlah soal bertambah dan soal baru bisa muncul. |
| **Bank soal** | Disimpan `localStorage["<slug>:bank:v1"]`. Bertahan setelah reload. Tombol reset ke bank bawaan. |
| **Skor** | `localStorage["<slug>:scores:v1"]`, maks 50 record, bisa dihapus, bisa diekspor CSV. |
| **Pengaturan** | `localStorage["<slug>:settings:v1"]` (mode, subjek, jumlah soal, suara). |
| **Timer** | Harus terlihat, format `m:ss`, dan **berhenti** saat permainan berakhir/keluar. |
| **Poin** | Aturan poin eksplisit di `logic.ts` (`RULES`), bukan angka sihir yang tersebar. |
| **Kunci versi** | Semua key localStorage berakhiran `:v1` (naikkan bila format berubah). |

---

## 4. Aturan visual

1. **Tailwind content globs wajib mencakup `./components/**`.** Kalau tidak, semua kelas warna di `components/games/**` tidak ikut ter-build dan panel jadi polos. (Ini pernah jadi bug besar di game #1 — jangan diulang.)
2. **Warna per peserta.** Kalau ada 2+ peserta/karakter, tiap peserta punya gradien panel, border, warna tombol, dan label yang berbeda. Bukti uji: jumlah gradien unik = jumlah peserta.
3. **Layout panel: 3 mode, default panel bawah.**
   - `bottom` (default): panel di bawah, arena selebar layar — dipakai kalau layar besar dan animasi jadi prioritas.
   - `side-lg` / `side-md`: panel di samping (44% / 34%) — dipakai kalau layar lebar dan soal panjang.
   - Tombol pengubah di header hanya muncul saat `innerWidth >= 1024`.
4. **Ukuran teks panel (jangan lebih besar dari ini):** soal latin 11–13 px, soal Arab 12–15 px, pilihan jawaban 10–12 px, tinggi tombol 36–46 px.
5. **Soal panjang tidak boleh memotong tata letak.** Kotak soal: pembungkus luar `max-h` + `overflow-y-auto`, pembungkus dalam `min-h` + `flex flex-col justify-center`. **Jangan** pakai `flex items-center justify-center` + `overflow-y-auto` pada elemen yang sama — browser memotong bagian atas dan scroll ke atas jadi rusak.
6. **Arena (kalau canvas):** ukuran sel karakter = `min(h × faktor, w × faktor)`; kalau kanvas sempit (rasio `w/h < 1.35`) pakai faktor `0.74 / 0.46`, kalau lebar pakai `0.68 / 0.27`. Pastikan karakter tidak saling menabrak dan elemen penghubung (tali/bola/garis) tidak terbalik.
7. **Kontras:** teks putih di atas gradien gelap, atau teks gelap di atas gradien terang. Jangan teks abu di atas abu.

---

## 5. Aturan data

- Semua tipe data di `logic.ts`; `Game.tsx` tidak boleh mendefinisikan tipe domain sendiri.
- Bank soal bawaan minimal: **8 soal per mata pelajaran, tiap soal 4 pilihan** dengan jawaban benar unik.
- Soal wajib punya `id` stabil (dipakai untuk shuffle & localStorage).
- Format bank: `Record<SubjectId, Q[]>`; kalau data lama rusak → fallback ke bank bawaan, jangan crash.
- Jangan menyimpan data sensitif apa pun ke localStorage.

---

## 6. Aturan teknis

1. TypeScript strict: **`npx tsc --noEmit` harus 0 error**. Dilarang `any`, `@ts-ignore`, `as unknown as`.
2. `next.config.mjs` sudah mematikan build-blocking TS/ESLint; jadi wajib cek tipe manual.
3. Canvas: hitung `devicePixelRatio`, pakai `ResizeObserver`, batalkan `requestAnimationFrame` di cleanup, dan jangan alokasi array besar tiap frame.
4. React: bersihkan semua `setInterval`/`setTimeout`/`addEventListener` di cleanup. Tidak ada state update setelah unmount.
5. Game harus **client-only** dan tidak boleh mengakses `window`/`localStorage` saat render pertama (pakai `useEffect`).
6. Tidak boleh ada `console.error` di runtime normal. Uji: `console_errors=0`.
7. Tidak boleh ada request jaringan eksternal (font/gambar CDN dilarang; simpan lokal di `public/`).

---

## 7. Arab & RTL

- Teks Arab: `dir="rtl"` + `className` dengan `font-arabic`/font Arab yang tersedia; jangan pakai `text-align: left`.
- Jangan menyisipkan teks Arab di dalam string yang juga memuat latin tanpa pemisah (bidi).
- Transliterasi/latin tetap `dir="ltr"`.

---

## 8. Aksesibilitas & perangkat

- Semua tombol punya label teks atau `aria-label` (jangan hanya emoji).
- Target sentuh minimal 36×36 px; jarak antartombol minimal 6 px.
- Bisa dimainkan dengan keyboard: Tab → Enter/Space, ESC untuk keluar.
- Aman untuk layar sentuh (IFP/tablet): `touch-action` jangan memblokir scroll panel.

---

## 9. Responsif — matriks wajib lulus

Wajib diuji dan **semua lulus**:

| Perangkat | Viewport |
|---|---|
| desktop | 1366 × 820 |
| laptop | 1280 × 720 |
| tablet lanskap | 1024 × 768 |
| tablet potret | 820 × 1180 |
| HP | 390 × 844 |

Kriteria: semua panel tampil, seluruh pilihan jawaban terlihat (mis. 8/8 untuk 1v1 dan 16/16 untuk 2v2), tidak ada elemen terpotong, tidak ada scroll horizontal.

---

## 10. Test hook + skrip verifikasi

Tambahkan atribut `data-*` yang stabil supaya bisa diuji otomatis:
`data-panel`, `data-correct`, `data-timer`, `data-slots`, dan (kalau canvas) `data-rope`/`data-cell`/`data-ground-y` atau padanannya.

Setiap game wajib punya skrip uji di `scripts/` (Node + `@playwright/test`), minimal:

| Skrip | Isi |
|---|---|
| `check-<slug>-layout.cjs` | matriks 5 viewport, jumlah panel & opsi terlihat |
| `check-<slug>-features.cjs` | warna unik, KELUAR + dialog, acak soal, tambah soal, bank persist |
| `check-<slug>-frame.cjs` | (kalau canvas) ukur posisi objek kunci di beberapa frame |
| `capture-<slug>.cjs` | screenshot hasil akhir ke `docs/papaninteraktif-audit/` |

Semua skrip menerima argumen base URL: `node scripts/check-<slug>-layout.cjs http://localhost:3000`.

---

## 11. Cara menjalankan (wajib dipatuhi)

```powershell
# DEV — memakai folder .next
npm run dev -- -p 3000

# PROD — WAJIB memakai folder build terpisah (.next-prod)
npm run build:prod
npm run start:prod          # port 3200

# type check
npx tsc --noEmit
```

- **Jangan** menjalankan `npm run build` biasa sementara `npm run dev` hidup kalau tidak memakai `NEXT_DIST_DIR` — dua proses akan saling menimpa `.next` dan **kedua server error**. Gunakan `build:prod`/`start:prod` yang sudah menyetel `NEXT_DIST_DIR=.next-prod`.
- URL yang dilaporkan ke pengguna: `http://localhost:3000/game/<slug>/play` (dev) dan `http://localhost:3200/game/<slug>/play` (prod).
- Setelah mengubah apa pun: jalankan ulang `build:prod`, restart server prod, lalu uji kedua port.

---

## 12. Definisi Selesai (DoD)

Sebuah game baru boleh dinyatakan selesai hanya kalau **semua** baris ini terpenuhi dan **angkanya dilaporkan**:

- [ ] `npx tsc --noEmit` → `0 error`
- [ ] `npm run build:prod` → `BUILD=0`
- [ ] dev (3000) dan prod (3200) → HTTP 200 untuk `/game/<slug>` dan `/game/<slug>/play`
- [ ] matriks 5 viewport → PASS semua
- [ ] fitur wajib (KELUAR, acak, tambah soal, bank persist, skor, timer) → PASS semua
- [ ] `console_errors=0`, `request_gagal=0`
- [ ] screenshot terbaru tersimpan di `docs/papaninteraktif-audit/`
- [ ] `docs/games/registry.json` → `status` game ini diubah ke `selesai`
- [ ] ringkasan angka uji ditulis di jawaban akhir (bukan klaim "sudah bagus")

---

## 13. Larangan keras

1. Mengubah game lain yang sudah jadi atau komponen bersama (`game-stage.tsx`, `src/lib/**`) tanpa instruksi.
2. Menghapus/menyembunyikan fitur wajib agar uji "lulus".
3. Menambah library baru, memakai CDN, atau memanggil API eksternal.
4. Memakai aset (gambar/suara) milik situs referensi.
5. Menyatakan selesai tanpa angka hasil uji.
6. Membiarkan `npm run build` menimpa `.next` saat dev hidup.
