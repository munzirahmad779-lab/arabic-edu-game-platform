import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token")?.trim();

    if (!token) {
      return NextResponse.json({ error: "INVALID_JOIN_TOKEN" }, { status: 400 });
    }

    const supabase = await createClient();

    // 1. Coba RPC get_game_session terlebih dahulu
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "get_game_session",
        { p_join_token: token }
      );

      if (!rpcError && rpcData && rpcData[0]) {
        return NextResponse.json(rpcData[0]);
      }

      if (rpcError && rpcError.message?.includes("INVALID")) {
        return NextResponse.json({ error: "INVALID_JOIN_TOKEN", ended: true }, { status: 404 });
      }
    } catch (rpcCatchErr) {
      console.warn("[/api/rooms/session] RPC invocation failed, engaging resilient fallback:", rpcCatchErr);
    }

    // 2. RESILIENT FALLBACK: Kueri langsung ke tabel jika RPC schema cache bermasalah
    const { data: participant, error: partError } = await supabase
      .from("room_participants")
      .select("id, room_id, guest_name, student_id, connection_state")
      .eq("join_token", token)
      .maybeSingle();

    if (partError || !participant) {
      return NextResponse.json({ error: "INVALID_JOIN_TOKEN", ended: true }, { status: 404 });
    }

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, code, state, current_question_index, capacity, snapshot, question_started_at, started_at")
      .eq("id", participant.room_id)
      .maybeSingle();

    if (roomError || !room) {
      return NextResponse.json({ error: "ROOM_NOT_FOUND", ended: true }, { status: 404 });
    }

    // Ekstraksi data snapshot permainan
    const snapshot = (room.snapshot as {
      game?: { name?: string; mode?: string; type?: string; duration_seconds?: number };
      questions?: Array<{
        id: string;
        position?: number;
        question_text: string;
        difficulty?: string;
        explanation_timing?: string;
        time_limit_seconds?: number;
        options?: Array<{ id: string; option_key: string; option_text: string }>;
        media?: Array<{ id: string; media_type: string; public_url: string }>;
      }>;
    }) || {};

    const questionsList = snapshot.questions ?? [];
    const questionIndex = room.current_question_index ?? 0;
    const currentQ = questionsList[questionIndex] || null;

    // Hitung peserta aktif
    const { count: participantCount } = await supabase
      .from("room_participants")
      .select("id", { count: "exact", head: true })
      .eq("room_id", room.id);

    // Cek apakah siswa sudah menjawab soal saat ini
    let answerSubmitted = false;
    if (currentQ) {
      const { data: ansRow } = await supabase
        .from("submissions")
        .select("id")
        .eq("room_id", room.id)
        .eq("room_participant_id", participant.id)
        .eq("question_id", currentQ.id)
        .maybeSingle();

      if (ansRow) {
        answerSubmitted = true;
      }
    }

    // Bentuk payload sesi yang kompatibel 100% dengan antarmuka client
    const fallbackSession = {
      room_id: room.id,
      room_code: room.code,
      game_name: snapshot.game?.name ?? "Latihan Magguru",
      game_type: snapshot.game?.type ?? "quiz",
      game_mode: snapshot.game?.mode ?? "competitive",
      game_duration_seconds: snapshot.game?.duration_seconds ?? 30,
      started_at: room.started_at,
      room_state: room.state,
      participant_id: participant.id,
      participant_name: participant.guest_name ?? "Santri Magguru",
      participant_count: participantCount ?? 1,
      capacity: room.capacity ?? 50,
      question_index: questionIndex,
      question_count: questionsList.length,
      question_started_at: room.question_started_at,
      question: currentQ ? {
        id: currentQ.id,
        position: currentQ.position ?? questionIndex + 1,
        question_text: currentQ.question_text,
        difficulty: currentQ.difficulty ?? "normal",
        explanation_timing: currentQ.explanation_timing ?? "immediate",
        time_limit_seconds: currentQ.time_limit_seconds ?? 30,
        options: currentQ.options ?? [],
        media: currentQ.media ?? [],
      } : null,
      answer_submitted: answerSubmitted,
      server_time: new Date().toISOString(),
    };

    return NextResponse.json(fallbackSession);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Error";
    console.error("[/api/rooms/session] Unexpected error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
