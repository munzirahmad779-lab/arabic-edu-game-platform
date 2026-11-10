import { test } from "node:test";
import assert from "node:assert/strict";
import {
  saveProjectorReport,
  type ProjectorReportDb,
  type ProjectorReportDbQuery,
  type ProjectorReportDbResult,
} from "../../src/lib/projector-save-report";

/**
 * Klien basis data palsu dalam memori untuk saveProjectorReport.
 * Meniru dua perilaku basis data asli yang menentukan semantik endpoint:
 * - RLS rooms_select_own: SELECT ke rooms hanya mengembalikan baris
 *   milik guru yang sedang masuk (visibleTeacherId).
 * - UNIQUE rooms.code berlaku untuk SEMUA baris: insert dengan code yang
 *   sudah dipakai baris mana pun (termasuk milik guru lain yang tidak
 *   terlihat RLS) gagal dengan galat berkode 23505.
 */

type Row = Record<string, unknown>;

class FakeDb implements ProjectorReportDb {
  rooms: Row[] = [];
  sessions: Row[] = [];
  participants: Row[] = [];
  games: Row[] = [];
  private roomSeq = 0;
  private sessionSeq = 0;

  constructor(private visibleTeacherId: string) {}

  from(table: string): ProjectorReportDbQuery {
    return new FakeQuery(this, table);
  }

  visibleRows(table: string): Row[] {
    // Tabel games dibaca saveProjectorReport untuk memeriksa cakupan
    // kelas game (class_id) sebelum membuat room baru.
    if (table === "games") return [...this.games];
    const all =
      table === "rooms"
        ? this.rooms
        : table === "room_sessions"
          ? this.sessions
          : this.participants;
    if (table === "rooms") {
      return all.filter((r) => r.teacher_id === this.visibleTeacherId);
    }
    return [...all];
  }

  insertRows(
    table: string,
    values: Row[],
  ): { rows: Row[]; error: { code?: string; message?: string } | null } {
    if (table === "rooms") {
      for (const v of values) {
        if (this.rooms.some((r) => r.code === v.code)) {
          return {
            rows: [],
            error: {
              code: "23505",
              message:
                'duplicate key value violates unique constraint "rooms_code_key"',
            },
          };
        }
      }
      const inserted = values.map((v) => ({
        id: `room-${++this.roomSeq}`,
        ...v,
      }));
      this.rooms.push(...inserted);
      return { rows: inserted, error: null };
    }
    if (table === "room_sessions") {
      const inserted = values.map((v) => ({
        id: `session-${++this.sessionSeq}`,
        ...v,
      }));
      this.sessions.push(...inserted);
      return { rows: inserted, error: null };
    }
    this.participants.push(...values);
    return { rows: values, error: null };
  }
}

class FakeQuery implements ProjectorReportDbQuery {
  private mode: "select" | "insert" | null = null;
  private insertValues: Row[] = [];
  private filters: Array<[string, unknown]> = [];
  private orderSpec: { column: string; ascending: boolean } | null = null;
  private limitCount: number | null = null;

  constructor(
    private db: FakeDb,
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
            const { error } = this.db.insertRows(this.table, this.insertValues);
            return { data: null, error };
          })()
        : { data: this.runSelect(), error: null };
    return Promise.resolve(executed).then(onFulfilled, onRejected);
  }
}

const GURU = "guru-1";
const NOW = new Date("2026-11-05T15:30:00.000Z");

const TEAMS = [
  {
    id: "arcade-run",
    name: "Pesawat Terbang Awan",
    score: 500,
    correctCount: 4,
    rank: 1,
    members: [{ id: "s1", name: "Budi" }],
  },
];

function baseInput(db: FakeDb, roomCode: string) {
  return {
    teacherId: GURU,
    gameId: null,
    gameName: "Dars 7 Rumah",
    classId: null,
    roomCode,
    targetRounds: 30,
    teams: TEAMS,
    now: NOW,
  };
}

test("code belum terdaftar: room baru dibuat persis perilaku lama", async () => {
  const db = new FakeDb(GURU);
  const result = await saveProjectorReport(db, baseInput(db, "NEW123"));

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.reusedRoom, false);
  assert.equal(db.rooms.length, 1);
  const room = db.rooms[0];
  assert.equal(room?.code, "NEW123");
  assert.equal(room?.teacher_id, GURU);
  assert.equal(room?.state, "ended");
  assert.equal(room?.current_question_index, 30);
  assert.deepEqual(room?.snapshot, {
    game: { id: null, name: "Dars 7 Rumah", mode: "projector" },
    targetRounds: 30,
  });
  assert.equal(db.sessions.length, 1);
  assert.equal(db.sessions[0]?.room_id, result.roomId);
  assert.equal(db.sessions[0]?.session_number, 1);
  // 1 baris tim + 1 baris anggota, menempel ke sesi baru
  assert.equal(result.recordedCount, 2);
  assert.equal(db.participants.length, 2);
  assert.ok(
    db.participants.every((p) => p.session_id === result.sessionId),
  );
  assert.equal(db.participants[0]?.participant_name, "Pesawat Terbang Awan (Budi)");
  assert.equal(db.participants[1]?.participant_name, "Budi [Pesawat]");
});

test("code sudah terdaftar milik guru yang sama: sesi menempel ke room lama, baris rooms tidak berubah", async () => {
  const db = new FakeDb(GURU);
  const snapshotAsli = {
    game: { id: "game-1", name: "Dars 7 Rumah", mode: "competitive" },
    questions: [{ id: "q1" }],
  };
  db.rooms.push({
    id: "room-lama",
    code: "7LFEZ3",
    teacher_id: GURU,
    game_id: "game-1",
    class_id: "kelas-1",
    state: "running",
    capacity: 30,
    current_question_index: 3,
    started_at: "2026-11-05T13:00:00.000Z",
    ended_at: null,
    snapshot: snapshotAsli,
  });
  db.sessions.push({
    id: "session-arsip",
    room_id: "room-lama",
    session_number: 2,
    started_at: "2026-11-04T13:00:00.000Z",
    ended_at: "2026-11-04T13:30:00.000Z",
  });

  const result = await saveProjectorReport(db, baseInput(db, "7LFEZ3"));

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.reusedRoom, true);
  assert.equal(result.roomId, "room-lama");
  // Tidak ada room baru, room lama utuh termasuk state yang masih hidup
  assert.equal(db.rooms.length, 1);
  assert.equal(db.rooms[0]?.state, "running");
  assert.equal(db.rooms[0]?.current_question_index, 3);
  assert.equal(db.rooms[0]?.ended_at, null);
  assert.deepEqual(db.rooms[0]?.snapshot, snapshotAsli);
  // Sesi baru bernomor max+1 mengikuti konvensi archive_room_session
  assert.equal(db.sessions.length, 2);
  const sesiBaru = db.sessions.find((s) => s.id === result.sessionId);
  assert.equal(sesiBaru?.room_id, "room-lama");
  assert.equal(sesiBaru?.session_number, 3);
  assert.equal(db.participants.length, 2);
  assert.ok(
    db.participants.every((p) => p.session_id === result.sessionId),
  );
});

test("code terdaftar milik guru lain: laporan tidak menulis ke room guru lain, tercatat di room baru berkode cadangan", async () => {
  const db = new FakeDb(GURU);
  db.rooms.push({
    id: "room-guru-lain",
    code: "7LFEZ3",
    teacher_id: "guru-lain",
    game_id: "game-9",
    class_id: null,
    state: "running",
    capacity: 30,
    current_question_index: 0,
    started_at: null,
    ended_at: null,
    snapshot: { game: { name: "Milik guru lain" } },
  });

  const result = await saveProjectorReport(db, {
    ...baseInput(db, "7LFEZ3"),
    generateCode: () => "PROJ-CADANGAN",
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.reusedRoom, false);
  assert.notEqual(result.roomId, "room-guru-lain");
  // Room guru lain utuh: tidak ada sesi atau peserta yang menempel ke sana
  assert.equal(db.rooms.length, 2);
  assert.equal(db.sessions.length, 1);
  assert.equal(db.sessions[0]?.room_id, result.roomId);
  const roomBaru = db.rooms.find((r) => r.id === result.roomId);
  assert.equal(roomBaru?.code, "PROJ-CADANGAN");
  assert.equal(roomBaru?.teacher_id, GURU);
  assert.equal(
    db.sessions.some((s) => s.room_id === "room-guru-lain"),
    false,
  );
});

test("game terikat kelas lain dari kelas bermain: room baru ber-class_id null, playedClassId tercatat di snapshot", async () => {
  const db = new FakeDb(GURU);
  // Game terikat ke "kelas-game", tetapi guru memainkannya untuk
  // "kelas-bermain" dari Kelola Tim. Di basis data asli, insert room
  // dengan class_id "kelas-bermain" ditolak trigger P0001; class_id
  // null yang lolos.
  db.games.push({ id: "game-terikat", teacher_id: GURU, class_id: "kelas-game" });

  const result = await saveProjectorReport(db, {
    ...baseInput(db, "SCOPED1"),
    gameId: "game-terikat",
    classId: "kelas-bermain",
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.reusedRoom, false);
  assert.equal(db.rooms.length, 1);
  const room = db.rooms[0];
  assert.equal(room?.game_id, "game-terikat");
  assert.equal(room?.class_id, null);
  assert.deepEqual(room?.snapshot, {
    game: { id: "game-terikat", name: "Dars 7 Rumah", mode: "projector" },
    targetRounds: 30,
    playedClassId: "kelas-bermain",
  });
  // Sesi dan peserta tetap tercatat menempel ke room baru
  assert.equal(db.sessions.length, 1);
  assert.equal(db.sessions[0]?.room_id, result.roomId);
  assert.equal(db.participants.length, 2);
});

test("game terikat kelas yang sama dengan kelas bermain: class_id room tetap kelas itu, tanpa playedClassId", async () => {
  const db = new FakeDb(GURU);
  db.games.push({ id: "game-terikat", teacher_id: GURU, class_id: "kelas-sama" });

  const result = await saveProjectorReport(db, {
    ...baseInput(db, "SCOPED2"),
    gameId: "game-terikat",
    classId: "kelas-sama",
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(db.rooms.length, 1);
  const room = db.rooms[0];
  assert.equal(room?.class_id, "kelas-sama");
  assert.deepEqual(room?.snapshot, {
    game: { id: "game-terikat", name: "Dars 7 Rumah", mode: "projector" },
    targetRounds: 30,
  });
});

test("game tanpa class_id: perilaku lama persis, class_id room mengikuti kelas bermain", async () => {
  const db = new FakeDb(GURU);
  db.games.push({ id: "game-bebas", teacher_id: GURU, class_id: null });

  const result = await saveProjectorReport(db, {
    ...baseInput(db, "BEBAS1"),
    gameId: "game-bebas",
    classId: "kelas-bermain",
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(db.rooms.length, 1);
  const room = db.rooms[0];
  assert.equal(room?.class_id, "kelas-bermain");
  assert.deepEqual(room?.snapshot, {
    game: { id: "game-bebas", name: "Dars 7 Rumah", mode: "projector" },
    targetRounds: 30,
  });
});
