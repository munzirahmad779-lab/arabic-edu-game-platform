import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { joinToken, questionId, selectedOptionId, answerText } = body as {
      joinToken?: string;
      questionId?: string;
      selectedOptionId?: string | null;
      answerText?: string | null;
    };

    if (!joinToken || !questionId) {
      return NextResponse.json({ error: "INVALID_PAYLOAD" }, { status: 400 });
    }

    const supabase = await createClient();

    // 1. Coba RPC submit_game_answer terlebih dahulu
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "submit_game_answer",
        {
          p_join_token: joinToken,
          p_question_id: questionId,
          p_selected_option_id: selectedOptionId || null,
          p_answer_text: answerText || null,
        }
      );

      if (!rpcError && rpcData && rpcData[0]) {
        return NextResponse.json({
          accepted: rpcData[0].accepted,
          is_correct: rpcData[0].is_correct,
          score_awarded: rpcData[0].score_awarded,
        });
      }

      if (rpcError) {
        console.warn("[/api/rooms/answer] submit_game_answer RPC returned error, attempting fallback:", rpcError.message);
      }
    } catch (rpcCatchErr) {
      console.warn("[/api/rooms/answer] RPC call threw, attempting fallback:", rpcCatchErr);
    }

    // 2. RESILIENT FALLBACK: Validasi langsung di server
    const { data: participant, error: partError } = await supabase
      .from("room_participants")
      .select("id, room_id")
      .eq("join_token", joinToken)
      .maybeSingle();

    if (partError || !participant) {
      return NextResponse.json({ error: "INVALID_JOIN_TOKEN" }, { status: 404 });
    }

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, state, snapshot")
      .eq("id", participant.room_id)
      .maybeSingle();

    if (roomError || !room) {
      return NextResponse.json({ error: "ROOM_NOT_FOUND" }, { status: 404 });
    }

    // Periksa apakah jawaban sudah pernah dikirim
    const { data: existingSub } = await supabase
      .from("submissions")
      .select("id, is_correct, score_awarded")
      .eq("room_id", room.id)
      .eq("room_participant_id", participant.id)
      .eq("question_id", questionId)
      .maybeSingle();

    if (existingSub) {
      return NextResponse.json({
        accepted: true,
        is_correct: existingSub.is_correct,
        score_awarded: existingSub.score_awarded,
      });
    }

    // Cari kunci jawaban di snapshot
    const snapshot = (room.snapshot as {
      questions?: Array<{
        id: string;
        correct_option_key?: string;
        options?: Array<{ id: string; option_key: string; option_text: string }>;
      }>;
    }) || {};

    const q = snapshot.questions?.find((item) => item.id === questionId);
    let isCorrect = false;

    if (q) {
      if (selectedOptionId) {
        const chosenOpt = q.options?.find((opt) => opt.id === selectedOptionId);
        if (chosenOpt && chosenOpt.option_key === q.correct_option_key) {
          isCorrect = true;
        }
      } else if (answerText && q.correct_option_key) {
        const correctOpt = q.options?.find((opt) => opt.option_key === q.correct_option_key);
        if (correctOpt && correctOpt.option_text.trim().toLowerCase() === answerText.trim().toLowerCase()) {
          isCorrect = true;
        }
      }
    }

    const scoreAwarded = isCorrect ? 100 : 0;

    // Simpan submission
    await supabase.from("submissions").insert({
      room_id: room.id,
      room_participant_id: participant.id,
      question_id: questionId,
      selected_option_id: selectedOptionId || null,
      answer_text: answerText || null,
      is_correct: isCorrect,
      score_awarded: scoreAwarded,
      response_time_ms: 1000,
    });

    return NextResponse.json({
      accepted: true,
      is_correct: isCorrect,
      score_awarded: scoreAwarded,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Error";
    console.error("[/api/rooms/answer] Fatal error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
