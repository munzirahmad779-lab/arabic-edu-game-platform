# PROJECT_CONTEXT.md

# PLATFORM GAME EDUKASI BAHASA ARAB
## Canonical Project Context — Master Specification

> Dokumen ini adalah sumber konteks utama proyek. Chat baru tidak boleh mengandalkan riwayat chat lama. Gunakan dokumen ini sebagai baseline arsitektur, scope MVP, keputusan teknis, dan roadmap.
>
> Status dokumen: **Blueprint/Architecture completed; implementation not yet started.**
>
> Prinsip: jangan mengubah keputusan yang sudah dikunci tanpa persetujuan eksplisit pemilik proyek.

---

# 1. PRODUCT VISION

Proyek ini adalah platform game edukasi Bahasa Arab berbasis web yang memungkinkan:

1. **Guru** membuat materi/soal Bahasa Arab dan menyusun permainan pembelajaran.
2. **Siswa** bergabung ke kelas atau room dan bermain secara real-time.
3. Jawaban siswa dinilai oleh sistem.
4. Hasil/leaderboard dapat ditampilkan sesuai mode dan pengaturan privasi.
5. Arsitektur disiapkan agar nantinya dapat berkembang menjadi beberapa jenis game dan berbagai jenis soal tanpa membangun ulang fondasi sistem.

Fokus awal adalah **game edukasi Bahasa Arab**, bukan platform game umum.

Tujuan desain utama:
- mudah digunakan guru;
- mudah diikuti siswa melalui perangkat masing-masing;
- Arabic-first dan RTL;
- real-time;
- kompetitif tetapi tetap pedagogis;
- akurasi lebih penting daripada kecepatan;
- aman dari manipulasi score oleh client;
- dapat dikembangkan ke game dan question type tambahan.

---

# 2. CORE PRODUCT ARCHITECTURE

Arsitektur utama:

```text
Teacher Application
        │
        ├── Dashboard
        ├── Classes
        ├── Question Bank
        ├── Game Builder
        ├── Room/Lobby
        └── Results
                │
                ▼
          Question Engine
                │
                ▼
            Game Engine
                │
                ▼
       Room / Session System
                │
        ┌───────┴────────┐
        ▼                ▼
Student Application   Realtime
        │
        ▼
Postgres / Supabase
```

Komponen inti:

- **Teacher Application**
- **Student Application**
- **Question Engine**
- **Game Engine**
- **Identity & Access Layer**
- **Postgres Database**
- **Storage**
- **Realtime Layer**
- **Scoring Engine**

### Prinsip arsitektur

**Question Type ≠ Game Type.**

Question Engine bertanggung jawab terhadap struktur dan evaluasi soal.

Game Engine bertanggung jawab terhadap bagaimana soal digunakan dalam permainan.

Contoh:
- MCQ adalah question type.
- Arabic Chase Race adalah game type.

Satu question type nantinya dapat digunakan oleh beberapa game type apabila kompatibel.

**Teacher Platform bukan engine tersendiri.** Ia adalah application/composition layer yang menggunakan Question Engine dan Game Engine.

**Learning Engine** dapat menjadi umbrella/fitur masa depan untuk longitudinal student progress. Pada MVP belum perlu dibuat sebagai engine terpisah.

---

# 3. TECHNOLOGY STACK — LOCKED

| Komponen | Teknologi |
|---|---|
| Frontend / App | Next.js |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Backend / Database | Supabase |
| Database | PostgreSQL |
| Teacher authentication | Supabase Auth |
| Realtime | Supabase Realtime |
| Storage | Supabase Storage |
| Deployment | Vercel |

Arsitektur harus memanfaatkan Supabase secara native sejauh relevan.

---

# 4. QUESTION ENGINE

## 4.1 Konsep

Question Engine adalah sistem soal yang terpisah dari Game Engine.

MVP hanya mengimplementasikan:

**MCQ / Multiple Choice Question.**

Question type yang direncanakan untuk fase berikutnya:

- Multiple Choice
- True/False
- Matching
- Ordering
- Text Answer
- Image-based
- Audio-based
- Reading Passage

Jangan mengimplementasikan question type non-MCQ dalam MVP.

---

## 4.2 Struktur Question

Konsep utama tabel `questions`:

- `id`
- `type`
- `payload` JSON
- metadata umum
- explanation
- category
- tags
- timestamps
- field media yang dapat disiapkan untuk masa depan bila diperlukan

`type` menggunakan enum/question-type classification.

Untuk MCQ, jawaban dinilai berdasarkan **option ID**, bukan pencocokan string.

Ini penting untuk Arabic karena:
- harakat;
- Unicode;
- variasi visual;
- RTL/bidi

tidak boleh menyebabkan jawaban MCQ yang benar gagal hanya karena normalisasi string.

---

## 4.3 Explanation

Question dapat memiliki explanation.

Namun **timing explanation adalah tanggung jawab Game**, bukan Question Engine.

Pilihan timing yang dirancang:

- `after_each_question`
- `after_game_only`
- `never`

---

## 4.4 Categories

Kategori awal dapat mencakup:

- المفردات
- النحو
- الصرف

Kategori harus dapat berkembang.

Tags/metadata dapat digunakan untuk klasifikasi lebih rinci.

---

## 4.5 Text Answer — FUTURE

Text Answer belum masuk MVP.

Jika nanti diterapkan, sistem harus membedakan:

- `exact`
- `normalized`

Normalisasi harus dapat dikontrol karena pada pembelajaran Bahasa Arab, penghilangan perbedaan tertentu dapat justru menghilangkan informasi pedagogis.

Jangan menerapkan normalisasi agresif secara global.

---

# 5. GAME ENGINE

Game Engine menangani:

- game type;
- room/session;
- session state;
- timer;
- scoring;
- leaderboard;
- win condition;
- game mode;
- gameplay state;
- realtime events.

Room state utama:

```text
waiting
running
ended
locked
```

Server menjadi sumber waktu untuk gameplay yang berpengaruh pada score.

---

# 6. GAME BUILDER — TEACHER UX

Teacher tidak perlu melihat kompleksitas internal plugin/game architecture.

MVP Game Builder dibuat sederhana:

1. Game name
2. Fixed game type: Arabic Chase Race
3. Mode:
   - competitive
   - pembelajaran
4. Choose questions
5. Duration
6. Ranking visibility
7. Create room

Game Builder harus menjadi UX sederhana, bukan konfigurasi engine yang kompleks.

Arsitektur internal tetap extensible.

---

# 7. FIRST GAME: ARABIC CHASE RACE

Nama konsep:

**Arabic Chase Race / سباق الكلمات العربية**

## 7.1 Gameplay

- Game berupa lintasan/race track horizontal.
- Setiap siswa memiliki character/marker.
- Guru membuat room.
- Siswa masuk ke lobby.
- Game dimulai dengan countdown:
  `3 - 2 - 1`
- Soal MCQ ditampilkan.
- Jawaban benar memberikan movement/points.
- Kecepatan dapat memberi bonus.
- Namun **accuracy harus selalu lebih dominan daripada speed**.
- Setelah seluruh pertanyaan selesai atau waktu game habis, game berakhir.
- Results/leaderboard ditampilkan sesuai visibility setting.

## 7.2 Visual MVP

Gunakan:
- horizontal SVG/CSS track;
- character sederhana per student;
- movement berdasarkan score.

Tidak perlu pada MVP:
- avatar kompleks;
- obstacles;
- powerups;
- skins;
- sound system kompleks;
- complex animation.

Fitur tersebut dapat masuk fase berikutnya.

---

# 8. SCORING ENGINE

## 8.1 Prinsip

**Accuracy > Speed.**

Kecepatan tidak boleh mengalahkan siswa yang lebih akurat.

Formula dasar yang telah dirancang:

### Correct

```text
score =
(base_score × difficulty_modifier)
+ speed_bonus
+ streak_bonus
```

### Wrong

```text
score = -penalty
```

Default penalty dapat berupa **0**.

Nilai awal yang direkomendasikan:

- base score sekitar 100;
- speed bonus maksimum sekitar 20;
- streak bonus dibatasi/capped sekitar 30.

Angka tersebut dapat dituning ketika implementasi dan testing, tetapi prinsip accuracy-dominant tidak boleh berubah.

---

## 8.2 Timing

Client tidak boleh menjadi sumber waktu yang dipercaya untuk scoring.

Server menghitung:

```text
response_time =
server_received_at - question_start_time
```

Server menetapkan timestamp `T0` ketika question dimulai/dibroadcast.

Gunakan universal grace window sekitar:

```text
400 ms
```

Grace window ditujukan untuk mengurangi bias akibat network latency.

---

## 8.3 Competitive Mode

Karakteristik:

- full scoring;
- speed bonus aktif;
- live leaderboard dapat digunakan;
- no retry pada MVP.

---

## 8.4 Learning Mode

Karakteristik:

- speed diminimalkan atau dimatikan;
- ranking dapat disembunyikan selama permainan;
- explanation dapat digunakan.

**Retry belum masuk MVP.**

Retry adalah kandidat Phase 2.

---

# 9. ROOM / SESSION SYSTEM

Room harus memiliki:

- unique room code;
- state;
- game reference;
- participants;
- start/end state;
- server timing;
- immutable game snapshot.

State:

```text
waiting
running
ended
locked
```

### Late Join

Room dikunci setelah game dimulai untuk mencegah late join pada MVP.

### Room Capacity

MVP target:

**maksimum 30 siswa per room.**

Namun architecture **tidak boleh di-hard-code secara struktural hanya untuk 30**. Angka 30 adalah product constraint MVP dan dapat ditingkatkan kemudian.

---

# 10. STUDENT IDENTITY

## 10.1 Persistent Student Identity

Untuk MVP, siswa **tidak menggunakan Supabase Auth**.

Siswa memiliki identity ringan:

- name
- PIN 4–6 digit
- class association

Identity bersifat persistent di dalam kelas.

Siswa yang sama dapat menggunakan kembali name + PIN pada kelas yang sama.

## 10.2 Scope Identity

Student identity MVP bersifat:

**unique per class**

bukan global across all classes.

## 10.3 Guest Room

Untuk ad-hoc room, guest join dapat tersedia.

## 10.4 Ranking Privacy

Ranking visibility:

- `full`
- `hidden`
- `self_only`

Pengaturan privacy harus ditegakkan server-side/RLS, bukan hanya disembunyikan melalui UI.

---

# 11. TEACHER APPLICATION

MVP teacher flow:

```text
Login
  ↓
Dashboard
  ↓
Class
  ↓
Question Bank
  ↓
Create/Edit MCQ
  ↓
Game Builder
  ↓
Create Room
  ↓
Lobby
  ↓
Run Game
  ↓
Results
```

Teacher features MVP:

- Supabase Auth login;
- dashboard;
- minimal class management;
- MCQ question bank;
- Game Builder;
- create room;
- lobby;
- results.

Tidak masuk MVP:
- advanced content folders;
- cross-teacher content sharing;
- advanced analytics;
- complex authoring system.

---

# 12. STUDENT APPLICATION

MVP flow:

```text
Join Class / Guest Room
       ↓
Name + PIN (class identity)
       ↓
Lobby
       ↓
Countdown
       ↓
Arabic Chase Race
       ↓
Answer MCQ
       ↓
Score / Movement
       ↓
Game Result
```

UI harus mobile-friendly.

---

# 13. REALTIME ARCHITECTURE

Gunakan Supabase Realtime.

Prinsip utama:

> **Broadcast = speed**
>
> **Database = truth**
>
> **Resync = safety net**

## Broadcast

Gunakan Broadcast untuk gameplay events yang membutuhkan kecepatan.

## Presence

Gunakan Presence untuk:
- connection state;
- lobby;
- participant presence.

## Database

Database menjadi source of truth untuk persistent state/results.

## Reconnect

Ketika client reconnect:
- jangan mengandalkan event yang mungkin terlewat;
- lakukan resync dari authoritative database/session state.

---

# 14. DATABASE MODEL

Tabel MVP/arsitektur:

```text
profiles
classes
students
question_categories
questions
games
game_questions
rooms
room_participants
submissions
room_events (optional)
```

## 14.1 profiles

Untuk teacher/user account dan metadata terkait.

## 14.2 classes

Minimal class management.

## 14.3 students

Persistent student identity yang scoped ke class.

## 14.4 question_categories

Kategori question seperti:
- المفردات
- النحو
- الصرف

## 14.5 questions

Question type + payload JSON + common metadata.

## 14.6 games

Konfigurasi game yang dibuat teacher.

## 14.7 game_questions

Relasi game dengan questions dan ordering/configuration.

## 14.8 rooms

Room/session yang aktif atau sudah selesai.

Harus menyimpan **snapshot immutable** pada room creation.

## 14.9 room_participants

Peserta yang tergabung dalam room.

## 14.10 submissions

Jawaban siswa.

Submission bersifat **immutable**.

Score harus dihitung server-side.

## 14.11 room_events

Optional event log untuk kebutuhan tertentu.

Jangan menambahkan kompleksitas event sourcing penuh pada MVP tanpa kebutuhan.

---

# 15. SNAPSHOT / HISTORICAL IMMUTABILITY

Ini adalah keputusan arsitektur penting.

Ketika room dibuat:

```text
Current Game/Questions
        ↓
Immutable Room Snapshot
        ↓
Gameplay
        ↓
Historical Results
```

Historical result **tidak boleh bergantung pada live version dari question/game**.

Jika teacher kemudian mengubah question, hasil room lama tetap merepresentasikan question/game pada saat room dibuat.

`rooms.snapshot` digunakan sebagai immutable historical source.

`submissions` juga immutable.

Analytics masa depan dapat diturunkan dari raw submissions.

---

# 16. SECURITY / AUTHORIZATION

Prinsip security:

- Supabase Auth untuk teacher.
- RLS untuk database access.
- Client tidak boleh menulis score secara langsung.
- Score dihitung oleh server/RPC.
- Writes penting dimediasi melalui RPC.
- Rate limiting diperlukan untuk submission/room operations yang relevan.
- Unique constraints mencegah duplicate submissions/identity conflict.
- Room dikunci setelah game start.
- Server menjadi authority untuk timing.
- Ranking privacy harus ditegakkan server-side/RLS.

Arsitektur MVP:

```text
Client
  ↓
Authorized RPC / controlled write
  ↓
Validation
  ↓
Server-side scoring/state
  ↓
Postgres
```

Jangan menganggap UI hiding sebagai security.

---

# 17. DUPLICATE SUBMISSION PROTECTION

Satu student tidak boleh dapat mengirim jawaban ganda untuk question yang sama secara normal.

Gunakan kombinasi:

- server validation;
- unique constraints;
- immutable submission;
- idempotent/controlled RPC behavior jika relevan.

Race condition harus diuji.

---

# 18. ARABIC-FIRST / RTL REQUIREMENTS

Platform harus didesain **Arabic-first**.

Wajib memperhatikan:

- RTL layout;
- Arabic Unicode;
- harakat;
- mixed bidirectional text;
- Arabic fonts;
- mobile rendering;
- input/display behavior.

Untuk MCQ:
- evaluasi berdasarkan option ID;
- jangan bergantung pada string normalization.

Untuk future Text Answer:
- exact/normalized matching harus eksplisit dan teacher-controlled.

Jangan melakukan Unicode/string normalization global yang dapat merusak makna pedagogis.

---

# 19. MEDIA

**MVP adalah TEXT-ONLY.**

Image/audio **tidak masuk implementasi MVP**.

Schema dapat disiapkan agar media URL dapat ditambahkan pada fase berikutnya jika diperlukan.

Phase 2:
- image-based questions;
- audio-based questions;
- media storage/URL handling.

Jangan menghabiskan effort MVP untuk media.

---

# 20. MVP — INCLUDED

## Teacher

- login;
- dashboard;
- minimal class;
- MCQ question bank;
- Game Builder;
- create room;
- lobby;
- results.

## Student

- class join menggunakan name + PIN;
- guest room join;
- lobby;
- Arabic Chase Race;
- MCQ answering;
- realtime participation;
- personal result sesuai ranking visibility.

## Infrastructure

- Next.js;
- TypeScript;
- Tailwind;
- Supabase;
- PostgreSQL;
- Auth;
- Realtime;
- RLS;
- server-side scoring;
- immutable submissions;
- room snapshot;
- Vercel deployment.

---

# 21. MVP — EXPLICITLY OUT OF SCOPE

Jangan memasukkan fitur berikut ke MVP tanpa persetujuan:

- game types selain Arabic Chase Race;
- question types selain MCQ;
- image/audio implementation;
- retry learning;
- avatar customization;
- powerups;
- obstacles;
- skins;
- complex sound/animation;
- full analytics;
- advanced folders;
- advanced anti-cheat/bot/replay detection;
- cross-teacher content sharing;
- global student identity;
- complex class management;
- unnecessary event-sourcing architecture.

---

# 22. LOCKED DECISIONS

| Area | Locked Decision |
|---|---|
| Stack | Next.js + TypeScript + Tailwind |
| Backend | Supabase |
| DB | PostgreSQL |
| Teacher Auth | Supabase Auth |
| Student Auth | Custom lightweight identity |
| Student Identity Scope | Unique per class |
| Student Identity | Name + 4–6 digit PIN |
| Question Engine | Separate from Game Engine |
| MVP Question Type | MCQ only |
| Game Engine | Core engine + extensible game architecture |
| First Game | Arabic Chase Race |
| Scoring | Accuracy-dominant |
| Speed | Bonus only, never dominant |
| Server Timing | Required for scoring |
| Grace Window | ~400 ms universal target |
| Competitive Mode | Full scoring, no retry |
| Learning Mode | Speed minimized/off, ranking may be hidden |
| Retry | NOT MVP; Phase 2 |
| Room Capacity | 30 students MVP |
| Capacity Architecture | Must not hard-code architecture to 30 |
| Realtime | Broadcast + Presence |
| Database Truth | Authoritative |
| Reconnect | Resync |
| Late Join | Room locked after start |
| Snapshot | Immutable room snapshot |
| Submission | Immutable |
| Score Write | Server-side/RPC |
| Security | RLS + RPC + rate limiting + unique constraints |
| Media | Text-only MVP |
| Ranking Privacy | full / hidden / self_only |
| Analytics | Raw submissions now; advanced analytics later |
| Deployment | Vercel |

---

# 23. IMPORTANT DESIGN PRINCIPLES

## 23.1 Do Not Confuse Question and Game

MCQ is not a game.

Arabic Chase Race is not a question type.

This separation is foundational for extensibility.

## 23.2 Accuracy Dominates Speed

The game is educational.

Speed may add excitement and a limited bonus, but cannot make rapid guessing outperform consistently correct answers.

## 23.3 Server Authority

Never trust client-submitted score or response timing.

## 23.4 Database Is Truth

Realtime improves responsiveness but must not become the sole persistent source of truth.

## 23.5 Historical Immutability

Past game results must remain valid even if questions/games are edited later.

## 23.6 Arabic-First

RTL and Arabic Unicode are first-class requirements, not later polish.

## 23.7 MVP Discipline

Do not add technically interesting features merely because the architecture permits them.

---

# 24. ACCEPTANCE CRITERIA

MVP should satisfy at minimum:

1. Teacher can authenticate.
2. Teacher can create/manage a minimal class.
3. Teacher can create at least 10 MCQ questions.
4. Teacher can create an Arabic Chase Race game/room.
5. At least 3 students can join a class/room.
6. At least 10 students can participate in a realtime game during QA.
7. Lobby updates participant presence appropriately.
8. Game starts through authoritative server/session state.
9. Countdown works.
10. Questions are delivered to students.
11. Correct answers affect movement/score.
12. Speed bonus works without dominating accuracy.
13. Server computes response time.
14. Duplicate submissions are rejected.
15. Room cannot accept late joins after lock/start.
16. Results are persisted.
17. Ranking privacy modes work:
    - full
    - hidden
    - self_only
18. Historical results remain unchanged after source question/game edits.
19. Reconnect can resync state.
20. RLS prevents unauthorized direct data access.
21. Client cannot directly manipulate authoritative score.
22. Arabic RTL renders correctly.
23. Arabic Unicode/harakat render correctly.
24. Mobile touch interaction works.
25. Race conditions around submissions/session state are tested.

---

# 25. QA PLAN

## Security

Test:
- RLS;
- unauthorized class access;
- unauthorized question access;
- unauthorized room access;
- direct score manipulation;
- RPC authorization;
- rate limits;
- duplicate submission.

## Scoring

Unit/integration tests:
- correct answer;
- wrong answer;
- speed bonus;
- streak bonus;
- difficulty modifier;
- penalty;
- grace window;
- slow vs fast correct users;
- accuracy-dominance invariant.

## Timing

Test:
- fast answer;
- delayed answer;
- answer near deadline;
- answer exactly around grace window;
- network delay;
- late submission;
- server/client clock difference.

## Snapshot

Test:
1. Create room.
2. Save snapshot.
3. Edit source question.
4. Verify old room result still uses old snapshot.

## Realtime

Test:
- lobby;
- game start;
- answer events;
- leaderboard;
- disconnect;
- reconnect;
- missed event;
- resync.

## Concurrency

Test:
- multiple students submitting simultaneously;
- duplicate requests;
- race conditions;
- room state transitions.

## UI

Test:
- RTL;
- Arabic text;
- harakat;
- mixed bidi;
- mobile;
- touch;
- common browsers.

---

# 26. ROADMAP

## Phase 0 — Architecture

Completed conceptually.

Deliverables:
- product architecture;
- question/game separation;
- MVP scope;
- database model;
- scoring architecture;
- realtime strategy;
- security strategy.

## Phase 1 — Foundation

Implement:
- Next.js project;
- TypeScript;
- Tailwind;
- Supabase;
- database;
- migrations;
- Auth;
- basic layout;
- RLS foundation.

## Phase 2 — Question System

Implement:
- question categories;
- MCQ schema;
- question CRUD;
- teacher question bank;
- validation.

## Phase 3 — Game Room

Implement:
- games;
- game_questions;
- room creation;
- room code;
- room state;
- snapshot;
- participants.

## Phase 4 — Multiplayer / Realtime

Implement:
- Broadcast;
- Presence;
- lobby;
- server session state;
- reconnect/resync;
- controlled submissions.

## Phase 5 — Arabic Chase Race

Implement:
- race track;
- character movement;
- countdown;
- question display;
- answer interaction;
- scoring;
- speed bonus;
- streak;
- finish condition;
- realtime gameplay.

## Phase 6 — Teacher Results

Implement:
- result dashboard;
- ranking visibility;
- individual result;
- historical room result.

## Phase 7 — Hardening & QA

Implement/test:
- RLS;
- RPC;
- rate limiting;
- duplicate protection;
- timing;
- snapshot;
- concurrency;
- reconnect;
- mobile/RTL;
- browser QA.

## Phase 8 — Additional Games

Potential future:
- other game types;
- additional question types;
- learning-mode enhancements;
- retry;
- image/audio;
- analytics;
- avatars/powerups;
- other extensibility features.

---

# 27. FUTURE EXTENSIBILITY

Architecture should support future game types without changing the Question Engine fundamentally.

Potential future game examples are not locked and should not be implemented unless explicitly approved.

Likewise, additional question types can be introduced through a stable question-type contract.

The system should be extensible but **not over-engineered**.

---

# 28. IMPLEMENTATION ORDER

When development begins, follow this order unless a concrete technical dependency requires adjustment:

```text
1. Project foundation
2. Supabase connection
3. Database schema + migrations
4. RLS
5. Teacher Auth
6. Classes
7. Question categories
8. MCQ Question Bank
9. Games + game_questions
10. Room + snapshot
11. Student identity
12. Room participants
13. Realtime lobby
14. Server-controlled game state
15. Submissions + server scoring
16. Arabic Chase Race UI/gameplay
17. Results
18. Reconnect/resync
19. Security hardening
20. QA
```

Do not jump directly into animations before the authoritative state/scoring architecture works.

---

# 29. DEVELOPMENT STATUS

**Current status:**

```text
Architecture / Blueprint: COMPLETED
Technical decisions: LOCKED for MVP
Implementation: NOT STARTED
```

No existing codebase should be assumed unless a future project state document explicitly says otherwise.

---

# 30. PROJECT CONTINUATION RULES

Any AI working on this project must follow:

1. Treat this document as the canonical project context.
2. Do not rely on previous chat history.
3. Do not claim to remember information that is not in the available project documents.
4. Do not invent missing decisions.
5. Do not silently change locked decisions.
6. Do not expand MVP scope without explicit approval.
7. Preserve existing implementation when code development begins.
8. Before major implementation, identify which part of the architecture is being changed.
9. Prefer small, testable implementation increments.
10. Test security-sensitive and state-sensitive code.
11. Keep server authority for scoring/timing.
12. Keep historical room data immutable.
13. Maintain Arabic RTL requirements throughout development.
14. When uncertain, distinguish clearly between:
    - existing decision;
    - implementation detail;
    - proposal.
15. If proposing a change to a locked decision, explain:
    - current decision;
    - proposed change;
    - reason;
    - consequences;
    - migration/implementation impact;
    - then wait for approval.

---

# 31. CONTEXT / HANDOFF PROTOCOL

Because AI chat usage and context limits can interrupt development, project continuity must not depend on a single chat.

At the end of a substantial development session, maintain a separate state document such as:

`PROJECT_PROGRESS.md`

It should contain:

```text
CURRENT PHASE
CURRENT TASK
COMPLETED
FILES CREATED
FILES MODIFIED
DATABASE CHANGES
DECISIONS MADE
TESTS RUN
KNOWN BUGS
BLOCKERS
NEXT EXACT TASK
```

`PROJECT_CONTEXT.md` remains the stable architecture/specification.

`PROJECT_PROGRESS.md` records changing implementation state.

This separation prevents implementation history from bloating the permanent architecture document.

---

# 32. CANONICAL PROJECT DOCUMENT SET

Recommended Project Knowledge structure:

```text
00_PROJECT_CONTEXT.md
01_PROJECT_PROGRESS.md
02_DATABASE.md
03_GAMEPLAY_SCORING.md
04_SECURITY_REALTIME.md
05_MVP_ACCEPTANCE_QA.md
```

For initial continuity, `00_PROJECT_CONTEXT.md` is the master source.

Additional documents can be added when implementation becomes large.

---

# 33. FINAL SOURCE-OF-TRUTH STATEMENT

This project is a **web-based Arabic educational game platform** whose MVP consists of:

- teacher authentication;
- minimal classes;
- MCQ question bank;
- simple Game Builder;
- realtime room/lobby;
- lightweight per-class student identity;
- Arabic Chase Race;
- server-authoritative accuracy-dominant scoring;
- ranking privacy controls;
- immutable room snapshots and submissions;
- Supabase/PostgreSQL/RLS/Realtime;
- RTL Arabic-first UI;
- Vercel deployment.

The MVP intentionally excludes retry, media, additional games/question types, advanced analytics, advanced anti-cheat, and other nonessential complexity.

**This is the baseline. Do not modify it silently.**
