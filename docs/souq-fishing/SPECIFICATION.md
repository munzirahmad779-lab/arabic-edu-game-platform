# SPESIFIKASI TEKNIS: EKSPEDISI PASAR & DERMAGA PANCING (SOUQ & FISHING)
**Platform:** Magguru (`magguru.web.id`)  
**Fase:** Fase 1 — Spesifikasi Teknis & Setup Modul  
**Status:** Draf Terkunci (Fase 1 Selesai)  
**Dokumen Pendukung:** [`AUDIT.md`](file:///C:/Users/munzi/Documents/Codex/2026-09-11/create-an-image-of/work/phase1-regression/project/docs/souq-fishing/AUDIT.md) | [`DECISIONS.md`](file:///C:/Users/munzi/Documents/Codex/2026-09-11/create-an-image-of/work/phase1-regression/project/docs/souq-fishing/DECISIONS.md)

---

## 1. MATRIKS 3 MODE OPERASI (§17.1)

Modul Souq & Fishing dirancang untuk mendukung 3 pola pembelajaran fleksibel di madrasah/pesantren:

| Parameter | Mode A: Proyektor 4 Tim (Hotseat Buzzer) | Mode B: Proyektor Individu (Showdown) | Mode C: Room Siswa Mandiri + Live Monitoring |
| :--- | :--- | :--- | :--- |
| **Layar Utama (Proyektor)** | Menampilkan Peta Ekspedisi 2D + 4 Box Tim (Merah, Biru, Hijau, Kuning). | Menampilkan Peta Ekspedisi 2D + Papan Skor Live Individu Siswa. | Dashboard Monitoring Guru: status progres node tiap santri & statistik bab. |
| **Piranti Siswa (HP)** | 4 HP (1 per tim) membuka `/controller` sebagai stik navigasi & tombol jawaban. | Semua siswa membuka `/controller` dengan identitas nama masing-masing. | Setiap siswa membuka `/join/room?token=...` dan bermain secara mandiri (self-paced). |
| **Siklus Belajar** | Giliran tim atau adu cepat buzzer tim menjawab tantangan gerbang & mancing. | Seluruh siswa berlomba memecahkan gerbang soal untuk mencapai dermaga pertama. | Siswa melangkah di peta sesuai ritme sendiri; soal baru muncul saat siswa tiba di pos. |
| **Jalur Transport** | `/api/projector/controller` (polling + heartbeat) + Realtime Broadcast. | Polling `/api/projector/controller` + Realtime Broadcast. | `/api/rooms/session` & RPC `submit_game_answer`. |
| **Penyimpanan Nilai** | `POST /api/projector/save-report` ke tabel `rooms` dan `room_sessions`. | `POST /api/projector/save-report`. | Tabel `submissions` (idempoten via constraint unik per siswa-soal). |

---

## 2. STRICT 2-ROW SPLIT GRID LAYAR PROYEKTOR (§17.2)

Untuk mencegah tabrakan visual (zero UI overlap) antara avatar yang berjalan dan pertanyaan guru, layar proyektor dibagi secara mutlak menjadi 2 baris (CSS Grid 2-Row Layout):

```
┌────────────────────────────────────────────────────────────────────────┐
│ ROW 1: PETA EKSPEDISI 2D PASAR & DERMAGA (Tinggi: 42vh / Flex-1)      │
│  [Pasar Santri] ──► [Gerbang Quest 1] ──► [Kantin] ──► [Dermaga Pancing]│
│  • Visual SVG/CSS murni, jalur bertekstur jalan setapak batu.          │
│  • Avatar 4 Tim melangkah dengan animasi langkah kaki lokal.           │
│  • Selama status "traveling": Avatar berjalan, area Row 2 LOCKED.      │
├────────────────────────────────────────────────────────────────────────┤
│ ROW 2: 4 BOX PAPAN TIM DENGAN STRICT MUTEX (Tinggi: 58vh / Flex-1.2)   │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │  TIM MERAH   │ │   TIM BIRU   │ │  TIM HIJAU   │ │  TIM KUNING  │   │
│  │ (Putri Hijab)│ │(Putra Peci)  │ │(Putri Mandiri│ │(Putra Mandiri│   │
│  │ Skor: 350    │ │ Skor: 420    │ │ Skor: 280    │ │ Skor: 510    │   │
│  │ [Kartu Soal] │ │ [Kartu Soal] │ │ [Kartu Soal] │ │ [Kartu Soal] │   │
│  │ Opsi A/B/C/D │ │ Opsi A/B/C/D │ │ Opsi A/B/C/D │ │ Opsi A/B/C/D │   │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

### Aturan Strict UI Mutex:
1. **Status `traveling` (Avatar Berjalan):**
   - Row 1 menampilkan animasi langkah kaki avatar berpindah dari Node A ke Node B.
   - Row 2 menampilkan status `"Sedang Berjalan ke Lokasi..."` dengan kartu soal disembunyikan/dikunci.
   - Tidak ada soal atau pilihan jawaban yang dirender.
2. **Status `challenge` (Gerbang Quest):**
   - Avatar berhenti di depan gerbang.
   - Row 2 membuka kartu soal dengan tipografi Arab 16pt / Lontara yang lega (line-height 2.0).
   - Opsi jawaban A/B/C/D aktif untuk menerima input kontroler.
3. **Status `fishing` (Dermaga Pancing):**
   - Avatar berada di dermaga melempar kail. Row 1 menampilkan animasi air dan pelampung bergoyang.
   - Row 2 menampilkan target ikan dan nilai poin tangkapan.

---

## 3. 4-STATE VIEW SWITCHER DI KONTROLER HP SISWA

Kontroler HP (`/controller`) dirancang ultra-ringan berbasis HTML5, CSS Grid, dan SVG Mini-Map Strip (tanpa canvas berat) agar lancar di HP Android RAM 2 GB:

```
┌──────────────────────────────────────────────────────────┐
│              KONTROLER HP (VIEW SWITCHER)                │
└────────────────────────────┬─────────────────────────────┘
                             │
       ┌─────────────────────┼─────────────────────┐
       ▼                     ▼                     ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   STATE 1    │      │   STATE 2    │      │   STATE 3    │
│    LOBBY     │ ===► │  MAP TRAVEL  │ ===► │  CHALLENGE   │
│ Pilih Tim    │      │ SVG Mini-Map │      │ 4 Tombol     │
│ & 4 Karakter │      │ Avatar Jalan │      │ Warna-Warni  │
└──────────────┘      └──────────────┘      └──────────────┘
                                                   │
                                                   ▼
                                            ┌──────────────┐
                                            │   STATE 4    │
                                            │ FISHING DOCK │
                                            │ Lempar Joran │
                                            │ Tarik Ikan!  │
                                            └──────────────┘
```

1. **State 1 — Lobby & Pemilihan Karakter/Tim:**
   - Siswa memilih stik tim (Merah, Biru, Hijau, Kuning) dan avatar (Putri Hijab, Putri Non-Hijab, Putra Peci, Putra Non-Peci).
2. **State 2 — Map Travel (SVG Mini-Map Strip):**
   - Menampilkan visual progress bar jalur ekspedisi dalam bentuk SVG horisontal sederhana.
   - Layar menampilkan animasi santai melangkah; tombol soal tidak ada di layar (anti-confusion).
3. **State 3 — Question Challenge (4 Kartu Buzzer):**
   - Teks soal guru (Arab/Lontara/Latin) tampil jelas di atas.
   - 4 Tombol besar mudah ditekan jempol (Merah ▲, Biru ◆, Kuning ●, Hijau ■) dengan feedback getar ringan (Haptic Feedback `navigator.vibrate(50)`).
   - **Kunci jawaban tidak ada di payload HP**.
4. **State 4 — Fishing Mini-Game (Dermaga Pancing):**
   - Tombol "Lempar Joran" (Cast Line).
   - Saat umpan disambar ikan, tombol berubah menjadi "Tarik Joran!" (Reel In) dengan animasi keberhasilan dan poin yang diperoleh.

---

## 4. SISTEM 4 KARAKTER SANTUN & INKLUSIF

Semua karakter dirender menggunakan SVG kartun lokal yang santun dan ramah budaya pesantren:
1. `putri_hijab`: Santriwati berhijab rapi dengan tas selempang penuntut ilmu.
2. `putri_non_hijab`: Siswi perempuan berpakaian sopan santun.
3. `putra_peci`: Santri putra berkopiah/peci hitam khas nusantara.
4. `putra_non_peci`: Siswa laki-laki berpakaian rapi dan bersahaja.

---

## 5. SKEMA CHECKPOINT & PENYIMPANAN SESI

Data checkpoint yang disimpan berkala memiliki format JSONB:
```json
{
  "version": 1,
  "roomCode": "X7K9PQ",
  "phase": "challenge",
  "activeNodeId": "gate_1",
  "currentQuestionIndex": 2,
  "virtualTimeElapsedMs": 45000,
  "teamsState": {
    "team-1": {
      "score": 350,
      "correctCount": 3,
      "inventory": ["rod_golden", "bait_sparkling"],
      "characterId": "putri_hijab",
      "currentNodeId": "gate_1"
    }
  },
  "rngSeed": 1284719,
  "updatedAt": "2026-10-18T05:30:00.000Z"
}
```
Ukuran maksimal: **≤ 64 KB**.

---

## 6. KESIAPAN IMPLEMENTASI & FASE BERIKUTNYA

Dengan spesifikasi ini:
- Fase 1 telah menyelesaikan seluruh arsitektur, interface, feature flag, dan dokumen spesifikasi.
- Tidak ada file inti Magguru yang dimodifikasi perilakunya pada Fase 1.
- Seluruh kode modul baru terisolasi di `src/modules/souq-fishing/`.
