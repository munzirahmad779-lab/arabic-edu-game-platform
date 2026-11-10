/**
 * Penyimpanan laporan hasil permainan proyektor ke tabel rooms /
 * room_sessions / room_session_participants, dipakai oleh
 * POST /api/projector/save-report.
 *
 * Semantik room:
 * - Bila `code` sudah terdaftar sebagai room MILIK guru yang sama, baris
 *   rooms itu dipakai ulang apa adanya: sesi laporan baru menempel ke
 *   room tersebut. Baris rooms TIDAK diubah sama sekali (state, snapshot,
 *   started_at/ended_at, current_question_index tetap milik alur room),
 *   karena room kelas bisa masih hidup dan siklus hidupnya diatur alur
 *   room sendiri. Pembaca laporan (teacher_daily_report, list_room_sessions)
 *   membaca lewat room_sessions + room_session_participants dan tidak
 *   menyaring rooms.state, jadi laporan tetap tercatat dan terbaca di
 *   tempat yang sama.
 * - Nomor sesi mengikuti konvensi archive_room_session: max+1 per room.
 * - Bila code belum terdaftar, baris rooms baru dibuat persis seperti
 *   perilaku lama (state "ended" + snapshot ringkas) dan sesi bernomor 1.
 * - Bila code terdaftar atas nama guru lain (tidak terlihat oleh RLS
 *   rooms_select_own, tetapi insert menabrak UNIQUE rooms.code), laporan
 *   TIDAK ditulis ke room guru lain; penyimpanan dicoba ulang sekali
 *   dengan kode cadangan baru agar laporan tetap tercatat atas nama
 *   guru pemanggil di room barunya sendiri.
 * - Game bisa terikat satu kelas (games.class_id terisi), sementara guru
 *   boleh memainkannya untuk kelas lain yang dipilih di Kelola Tim.
 *   Trigger assert_project_relationship_integrity menolak room baru
 *   (P0001) bila class_id room berbeda dari kelas game yang terikat,
 *   tetapi class_id NULL selalu lolos. Jadi pada cabang buat-baru, bila
 *   game terikat kelas yang berbeda dari kelas bermain, room dibuat
 *   dengan class_id NULL dan kelas yang benar-benar bermain dicatat di
 *   snapshot sebagai playedClassId agar informasinya tidak hilang.
 *
 * Klien basis data disuntikkan sebagai antarmuka struktural minimal agar
 * fungsi ini bisa diuji unit dengan klien palsu (lihat
 * tests/regression/projector-save-report.test.ts).
 */

export interface ProjectorReportDbError {
  code?: string;
  message?: string;
}

export interface ProjectorReportDbResult<T> {
  data: T | null;
  error: ProjectorReportDbError | null;
}

export interface ProjectorReportDbQuery extends PromiseLike<
  ProjectorReportDbResult<unknown>
> {
  select(columns: string): ProjectorReportDbQuery;
  insert(
    values: Record<string, unknown> | Array<Record<string, unknown>>,
  ): ProjectorReportDbQuery;
  eq(column: string, value: unknown): ProjectorReportDbQuery;
  order(
    column: string,
    options: { ascending: boolean },
  ): ProjectorReportDbQuery;
  limit(count: number): ProjectorReportDbQuery;
  maybeSingle(): Promise<ProjectorReportDbResult<Record<string, unknown>>>;
  single(): Promise<ProjectorReportDbResult<Record<string, unknown>>>;
}

export interface ProjectorReportDb {
  from(table: string): ProjectorReportDbQuery;
}

export interface ProjectorSaveReportTeam {
  id: string;
  name: string;
  score: number;
  correctCount: number;
  rank?: number;
  members?: Array<{ id: string; name: string }>;
}

export interface SaveProjectorReportInput {
  teacherId: string;
  gameId: string | null;
  gameName?: string;
  classId: string | null;
  roomCode?: string;
  targetRounds: number;
  teams: ProjectorSaveReportTeam[];
  /** Disuntikkan untuk uji; bawaan waktu nyata. */
  now?: Date;
  /** Disuntikkan untuk uji; bawaan pola kode lama "PROJ-XXXXX". */
  generateCode?: () => string;
}

export type SaveProjectorReportResult =
  | {
      ok: true;
      roomId: string;
      sessionId: string;
      recordedCount: number;
      reusedRoom: boolean;
    }
  | { ok: false; stage: "room" | "session" | "participants"; error: string };

function generateProjectorCode(): string {
  return `PROJ-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
}

export async function saveProjectorReport(
  db: ProjectorReportDb,
  input: SaveProjectorReportInput,
): Promise<SaveProjectorReportResult> {
  const { targetRounds, teams } = input;
  const now = input.now ?? new Date();
  const generateCode = input.generateCode ?? generateProjectorCode;
  const startedAt = new Date(
    now.getTime() - targetRounds * 60 * 1000,
  ).toISOString();
  const endedAt = now.toISOString();

  let code = input.roomCode || generateCode();
  let roomId: string | null = null;
  let reusedRoom = false;
  let sessionNumber = 1;

  // 1. Pakai ulang room yang sudah ada bila code terdaftar atas nama
  //    guru yang sama. Di bawah RLS rooms_select_own, pencarian ini hanya
  //    bisa menemukan room milik pemanggil; pemeriksaan teacher_id di
  //    sini adalah lapis pertahanan kedua.
  const { data: existingRoom, error: lookupError } = await db
    .from("rooms")
    .select("id, teacher_id")
    .eq("code", code)
    .maybeSingle();

  if (lookupError) {
    console.error(
      "[save-projector-report] Error looking up room:",
      lookupError,
    );
    return {
      ok: false,
      stage: "room",
      error: lookupError.message || "FAILED_TO_LOOK_UP_ROOM",
    };
  }

  if (existingRoom && existingRoom.teacher_id === input.teacherId) {
    roomId = String(existingRoom.id);
    reusedRoom = true;

    const { data: lastSession, error: sessionLookupError } = await db
      .from("room_sessions")
      .select("session_number")
      .eq("room_id", roomId)
      .order("session_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sessionLookupError) {
      console.error(
        "[save-projector-report] Error looking up room sessions:",
        sessionLookupError,
      );
      return {
        ok: false,
        stage: "session",
        error: sessionLookupError.message || "FAILED_TO_LOOK_UP_SESSION",
      };
    }

    sessionNumber =
      (typeof lastSession?.session_number === "number"
        ? lastSession.session_number
        : 0) + 1;
  } else {
    // 2. Belum ada room yang bisa dipakai ulang: buat baris rooms baru
    //    persis seperti perilaku lama. Bila insert menabrak UNIQUE code
    //    (code milik guru lain yang tidak terlihat RLS), coba sekali lagi
    //    dengan kode cadangan agar laporan tercatat di room baru milik
    //    pemanggil sendiri, bukan di room guru lain.
    //
    // Kelas efektif room baru: trigger basis data
    // assert_project_relationship_integrity (migrasi 0001) menolak
    // room (P0001 "room class must match the game class when the game
    // is class-scoped") bila game terikat satu kelas (games.class_id
    // terisi) sedangkan class_id room berbeda, dan class_id NULL
    // selalu lolos. Karena guru sah memainkan game terikat untuk
    // kelas lain dari Kelola Tim, dalam keadaan itu class_id room
    // dikosongkan dan kelas yang benar-benar bermain dipindah ke
    // snapshot sebagai playedClassId. Nilai efektif ini dihitung
    // sekali di sini agar percobaan ulang 23505 di bawah memakai
    // class_id yang sama. Bila pembacaan game gagal, game dianggap
    // tidak terikat kelas: pemeriksaan ini tidak boleh menggagalkan
    // penyimpanan laporan.
    let effectiveClassId = input.classId;
    let playedClassId: string | null = null;
    if (input.gameId && input.classId) {
      const { data: gameRow } = await db
        .from("games")
        .select("class_id")
        .eq("id", input.gameId)
        .maybeSingle();
      const gameClassId =
        typeof gameRow?.class_id === "string" ? gameRow.class_id : null;
      if (gameClassId && gameClassId !== input.classId) {
        effectiveClassId = null;
        playedClassId = input.classId;
      }
    }

    for (let attempt = 0; attempt < 2; attempt++) {
      const { data: room, error: roomError } = await db
        .from("rooms")
        .insert({
          code,
          teacher_id: input.teacherId,
          game_id: input.gameId,
          class_id: effectiveClassId,
          state: "ended",
          capacity: 40,
          current_question_index: targetRounds,
          started_at: startedAt,
          ended_at: endedAt,
          snapshot: {
            game: {
              id: input.gameId,
              name: input.gameName || "Mode Proyektor Hotseat",
              mode: "projector",
            },
            targetRounds,
            ...(playedClassId ? { playedClassId } : {}),
          },
        })
        .select("id")
        .single();

      if (!roomError && room) {
        roomId = String(room.id);
        break;
      }

      if (roomError?.code === "23505" && attempt === 0) {
        code = generateCode();
        continue;
      }

      console.error("[save-projector-report] Error creating room:", roomError);
      return {
        ok: false,
        stage: "room",
        error: roomError?.message || "FAILED_TO_CREATE_ROOM",
      };
    }
  }

  if (!roomId) {
    return { ok: false, stage: "room", error: "FAILED_TO_CREATE_ROOM" };
  }

  // 3. Create room_sessions entry (menempel ke room baru atau room lama)
  const { data: session, error: sessionError } = await db
    .from("room_sessions")
    .insert({
      room_id: roomId,
      session_number: sessionNumber,
      started_at: startedAt,
      ended_at: endedAt,
    })
    .select("id")
    .single();

  if (sessionError || !session) {
    console.error(
      "[save-projector-report] Error creating room session:",
      sessionError,
    );
    return {
      ok: false,
      stage: "session",
      error: sessionError?.message || "FAILED_TO_CREATE_SESSION",
    };
  }

  const sessionId = String(session.id);

  // 4. Sort teams by score descending and assign 1-based ranks
  const sortedTeams = [...teams].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  // 5. Insert participants: both team entries and individual student entries
  const participantRows: Array<{
    session_id: string;
    participant_name: string;
    final_score: number;
    rank: number;
    correct_count: number;
    total_questions: number;
    avg_response_ms: number;
  }> = [];

  sortedTeams.forEach((t, idx) => {
    const calculatedRank =
      typeof t.rank === "number" && t.rank > 0 ? t.rank : idx + 1;
    const studentNames = (t.members || []).map((m) => m.name).filter(Boolean);
    const studentLabel =
      studentNames.length > 0 ? ` (${studentNames.join(", ")})` : "";

    // Team collective row
    participantRows.push({
      session_id: sessionId,
      participant_name: `${t.name}${studentLabel}`,
      final_score: t.score ?? 0,
      rank: calculatedRank,
      correct_count: t.correctCount ?? 0,
      total_questions: targetRounds,
      avg_response_ms: 2500,
    });

    // Individual student rows so they appear directly by student name in daily report
    (t.members || []).forEach((m) => {
      participantRows.push({
        session_id: sessionId,
        participant_name: `${m.name} [${t.name.split(" ")[0] || "Tim"}]`,
        final_score: t.score ?? 0,
        rank: calculatedRank,
        correct_count: t.correctCount ?? 0,
        total_questions: targetRounds,
        avg_response_ms: 2500,
      });
    });
  });

  if (participantRows.length > 0) {
    const { error: partError } = await db
      .from("room_session_participants")
      .insert(participantRows);

    if (partError) {
      console.error(
        "[save-projector-report] Error inserting participants:",
        partError,
      );
      return {
        ok: false,
        stage: "participants",
        error: partError.message || "FAILED_TO_INSERT_PARTICIPANTS",
      };
    }
  }

  return {
    ok: true,
    roomId,
    sessionId,
    recordedCount: participantRows.length,
    reusedRoom,
  };
}
