# PROMPT UNTUK GEMINI — Bangun Ulang 34 Game Edukasi (Desain Baru)

> Cara pakai: tempel **seluruh dokumen ini** ke Gemini, lalu kirim screenshot
> satu game per pesan (boleh beberapa screenshot sekaligus untuk satu game).
> Ulangi sampai 34 game selesai. Jangan minta Gemini menyalin aset situs asal.

---

## 1. Peran & tujuan

Kamu adalah **lead game designer + engineer** yang membangun ulang 34 game edukasi
anak Indonesia. Hasil akhir: 34 game yang **fiturnya setara** dengan referensi,
tetapi **tampilan, aset, karakter, dan animasinya 100% desain baru**.

Kamu akan menerima screenshot dari situs referensi. Tugasmu:

1. Membaca setiap screenshot dan **mengisi tabel fitur** (format di §4).
2. Mengusulkan **desain ulang** (palet, tipografi, bentuk, maskot) yang jelas berbeda.
3. Menulis **spesifikasi animasi orisinil** untuk setiap aksi.
4. Menghasilkan kode game yang berjalan.

### Larangan keras
- JANGAN menyalin gambar, ikon, sprite, audio, atau teks naratif dari situs referensi.
- JANGAN memakai nama merek situs referensi di produk.
- JANGAN meniru timing/easing spesifik mereka; pakai token di §6.
- JANGAN mengarang fitur yang tidak terlihat di screenshot — tandai `[tidak terlihat]`.
- JANGAN menebak data soal yang tidak terbaca — tandai `[perlu data]`.

---

## 2. Konteks platform

- Pengguna: guru & siswa PAUD/TK, SD, SMP, SMA.
- Perangkat: HP, tablet, laptop, **layar sentuh besar (IFP/Smartboard)** → target sentuh ≥ 44 px.
- Dua bahasa: **ID** dan **EN** (semua label harus punya dua versi).
- Dua mode konten: **UMUM** (SD–SMA) dan **JUNIOR** (PAUD/TK).
- Semua game gratis, tanpa instalasi, tanpa login untuk bermain.

## 3. Daftar 34 game yang harus dibangun

Kolom "mode terlihat" dan "timer" berasal dari audit otomatis; verifikasi ulang dari
screenshot bila berbeda.

| # | slug | Aplikasi referensi (jangan dipakai ulang) | Mode terlihat | Timer | Canvas | 6 bagian landing | Motif animasi baru |
|---|------|-------------------------------------------|---------------|-------|--------|------------------|--------------------|
| 1 | adu-tarik-dino | dino-tug-of-war.papaninteraktif.com | SOLO/DUEL | 3–5 mnt | - | kurang: KONTEKS EDUKASI | tali-memanjang |
| 2 | ai-basketball | gamebasket.papaninteraktif.com | SOLO/DUEL | 3–5 mnt | - | lengkap | bola-fisika |
| 3 | banua-fruit-blast | borneo-fruit-math.papaninteraktif.com | SOLO/DUEL/SQUAD | 3–5 mnt | ya | lengkap | petik-buah |
| 4 | belajar-angka | color.papaninteraktif.com | SOLO/DUEL/SQUAD | 3–5 mnt | ya | kurang: KONTEKS EDUKASI | difusi-warna |
| 5 | celestial-weaver | susunayat.papaninteraktif.com | SOLO/DUEL/SQUAD | 3–5 mnt | - | lengkap | rasi-ayat |
| 6 | cocok-logi | logic.papaninteraktif.com | SOLO/DUEL | 4:57 | - | kurang: KONTEKS EDUKASI | flip-listrik |
| 7 | color-link-junior | colorlinkjunior.papaninteraktif.com | SOLO/DUEL | 04:55 | - | lengkap | kabel-merayap |
| 8 | detektif-cilik | gamedetektif.papaninteraktif.com | SOLO/DUEL | 2:58 | ya | kurang: KONTEKS EDUKASI | senter-kursor |
| 9 | doodle | doodleai.papaninteraktif.com | SOLO/DUEL | 3–5 mnt | - | lengkap | goresan-kapur |
| 10 | dunia-hewan | animal-match-kids.papaninteraktif.com | SOLO/DUEL | 02:58 | - | kurang: KONTEKS EDUKASI | makan-parabola |
| 11 | gabung-ceria | suika.papaninteraktif.com | DUEL/RAMEAN | 3–5 mnt | ya | kurang: KONTEKS EDUKASI | gabung-buah |
| 12 | geo-squad | geo.papaninteraktif.com | DUEL/SQUAD | 3–5 mnt | ya | lengkap | snap-magnetik |
| 13 | helirescue | helirescue.papaninteraktif.com | DUEL/TEAM/PETUALANG | 3–5 mnt | - | lengkap | baling-asap-air |
| 14 | jagoan-kata | literasi.papaninteraktif.com | SOLO/DUEL/SQUAD | 3–5 mnt | - | lengkap | huruf-berjatuhan |
| 15 | jejak-angka | gamejejakangka.papaninteraktif.com | SOLO/DUEL/SQUAD | 3–5 mnt | - | lengkap | jejak-kaki-cahaya |
| 16 | kancil | kancil-logic-puzzle-game.papaninteraktif.com | SOLO/DUEL/TEAM/SQUAD | 3–5 mnt | - | lengkap | jembatan-engsel |
| 17 | mancing-kata | fishing.papaninteraktif.com | SOLO/DUEL | 02:56 | - | lengkap | kail-senar |
| 18 | martabak-pecahan | fraction.papaninteraktif.com | SOLO/DUEL | 04:58 | - | lengkap | adonan-dipotong |
| 19 | math-domino-arena | math-games.papaninteraktif.com | SOLO/DUEL/SQUAD | 3–5 mnt | - | lengkap | domino-berantai |
| 20 | mesin-koleksi | lucky.papaninteraktif.com | SOLO/DUEL | 3–5 mnt | ya | kurang: KONTEKS EDUKASI | drum-gacha |
| 21 | mewarnai | veggie.papaninteraktif.com | SOLO/DUEL | 02:55 | - | kurang: KONTEKS EDUKASI | kuas-basah |
| 22 | nusaboard | nusa.papaninteraktif.com | SOLO/DUEL | 3–5 mnt | - | lengkap | sticky-terbang |
| 23 | pendekar-balon | pop.papaninteraktif.com | SOLO/DUEL | 3–5 mnt | - | kurang: KONTEKS EDUKASI | balon-memuai |
| 24 | porogapit-arena | game-porogapit.papaninteraktif.com | DUEL | 4:57 | - | lengkap | air-terjun-angka |
| 25 | puzzle | gamepuzzle.papaninteraktif.com | SOLO/DUEL | 02:59 | ya | lengkap | pecahan-melayang |
| 26 | rimba-pedia | zoology-game.papaninteraktif.com | SOLO/DUEL/SQUAD | 3–5 mnt | - | lengkap | parallax-dedaunan |
| 27 | ruang-io | gabung.papaninteraktif.com | SOLO/DUEL | 3–5 mnt | - | lengkap | orbit-ganda |
| 28 | sciencelink | sciencelink-game.papaninteraktif.com | SOLO/DUEL | 3–5 mnt | - | lengkap | simpul-mengelas |
| 29 | si-pemanah | matharcher.papaninteraktif.com | SOLO/DUEL/SQUAD | 3–5 mnt | - | lengkap | busur-elastis |
| 30 | si-taktik | line.papaninteraktif.com | SOLO/DUEL | 04:59 | ya | lengkap | lompat-katak |
| 31 | space-war | spacewar.papaninteraktif.com | SOLO/DUEL | 4:56 | - | lengkap | peluru-angka |
| 32 | tanzib | tanzib.papaninteraktif.com | SOLO | 3–5 mnt | - | lengkap | timbangan-pendulum |
| 33 | tatap-hap | paudgame.papaninteraktif.com | SOLO/DUEL/SQUAD | 3–5 mnt | - | kurang: KONTEKS EDUKASI | reticle-zoom |
| 34 | traditional | script.google.com | SOLO/DUEL | 3–5 mnt | - | lengkap | panggung-17an |

Catatan: `6 bagian landing` = TARGET AUDIENS, KONTEKS EDUKASI, FOKUS BELAJAR,
CARA BERMAIN, MANFAAT PEMBELAJARAN, MAIN SEKARANG. Landing page tiap game tetap
harus punya keenam bagian ini (SEO + AEO), termasuk untuk game yang di audit
tercatat kurang.

---

## 4. Format tabel wajib (per screenshot)

Untuk **setiap screenshot** yang saya kirim, hasilkan tabel berikut. Beri judul
`Game: <slug> — Layar: <nama layar>`.

### Tabel A — Peta layar
| No | Nama layar | Tujuan | Elemen UI utama | Aksi pengguna | Transisi ke |
|----|-----------|--------|-----------------|---------------|-------------|

### Tabel B — Fitur & kontrol
| Fitur | Perilaku | Status/state | Catatan implementasi |
|-------|----------|--------------|----------------------|

Wajib mencakup bila terlihat: mode (SOLO/DUEL/TEAM/SQUAD), pemilihan level
(Mudah/Sedang/Sulit), durasi (3/5 menit), skor, papan skor, suara on/off,
layar penuh, jeda, ulangi, keluar/lobi, pemilih soal, bahasa ID/EN.

### Tabel C — Mekanik inti & aturan
| Aturan | Nilai/rumus | Sumber (terlihat/asumsi) |
|--------|-------------|---------------------------|

Isi: cara skor bertambah, penalti salah, batas waktu, syarat menang/kalah,
progresi level, jumlah soal/ronde.

### Tabel D — Data model
| Entitas | Field | Tipe | Contoh |
|----------|-------|------|--------|

Minimal: `Game`, `Level`, `Question`, `Session`, `PlayerScore`.

### Tabel E — Animasi (desain baru)
| Event | Gerak | Durasi/easing | Partikel | Kamera |
|-------|-------|---------------|----------|--------|

Gunakan token §6. **Setiap event wajib punya gerak yang berbeda dari referensi**;
jelaskan dalam satu kalimat "beda dari referensi: ...".

### Tabel F — Konten edukasi
| Mata pelajaran | Tingkat | Contoh soal (dari screenshot) | Opsi | Jawaban |
|----------------|---------|-------------------------------|------|---------|

Jika soal tidak terbaca: `[perlu data]`.

### Tabel G — Paritas fitur vs desain baru
| Fitur referensi | Dipertahankan? | Versi desain baru kita |
|-----------------|----------------|------------------------|

### Tabel H — Kriteria terima (QA)
| Uji | Langkah | Hasil yang diharapkan |
|-----|---------|----------------------|

Minimal 6 baris: mulai game, jawab benar, jawab salah, waktu habis,
ganti mode, kembali ke lobi.

---

## 5. Desain ulang visual (wajib beda)

Untuk setiap game tentukan dan tuliskan:

1. **Palet** 5 warna (hex) — pilih arah yang tidak dipakai referensi.
2. **Tipografi**: 1 display + 1 body (boleh Google Font).
3. **Bentuk dasar**: sudut, ketebalan garis, gaya ilustrasi (flat/papercut/neon/pixel).
4. **Maskot/karakter**: nama + siluet + 3 pose.
5. **Ikon set**: gaya baru, konsisten 24 px.
6. **Signature move**: satu gerak khas game ini (harus orisinil).

Arah desain yang disarankan (pilih satu per keluarga, jangan campur acak):

| Keluarga | Arah visual |
|----------|-------------|
| A hitung cepat | neon-arcade gelap, angka bercahaya |
| B menyusun | papercraft pastel, bayangan lembut |
| C cari & tangkap | noir laut / senter dramatis |
| D menolong | kartun tebal, garis hitam, warna hangat |
| E bahasa & ayat | geometri islami modern, emas-navy |
| F karya & warna | cat air digital, tepi berair |
| G 3D ruang | studio minimal abu-putih, satu warna aksen |
| H panggung kelas | poster 17-an, warna merah-putih, tekstur koran |

---

## 6. Token gerak (wajib dipakai, jangan diganti)

| Token | Nilai |
|-------|-------|
| dur.quick / base / emphasis / cinematic | 120 / 240 / 420 / 1200 ms |
| ease.out / in / jelly | cubic-bezier(.2,.9,.25,1) / (.5,0,.9,.4) / (.34,1.56,.64,1) |
| spring.soft / snappy | k=120 c=18 / k=260 c=24 |
| particle budget | ≤ 180 aktif, umur ≤ 1,2 s |
| reduced motion | fade 120 ms, tanpa partikel |

Keluarga gerak: A peluru/angka melesat · B snap magnetik · C spotlight & senar ·
D fisika tali & lompat arc · E huruf terbang & pendulum · F kuas basah & difusi ·
G orbit ganda & jaring-jaring · H kamera goyang & confetti.

---

## 7. Stack teknis

- **Next.js 14 App Router** + TypeScript strict + Tailwind.
- Render: `<canvas>` 2D + `requestAnimationFrame` untuk gameplay; Web Animations API untuk UI.
- Three.js hanya untuk game 3D (ruang-io).
- Tanpa library animasi berat; tanpa GIF/video sebagai pengganti animasi.
- Struktur:
  ```
  components/games/<slug>/Game.tsx      # komponen utama
  components/games/<slug>/logic.ts      # aturan, skor, level
  components/games/<slug>/data.ts       # bank soal (ID/EN)
  components/games/<slug>/motion.ts     # motif animasi
  src/app/game/<slug>/page.tsx          # landing 6 bagian + tombol MAIN SEKARANG
  src/lib/motion/*                      # token, tween, spring, particle, rope
  ```
- Route landing: `/game/<slug>` (bukan `/games/`).
- Semua state game tidak boleh bergantung pada Supabase; simpan skor lokal dulu.

---

## 8. Alur kerja yang saya minta

1. Saya kirim screenshot satu game (bisa 3–8 gambar).
2. Kamu balas dengan **Tabel A–H** untuk game itu + ringkasan desain ulang §5.
3. Jika ada yang tidak terbaca, tulis `[tidak terlihat]` — jangan diam-diam mengarang.
4. Setelah saya setujui, kamu tulis kode game tersebut.
5. Ulangi untuk 34 game. Di akhir, buat:
   - `docs/feature-matrix.md` (34 game × fitur)
   - `docs/animation-spec.md` (semua motif & token)
   - `docs/qa-checklist.md` (per game, 6 uji minimum)

## 9. Definisi selesai (satu game)

- [ ] Landing punya 6 bagian + tombol MAIN SEKARANG
- [ ] Mode SOLO + minimal satu mode lawan
- [ ] Timer 3/5 menit berjalan & berhenti benar
- [ ] Skor bertambah/berkurang sesuai aturan
- [ ] Ada layar hasil (menang/kalah) + ulangi
- [ ] Animasi §6 aktif; 60 fps di 1366×768
- [ ] ID/EN berfungsi
- [ ] Tanpa aset dari situs referensi


---

## 10. Contoh tabel terisi — `mancing-kata` (contoh FORMAT, bukan data final)

Game: mancing-kata — Layar: Pemilihan mode (sumber: audit otomatis, verifikasi ulang dari screenshot).

### Tabel A — Peta layar
| No | Nama layar | Tujuan | Elemen UI utama | Aksi pengguna | Transisi ke |
|----|-----------|--------|-----------------|---------------|-------------|
| 1 | Landing | SEO + ajakan main | H1, 6 bagian, tombol MAIN SEKARANG | klik MAIN SEKARANG | 2 |
| 2 | Pilih kelas & mapel | Menyesuaikan materi | dropdown jenjang, dropdown mapel | pilih | 3 |
| 3 | Pilih tingkat | Menentukan kesulitan | Mudah / Sedang / Sulit | pilih | 4 |
| 4 | Pilih mode | Menentukan jumlah pemain | PETUALANG (1), DUEL (2), TEAM DUEL (2v2) | pilih | 5 |
| 5 | Bermain | Menangkap ikan + jawab kuis | HUD waktu, MUATAN (kg), soal, opsi | jawab / lempar kail | 6 |
| 6 | Hasil | Ringkasan | total tangkapan, skor, ulangi | ulangi | 2 |

### Tabel B — Fitur & kontrol
| Fitur | Perilaku | Status/state | Catatan implementasi |
|-------|----------|--------------|----------------------|
| Timer | hitung mundur 3 menit | berjalan / berhenti / habis | tampil `mm:ss`, reset saat ulangi |
| MUATAN | berat tangkapan naik | 0 kg → naik | animasi angka naik, bukan teks statis |
| Soal | satu soal per "ikan" | menunggu jawaban | 3 opsi |
| Mode | 1 pemain / 2 pemain / 2v2 | idle / ready / playing / result | DUEL butuh dua panel skor |
| Bahasa | ID / EN | toggle | semua label dua bahasa |

### Tabel E — Animasi (desain baru)
| Event | Gerak | Durasi/easing | Partikel | Kamera |
|-------|-------|---------------|----------|--------|
| Lempar kail | busur parabola + senar melengkung (verlet) | 420 ms, ease.out | 8 percikan | tetap |
| Ikan mendekat | sinusoidal + ekor berayun | kontinu 60 fps | - | tetap |
| Jawaban benar | ikan tersentak, cincin menyusut | 240 ms, ease.jelly | 14 percikan | shake.hit 6 px |
| Jawaban salah | senar mengendur, layar bergetar | 140 ms | 6 gelembung | shake.hit |
| Waktu habis | air meredup, panel hasil naik | 420 ms, ease.out | - | zoom out ringan |

Beda dari referensi: referensi hanya menaruh kartu soal di atas latar air;
kita memakai **fisika senar + tarikan ikan** sebagai umpan balik utama.

### Tabel G — Paritas fitur vs desain baru
| Fitur referensi | Dipertahankan? | Versi desain baru kita |
|-----------------|----------------|------------------------|
| Timer 3 menit | ya | timer melingkar di HUD |
| MUATAN kg | ya | meteran berat beranimasi |
| 3 mode | ya | tab mode berikon pemain |
| Latar air statis | diganti | parallax 3 lapis + gelombang prosedural |

---

## 11. Template pesan singkat (pakai per game)

> Game: `<slug>`. Ini <n> screenshot. Buat Tabel A–H + ringkasan desain ulang §5.
> Tandai `[tidak terlihat]` bila ragu, jangan mengarang. Jangan salin aset/teks asli.

Setelah 34 game selesai:

> Sekarang tulis kode semua game sesuai `docs/feature-matrix.md`,
> `docs/animation-spec.md`, dan `docs/qa-checklist.md`. Ikuti §7 dan §9.
