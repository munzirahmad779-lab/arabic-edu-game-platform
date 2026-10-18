# LOG KEPUTUSAN ARSITEKTUR (DECISIONS.MD)
**Proyek:** Ekspedisi Pasar & Dermaga Pancing (Souq & Fishing)  
**Platform:** Magguru (`magguru.web.id`)  

---

### DEC-001: Zero Database Migration via Native Engine Theme
- **Tanggal:** 18 Oktober 2026
- **Status:** Disetujui (Fase 0)
- **Konteks:** Database PostgreSQL memiliki constraint `check (game_type in ('arabic_chase_race', 'quiz', 'runner', 'matching', 'penalty', 'anagram'))`. Mengubah constraint membutuhkan migrasi database pada tabel kritis `games`.
- **Keputusan:** Mengikuti pola engine arkade native Magguru (`airplane`, `whack`, dll.), game disimpan sebagai `game_type = "quiz"` dengan `game_theme = "souq_fishing"`. State checkpoint disimpan di kolom `rooms.snapshot` atau metadata sesi.
- **Dampak:** Nol risiko migrasi database, kompatibilitas 100% dengan RPC pelaporan nilai yang sudah ada.

### DEC-002: Dukungan Tipografi Khusus Lontara (Bugis)
- **Tanggal:** 18 Oktober 2026
- **Status:** Disetujui (Fase 0)
- **Konteks:** Teks soal guru mencakup aksara Bugis/Lontara (Unicode U+1A00–U+1A1F). Font bawaan Tailwind saat ini berfokus pada Arab (Amiri/Traditional Arabic) dan Latin (Inter).
- **Keputusan:** Menambahkan font fallback spesifik `"Noto Sans Buginese", system-ui` pada kelas kontainer teks soal di modul Souq & Fishing tanpa mengganggu stylesheet global Magguru.
- **Dampak:** Aksara Lontara tampil presisi tanpa tumpang tindih tanda baca atau pemotongan glif.

### DEC-003: CheckpointStore Hybrid (Realtime Broadcast + Polling Fallback)
- **Tanggal:** 18 Oktober 2026
- **Status:** Disetujui (Fase 0)
- **Konteks:** Store memori `/api/projector/controller` berada di `globalThis`, yang pada arsitektur serverless multi-instans (Vercel) dapat mengalami state drift jika controller dan proyektor dilayani oleh kontainer serverless berbeda.
- **Keputusan:** CheckpointStore mendukung penyimpanan state sesi di `rooms.snapshot->'checkpoint'` serta channel Supabase Realtime Broadcast untuk sinkronisasi sub-detik yang handal.
- **Dampak:** Ketahanan sesi saat refresh layar proyektor atau HP siswa.

### DEC-004: Rancangan v2.1 — Active Tilt Horizontal + Zona Split 50/50 & Dedicated Lanes
- **Tanggal:** 18 Oktober 2026
- **Status:** Disetujui (Amendemen v2.1)
- **Konteks:** Diperlukan penegasan rasio proyektor kelas yang ergonomis untuk mencegah tabrakan visual antara peta petualangan 2D dan kartu pertanyaan 4 tim santri.
- **Keputusan:**
  1. **Tinggi Grid 58/42:** Baris Atas (`ProjectorWorldMap`) dikunci tepat **58vh** (TIDAK PERNAH dikompresi di bawah 58vh) dan Baris Bawah (`ProjectorFourTeamTables`) dikunci **42vh**.
  2. **Tafsir "Soal 58" sebagai Lebar Horizontal:** Angka alokasi ~55%-58% diterapkan pada sumbu horizontal (`width` / `flex-basis`) kolom `<TeamBox>` tim yang aktif ditantang soal saat $N=1$ (`55% / 15% / 15% / 15%`), bukan sumbu tinggi. Dengan demikian, tinggi peta 58vh tetap utuh dan kartu soal di baris bawah memiliki ruang baca yang sangat lega untuk teks Arab/Lontara.
  3. **Penolakan Take-Over Penuh:** Modul secara tegas menolak pola modal dialog take-over penuh layar (100%), karena akan mematikan pemantauan realtime kelas bagi 3 tim lainnya. Active Tilt Horizontal menjaga keterlihatan seluruh 4 tim secara konstan.
  4. **Zona Visual 50/50 & 4 Dedicated Lanes:** Peta 58vh dibagi seimbang menjadi Kolom Kiri (Zona Daratan Pasar: ALUN, KIOS G1, GERBANG_KANTIN G2, KANTIN) dan Kolom Kanan (Zona Perairan Dermaga: DERMAGA 1, DERMAGA VIP). Setiap tim memiliki jalur koordinat Y terpisah (offset 12px) sehingga avatar tidak bertabrakan, sambil menjaga progresi mesin Fase 1 berjalan deterministik tanpa kebuntuan (deadlock).
- **Dampak:** Zero UI overlap mutlak, keterbacaan teks soal Arab/Lontara optimal, dan pengalaman panggung kelas tetap seru dan adil bagi ke-4 tim.
