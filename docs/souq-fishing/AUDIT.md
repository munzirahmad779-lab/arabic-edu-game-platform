# DOKUMEN AUDIT FASE 0: EKSPEDISI PASAR & DERMAGA PANCING (SOUQ & FISHING)
**Platform:** Magguru (`magguru.web.id`)  
**Status:** SELESAI & MENUNGGU PERSETUJUAN AHMAD ("LANJUT FASE 1")  
**Tanggal:** 18 Oktober 2026  
**Auditor:** Senior Engine Architect (Antigravity)

---

## 1. BASELINE REPOSITORI & METRIK KUALITAS (RULE 1 & 4)

Sebelum analisis arsitektur dimulai, baseline penuh telah dijalankan pada repositori branch `main` (commit `c0644d9`). Seluruh gate lulus tanpa modifikasi kode yang sudah ada:

| Perintah Pengujian | Status | Ringkasan Output Riil |
| :--- | :---: | :--- |
| `npm run typecheck` (`tsc --noEmit`) | **LULUS** | 0 error. TypeScript 5.5.4 bersih. |
| `npm run lint` (`next lint`) | **LULUS** | 0 error, 1 peringatan pra-eksisting (`src/app/join/room/page.tsx:361:6` - missing dependency in `useEffect`). |
| `npm run test:doctor` (`database-doctor.mjs`) | **LULUS** | 13/13 database invariants terverifikasi sukses. |
| `npm run test` (`tsx --test`) | **LULUS** | 81/81 tes lolos dari 33 berkas pengujian. |
| `npm run build` (`next build`) | **LULUS** | 36 rute sukses terkompilasi. Ukuran First Load JS bersama: 87.4 kB. |

### Metrik Ukuran Rute Terkait (First Load JS)
- `/dashboard/games/[gameId]/projector`: 20.6 kB (First load: 117 kB)
- `/controller`: 177 B (First load: 100 kB)
- `/join/room`: 62.2 kB (First load: 220 kB)
- `/dashboard/games`: 5.14 kB (First load: 101 kB)

---

## 2. HASIL AUDIT 10 BIDANG INTI MAGGURU

### 1. Lingkungan & Dependensi
- **Next.js:** `14.2.35` (App Router)
- **React:** `18.3.1` (Client & Server Components)
- **TypeScript:** `5.5.4` (Strict Mode aktif)
- **Package Manager:** `npm`
- **Konvensi Penamaan:** Kebab-case untuk rute dan komponen berkas (`game-mode-selector.tsx`), PascalCase untuk React Component, camelCase untuk utilitas/adapters.
- **Dependensi Baru:** **0 dependensi baru**. Semua kebutuhan visual peta, mini-map strip, RNG bersemi, dan timer murni dibuat menggunakan native SVG, CSS Grid/Flexbox, dan JavaScript murni.

### 2. Registri Tipe Game & Alur Guru
- **Registri Inti:** `src/lib/game-engine/registry.ts` mengelola `DEFINITIONS` (`runner`, `matching`, `penalty`, `anagram`, `quiz`).
- **Pilihan Guru di Dashboard:** `src/app/dashboard/games/game-mode-selector.tsx` mendefinisikan array `NATIVE_GAME_ENGINES`.
  - Guru memilih mesin (misalnya `kahoot`, `airplane`, `whack`).
  - Form HTML mengirimkan `game_type = "quiz"` (memenuhi constraint database Postgres) dan `game_theme = "<nama_engine>"`.
  - Ini adalah pola arsitektur terbaik: modul game baru `souq_fishing` dapat didaftarkan sebagai native engine dengan `game_type = "quiz"` tanpa perlu mengubah batasan tabel database `games_game_type_check`.

### 3. Arsitektur & Siklus Room
- **Tabel:** `rooms` (`id`, `code`, `teacher_id`, `state`, `snapshot`, `capacity`, `current_question_index`).
- **Snapshot Soal:** Kolom `snapshot` (`jsonb`) membekukan data game dan daftar pertanyaan `{ game: {...}, questions: [...] }` saat room dibuat.
- **Siklus Status:** `waiting` -> `running` -> `ended` / `locked`.
- **Kode Room:** 6 karakter alfanumerik huruf kapital (mis. `X7K9PQ`) atau kode hotseat proyektor.

### 4. Peserta & Manajemen Tim
- **Model Siswa:**
  - Tamu: Nama panggilan + token UUID acak (`room_participants.join_token`).
  - Santri: Login akun madrasah/PIN (`students.id`).
- **Pembagian Tim di Proyektor:**
  - 4 Tim default: Tim 1 (Merah), Tim 2 (Biru), Tim 3 (Hijau), Tim 4 (Kuning).
  - Pada proyektor (`ProjectorScreen`), tim dialokasikan di client-side state dan disimpan ke sesi saat selesai via `/api/projector/save-report`.
  - Siswa yang membuka `/controller` memilih stik tim 1–4 atau otomatis terikat melalui parameter URL `?team=team-X`.

### 5. Transport Real-Time & Evaluasi Vercel Serverless
- **Pola yang Ada:**
  - Route `/api/projector/controller`: Polling client tiap 400ms + HTTP POST event.
  - Memori Global: `globalThis.__projectorControllerStore` di `src/lib/game-engine/projector-controller-store.ts`.
- **Evaluasi Keamanan Serverless Vercel (⚠ BERBEDA):**
  - Pada environment multi-instance serverless Vercel, variabel `globalThis` tidak dibagikan antar-instans kontainer lambda yang berbeda. Jika controller melempar POST ke Instans A, proyektor yang melakukan polling ke Instans B bisa mengalami jeda atau kehilangan event bila hanya mengandalkan RAM semata.
  - **Solusi Adapter Transport & Checkpoint:**
    1. Adapter Transport v1 tetap mendukung jalur cepat `/api/projector/controller` untuk kompatibilitas penuh.
    2. Modul menyediakan sinkronisasi ganda: Supabase Realtime Broadcast channel (`room:<roomCode>`) dan fallback persistence pada `rooms.snapshot->'checkpoint'`.

### 6. Jalur Penulisan Skor & Idempotensi
- **Self-Paced / Siswa Room:** Menggunakan PostgreSQL RPC `submit_game_answer` (`security definer`) yang menulis ke tabel `submissions`.
  - Constraint unik `unique (room_participant_id, question_id)` menjamin jawaban tidak dapat dikirim berulang (idempotent).
- **Proyektor Host:** Menggunakan `POST /api/projector/save-report` yang membuat record di `rooms`, `room_sessions`, dan `room_session_participants`.
- **Privasi Leaderboard:** Didukung penuh melalui enum opsi privasi (`full`, `hidden`, `self_only`).

### 7. Skema Soal & Tipografi (Arab & Lontara)
- **Skema Soal:** Tabel `questions` (`question_text`, `options: jsonb`, `correct_option_key`, `difficulty`, `explanation`, `media`).
- **Teks Arab Sakral:**
  - Didukung melalui `.font-arabic`, font `Traditional Arabic` (16pt), `Amiri`, dan line-height 2.0 (mencegah clipping harakat/tashkeel).
  - Jawaban tidak pernah dicocokkan berdasarkan teks string, melainkan ID opsi (`option_key` atau `option_id`).
- **Teks Bugis (Lontara - Unicode U+1A00–U+1A1F):**
  - Di audit, belum ada konfigurasi font spesifik `Noto Sans Buginese` di `tailwind.config.ts`.
  - **Rekomendasi UI:** Adapter UI Souq & Fishing menyertakan CSS rule font-family fallback `"Noto Sans Buginese", system-ui` agar aksara Lontara tampil tajam dan tidak bergeser saat avatar berjalan atau soal tampil.

### 8. Keamanan & Otorisasi
- **Kerahasiaan Kunci Jawaban (D1 & D8):** Payload yang dikirim ke kontroler HP siswa (`/controller`) hanya berisi ID opsi dan teks soal, **kunci jawaban benar TIDAK PERNAH dikirim ke kontroler sebelum submit**.
- **Otentikasi Host:** Layar proyektor memvalidasi guru melalui `supabase.auth.getUser()`.
- **Otentikasi Siswa:** Dilindungi oleh validitas token UUID `join_token`.

### 9. Sistem UI, Layout Mutex & Audio
- **Framework CSS:** Tailwind CSS 3.4.10.
- **Strict UI Mutex (§17.2):** State `traveling` (avatar berjalan di peta) dan state `challenge` (pertanyaan muncul) dipisahkan secara mutlak melalui Finite State Machine (FSM) di `engine/`. Layar dilarang keras merender modal pertanyaan saat animasi perjalanan sedang berlangsung.
- **Audio:** Menggunakan `src/lib/game-engine/audio-bridge.ts`. Background music mati secara default (D10); SFX langkah kaki, cipratan air, lonceng dermaga, dan lemparan joran aktif.

### 10. Infrastruktur Uji & CI
- Menggunakan Node.js test runner bawaan dengan `tsx` (`npm run test`), lint (`next lint`), typecheck (`npm run typecheck`), dan doctor (`npm run test:doctor`).
- Modul baru `src/modules/souq-fishing` akan dilengkapi suite unit test murni independen di `tests/souq-fishing/` yang langsung terintegrasi ke `npm run test`.

---

## 3. TABEL VERIFIKASI ASUMSI (⚠)

| Asumsi Awal Dokumen | Hasil Verifikasi Kode Nyata | Keterangan & Tindakan |
| :--- | :---: | :--- |
| **⚠ rooms.snapshot membekukan soal** | **TERKONFIRMASI** | File `src/app/join/room/page.tsx` dan RPC `submit_game_answer` membaca `rooms.snapshot->'questions'`. Soal beku saat room dimulai. |
| **⚠ Vercel Serverless aman dengan in-memory store** | **BERBEDA** | `globalThis.__projectorControllerStore` bersifat lokal per proses Node.js. Multi-instance serverless Vercel berisiko desinkronisasi. Ditangani oleh CheckpointStore & Realtime Broadcast. |
| **⚠ joinToken sebagai identitas unik siswa** | **TERKONFIRMASI** | Kolom `room_participants.join_token` bertipe UUID dan divalidasi ketat oleh RPC `submit_game_answer`. |
| **⚠ Skema submissions bersifat idempoten** | **TERKONFIRMASI** | Constraint database menolak duplicate submission untuk `(room_participant_id, question_id)`. |
| **⚠ Penambahan tipe game butuh migrasi database** | **BERBEDA (LEBIH AMAN)** | Native engine di Magguru memakai `game_type = "quiz"` dengan `game_theme = "souq_fishing"`. **Nol migrasi database**, 100% kompatibel. |
| **⚠ 4 Karakter Inklusif Santun** | **TERKONFIRMASI** | 4 karakter (`putri_hijab`, `putri_non_hijab`, `putra_peci`, `putra_non_peci`) dirender via SVG kartun santun tanpa aset pihak ketiga yang berat. |

---

## 4. RANCANGAN 4 ADAPTER (D3) & JEMBATAN `magguru-bridge.ts`

```
┌────────────────────────────────────────────────────────┐
│              WEB MAGGURU (UI & ROUTES)                 │
│  /dashboard/games/...  │  /controller  │  /join/room   │
└───────────────────────────▲────────────────────────────┘
                            │ (Hanya 1 Pintu Masuk/Keluar)
┌───────────────────────────▼────────────────────────────┐
│      src/modules/souq-fishing/bridge/magguru-bridge.ts │
│       - Feature Flag: ENABLE_SOUQ_FISHING_MODULE       │
│       - Mount Hooks & Route Switchers                  │
└───────────────────────────▲────────────────────────────┘
                            │
  ┌─────────────────────────┴─────────────────────────┐
  │                   4 ADAPTERS                      │
  ├─────────────────────┬─────────────────────────────┤
  │ 1. QuestionSource   │ 2. TransportAdapter         │
  │    (Baca Snapshot   │    (Polling HTTP Controller │
  │     & Sanitasi Opsi)│     + Realtime Broadcast)   │
  ├─────────────────────┼─────────────────────────────┤
  │ 3. CheckpointStore  │ 4. ResultSinkAdapter        │
  │    (Simpan state    │    (Tulis skor via RPC /    │
  │     sesi berkala)   │     save-report Proyektor)  │
  └─────────────────────┴─────────────────────────────┘
                            ▲
                            │ Injeksi Dependensi Penuh
┌───────────────────────────┴────────────────────────────┐
│       src/modules/souq-fishing/engine/ (MURNI)         │
│  - world.ts (Peta Pasar & Dermaga)                     │
│  - gates.ts (Gerbang Quest & Syarat Joran/Umpan)       │
│  - fishing.ts (Mekanik Pancing & Kolam Ikan Berpoin)   │
│  - mutex.ts (Strict UI Mutex: Travel vs Challenge)     │
│  - clock.ts & rng.ts (Virtual Clock & Seeded PRNG)     │
└────────────────────────────────────────────────────────┘
```

1. **`QuestionSourceAdapter`:**
   - Membaca soal dari `rooms.snapshot` atau bank soal Magguru.
   - Mengambil soal pilihan ganda, mempertahankan teks Arab (lengkap dengan harakat) dan Lontara apa adanya tanpa normalisasi.
   - Menghapus atribut `is_correct` / `correct_option_key` sebelum payload diserahkan ke kontroler siswa.
2. **`TransportAdapter`:**
   - Mendukung 2 mode transport: (a) HTTP polling `/api/projector/controller` untuk hotseat kelas; (b) Supabase Realtime channel untuk low-latency multi-klien.
3. **`CheckpointStoreAdapter`:**
   - Menyimpan serialisasi state sesi (posisi avatar, gerbang quest yang terbuka, ikan yang didapat, seed RNG, virtual time).
   - Memulihkan sesi seketika saat halaman proyektor atau HP siswa ter-refresh.
4. **`ResultSinkAdapter`:**
   - Untuk Mode Proyektor Tim (Mode A & B): Memanggil `POST /api/projector/save-report` di akhir sesi.
   - Untuk Mode Room Siswa Mandiri (Mode C): Memanggil RPC `submit_game_answer`.

---

## 5. DAFTAR FILE MAGGURU YANG AKAN DISENTUH (TARGET ≤ 5 FILE)

Perubahan pada codebase inti Magguru dibatasi maksimal pada 5 file titik sambung, dan seluruhnya dibungkus feature flag `ENABLE_SOUQ_FISHING_MODULE`:

1. `src/lib/game-engine/registry.ts`:
   - Mendaftarkan entri definisi tipe game `souq_fishing` jika flag aktif.
2. `src/app/dashboard/games/game-mode-selector.tsx`:
   - Menambahkan opsi kartu mesin game `Ekspedisi Pasar & Dermaga Pancing` pada grid seleksi engine proyektor jika flag aktif.
3. `src/app/dashboard/games/[gameId]/projector/projector-screen.tsx`:
   - Menambahkan percabangan `if (activeEngine === "souq_fishing")` untuk merender `<SouqFishingHostScreen />` yang diekspor oleh bridge.
4. `src/app/controller/page.tsx`:
   - Menambahkan deteksi mode `souq_fishing` untuk merender `<SouqFishingMobileController />` (SVG Mini-Map + 4 Tombol Pilihan Opsi, tanpa canvas berat).
5. `src/app/join/room/page.tsx`:
   - Menambahkan percabangan pada mode self-paced untuk merender `<SouqFishingStudentView />` bila room menggunakan engine Souq & Fishing.

---

## 6. KEBUTUHAN MIGRASI DATABASE

- **Kebutuhan Migrasi:** **0 (NOL MIGRASI DATABASE)**.
- **Rasional:**
  - Mengikuti pola mesin arcade Magguru yang sudah terbukti (`airplane`, `whack`, `space`), game disimpan sebagai `game_type = "quiz"` dengan `game_theme = "souq_fishing"`.
  - State checkpoint dan riwayat ekspedisi disimpan di kolom `rooms.snapshot` atau kolom `metadata` pada `room_sessions` yang sudah bertipe `jsonb`.
  - Database production tetap aman tanpa perlu menjalankan skrip DDL SQL baru.

---

## 7. MANAJEMEN RISIKO & MITIGASI

| Risiko | Tingkat | Mitigasi |
| :--- | :---: | :--- |
| **HP Siswa RAM 2 GB Lag/Crash** | Sedang | HP tidak merender Canvas proyektor; hanya HTML/CSS + SVG Strip Mini-Map ringan (< 30 kB). |
| **Tampilan Menumpuk (UI Overlap)** | Tinggi | Strict UI Mutex (§17.2) di engine: state `traveling` dan `challenge` saling mengunci (mutual exclusion). Soal tidak akan pernah dirender saat avatar sedang bergerak. |
| **Teks Arab/Lontara Terpotong** | Sedang | Strict sacred text rule: tanpa normalisasi teks, line-height 2.0+, CSS `dir="rtl"` untuk Arab, font fallback Buginese untuk Lontara. |
| **Jaringan Pesantren Putus-Nyambung** | Tinggi | Kontroler menyimpan pesan niat (intent) secara lokal dan mengulang pengiriman; engine mencatat checkpoint berkala. |
| **Regresi Game Lain** | Tinggi | Zero regression: seluruh logika game baru terisolasi di `src/modules/souq-fishing/`. Baseline CI dijalankan di tiap fase. |

---

---

## 8. PHASE 0 ADDENDUM — CHECKPOINT & TRANSPORT GUARD (MENGIKAT)

Addendum ini mengikat secara hukum arsitektur dan menjadi batas tegas yang wajib dipatuhi modul `souq-fishing`:

### 8.1 Server-Side Namespace & Isolasi Snapshot
1. **Server-Side Only Persistence:** Checkpoint sesi hanya boleh disimpan secara server-side melalui endpoint/bridge berwenang, dilarang keras ditulis langsung dari client siswa.
2. **Namespace Terisolasi:** Data checkpoint wajib menggunakan namespace khusus bertingkat:
   ```json
   snapshot.souq_fishing.checkpoint_v1
   ```
3. **Larangan Overwrite:** Modul **DILARANG KERAS** menimpa atau memodifikasi field bawaan Magguru lainnya di dalam `rooms.snapshot` seperti:
   - `snapshot.game`
   - `snapshot.questions`
   - `snapshot.game_questions`
   - `snapshot.settings`
4. **Merge JSONB Atomik, Versioned & Berbatas Ukuran:**
   - Update checkpoint dilakukan secara atomik menggunakan update `jsonb_set` parsial ber-version (`version: number`).
   - Setiap checkpoint menyertakan timestamp `updated_at` (ISO 8601).
   - **Size Guard:** Payload serialisasi checkpoint dibatasi ketat **maksimal 64 KB** (mencegah bloat pada kolom snapshot).

### 8.2 Tata Kelola Route & RPC Baru (Target 0 Migrasi)
- Modul tetap memegang target **0 migrasi database**.
- Penyimpanan checkpoint proyektor memanfaatkan route server aman yang mengeksekusi update parsial pada tabel `rooms` milik guru.
- Jika di masa mendatang diperlukan RPC Postgres baru, rancangan spesifikasinya wajib ditulis dan dilaporkan ke Ahmad terlebih dahulu untuk persetujuan eksplisit sebelum migrasi apa pun dieksekusi.

### 8.3 Transport Guard: Polling, Throttling & Larangan Broadcast Per-Frame
1. **Dynamic Polling & Exponential Backoff:**
   - **Fase Aktif (Giliran/Input Menunggu):** Polling standar 400ms – 500ms.
   - **Fase Idle/Jeda/Walking Animasi:** Polling melambat otomatis ke 1000ms – 2000ms.
   - **Error / Offline Backoff:** Polling mundur bertahap: 1s -> 2s -> 4s -> max 8s saat jaringan putus.
2. **Koalesensi Event & Batas Laju:**
   - Input cepat (rapid tap) dikonsolidasikan (event debouncing / coalescing) sebelum dikirim ke server.
   - Pembatasan aman: **maksimal 25 pesan per detik** per sesi room.
3. **Larangan Keras Broadcast Per-Frame:**
   - Dilarang mem-broadcast koordinat posisi karakter frame-by-frame (60 FPS) ke jaringan.
   - Yang dikirim hanyalah **niat navigasi discrete** (misal: `{ action: "travel_to", destinationNodeId: "gate_1" }`).
   - Animasi langkah kaki dijalankan 100% lokal di klien masing-masing berdasarkan seed deterministik.

### 8.4 Titik Sanitasi Kunci Jawaban di Bridge (Anti-Cheat & Strict Privacy)
- **Aturan Kerahasiaan Jawaban:** Kunci jawaban (`correctOptionId`, `correct_option_key`, `is_correct`) **DILARANG KERAS** berada di dalam payload apa pun yang dikirim ke kontroler HP siswa atau layar proyektor sebelum waktu pengumuman/reveal tiba.
- **Titik Sanitasi (`QuestionSourceAdapter` & `MagguruBridge`):**
  - Saat membaca raw question dari snapshot, adapter menjalankan fungsi sterilisasi:
    ```typescript
    export function sanitizeQuestionForClient(q: RawQuestion): SanitizedQuestion {
      const { correct_option_key, ...safeQuestion } = q;
      return {
        ...safeQuestion,
        options: q.options.map(({ id, option_key, option_text }) => ({
          id,
          option_key,
          option_text,
        })),
      };
    }
    ```
  - Kunci jawaban asli tetap tersimpan secara privat di Host Engine / server session bridge dan hanya digunakan untuk memverifikasi `intent` jawaban yang dikirimkan siswa.

---

## 9. KESIMPULAN & STATUS FASE 0

Fase 0 (Audit) beserta Addendum Checkpoint & Transport Guard telah lengkap dan terikat secara arsitektur.

