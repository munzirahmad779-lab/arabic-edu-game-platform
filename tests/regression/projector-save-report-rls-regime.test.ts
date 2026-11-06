import { test } from "node:test";
import assert from "node:assert/strict";
import {
  saveProjectorReport,
  type ProjectorReportDb,
  type ProjectorReportDbQuery,
  type ProjectorReportDbResult,
} from "../../src/lib/projector-save-report";

/**
 * Reproduksi setia jalur simpan laporan proyektor terhadap rezim
 * skema + RLS persis supabase/migrations/0001..0080, untuk payload
 * gladi live 6 Nov 2026 (Dars 7 Rumah, room 7LFEZ3 milik guru yang
 * sama, 4 tim, skor 3975/1900/1350/275, 30 soal, tiap tim 4 siswa
 * terdaftar).
 *
 * Rezim yang ditegakkan klien palsu ini:
 * - Grant tabel 0033: authenticated punya select/insert/update/delete
 *   pada room_sessions dan room_session_participants.
 * - RLS rooms (0002): baris rooms hanya terlihat bila teacher_id =
 *   auth.uid() pemanggil, termasuk dari dalam subquery policy tabel
 *   lain (Postgres menerapkan RLS tabel yang dibaca policy).
 * - RLS room_sessions (RLS aktif 0030): SELECT hanya lewat policy
 *   0042 (room induk milik pemanggil); INSERT hanya lewat policy
 *   0080 bila bendera `policyInsertSesi` menyala, dengan WITH CHECK
 *   exists(rooms: id = new.room_id dan teacher_id = uid) yang dibaca
 *   lewat visibilitas rooms di atas. Tanpa policy INSERT sama sekali
 *   Postgres menolak 42501.
 * - RLS room_session_participants: sama, SELECT 0042, INSERT 0080
 *   (bendera `policyInsertPeserta`) dengan WITH CHECK exists lewat
 *   room_sessions (yang visibilitasnya mengikuti 0042) join rooms.
 * - Constraint skema: rooms.code UNIQUE untuk semua baris (23505),
 *   FK room_sessions.room_id -> rooms.id dan participants.session_id
 *   -> room_sessions.id (23503, pemeriksaan FK mengabaikan RLS),
 *   kolom NOT NULL sesuai definisi 0030/0048 (23502).
 * - INSERT ... RETURNING (pola .select().single() supabase-js):
 *   baris hasil harus terlihat oleh policy SELECT tabel itu.
 *
 * Kontrol negatif di bawah membuktikan klien palsu ini sungguh
 * menegakkan rezim: tanpa 0080, gejala produksi pra-0080 (gagal di
 * tahap sesi, 42501) terproduksi persis.
 */

type Row = Record<string, unknown>;

interface DbError {
  code?: string;
  message?: string;
}

const RLS_MSG = (table: string) =>
  `new row violates row-level security policy for table "${table}"`;

class RegimeDb implements ProjectorReportDb {
  rooms: Row[] = [];
  sessions: Row[] = [];
  participants: Row[] = [];
  policyInsertSesi = true;
  policyInsertPeserta = true;
  private roomSeq = 0;
  private sessionSeq = 0;

  constructor(private uid: string) {}

  from(table: string): ProjectorReportDbQuery {
    return new RegimeQuery(this, table);
  }

  // Visibilitas RLS untuk SELECT (dan untuk subquery di dalam policy).
  visibleRows(table: string): Row[] {
    if (table === "rooms") {
      return this.rooms.filter((r) => r.teacher_id === this.uid);
    }
    if (table === "room_sessions") {
      return this.sessions.filter((s) => {
        const room = this.rooms.find((r) => r.id === s.room_id);
        return room !== undefined && room.teacher_id === this.uid;
      });
    }
    return this.participants.filter((p) => {
      const session = this.sessions.find((s) => s.id === p.session_id);
      if (!session) return false;
      const room = this.rooms.find((r) => r.id === session.room_id);
      return room !== undefined && room.teacher_id === this.uid;
    });
  }

  private checkRoomsInsert(v: Row): DbError | null {
    // rooms_insert_own (0002): with check teacher_id = auth.uid()
    if (v.teacher_id !== this.uid) {
      return { code: "42501", message: RLS_MSG("rooms") };
    }
    // NOT NULL 0001: code, teacher_id, snapshot
    for (const col of ["code", "teacher_id", "snapshot"]) {
      if (v[col] === null || v[col] === undefined) {
        return {
          code: "23502",
          message: `null value in column "${col}" of relation "rooms" violates not-null constraint`,
        };
      }
    }
    // UNIQUE rooms.code berlaku juga untuk baris yang tak terlihat RLS
    if (this.rooms.some((r) => r.code === v.code)) {
      return {
        code: "23505",
        message:
          'duplicate key value violates unique constraint "rooms_code_key"',
      };
    }
    return null;
  }

  private checkSessionInsert(v: Row): DbError | null {
    // NOT NULL 0030: room_id, session_number
    for (const col of ["room_id", "session_number"]) {
      if (v[col] === null || v[col] === undefined) {
        return {
          code: "23502",
          message: `null value in column "${col}" of relation "room_sessions" violates not-null constraint`,
        };
      }
    }
    // FK ke rooms.id (mengabaikan RLS)
    if (!this.rooms.some((r) => r.id === v.room_id)) {
      return {
        code: "23503",
        message:
          'insert or update on table "room_sessions" violates foreign key constraint "room_sessions_room_id_fkey"',
      };
    }
    // Policy INSERT 0080: exists(rooms terlihat RLS: id = room_id dan
    // teacher_id = uid). Tanpa policy, insert selalu ditolak.
    if (!this.policyInsertSesi) {
      return { code: "42501", message: RLS_MSG("room_sessions") };
    }
    const visible = this.visibleRows("rooms").some(
      (r) => r.id === v.room_id && r.teacher_id === this.uid,
    );
    if (!visible) {
      return { code: "42501", message: RLS_MSG("room_sessions") };
    }
    return null;
  }

  private checkParticipantInsert(v: Row): DbError | null {
    // NOT NULL 0030: session_id, participant_name, final_score, rank,
    // correct_count, total_questions (student_id 0048 boleh null)
    for (const col of [
      "session_id",
      "participant_name",
      "final_score",
      "rank",
      "correct_count",
      "total_questions",
    ]) {
      if (v[col] === null || v[col] === undefined) {
        return {
          code: "23502",
          message: `null value in column "${col}" of relation "room_session_participants" violates not-null constraint`,
        };
      }
    }
    // FK ke room_sessions.id (mengabaikan RLS)
    if (!this.sessions.some((s) => s.id === v.session_id)) {
      return {
        code: "23503",
        message:
          'insert or update on table "room_session_participants" violates foreign key constraint "room_session_participants_session_id_fkey"',
      };
    }
    // Policy INSERT 0080: exists(room_sessions terlihat 0042 join
    // rooms: id = session_id dan rooms.teacher_id = uid)
    if (!this.policyInsertPeserta) {
      return { code: "42501", message: RLS_MSG("room_session_participants") };
    }
    const visible = this.visibleRows("room_sessions").some(
      (s) => s.id === v.session_id,
    );
    if (!visible) {
      return { code: "42501", message: RLS_MSG("room_session_participants") };
    }
    return null;
  }

  insertRows(
    table: string,
    values: Row[],
  ): { rows: Row[]; error: DbError | null } {
    const check =
      table === "rooms"
        ? (v: Row) => this.checkRoomsInsert(v)
        : table === "room_sessions"
          ? (v: Row) => this.checkSessionInsert(v)
          : (v: Row) => this.checkParticipantInsert(v);
    // Insert banyak baris bersifat atomik: satu baris gagal, semua batal.
    for (const v of values) {
      const error = check(v);
      if (error) return { rows: [], error };
    }
    const inserted = values.map((v) => {
      if (table === "rooms") return { id: `room-${++this.roomSeq}`, ...v };
      if (table === "room_sessions") {
        return { id: `session-${++this.sessionSeq}`, ...v };
      }
      return { ...v };
    });
    if (table === "rooms") this.rooms.push(...inserted);
    else if (table === "room_sessions") this.sessions.push(...inserted);
    else this.participants.push(...inserted);
    // RETURNING: hanya baris yang terlihat policy SELECT yang kembali.
    const visibleIds = new Set(
      this.visibleRows(table).map((r) => r.id),
    );
    return {
      rows: inserted.filter((r) => table === "room_session_participants" || visibleIds.has(r.id)),
      error: null,
    };
  }
}

class RegimeQuery implements ProjectorReportDbQuery {
  private mode: "select" | "insert" | null = null;
  private insertValues: Row[] = [];
  private filters: Array<[string, unknown]> = [];
  private orderSpec: { column: string; ascending: boolean } | null = null;
  private limitCount: number | null = null;

  constructor(
    private db: RegimeDb,
    private table: string,
  ) {}

  select(): ProjectorReportDbQuery {
    if (this.mode === null) this.mode = "select";
    return this;
  }

  insert(values: Row | Row[]): ProjectorReportDbQuery {
    this.mode = "insert";
    this.insertValues = Array.isArray(values) ? values : [values];
    return this;
  }

  eq(column: string, value: unknown): ProjectorReportDbQuery {
    this.filters.push([column, value]);
    return this;
  }

  order(
    column: string,
    options: { ascending: boolean },
  ): ProjectorReportDbQuery {
    this.orderSpec = { column, ascending: options.ascending };
    return this;
  }

  limit(count: number): ProjectorReportDbQuery {
    this.limitCount = count;
    return this;
  }

  private runSelect(): Row[] {
    let rows = this.db.visibleRows(this.table);
    for (const [col, val] of this.filters) {
      rows = rows.filter((r) => r[col] === val);
    }
    if (this.orderSpec) {
      const { column, ascending } = this.orderSpec;
      rows = [...rows].sort((a, b) => {
        const av = Number(a[column] ?? 0);
        const bv = Number(b[column] ?? 0);
        return ascending ? av - bv : bv - av;
      });
    }
    if (this.limitCount !== null) rows = rows.slice(0, this.limitCount);
    return rows;
  }

  async maybeSingle(): Promise<ProjectorReportDbResult<Row>> {
    if (this.mode === "insert") {
      const { rows, error } = this.db.insertRows(this.table, this.insertValues);
      return { data: rows[0] ?? null, error };
    }
    const rows = this.runSelect();
    return { data: rows[0] ?? null, error: null };
  }

  async single(): Promise<ProjectorReportDbResult<Row>> {
    if (this.mode === "insert") {
      const { rows, error } = this.db.insertRows(this.table, this.insertValues);
      if (error) return { data: null, error };
      if (rows.length === 0) {
        return { data: null, error: { message: "Results contain 0 rows" } };
      }
      return { data: rows[0] ?? null, error: null };
    }
    const rows = this.runSelect();
    if (rows.length === 0) {
      return { data: null, error: { message: "Results contain 0 rows" } };
    }
    return { data: rows[0] ?? null, error: null };
  }

  then<TResult1 = ProjectorReportDbResult<unknown>, TResult2 = never>(
    onFulfilled?:
      | ((
          value: ProjectorReportDbResult<unknown>,
        ) => TResult1 | PromiseLike<TResult1>)
      | null,
    onRejected?:
      | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
      | null,
  ): Promise<TResult1 | TResult2> {
    const executed: ProjectorReportDbResult<unknown> =
      this.mode === "insert"
        ? (() => {
            const { error } = this.db.insertRows(
              this.table,
              this.insertValues,
            );
            return { data: null, error };
          })()
        : { data: this.runSelect(), error: null };
    return Promise.resolve(executed).then(onFulfilled, onRejected);
  }
}

const GURU = "guru-yusuff";

// Payload persis gladi 6 Nov 2026: 4 tim dengan anggota siswa
// terdaftar, skor dan jumlah benar dari podium gladi, 30 soal.
const GLADI_TEAMS = [
  {
    id: "team-1",
    name: "Tim Merah (الفريق الأحمر)",
    score: 3975,
    correctCount: 27,
    rank: 1,
    members: [
      { id: "s1", name: "Siswa Merah 1" },
      { id: "s2", name: "Siswa Merah 2" },
      { id: "s3", name: "Siswa Merah 3" },
      { id: "s4", name: "Siswa Merah 4" },
    ],
  },
  {
    id: "team-2",
    name: "Tim Biru (الفريق الأزرق)",
    score: 1900,
    correctCount: 17,
    rank: 2,
    members: [
      { id: "s5", name: "Siswa Biru 1" },
      { id: "s6", name: "Siswa Biru 2" },
      { id: "s7", name: "Siswa Biru 3" },
      { id: "s8", name: "Siswa Biru 4" },
    ],
  },
  {
    id: "team-3",
    name: "Tim Hijau (الفريق الأخضر)",
    score: 1350,
    correctCount: 15,
    rank: 3,
    members: [
      { id: "s9", name: "Siswa Hijau 1" },
      { id: "s10", name: "Siswa Hijau 2" },
      { id: "s11", name: "Siswa Hijau 3" },
      { id: "s12", name: "Siswa Hijau 4" },
    ],
  },
  {
    id: "team-4",
    name: "Tim Kuning (الفريق الأصفر)",
    score: 275,
    correctCount: 6,
    rank: 4,
    members: [
      { id: "s13", name: "Siswa Kuning 1" },
      { id: "s14", name: "Siswa Kuning 2" },
      { id: "s15", name: "Siswa Kuning 3" },
      { id: "s16", name: "Siswa Kuning 4" },
    ],
  },
];

function gladiDb(): RegimeDb {
  const db = new RegimeDb(GURU);
  db.rooms.push({
    id: "room-7lfez3",
    code: "7LFEZ3",
    teacher_id: GURU,
    game_id: "game-dars7",
    class_id: "kelas-mangkoso",
    state: "running",
    capacity: 40,
    current_question_index: 30,
    started_at: "2026-11-05T23:20:00.000Z",
    ended_at: null,
    snapshot: { game: { name: "Dars 7 Rumah" }, questions: [] },
  });
  // Satu sesi arsip lama, agar nomor sesi baru harus max+1 = 2.
  db.sessions.push({
    id: "session-arsip",
    room_id: "room-7lfez3",
    session_number: 1,
    started_at: "2026-11-04T23:00:00.000Z",
    ended_at: "2026-11-04T23:30:00.000Z",
  });
  return db;
}

function gladiInput() {
  return {
    teacherId: GURU,
    gameId: "game-dars7",
    gameName: "Dars 7 Rumah",
    classId: "kelas-mangkoso",
    roomCode: "7LFEZ3",
    targetRounds: 30,
    teams: GLADI_TEAMS,
    now: new Date("2026-11-05T23:48:00.000Z"),
  };
}

test("rezim lengkap 0001-0080: payload gladi lolos semua tahap", async () => {
  const db = gladiDb();
  const result = await saveProjectorReport(db, gladiInput());

  assert.equal(result.ok, true, JSON.stringify(result));
  if (!result.ok) return;
  assert.equal(result.reusedRoom, true);
  assert.equal(result.roomId, "room-7lfez3");
  // 4 baris tim + 16 baris anggota
  assert.equal(result.recordedCount, 20);
  assert.equal(db.participants.length, 20);
  // Sesi baru menempel ke room lama dengan nomor max+1
  assert.equal(db.sessions.length, 2);
  const sesi = db.sessions.find((s) => s.id === result.sessionId);
  assert.equal(sesi?.room_id, "room-7lfez3");
  assert.equal(sesi?.session_number, 2);
  // Baris rooms tidak disentuh jalur pakai ulang
  assert.equal(db.rooms.length, 1);
  assert.equal(db.rooms[0]?.state, "running");
  // Skor podium gladi tercatat apa adanya
  const barisTim = db.participants.filter(
    (p) => p.participant_name === "Tim Merah (الفريق الأحمر) (Siswa Merah 1, Siswa Merah 2, Siswa Merah 3, Siswa Merah 4)",
  );
  assert.equal(barisTim.length, 1);
  assert.equal(barisTim[0]?.final_score, 3975);
  assert.equal(barisTim[0]?.correct_count, 27);
  assert.equal(barisTim[0]?.total_questions, 30);
});

test("kontrol negatif tanpa policy INSERT 0080: gagal di tahap session dengan 42501 (gejala produksi pra-0080)", async () => {
  const db = gladiDb();
  db.policyInsertSesi = false;
  db.policyInsertPeserta = false;
  const result = await saveProjectorReport(db, gladiInput());

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.stage, "session");
  assert.match(result.error, /row-level security policy/);
  assert.equal(db.sessions.length, 1); // hanya sesi arsip lama
  assert.equal(db.participants.length, 0);
});

test("kontrol negatif hanya policy INSERT peserta yang hilang: gagal di tahap participants, sesi tertinggal tanpa peserta", async () => {
  const db = gladiDb();
  db.policyInsertPeserta = false;
  const result = await saveProjectorReport(db, gladiInput());

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.stage, "participants");
  // Sesi sempat tertulis tetapi tanpa peserta: persis keadaan yang
  // membuat teacher_daily_report (join dari room_session_participants)
  // menampilkan Total Sesi 0 walau tahap sesi sebenarnya lolos.
  assert.equal(db.sessions.length, 2);
  assert.equal(db.participants.length, 0);
});
