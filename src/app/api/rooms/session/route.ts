export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ActiveRoomStore, normalizeSnapshotQuestion } from "@/lib/game-engine/room-store";

// Soal yang dikirim ke siswa TIDAK boleh memuat kunci jawaban. Salinan
// internal di ActiveRoomStore tetap menyimpannya untuk penilaian cadangan
// sisi server; yang keluar lewat API publik selalu disanitasi di sini.
function toPublicQuestion(q: unknown): unknown {
  if (!q || typeof q !== "object") return q ?? null;
  const copy: Record<string, unknown> = { ...(q as Record<string, unknown>) };
  delete copy.correct_option_key;
  return copy;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token: string = searchParams.get("token")?.trim() || "";
    const roomCodeQuery: string = searchParams.get("code")?.trim().toUpperCase() || "";
    const studentNameQuery: string = searchParams.get("name")?.trim() || "";

    if (!token && !roomCodeQuery) {
      return NextResponse.json({ error: "INVALID_JOIN_TOKEN" }, { status: 400 });
    }

    const supabase = await createClient();

    // 1. Prioritize authoritative Supabase RPC get_game_session
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "get_game_session",
        { p_join_token: token }
      );

      if (rpcError) {
        // Jangan telan diam-diam: kegagalan RPC otoritatif adalah akar bug
        // "siswa tidak bisa terhubung" yang lama tak terlihat di log.
        console.error(
          "[/api/rooms/session] get_game_session RPC error:",
          rpcError.message
        );
      }

      if (!rpcError && rpcData && rpcData[0]) {
        const rpcSession = { ...(rpcData[0] as Record<string, unknown>) };
        const roomId = String(rpcSession.room_id ?? "");
        const participantId = String(rpcSession.participant_id ?? "");
        const participantName = String(rpcSession.participant_name ?? "Santri Magguru");
        const qIdx = Number(rpcSession.question_index ?? 0);

        const rawQ = rpcSession.question;
        const normQ = normalizeSnapshotQuestion(rawQ, qIdx);

        ActiveRoomStore.registerRoom({
          id: roomId,
          code: String(rpcSession.room_code ?? "ROOM"),
          game_name: String(rpcSession.game_name ?? "Game"),
          game_type: String(rpcSession.game_type ?? "quiz"),
          game_mode: String(rpcSession.game_mode ?? "competitive"),
          duration_seconds: Number(rpcSession.game_duration_seconds ?? 300),
          capacity: Number(rpcSession.capacity ?? 30),
          state: rpcSession.room_state as "waiting" | "running" | "ended",
          started_at: (rpcSession.started_at as string) ?? null,
          question_started_at: (rpcSession.question_started_at as string) ?? null,
          current_question_index: qIdx,
        });

        if (normQ) {
          ActiveRoomStore.setQuestionAt(roomId, qIdx, normQ);
        }

        ActiveRoomStore.registerParticipant({
          roomId,
          joinToken: token,
          participantId,
          name: participantName,
        });

        rpcSession.question = toPublicQuestion(normQ);
        // participant_count otoritatif berasal dari RPC. Menimpanya dengan
        // ukuran store memori menghitung peserta basi instance ini dan
        // menyimpang dari jumlah peserta sebenarnya di database.

        return NextResponse.json(rpcSession);
      }
    } catch (e) {
      console.warn("[/api/rooms/session] Supabase RPC get_game_session notice:", e);
    }

    // 2. Resilient In-Memory Match via ActiveRoomStore
    // Room placeholder (kode "ROOM", tanpa soal) yang dibuat registerParticipant
    // untuk room yang belum dikenal instance ini BUKAN sesi otoritatif:
    // menyajikannya membekukan siswa di ruang tunggu selamanya. Lewati dan
    // biarkan jalur RPC di bawah yang menjawab.
    const memoryMatch = ActiveRoomStore.getByToken(token);
    const memoryIsPlaceholder =
      memoryMatch !== null &&
      memoryMatch.room.code === "ROOM" &&
      memoryMatch.room.questions.length === 0;
    if (memoryMatch && !memoryIsPlaceholder) {
      const { room, participant } = memoryMatch;
      participant.last_seen_at = Date.now();

      const questions = room.questions;
      const totalQuestions = questions.length;

      const participantSubmissionsCount = participant.submissions.length;
      const qIdx = Math.max(participantSubmissionsCount, room.current_question_index);

      const isCompleted = totalQuestions > 0 && qIdx >= totalQuestions;
      const roomState = isCompleted ? "ended" : room.state;

      const activeQuestion = !isCompleted && questions[qIdx] ? questions[qIdx] : null;
      const answerSubmitted = activeQuestion
        ? participant.submissions.some((s) => s.question_id === activeQuestion.id)
        : false;

      return NextResponse.json({
        room_id: room.id,
        room_code: room.code,
        game_name: room.game_name,
        game_type: room.game_type,
        game_mode: room.game_mode,
        game_duration_seconds: room.duration_seconds,
        started_at: room.started_at,
        room_state: roomState,
        participant_id: participant.id,
        participant_name: participant.name,
        participant_count: room.participants.size || 1,
        capacity: room.capacity,
        question_index: qIdx,
        question_count: totalQuestions,
        question_started_at: room.question_started_at || room.started_at || new Date().toISOString(),
        question: toPublicQuestion(activeQuestion),
        answer_submitted: answerSubmitted,
        server_time: new Date().toISOString(),
      });
    }

    // 3. Fallback: Query get_join_session RPC
    try {
      const { data: joinData, error: joinErr } = await (supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<{
        data: Array<{
          room_id: string;
          room_code: string;
          game_name: string;
          room_state: string;
          participant_id: string;
          participant_name: string;
          participant_count: number;
          capacity: number;
        }> | null;
        error: Error | null;
      }>)(
        "get_join_session",
        { p_join_token: token }
      );

      if (!joinErr && joinData && joinData.length > 0 && joinData[0].room_id) {
        const row = joinData[0];
        const rState = (row.room_state as "waiting" | "running" | "ended") || "waiting";

        // Hydrate from rooms snapshot in database to ensure questions are fully populated
        let cachedRoom = ActiveRoomStore.getRoomById(row.room_id);
        if (!cachedRoom || cachedRoom.questions.length === 0) {
          try {
            const { data: roomRow } = await supabase
              .from("rooms")
              .select("id, code, state, started_at, current_question_index, question_started_at, snapshot, capacity")
              .eq("id", row.room_id)
              .maybeSingle();

            if (roomRow) {
              const snap = roomRow.snapshot as {
                game?: {
                  name?: string;
                  mode?: string;
                  game_type?: string;
                  duration_seconds?: number;
                };
                questions?: unknown[];
              } | null;

              const rawQs = snap?.questions ?? [];
              const normQs = rawQs
                .map((q, idx) => normalizeSnapshotQuestion(q, idx))
                .filter((q): q is NonNullable<typeof q> => q !== null);

              cachedRoom = ActiveRoomStore.registerRoom({
                id: roomRow.id,
                code: roomRow.code,
                game_name: snap?.game?.name || row.game_name || "Game",
                game_type: snap?.game?.game_type || (snap?.game?.mode === "anagram" ? "anagram" : "quiz"),
                game_mode: snap?.game?.mode || "competitive",
                duration_seconds: snap?.game?.duration_seconds || 300,
                capacity: roomRow.capacity || 30,
                state: (roomRow.state as "waiting" | "running" | "ended") || rState,
                started_at: roomRow.started_at,
                question_started_at: roomRow.question_started_at,
                current_question_index: roomRow.current_question_index ?? 0,
                questions: normQs,
              });
            }
          } catch (rErr) {
            console.warn("[/api/rooms/session] Snapshot hydrate notice:", rErr);
          }
        }

        const questions = cachedRoom?.questions ?? [];
        const qIdx = cachedRoom?.current_question_index ?? 0;
        const currentQ = questions[qIdx] ?? null;

        // Daftarkan room dengan data ASLI dari RPC lebih dulu, supaya
        // registerParticipant tidak mengarang room placeholder.
        ActiveRoomStore.registerRoom({
          id: row.room_id,
          code: row.room_code,
          game_name: row.game_name || "Game",
          state: rState,
          capacity: row.capacity || 30,
        });

        ActiveRoomStore.registerParticipant({
          roomId: row.room_id,
          joinToken: token,
          participantId: row.participant_id,
          name: row.participant_name || "Santri Magguru",
        });

        return NextResponse.json({
          room_id: row.room_id,
          room_code: row.room_code,
          game_name: row.game_name || cachedRoom?.game_name || "Game",
          game_type: cachedRoom?.game_type || "quiz",
          game_mode: cachedRoom?.game_mode || "competitive",
          game_duration_seconds: cachedRoom?.duration_seconds || 300,
          started_at: cachedRoom?.started_at || null,
          room_state: rState,
          participant_id: row.participant_id,
          participant_name: row.participant_name || "Santri Magguru",
          participant_count: row.participant_count || cachedRoom?.participants.size || 1,
          capacity: row.capacity || cachedRoom?.capacity || 30,
          question_index: qIdx,
          question_count: questions.length,
          question_started_at: cachedRoom?.question_started_at || null,
          question: toPublicQuestion(currentQ),
          answer_submitted: false,
          server_time: new Date().toISOString(),
        });
      }
    } catch (fallbackErr) {
      console.warn("[/api/rooms/session] get_join_session fallback notice:", fallbackErr);
    }

    // 4. Direct Table Check on room_participants
    try {
      const { data: partRow } = await supabase
        .from("room_participants")
        .select(`
          id,
          room_id,
          guest_name,
          student_id,
          rooms (
            id,
            code,
            state,
            snapshot,
            capacity,
            started_at,
            current_question_index,
            question_started_at
          )
        `)
        .eq("join_token", token)
        .maybeSingle();

      if (partRow && partRow.rooms) {
        const rData = partRow.rooms as unknown as {
          id: string;
          code: string;
          state: string;
          snapshot: unknown;
          capacity: number;
          started_at: string | null;
          current_question_index: number;
          question_started_at: string | null;
        };

        const snap = rData.snapshot as {
          game?: {
            name?: string;
            mode?: string;
            game_type?: string;
            duration_seconds?: number;
          };
          questions?: unknown[];
        } | null;

        const rawQs = snap?.questions ?? [];
        const normQs = rawQs
          .map((q, idx) => normalizeSnapshotQuestion(q, idx))
          .filter((q): q is NonNullable<typeof q> => q !== null);

        const rState = (rData.state as "waiting" | "running" | "ended") || "waiting";

        const cachedRoom = ActiveRoomStore.registerRoom({
          id: rData.id,
          code: rData.code,
          game_name: snap?.game?.name || "Game",
          game_type: snap?.game?.game_type || "quiz",
          game_mode: snap?.game?.mode || "competitive",
          duration_seconds: snap?.game?.duration_seconds || 300,
          capacity: rData.capacity || 30,
          state: rState,
          started_at: rData.started_at,
          question_started_at: rData.question_started_at,
          current_question_index: rData.current_question_index ?? 0,
          questions: normQs,
        });

        const pName = partRow.guest_name || "Santri Magguru";
        ActiveRoomStore.registerParticipant({
          roomId: rData.id,
          joinToken: token,
          participantId: partRow.id,
          name: pName,
        });

        const qIdx = rData.current_question_index ?? 0;
        const currentQ = normQs[qIdx] ?? null;

        return NextResponse.json({
          room_id: rData.id,
          room_code: rData.code,
          game_name: snap?.game?.name || "Game",
          game_type: cachedRoom.game_type,
          game_mode: cachedRoom.game_mode,
          game_duration_seconds: cachedRoom.duration_seconds,
          started_at: rData.started_at,
          room_state: rState,
          participant_id: partRow.id,
          participant_name: pName,
          participant_count: cachedRoom.participants.size || 1,
          capacity: rData.capacity || 30,
          question_index: qIdx,
          question_count: normQs.length,
          question_started_at: rData.question_started_at,
          question: toPublicQuestion(currentQ),
          answer_submitted: false,
          server_time: new Date().toISOString(),
        });
      }
    } catch (partErr) {
      console.warn("[/api/rooms/session] room_participants direct table notice:", partErr);
    }

    // 5. Auto-reconnect by Room Code via SECURITY DEFINER RPC.
    // Jalur lama membaca tabel rooms dan menyisipkan room_participants secara
    // langsung sebagai anon; RLS (migrasi 0002) hanya memberi policy kepada
    // authenticated pemilik ruangan, sehingga jalur itu selalu kosong di
    // produksi dan siswa yang tokennya hilang terkunci di SESSION_NOT_FOUND.
    // RPC reconnect_room_participant (migrasi 0068) melakukan pencarian yang
    // sama dari sisi definer.
    if (roomCodeQuery) {
      try {
        const { data: recData, error: recError } = await supabase.rpc(
          "reconnect_room_participant",
          { p_code: roomCodeQuery, p_name: studentNameQuery }
        );

        if (recError) {
          console.error(
            "[/api/rooms/session] reconnect_room_participant RPC error:",
            recError.message
          );
        }

        const rec = !recError && recData && recData.length > 0 ? recData[0] : null;

        if (rec && rec.room_state === "ended") {
          return NextResponse.json(
            {
              error: "SESSION_ENDED",
              ended: true,
              room_code: roomCodeQuery,
            },
            { status: 404 }
          );
        }

        if (rec && rec.join_token && rec.participant_id) {
          const snapRaw =
            rec.snapshot &&
            typeof rec.snapshot === "object" &&
            !Array.isArray(rec.snapshot)
              ? (rec.snapshot as Record<string, unknown>)
              : null;
          const snapGame =
            snapRaw?.game &&
            typeof snapRaw.game === "object" &&
            !Array.isArray(snapRaw.game)
              ? (snapRaw.game as Record<string, unknown>)
              : null;

          const rawQs = Array.isArray(snapRaw?.questions)
            ? (snapRaw.questions as unknown[])
            : [];
          const normQs = rawQs
            .map((q, idx) => normalizeSnapshotQuestion(q, idx))
            .filter((q): q is NonNullable<typeof q> => q !== null);

          const rState = rec.room_state as "waiting" | "running" | "ended";
          const cachedRoom = ActiveRoomStore.registerRoom({
            id: rec.room_id,
            code: roomCodeQuery,
            game_name: String(snapGame?.name ?? "Game"),
            game_type: String(
              snapGame?.game_type ??
                (snapGame?.mode === "anagram" ? "anagram" : "quiz")
            ),
            game_mode: String(snapGame?.mode ?? "competitive"),
            duration_seconds: Number(snapGame?.duration_seconds ?? 300),
            capacity: rec.capacity || 30,
            state: rState,
            started_at: rec.started_at,
            question_started_at: rec.question_started_at,
            current_question_index: rec.current_question_index ?? 0,
            questions: normQs,
          });

          ActiveRoomStore.registerParticipant({
            roomId: rec.room_id,
            joinToken: rec.join_token,
            participantId: rec.participant_id,
            name: rec.participant_name || "Santri Magguru",
          });

          const qIdx = rec.question_index ?? 0;
          const currentQ = normQs[qIdx] ?? null;

          return NextResponse.json({
            room_id: rec.room_id,
            room_code: roomCodeQuery,
            game_name: String(snapGame?.name ?? "Game"),
            game_type: cachedRoom.game_type,
            game_mode: cachedRoom.game_mode,
            game_duration_seconds: cachedRoom.duration_seconds,
            started_at: rec.started_at,
            room_state: rState,
            participant_id: rec.participant_id,
            participant_name: rec.participant_name || "Santri Magguru",
            participant_count: cachedRoom.participants.size || 1,
            capacity: rec.capacity || 30,
            question_index: qIdx,
            question_count: normQs.length,
            question_started_at: rec.question_started_at,
            question: toPublicQuestion(currentQ),
            answer_submitted: false,
            server_time: new Date().toISOString(),
            new_join_token: rec.join_token,
          });
        }
      } catch (autoErr) {
        console.warn("[/api/rooms/session] auto-rejoin notice:", autoErr);
      }
    }

    // 404 netral (ended: false): room tidak ditemukan dari kode yang diberikan,
    // atau token tidak dikenal dan tidak ada jalur reconnect yang cocok.
    return NextResponse.json(
      {
        error: "SESSION_NOT_FOUND",
        ended: false,
        room_code: roomCodeQuery || null,
      },
      { status: 404 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Error";
    console.error("[/api/rooms/session] Unexpected error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
