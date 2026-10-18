# SPESIFIKASI TEKNIS: EKSPEDISI PASAR & DERMAGA PANCING (SOUQ & FISHING)
**Platform:** Magguru (`magguru.web.id`)  
**Versi Arsitektur:** v2.1 (Active Tilt Horizontal + Zona Split 50/50 & Dedicated Lanes)  
**Status:** Draf Terkunci & Disetujui  
**Dokumen Pendukung:** [`AUDIT.md`](file:///C:/Users/munzi/Documents/Codex/2026-09-11/create-an-image-of/work/phase1-regression/project/docs/souq-fishing/AUDIT.md) | [`DECISIONS.md`](file:///C:/Users/munzi/Documents/Codex/2026-09-11/create-an-image-of/work/phase1-regression/project/docs/souq-fishing/DECISIONS.md)

---

## 1. MATRIKS 3 MODE OPERASI (§17.1)

Modul Souq & Fishing dirancang untuk mendukung 3 pola pembelajaran fleksibel di madrasah/pesantren:

| Parameter | Mode A: `TEAM_PROJECTOR` (Hotseat Buzzer 4 Tim) | Mode B: `SOLO_PROJECTOR` (Showdown Kelas Individu) | Mode C: `SELF_PACED_ROOM` (Room Mandiri + Live Monitor) |
| :--- | :--- | :--- | :--- |
| **Layar Utama (Proyektor)** | Menampilkan Peta Ekspedisi 2D + 4 Box Tim (Merah, Biru, Hijau, Kuning) dengan Active Tilt. | Menampilkan Peta Ekspedisi 2D + Papan Skor Live Individu Seluruh Siswa. | Dashboard Monitoring Guru: status progres node tiap santri & statistik bab. |
| **Piranti Siswa (HP)** | 4 HP (1 per tim) membuka `/controller` sebagai stik navigasi & tombol jawaban (100vh full). | Semua siswa membuka `/controller` dengan identitas nama santri masing-masing. | Setiap siswa membuka `/join/room?token=...` dan bermain secara mandiri (self-paced). |
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

Baris atas proyektor (`ProjectorWorldMap`, 58vh) dibagi secara visual menjadi 2 kolom horizontal seimbang **50/50** menggunakan CSS Grid `grid-cols-2`:

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ BARIS ATAS PROYEKTOR: ProjectorWorldMap (58vh) [grid-cols-2]                                          │
├───────────────────────────────────────────────────┬───────────────────────────────────────────────────┤
│ KOLOM KIRI (50% Lebar): ZONA DARATAN PASAR        │ KOLOM KANAN (50% Lebar): ZONA PERAIRAN DERMAGA    │
│                                                   │                                                   │
│ [ALUN] ──► [KIOS (G1)] ──► [GERBANG_KANTIN (G2)]  │ [DERMAGA_1] ───────────────► [DERMAGA_VIP]        │
│                │                       │          │       │                              │            │
│                ▼                       ▼          │       ▼                              ▼            │
│         Quest G1 (3 Pin)        Quest G2 (4 Pin)  │ Memancing Biasa              Ikan Legendaris      │
│         (+20/pin, +100 lulus)   (Hadiah VIP +     │ Common {50, 75, 100}         Epic {450, 500, 550, │
│                │                 Umpan x3 +       │ Rare {200, 250, 300}         600}                 │
│                ▼                 Buff 180s)       │                              Legendary {800, 1000,│
│         [Hadiah: Joran Emas]         │            │                              1200}                │
│                │                     ▼            │                                                   │
│                └───────────► [KANTIN] ────────────┘                                                   │
│                        (Buff: Jalan -50%, Poin +20%)                                                  │
│                                                                                                       │
│ ── Jalur 1 (Merah: Putri Hijab) ─────────────────►│ ── Jalur 1 (Merah: Ujung Dermaga 1) ─────────────►│
│ ── Jalur 2 (Biru: Putra Peci) ───────────────────►│ ── Jalur 2 (Biru: Ujung Dermaga 2) ──────────────►│
│ ── Jalur 3 (Hijau: Putri Mandiri) ───────────────►│ ── Jalur 3 (Hijau: Dermaga Tengah) ──────────────►│
│ ── Jalur 4 (Kuning: Putra Mandiri) ──────────────►│ ── Jalur 4 (Kuning: Dermaga VIP) ────────────────►│
└───────────────────────────────────────────────────┴───────────────────────────────────────────────────┘
```

### Rincian Zona & Progresi Jalur (Dedicated Lanes):
1. **Kolom Kiri (50% Lebar) — Daratan Pasar:**
   - `ALUN`: Titik awal kumpul dan musyawarah tim santri.
   - `KIOS (G1)`: Gerbang Quest 1, tantangan 3 pin kunci emas (`+20` poin per pin, bonus lulus `+100` poin, hadiah `rod_golden` / Joran Emas).
   - `GERBANG_KANTIN (G2)`: Gerbang Quest 2, tantangan 4 pin kunci emas (syarat lulus G1, hadiah Kunci Dermaga VIP + Umpan Berkilau ×3 + Buff Berkah Kantin).
   - `KANTIN`: Pos Barokah tempat santri mengklaim Buff Berkah Kantin durasi 180 detik (kecepatan jalan -50% durasi / 2× lebih cepat, poin tangkapan +20% dibulatkan ke atas).
2. **Kolom Kanan (50% Lebar) — Perairan Dermaga:**
   - `DERMAGA_1`: Spot memancing standar untuk tier Common {50, 75, 100} dan Rare {200, 250, 300}.
   - `DERMAGA_VIP`: Spot memancing laut dalam untuk tier Epic {450, 500, 550, 600} dan Legendary {800, 1000, 1200}.
3. **4 Dedicated Lanes (Jalur Eksklusif Tim):**
   - Setiap tim memiliki jalur koordinat Y terpisah (offset vertikal 12px) sehingga avatar 4 karakter santun (`putri_hijab`, `putra_peci`, `putri_non_hijab`, `putra_non_peci`) berjalan berdampingan tanpa saling menimpa atau tumpang tindih visual.
   - Progresi mesin Fase 1 (`ALUN -> G1 -> G2 -> KANTIN -> DERMAGA`) berjalan 100% deterministik dan bebas deadlock.

---

## 4. §17.4.3 KONTRAK TUNGGAL ACTIVE TILT BERBASIS FLEX DI BARIS BAWAH (42vh)

Pada baris bawah proyektor (`ProjectorFourTeamTables`, 42vh), lebar horizontal dari ke-4 kolom `<TeamBox>` menyesuaikan secara dinamis dan mulus berbasis **FLEX** (bukan grid baris tabel tim):

```css
/* Kontrak Tunggal Baris Bawah Berbasis FLEX */
.projector-four-team-tables {
  display: flex;
  flex-direction: row;
  height: 42vh;
  min-height: 42vh;
  max-height: 42vh;
  overflow: hidden;
  contain: content;
}

.team-box {
  min-width: 0;
  overflow: hidden;
  contain: content;
  transition: flex-basis 250ms ease;
}
```

### Matriks Distribusi Lebar Horizontal ($N$):
Lebar horizontal dinamis diatur melalui properti `flex-basis` berdasarkan $N$ (jumlah tim yang sedang aktif dalam status tantangan soal `gate` atau `fishing`):
- **$N = 0$** (Semua tim idle / traveling): `25% / 25% / 25% / 25%`
- **$N = 1$** (1 aktif ditantang soal, 3 tim jalan): `55% / 15% / 15% / 15%` (Tim aktif melebar horizontal 55%)
- **$N = 2$** (2 tim ditantang bersamaan): `35% / 15% / 35% / 15%` (Masing-masing tim aktif 35%)
- **$N = 3$** (3 tim ditantang bersamaan): `28% / 28% / 28% / 16%` (Masing-masing tim aktif 28%)
- **$N = 4$** (Semua tim ditantang soal): `25% / 25% / 25% / 25%`

### Strategi Tanpa Scroll Saat $N \ge 3$:
Saat $N \ge 3$:
1. **Dekorasi sekunder disembunyikan:** Badge non-esensial dan teks bantuan panjang dihilangkan untuk menghemat ruang.
2. **Skalasi teks adaptif:** Ukuran teks soal dan opsi A–D diskalakan adaptif dengan `clamp(0.75rem, 1.2vw, 1.5rem)` sampai batas minimum terbaca jelas dari belakang kelas.
3. **Pencegahan Kerapatan Ekstrem (Antrian Soal):** Jika masih tidak muat, sistem **MELARANG** $N \ge 3$ aktif bersamaan: tim ke-3 dan ke-4 yang memicu soal secara bersamaan dipaksa antri (state `QUEUED_QUESTION`), sehingga hanya maksimal 2 tim yang menampilkan kartu soal serentak.
4. **`overflow: hidden` WAJIB dipertahankan:** **DILARANG KERAS** memunculkan scrollbar di layar proyektor TV kelas.

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
   - **DILARANG KERAS** menggunakan `position: fixed` atau `position: absolute` untuk menampilkan kartu pertanyaan melayang di atas peta visual (baris atas 58vh).
   - **DILARANG KERAS** memunculkan modal pop-up di baris atas (58vh).
2. **Pagar Pembatas Vertikal:**
   - Seluruh elemen teks pertanyaan, kartu opsi A/B/C/D, indikator waktu, dan tombol konfirmasi dilarang menembus garis batas pemisah 58vh / 42vh.
   - Peta di baris atas tetap bersih 100% sehingga guru dan santri dapat mengamati pergerakan ekspedisi dengan pandangan lapang tanpa halangan pop-up.

---

## 7. §17.4.6 KONTROLER HP SISWA (FULL-VIEWPORT 100vh)

1. **Bebas Active Tilt:**
   - Fitur Active Tilt Horizontal **HANYA** berlaku pada layar proyektor 4 tim kelas.
   - Piranti HP siswa (`/controller`) **TIDAK** menggunakan Active Tilt.
2. **100vh Single-State Mounted:**
   - Kontroler HP selalu merender 1 state aktif penuh (100vh) tanpa split view.

---

## 8. §17.4.7 INDIKATOR VISUAL WAJIB

Tampilan tantangan di Proyektor (`<TeamBox>`) dan HP Kontroler wajib menyertakan indikator status resmi:
1. **`GATE_QUESTION_VIEW` (Tantangan Pembuka Gerbang):**
   - Header gembok emas bertingkat.
   - Indikator pin status: `[🔓][🔓][🔒]` (3 pin KIOS G1) atau `[🔓][🔓][🔓][🔒]` (4 pin GERBANG_KANTIN G2).
   - Kartu soal kurikulum guru + 4 opsi A–D.
2. **`FISHING_QUESTION_VIEW` (Tantangan Memancing Ikan):**
   - Animasi SVG ikan melompat dari perairan.
   - Pita poin tangkapan sesuai tier ikan (Common {50, 75, 100}, Rare {200, 250, 300}, Epic {450, 500, 550, 600}, Legendary {800, 1000, 1200}).
   - Tension bar (indikator kekuatan tarikan senar pancing).
   - Kartu soal pancing + 4 opsi A–D.

---

## 9. 4-STATE VIEW SWITCHER DI KONTROLER HP SISWA

Kontroler HP (`/controller`) dirancang ultra-ringan berbasis HTML5, CSS Flex/Grid, dan SVG Mini-Map Strip (tanpa canvas berat) agar lancar di HP Android RAM 2 GB:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   KONTROLER HP (VIEW SWITCHER 100vh)                   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
    ┌───────────────────────────────┼───────────────────────────────┐
    ▼                               ▼                               ▼
┌─────────────────────────┐   ┌─────────────────────────┐   ┌─────────────────────────┐
│ STATE 1:                │   │ STATE 2:                │   │ STATE 3:                │
│ PRE_GAME_DASHBOARD      │==►│ WALKING_VIEW            │==►│ GATE_QUESTION_VIEW      │
│ - Pilih 4 Karakter      │   │ - SVG Mini-Map Strip    │   │ - Gembok Emas 3/4 Pin   │
│ - Pilih Stik Tim (1-4)  │   │ - Animasi Melangkah     │   │ - Teks Soal Kurikulum   │
│ - Menunggu Host Dimulai │   │ - Tombol Soal UNMOUNTED │   │ - 4 Tombol A-D Besar    │
└─────────────────────────┘   └─────────────────────────┘   └─────────────────────────┘
                                                                        │
                                                                        ▼
                                                            ┌─────────────────────────┐
                                                            │ STATE 4:                │
                                                            │ FISHING_QUESTION_VIEW   │
                                                            │ - SVG Ikan Melompat     │
                                                            │ - Tension Bar Pancing   │
                                                            │ - Lempar / Tarik Joran  │
                                                            └─────────────────────────┘
```

1. **State 1 — `PRE_GAME_DASHBOARD`:**
   - Siswa memilih identitas tim (Merah, Biru, Hijau, Kuning) dan avatar dari 4 karakter santun.
2. **State 2 — `WALKING_VIEW`:**
   - Menampilkan visual progress bar jalur ekspedisi dalam bentuk SVG horisontal sederhana (< 30 kB).
   - Layar menampilkan avatar yang melangkah santai; tombol soal tidak ada di layar (anti-confusion).
3. **State 3 — `GATE_QUESTION_VIEW`:**
   - Teks soal guru (Arab/Lontara/Latin) tampil jelas di atas.
   - Indikator pin gembok emas `[🔓][🔓][🔒]`.
   - 4 Tombol besar mudah ditekan jempol (Merah ▲, Biru ◆, Kuning ●, Hijau ■) dengan feedback getar ringan (`navigator.vibrate(50)`).
   - **Kunci jawaban tidak pernah ada di payload HP**.
4. **State 4 — `FISHING_QUESTION_VIEW`:**
   - Tombol "Lempar Joran" (Cast Line).
   - Saat umpan disambar ikan, tombol berubah menjadi "Tarik Joran!" (Reel In) dengan animasi keberhasilan dan poin yang diperoleh.

---

## 10. SISTEM 4 KARAKTER SANTUN & INKLUSIF

Semua karakter dirender menggunakan SVG kartun lokal yang santun dan ramah budaya pesantren:
1. `putri_hijab`: Santriwati berhijab rapi dengan tas selempang penuntut ilmu.
2. `putri_non_hijab`: Siswi perempuan berpakaian sopan santun nusantara.
3. `putra_peci`: Santri putra berkopiah/peci hitam khas santri.
4. `putra_non_peci`: Siswa laki-laki berpakaian rapi dan bersahaja.

---

## 11. MEKANIK GERBANG QUEST (GATE MECHANICS)

1. **Gerbang 1 (KIOS):**
   - Syarat: 3 pin kunci emas (`[🔓][🔓][🔒]`).
   - Skor: `+20` poin per pin jawaban benar.
   - Bonus Kelulusan: `+100` poin saat 3 pin terpenuhi.
   - Hadiah: `rod_golden` (Joran Emas) untuk membuka kemampuan memancing.
2. **Gerbang 2 (GERBANG_KANTIN):**
   - Syarat: 4 pin kunci emas (`[🔓][🔓][🔓][🔒]`), dengan prasyarat wajib telah lulus Gerbang 1 (KIOS).
   - Hadiah Kelulusan:
     - Kunci Akses `DERMAGA_VIP`.
     - `bait_sparkling` (Umpan Berkilau) ×3.
     - `canteen_buff` (Buff Berkah Kantin): Durasi **180 detik**, durasi perjalanan (jalan) berkurang `-50%` (kecepatan gerak 2× lebih cepat), poin tangkapan ikan `+20%` (dibulatkan ke atas).

---

## 12. TINGKATAN IKAN & POIN (FISHING TIERS)

Hasil pancingan di Kolom Kanan Dermaga dikelompokkan secara kanonikal ke dalam 4 tier dengan aturan rantai soal (*question chain*):

1. **Common:**
   - Nilai Poin Diskrit: `{50, 75, 100}`
   - Mekanik Tantangan: 1 soal, tanpa timer.
   - Lokasi: `DERMAGA_1` (Jalur Biasa).
2. **Rare:**
   - Nilai Poin Diskrit: `{200, 250, 300}`
   - Mekanik Tantangan: 1 soal, batas waktu timer **20 detik**.
   - Lokasi: `DERMAGA_1` (Jalur Biasa).
3. **Epic:**
   - Nilai Poin Diskrit: `{450, 500, 550, 600}`
   - Mekanik Tantangan: Rantai **2 soal beruntun** ($n = 2$).
   - Lokasi: `DERMAGA_VIP` (Jalur Khusus).
4. **Legendary:**
   - Nilai Poin Diskrit: `{800, 1000, 1200}`
   - Mekanik Tantangan: Rantai **3 soal beruntun** ($n = 3$).
   - Lokasi: `DERMAGA_VIP` (Puncak Quest).
5. **Aturan Penalti Gagal Rantai ($n \ge 2$):**
   - Jika gagal di tengah jalan pada rantai $n \ge 2$, tim menerima poin parsial dengan formula resmi:
     $$\text{Poin Parsial} = \left\lfloor 0.25 \times \text{Nilai Poin} \times \frac{\text{Jumlah Benar}}{n} \right\rfloor$$

---

## 13. TANGGA BANTUAN BELAJAR SANTRI (ASSISTANCE LADDER)

Untuk mencegah santri merasa putus asa atau tim terkunci permanen di satu gerbang, modul menerapkan tangga bantuan bertingkat resmi:
1. **Salah 2× Beruntun:**
   - Sistem secara otomatis menyembunyikan 1 opsi salah (bantuan eliminasi 50:50).
2. **Salah 3× Beruntun:**
   - Tim masuk ke status **Istirahat Belajar selama 15 detik** (bukan 5 detik), dan layar menampilkan ulasan/pembahasan soal yang salah untuk evaluasi pemahaman santri.
3. **Lulus Dibantu (Assisted = true):**
   - Setelah 3× istirahat belajar, gerbang diberikan status **Lulus Dibantu (`assisted: true`)** agar tim dapat melanjutkan ekspedisi ke pos berikutnya.
   - **Konsekuensi Skor:** Tim **TIDAK DIBERI** bonus kelulusan `+100` poin dari gerbang (bukan pemotongan 50% poin, melainkan peniadaan bonus +100 gerbang).

---

## 14. DUKUNGAN BAHASA & AKSARA BUGIS (LONTARA)

Sistem lokalisasi dan bank soal mendukung penuh 4 opsi bahasa resmi:
1. **Bahasa Indonesia (`id`)**: Bahasa antarmuka utama madrasah.
2. **Bahasa Arab (`ar`)**: Tipografi `Traditional Arabic` / `Amiri` 16pt, line-height 2.0 (mencegah terpotongnya harakat/tashkeel), `dir="rtl"`.
3. **Bahasa Inggris (`en`)**: Bahasa internasional untuk kosakata global.
4. **Bahasa Bugis / Aksara Lontara (`bugis_lontara`)**:
   - Mendukung glif Unicode U+1A00–U+1A1F (ᨀ, ᨁ, ᨂ, ᨃ, ᨄ, dll.).
   - Tipografi fallback: `"Noto Sans Buginese", "Noto Sans Bugis", system-ui, sans-serif`.
   - Tata letak: Left-to-Right (LTR) alami Lontara.
   - Integritas Soal: Diakritik tanda baca Lontara (*ana' surang*) dipelihara apa adanya tanpa normalisasi atau pemotongan string. Perbandingan jawaban strictly menggunakan ID opsi A–D.

---

## 15. STRUKTUR LOKALISASI `theme-labels.json`

File `src/modules/souq-fishing/config/theme-labels.json` dikemas secara flat dengan 4 grup bahasa:
- `id`: Bahasa Indonesia
- `ar`: Bahasa Arab
- `en`: Bahasa Inggris
- `bugis_lontara`: Bahasa Bugis & Aksara Lontara
Setiap istilah modern (seperti Dermaga VIP, buff kantin, dan tension bar) ditandai dengan komentar panduan `// Ahmad: silakan edit` agar mudah disesuaikan oleh guru/pengembang.
