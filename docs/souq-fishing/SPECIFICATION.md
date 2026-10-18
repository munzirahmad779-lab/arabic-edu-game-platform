# SPESIFIKASI TEKNIS: EKSPEDISI PASAR & DERMAGA PANCING (SOUQ & FISHING)
**Platform:** Magguru (`magguru.web.id`)  
**Versi Arsitektur:** v2.1 (Active Tilt Horizontal + Zona Split 50/50 & Dedicated Lanes)  
**Status:** Draf Terkunci & Disetujui  
**Dokumen Pendukung:** [`AUDIT.md`](file:///C:/Users/munzi/Documents/Codex/2026-09-11/create-an-image-of/work/phase1-regression/project/docs/souq-fishing/AUDIT.md) | [`DECISIONS.md`](file:///C:/Users/munzi/Documents/Codex/2026-09-11/create-an-image-of/work/phase1-regression/project/docs/souq-fishing/DECISIONS.md)

---

## 1. MATRIKS 3 MODE OPERASI (§17.1)

Modul Souq & Fishing dirancang untuk mendukung 3 pola pembelajaran fleksibel di madrasah/pesantren:

| Parameter | Mode A: Proyektor 4 Tim (Hotseat Buzzer) | Mode B: Proyektor Individu (Showdown) | Mode C: Room Siswa Mandiri + Live Monitoring |
| :--- | :--- | :--- | :--- |
| **Layar Utama (Proyektor)** | Menampilkan Peta Ekspedisi 2D + 4 Box Tim (Merah, Biru, Hijau, Kuning) dengan Active Tilt. | Menampilkan Peta Ekspedisi 2D + Papan Skor Live Individu Siswa. | Dashboard Monitoring Guru: status progres node tiap santri & statistik bab. |
| **Piranti Siswa (HP)** | 4 HP (1 per tim) membuka `/controller` sebagai stik navigasi & tombol jawaban (100vh full). | Semua siswa membuka `/controller` dengan identitas nama masing-masing. | Setiap siswa membuka `/join/room?token=...` dan bermain secara mandiri (self-paced). |
| **Siklus Belajar** | Giliran tim atau adu cepat buzzer tim menjawab tantangan gerbang & mancing. | Seluruh siswa berlomba memecahkan gerbang soal untuk mencapai dermaga pertama. | Siswa melangkah di peta sesuai ritme sendiri; soal baru muncul saat siswa tiba di pos. |
| **Jalur Transport** | `/api/projector/controller` (polling + heartbeat) + Realtime Broadcast. | Polling `/api/projector/controller` + Realtime Broadcast. | `/api/rooms/session` & RPC `submit_game_answer`. |
| **Penyimpanan Nilai** | `POST /api/projector/save-report` ke tabel `rooms` dan `room_sessions`. | `POST /api/projector/save-report`. | Tabel `submissions` (idempoten via constraint unik per siswa-soal). |

---

## 2. §17.4.1 GRID VERTIKAL PROYEKTOR (KUNCI 58/42)

Untuk memastikan proporsi visual tetap konsisten pada layar proyektor kelas (resolusi 1080p, 720p, maupun 4:3), layout proyektor dikunci secara absolut dengan rasio **58/42**:

```css
/* Container Utama Proyektor */
.projector-container {
  height: 100vh;
  width: 100vw;
  display: grid;
  grid-template-rows: 58fr 42fr; /* Baris Atas 58vh, Baris Bawah 42vh */
  overflow: hidden;
}

/* Isolasi Render & Containment */
.projector-world-map {
  height: 58vh;
  min-height: 58vh;
  max-height: 58vh;
  overflow: hidden;
  contain: content;
}

.projector-four-team-tables {
  height: 42vh;
  min-height: 42vh;
  max-height: 42vh;
  overflow: hidden;
  contain: content;
}
```

### Invariant Grid Proyektor:
1. **Baris Atas (`ProjectorWorldMap`):** Dikunci tepat **58vh** dan **TIDAK PERNAH** dikompresi di bawah 58vh, apa pun status tantangan soal di baris bawah.
2. **Baris Bawah (`ProjectorFourTeamTables`):** Dikunci tepat **42vh**, menjadi wadah eksklusif untuk 4 kotak tim (`<TeamBox>`) dan kartu soal.
3. Kedua baris wajib menerapkan `contain: content` dan `overflow: hidden` untuk mencegah kebocoran reflow/repaint antar-baris.

---

## 3. §17.4.2 SPLIT HORIZONTAL PETA 50/50 & DEDICATED LANES

Baris atas proyektor (`ProjectorWorldMap`, 58vh) dibagi secara visual menjadi 2 kolom horizontal seimbang **50/50**:

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ BARIS ATAS PROYEKTOR: ProjectorWorldMap (58vh)                                                        │
├───────────────────────────────────────────────────┬───────────────────────────────────────────────────┤
│ KOLOM KIRI (50% Lebar): ZONA DARATAN PASAR        │ KOLOM KANAN (50% Lebar): ZONA PERAIRAN DERMAGA    │
│                                                   │                                                   │
│ [ALUN] ──► [KIOS (G1)] ──► [GERBANG_KANTIN (G2)]  │ [DERMAGA_1] ───────────────► [DERMAGA_VIP]        │
│                │                       │          │       │                              │            │
│                ▼                       ▼          │       ▼                              ▼            │
│         Quest G1 (3 Pin)        Quest G2 (4 Pin)  │ Memancing Biasa              Ikan Legendaris      │
│                │                       │          │ (+50 s.d. +500 Poin)         (+600 s.d. +1200 P)  │
│                └───────────► [KANTIN] ─┘          │                                                   │
│                        (Buff +25% Poin)           │                                                   │
│                                                   │                                                   │
│ ── Jalur 1 (Merah: Putri Hijab) ─────────────────►│ ── Jalur 1 (Merah: Ujung Dermaga 1) ─────────────►│
│ ── Jalur 2 (Biru: Putra Peci) ───────────────────►│ ── Jalur 2 (Biru: Ujung Dermaga 2) ──────────────►│
│ ── Jalur 3 (Hijau: Putri Mandiri) ───────────────►│ ── Jalur 3 (Hijau: Dermaga Tengah) ──────────────►│
│ ── Jalur 4 (Kuning: Putra Mandiri) ──────────────►│ ── Jalur 4 (Kuning: Dermaga VIP) ────────────────►│
└───────────────────────────────────────────────────┴───────────────────────────────────────────────────┘
```

### Rincian Zona & Progresi Jalur (Dedicated Lanes):
1. **Kolom Kiri (50% Lebar) — Daratan Pasar:**
   - `ALUN`: Titik keberangkatan awal santri.
   - `KIOS (G1)`: Gerbang Quest 1, mengharuskan santri memecahkan soal (3 pin kunci emas `[🔓][🔓][🔒]`).
   - `GERBANG_KANTIN (G2)`: Gerbang Quest 2, tantangan lanjutan (4 pin kunci emas `[🔓][🔓][🔓][🔒]`).
   - `KANTIN`: Pos Barokah tempat santri mengklaim Buff Kantin (+25% Poin pancing) dan peralatan Joran Emas.
2. **Kolom Kanan (50% Lebar) — Perairan Dermaga:**
   - `DERMAGA_1`: Spot memancing standar (ikan air tawar/pantai: Nila, Kerapu, Baronang bernilai +50 s.d. +500 poin).
   - `DERMAGA_VIP`: Spot memancing laut dalam untuk tim yang membuka seluruh gerbang (Ikan Mas Emas, Marlin Biru bernilai +600 s.d. +1200 poin).
3. **4 Dedicated Lanes (Jalur Eksklusif Tim):**
   - Setiap tim memiliki jalur koordinat Y terpisah (offset vertikal 12px) sehingga avatar 4 karakter santun (`putri_hijab`, `putra_peci`, `putri_non_hijab`, `putra_non_peci`) berjalan berdampingan tanpa saling menimpa atau tumpang tindih visual.
   - Progresi mesin Fase 1 (`ALUN -> G1 -> G2 -> KANTIN -> DERMAGA`) berjalan 100% deterministik dan bebas deadlock.

---

## 4. §17.4.3 ACTIVE TILT HORIZONTAL DI BARIS BAWAH (42vh)

Pada baris bawah proyektor (`ProjectorFourTeamTables`, 42vh), lebar horizontal dari ke-4 kolom `<TeamBox>` menyesuaikan secara dinamis dan mulus berdasarkan nilai **$N$** (jumlah tim yang sedang dalam status tantangan soal `gate` atau `fishing` pada saat bersamaan):

```
Active Tilt Width Formula:
N = 0 (Semua tim idle / traveling):   [ 25% ] [ 25% ] [ 25% ] [ 25% ]
N = 1 (1 tim ditantang, 3 traveling): [        55% (AKTIF)        ] [ 15% ] [ 15% ] [ 15% ]
N = 2 (2 tim ditantang bersamaan):    [     35% (AKTIF)     ] [ 15% ] [     35% (AKTIF)     ] [ 15% ]
N = 3 (3 tim ditantang bersamaan):    [   28% (AKTIF)   ] [   28% (AKTIF)   ] [   28% (AKTIF)   ] [ 16% ]
N = 4 (Semua tim ditantang soal):     [ 25% ] [ 25% ] [ 25% ] [ 25% ]
```

### Aturan CSS & Transisi Wajib:
1. **Aturan Kotak Tim (`<TeamBox>`):**
   - Kartu soal A-D **SELALU** dirender di dalam `<TeamBox>` pada baris bawah (42vh).
   - Wajib menggunakan `contain: content`, `min-width: 0`, dan `overflow: hidden`.
   - Transisi pergeseran lebar: `transition: flex-basis 250ms cubic-bezier(0.4, 0, 0.2, 1), width 250ms ease`.
2. **Kompensasi Kerapatan Saat $N \ge 3$:**
   - Ketika $N = 3$ atau $N = 4$, lebar kolom mengecil ke 25%–28%.
   - Komponen otomatis menyembunyikan dekorasi sekunder (badge non-esensial, subtitle deskripsi panjang).
   - Ukuran font opsi soal diskalakan secara otomatis (`text-xs` hingga `text-sm`) dengan container berkemampuan internal scroll (`overflow-y-auto max-h-full`) untuk mencegah teks soal panjang (misalnya teks tafsir/hadits Arab berharakat penuh) meluap keluar dari batas 42vh.

---

## 5. §17.4.4 TRIGGER SOAL & STRICT UI MUTEX

1. **Trigger Deterministik:**
   - Pertanyaan kuis **HANYA** muncul saat terjadi salah satu dari dua event resmi:
     - `gate_triggered`: Avatar tim tiba di `KIOS` (G1) atau `GERBANG_KANTIN` (G2).
     - `fish_hooked`: Avatar tim melempar umpan di dermaga dan pelampung disambar ikan.
2. **Kondisi Traveling / Idle:**
   - Selama status tim adalah `'traveling'` atau `'idle'`, `<TeamBox>` tim tersebut **HANYA** menampilkan avatar mini yang sedang melangkah/bersiap serta skor tim saat ini.
   - Komponen `<ChallengeCard>` wajib **UNMOUNTED (`null`)** saat `status === 'traveling'`. Tidak ada elemen pertanyaan tersembunyi yang memakan ruang rendering.

---

## 6. §17.4.5 ZERO-OVERLAP MUTLAK (ATURAN EMAS KELAS)

1. **Larangan Fixed / Absolute Floating:**
   - **DILARANG KERAS** menggunakan `position: fixed` atau `position: absolute` untuk menampilkan kartu pertanyaan melayang di atas peta visual (baris atas).
   - **DILARANG KERAS** memunculkan modal dialog di baris atas (58vh).
2. **Pagar Pembatas Vertikal:**
   - Seluruh elemen teks pertanyaan, kartu opsi A/B/C/D, indikator waktu, dan tombol konfirmasi dilarang menembus garis batas pemisah 58vh / 42vh.
   - Peta di baris atas tetap bersih 100% sehingga guru dan santri dapat mengamati pergerakan ekspedisi dengan pandangan lapang tanpa halangan pop-up.

---

## 7. §17.4.6 KONTROLER HP SISWA (FULL-VIEWPORT 100vh)

1. **Bebas Active Tilt:**
   - Fitur Active Tilt Horizontal **HANYA** berlaku pada layar proyektor 4 tim kelas.
   - Piranti HP siswa (`/controller`) **TIDAK** menggunakan Active Tilt.
2. **100vh Single-State Mounted:**
   - Kontroler HP selalu merender 1 state aktif penuh (100vh) dengan transisi bersih:
     - **State 1:** Lobby & Pemilihan Karakter/Tim.
     - **State 2:** Map Travel (SVG Mini-Map Strip ringan 30 kB + animasi langkah santai, tanpa canvas berat).
     - **State 3:** Question Challenge (Teks soal + 4 tombol besar A-D ramah jempol dengan haptic feedback).
     - **State 4:** Fishing Mini-Game (Tombol lempar & tarik joran).

---

## 8. §17.4.7 INDIKATOR VISUAL WAJIB

Tampilan tantangan di Proyektor (`<TeamBox>`) dan HP Kontroler wajib menyertakan indikator status resmi:

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. GATE_QUESTION_VIEW (Tantangan Pembuka Gerbang)                      │
│    [🔒 Header Gembok Emas]                                             │
│    Indikator Kunci: [🔓 Terbuka] [🔓 Terbuka] [🔒 Terkunci] (G1: 3 Pin) │
│    Kartu Soal: "مَا مَعْنَى كَلِمَةِ 'مَدْرَسَة'؟"                       │
│    [A. Rumah]  [B. Sekolah]  [C. Pasar]  [D. Masjid]                   │
├────────────────────────────────────────────────────────────────────────┤
│ 2. FISHING_QUESTION_VIEW (Tantangan Memancing Ikan)                    │
│    [🐟 SVG Ikan Melompat]                                              │
│    Pita Skor: [+500 POIN IKAN KERAPU SAMUDRA]                          │
│    Tension Bar: [========|====] (Kekuatan Tarikan Senar)               │
│    Kartu Soal: "Sebutkan rukun sholat yang ketiga!"                    │
│    [A. Ruku']  [B. I'tidal]  [C. Takbiratul Ihram]  [D. Sujud]         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 9. DUKUNGAN BAHASA & AKSARA BUGIS (LONTARA)

Sistem lokalisasi dan bank soal mendukung penuh 4 opsi bahasa resmi:
1. **Bahasa Indonesia (`id`)**: Bahasa antarmuka utama madrasah.
2. **Bahasa Arab (`ar`)**: Tipografi `Traditional Arabic` / `Amiri` 16pt, line-height 2.0 (mencegah terpotongnya harakat/tashkeel), `dir="rtl"`.
3. **Bahasa Inggris (`en`)**: Bahasa internasional untuk kosakata global.
4. **Bahasa Bugis / Aksara Lontara (`bugis_lontara`)**:
   - Mendukung glif Unicode U+1A00–U+1A1F (ᨀ, ᨁ, ᨂ, ᨃ, ᨄ, dll.).
   - Tipografi fallback: `"Noto Sans Buginese", system-ui, sans-serif`.
   - Tata letak: Left-to-Right (LTR) alami Lontara.
   - Integritas Soal: Diakritik tanda baca Lontara (*ana' surang*) dipelihara apa adanya tanpa normalisasi atau pemotongan string. Perbandingan jawaban strictly menggunakan ID opsi A–D.

---

## 10. KESIAPAN & PANDUAN FASE BERIKUTNYA

Amendemen v2.1 ini mengikat seluruh implementasi visual dan logika game.
- Grid vertikal 58/42 terkunci.
- Split horizontal peta 50/50 dan 4 dedicated lanes siap dihubungkan ke pure engine pada Fase 2.
- Logika CSS Active Tilt di baris bawah siap diterapkan pada komponen UI tanpa melanggar Strict UI Mutex.
