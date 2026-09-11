# PROJECT_PROGRESS.md

Dokumen ini mencatat status implementasi AKTUAL.

`PROJECT_CONTEXT.md` tetap menjadi sumber kebenaran untuk arsitektur dan keputusan yang dikunci.

Chat berikutnya harus dapat melanjutkan pekerjaan hanya dengan membaca:
1. `PROJECT_CONTEXT.md`
2. `PROJECT_PROGRESS.md`

---

# CURRENT PHASE

**Phase 1 — Foundation**

# CURRENT TASK

Phase 1 implementation telah selesai pada versi awal dan kemudian melalui audit/hardening keamanan serta integritas database.

Saat ini Phase 1 berada pada status:

**IMPLEMENTED + AUDITED + HARDENED**

Belum mulai Phase 2.

Phase 2 — Question System hanya dimulai setelah instruksi eksplisit dari pemilik proyek.

---

# COMPLETED

## Foundation

- Next.js 14 App Router
- TypeScript strict
- Tailwind CSS
- Struktur folder:
  - `src/app`
  - `src/lib/supabase`
  - `src/types`
- Supabase integration:
  - browser client
  - server client
  - middleware session refresh
  - protected-route redirect untuk `/dashboard/*`
- Teacher authentication:
  - sign up
  - sign in
  - email/password
  - satu halaman `/login`
- Logout melalui route handler:
  - `POST /auth/logout`
- Dashboard layout melakukan verifikasi sesi server-side sebagai defense-in-depth di atas middleware.
- `profiles` auto-provisioning melalui trigger `handle_new_user()` pada `auth.users`.
- Arabic-first base:
  - `<html lang="ar" dir="rtl">`
  - Arabic-safe font stack.

---

# DATABASE / MIGRATION

Migration schema MVP telah dibuat untuk 10 tabel:

1. `profiles`
2. `classes`
3. `students`
4. `question_categories`
5. `questions`
6. `games`
7. `game_questions`
8. `rooms`
9. `room_participants`
10. `submissions`

`room_events` belum dibuat karena bersifat opsional dan belum ada kebutuhan konkret.

## Poin desain penting

- `questions.type` menggunakan `TEXT + CHECK constraint`, bukan PostgreSQL ENUM.
- MVP hanya mendukung `mcq`.
- `explanation_timing` berada di `game_questions`, bukan `questions`.
- `submissions.selected_option_id` menggunakan opaque option ID, bukan teks jawaban.
- `rooms.snapshot` menyimpan salinan immutable game + questions ketika room dibuat.
- `rooms.capacity` default 30.
- Duplicate submission dicegah dengan:
  - `UNIQUE (room_participant_id, question_id)`
- Satu siswa hanya dapat memiliki satu slot pada satu room:
  - partial unique index pada `(room_id, student_id)`
  - hanya berlaku untuk student, bukan guest.
- Semua tabel memiliki `created_at` dan `updated_at`.
- `updated_at` menggunakan trigger `set_updated_at()`.

## Database hardening

Tambahan hardening telah dilakukan pada `0001_init_schema.sql`:

- `handle_new_user()` sekarang juga menyimpan `full_name` dari `raw_user_meta_data`.
- Identitas participant menggunakan XOR: tepat salah satu dari `student_id` atau `guest_name` harus terisi.
- Ditambahkan database-level relationship integrity melalui SECURITY DEFINER trigger function untuk mencegah hubungan lintas-teacher/tenant.
- Relasi berikut diverifikasi:
  - question ↔ category
  - game ↔ class
  - game_question ↔ game/question
  - room ↔ game/class
  - room_participant ↔ room/student
  - submission ↔ room/participant/question
- Ditambahkan proteksi terhadap perubahan role teacher menjadi admin oleh dirinya sendiri melalui trigger `prevent_teacher_role_escalation()`.
- Foreign key `submissions.room_id` dan `submissions.room_participant_id` menggunakan `ON DELETE RESTRICT`, sehingga historical submissions tidak ikut terhapus ketika room atau participant dihapus.

---

# AUTHENTICATION

Supabase Auth email/password digunakan untuk teacher.

Student tidak menggunakan Supabase Auth pada MVP.

Student identity direncanakan menggunakan:

- name
- PIN 4–6 digit

Implementasi student identity dan PIN verification belum dilakukan pada Phase 1.

Kolom `students.pin_hash` telah disiapkan untuk fase mendatang.

---

# SECURITY / RLS

RLS telah diaktifkan pada seluruh 10 tabel.

Versi implementasi memiliki 35 policy:

| Tabel | Policy |
|---|---|
| `profiles` | select/update own (2) |
| `classes` | full CRUD own (4) |
| `students` | full CRUD via owned class (4) |
| `question_categories` | full CRUD own (4) |
| `questions` | full CRUD own (4) |
| `games` | full CRUD own (4) |
| `game_questions` | full CRUD via owned game (4) |
| `rooms` | full CRUD own (4) |
| `room_participants` | full CRUD via owned room (4) |
| `submissions` | SELECT only via owned room (1) |

## Intentional future RPC boundary

Tidak ada policy anon/student langsung untuk:

- room lookup
- room joining
- student PIN verification
- submission insertion

Akses tersebut harus dimediasi oleh SECURITY DEFINER RPC pada fase mendatang.

Tujuannya agar data snapshot, question payload, dan jawaban tidak bocor melalui anon key.

---

# SECURITY HARDENING AUDIT

Audit terhadap implementasi Phase 1 menemukan dan memperbaiki beberapa kelemahan:

## 1. Cross-tenant relationship integrity

RLS ownership saja tidak cukup untuk menjamin seluruh foreign-key relationship berada pada tenant/teacher yang sama.

Telah ditambahkan database-level integrity checks untuk mencegah:

- question menggunakan category teacher lain
- game menggunakan class teacher lain
- game_question menggunakan question teacher lain
- room menggunakan game/class teacher lain
- participant menggunakan student/class teacher lain
- submission mencampur room, participant, atau question yang tidak sesuai

## 2. Participant identity

Constraint awal mengizinkan `student_id` dan `guest_name` terisi bersamaan.

Telah diubah menjadi XOR:

```sql
check ((student_id is not null) <> (guest_name is not null))
```

## 3. Teacher role escalation

Client tidak boleh menaikkan role dirinya sendiri dari:

```text
teacher → admin
```

Proteksi database-level telah ditambahkan.

## 4. Login redirect

`redirectTo` dari query parameter tidak lagi diteruskan secara bebas ke `router.replace()`.

Hanya path internal yang dimulai dengan `/` dan bukan `//` yang diterima.

Fallback:

```text
/dashboard
```

## 5. Error information disclosure

`error.message` mentah tidak lagi ditampilkan pada `src/app/error.tsx`.

User hanya menerima pesan error generik.

## 6. Historical submission deletion

Foreign key submission terhadap room dan participant sebelumnya menggunakan `ON DELETE CASCADE`.

Telah diubah menjadi `ON DELETE RESTRICT` agar historical submissions tetap dipertahankan.

---

# FILES CREATED

## Root configuration

- `package.json`
- `tsconfig.json`
- `next.config.mjs`
- `tailwind.config.ts`
- `postcss.config.mjs`
- `.eslintrc.json`
- `.gitignore`
- `.env.example`

## App Router

- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/app/globals.css`
- `src/app/loading.tsx`
- `src/app/error.tsx`
- `src/app/not-found.tsx`
- `src/app/(auth)/login/page.tsx`
- `src/app/auth/logout/route.ts`
- `src/app/dashboard/layout.tsx`
- `src/app/dashboard/page.tsx`

## Supabase

- `src/lib/supabase/client.ts`
- `src/lib/supabase/server.ts`
- `src/lib/supabase/middleware.ts`
- `src/middleware.ts`

## Types

- `src/types/database.ts`

## Migrations

- `supabase/migrations/0001_init_schema.sql`
- `supabase/migrations/0002_rls_policies.sql`

## Project documentation

- `PROJECT_CONTEXT.md`
- `PROJECT_PROGRESS.md`

---

# FILES MODIFIED DURING HARDENING

- `supabase/migrations/0001_init_schema.sql`
- `supabase/migrations/0002_rls_policies.sql`
- `src/types/database.ts`
- `src/app/(auth)/login/page.tsx`
- `src/app/error.tsx`
- `PROJECT_PROGRESS.md`

`0002_rls_policies.sql` tidak mengalami perubahan struktural terhadap model RLS.

---

# TYPE DEFINITIONS

`src/types/database.ts` adalah hand-written database type yang mengikuti schema migration.

Perubahan hardening:

- `ProfileRole` tetap dipertahankan karena digunakan pada `Row.role`.
- `role` dihapus dari `profiles.Insert`.
- `role` dihapus dari `profiles.Update`.

Dengan demikian client-side database type tidak menyediakan role mutation melalui operasi insert/update biasa.

---

# DEPENDENCIES

Dependency utama:

- `next@14.2.35`
- `react@18.3.1`
- `react-dom@18.3.1`
- `@supabase/ssr@^0.12.7`
- `@supabase/supabase-js@^2.116.0`
- `typescript@^5.5.4`
- `tailwindcss@^3.4.10`
- `autoprefixer@^10.4.20`
- `postcss@^8.4.41`
- `eslint@^8.57.0`
- `eslint-config-next@14.2.35`
- `@types/node`
- `@types/react`
- `@types/react-dom`

Next.js dinaikkan dari 14.2.5 ke 14.2.35 karena security advisory.

`@supabase/ssr` dinaikkan untuk kompatibilitas dengan versi `supabase-js` terbaru yang digunakan.

Server-side Supabase implementation menggunakan API `getAll` / `setAll`, bukan API cookie lama `get` / `set` / `remove`.

---

# TESTS PERFORMED ON ORIGINAL PHASE 1 IMPLEMENTATION

Claude melaporkan test berikut berhasil dijalankan pada environment implementasi awal:

```text
npx tsc --noEmit
→ 0 error

npx next lint
→ 0 warning/error

npx next build
→ sukses
```

PostgreSQL 16 juga digunakan untuk verifikasi migration secara nyata.

Test database awal meliputi:

- `0001_init_schema.sql` → berhasil
- `0002_rls_policies.sql` → berhasil
- 35 policy terverifikasi
- FK/unique/check constraint terverifikasi
- trigger `handle_new_user()` teruji
- isolasi RLS antar-teacher teruji
- direct submission insert ditolak
- anon access terhadap students/rooms/submissions ditolak

Database test `phase1_verify` telah dihapus setelah pengujian.

---

# VERIFICATION STATUS AFTER HARDENING

Versi hardened telah diaudit dan diperbaiki berdasarkan hasil pemeriksaan kode.

Namun, perubahan hardened belum menjalani ulang seluruh rangkaian:

- `npm install`
- `npx tsc --noEmit`
- `npx next lint`
- `npx next build`
- full PostgreSQL migration/RLS regression test

pada environment yang sama setelah seluruh patch diterapkan.

Oleh karena itu status yang benar adalah:

- Original Phase 1 implementation: verified by Claude environment.
- Hardened source: audited and patched.
- Full post-hardening regression verification: **PENDING**.

Jangan menyatakan full verification PASS sebelum test tersebut benar-benar dijalankan.

---

# KNOWN ISSUES

Tidak ada security issue yang diketahui dari audit source pada scope Phase 1 yang belum memiliki mitigasi.

Full regression test setelah hardening masih pending.

---

# BLOCKERS

Tidak ada blocker struktural.

Phase 2 dapat dimulai setelah full regression verification atau sesuai keputusan pemilik proyek.

---

# PHASE 1 BOUNDARY

Phase 1 tidak mencakup:

- Question Bank UI
- Question CRUD
- MCQ payload editor
- Game Builder
- Room joining
- Student PIN verification
- Realtime gameplay
- Scoring engine
- Arabic Chase Race
- Results dashboard

Semua fitur tersebut berada pada fase berikutnya sesuai `PROJECT_CONTEXT.md`.

---

# EXACT NEXT TASK

## Phase 2 — Question System

Setelah pemilik proyek memberikan instruksi eksplisit untuk memulai Phase 2:

1. Finalisasi struktur payload MCQ.
2. Finalisasi validasi payload MCQ.
3. Implementasi Question CRUD.
4. Implementasi Category CRUD.
5. Teacher Question Bank UI:
   - list questions
   - create question
   - edit question
   - delete question
   - category management
6. Validasi ownership/RLS tetap dipertahankan.
7. Arabic-first:
   - RTL
   - Unicode-safe
   - harakat-safe
8. Test Question System.

Phase 2 tidak boleh melompat ke:

- Game Builder
- Room
- Realtime
- Scoring
- Arabic Chase Race

---

# IMPORTANT DECISIONS — IMPLEMENTATION LEVEL

## Authentication

Teacher menggunakan satu halaman gabungan:

```text
/login
```

untuk sign in dan sign up.

## Profile role

`profiles.role` memiliki:

```text
teacher
admin
```

Default:

```text
teacher
```

Role `admin` belum digunakan untuk gating pada Phase 1.

## Question type

Menggunakan:

```text
TEXT + CHECK
```

bukan PostgreSQL ENUM.

MVP:

```text
mcq
```

## Explanation timing

Disimpan pada:

```text
game_questions.explanation_timing
```

bukan `questions`, karena timing explanation merupakan tanggung jawab Game.

## Foreign keys

Mengikuti nama default PostgreSQL:

```text
<table>_<column>_fkey
```

## Student authentication

Tidak menggunakan Supabase Auth.

Student identity:

```text
name + PIN
```

## Room access

Student/anon tidak diberikan direct table access.

Akses akan menggunakan SECURITY DEFINER RPC pada fase mendatang.

---

# CONTINUATION RULES

Chat berikutnya wajib:

1. Membaca `PROJECT_CONTEXT.md` sebagai sumber kebenaran arsitektur.
2. Membaca `PROJECT_PROGRESS.md` sebagai sumber status implementasi aktual.
3. Tidak mengandalkan chat sebelumnya.
4. Tidak menganggap proposal sebagai implementation.
5. Tidak menganggap implementation sebagai verified apabila belum diuji.
6. Tidak mengubah locked decision tanpa persetujuan eksplisit.
7. Tidak memperluas MVP tanpa persetujuan.
8. Mempertahankan server authority untuk:
   - timing
   - scoring
   - submission validation
9. Mempertahankan immutable historical records.
10. Mempertahankan Arabic-first design.
11. Menggunakan increment kecil dan dapat diuji.
12. Sebelum memodifikasi file, audit isi aktual file terlebih dahulu.
13. Jika file sudah aman, jangan melakukan perubahan yang tidak diperlukan.
14. Jika terdapat security/integrity issue, prioritaskan perbaikan sebelum melanjutkan fitur yang bergantung padanya.

---

# HANDOFF PROTOCOL

Setelah setiap phase atau milestone signifikan, `PROJECT_PROGRESS.md` harus diperbarui dengan:

- Current phase
- Current task
- Completed
- Files created
- Files modified
- Database changes
- Security changes
- Tests performed
- Errors found and fixed
- Known issues
- Blockers
- Exact next task
- New implementation-level decisions

Dokumen harus menggambarkan status aktual, bukan status yang direncanakan.

---

# CURRENT PROJECT STATUS

**Architecture:** COMPLETE

**Phase 1 Foundation:** IMPLEMENTED

**Phase 1 Security Audit:** COMPLETE

**Phase 1 Hardening:** COMPLETE

**Historical submission deletion protection:** COMPLETE

**Full post-hardening regression verification:** PENDING

**Phase 2:** NOT STARTED

**Current priority:** Jalankan full regression verification terhadap source hardened, kemudian mulai Phase 2 Question System setelah persetujuan eksplisit pemilik proyek.
