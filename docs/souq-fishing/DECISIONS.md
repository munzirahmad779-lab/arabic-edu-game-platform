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
