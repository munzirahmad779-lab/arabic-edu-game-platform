export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ActiveRoomStore, normalizeSnapshotQuestion } from "@/lib/game-engine/room-store";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token")?.trim();

    if (!token) {
      return NextResponse.json({ error: "INVALID_JOIN_TOKEN" }, { status: 400 });
    }

    // 1. Prioritize authoritative Supabase RPC get_game_session
    const supabase = await createClient();
    let rpcSession: Record<string, unknown> | null = null;
    let rpcHadInvalidToken = false;

    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "get_game_session",
        { p_join_token: token }
      );
      if (rpcError && (rpcError.message?.includes("INVALID") || rpcError.code === "P0001")) {
        rpcHadInvalidToken = true;
      } else if (!rpcError && rpcData && rpcData[0]) {
        rpcSession = { ...(rpcData[0] as Record<string, unknown>) };
      }
    } catch (e) {
      console.warn("[/api/rooms/session] Supabase RPC lookup notice:", e);
    }

    if (rpcHadInvalidToken) {
      return NextResponse.json({ error: "INVALID_JOIN_TOKEN", ended: true }, { status: 404 });
    }

    if (rpcSession) {
      const roomId = String(rpcSession.room_id ?? "");
      const participantId = String(rpcSession.participant_id ?? "");
      const participantName = String(rpcSession.participant_name ?? "Santri Magguru");
      const qIdx = Number(rpcSession.question_index ?? 0);

      const rawQ = rpcSession.question;
      const normQ = normalizeSnapshotQuestion(rawQ, qIdx);

      const storedRoom = ActiveRoomStore.registerRoom({
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

      rpcSession.question = normQ;
      rpcSession.participant_count = storedRoom.participants.size || Number(rpcSession.participant_count ?? 1);

      return NextResponse.json(rpcSession);
    }

    // 2. Resilient fallback to ActiveRoomStore when Supabase RPC is offline/unreachable
    const memoryMatch = ActiveRoomStore.getByToken(token);
    if (memoryMatch) {
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
        question: activeQuestion,
        answer_submitted: answerSubmitted,
        server_time: new Date().toISOString(),
      });
    }

    return NextResponse.json({ error: "SESSION_NOT_FOUND", ended: true }, { status: 404 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Error";
    console.error("[/api/rooms/session] Unexpected error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
