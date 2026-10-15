import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RawOption = { id: string; option_key: string; option_text: string };
type RawQuestionItem = {
  id?: string;
  correct_option_key?: string;
  options?: RawOption[];
  question?: {
    id: string;
    correct_option_key?: string;
    options?: RawOption[];
  };
};

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

    // 1. Cari peserta dan room terlebih dahulu
    const { data: participant, error: partError } = await supabase
      .from("room_participants")
      .select("id, room_id")
      .eq("join_token", joinToken)
      .maybeSingle();

    if (partError || !participant) {
      // Coba RPC jika akses tabel dibatasi RLS
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
      return NextResponse.json({ error: "INVALID_JOIN_TOKEN" }, { status: 404 });
    }

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, state, current_question_index, snapshot")
      .eq("id", participant.room_id)
      .maybeSingle();

    if (roomError || !room) {
      return NextResponse.json({ error: "ROOM_NOT_FOUND" }, { status: 404 });
    }

    // Periksa apakah jawaban sudah pernah dikirim untuk soal ini
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

    const snapshot = (room.snapshot as {
      game?: { mode?: string };
      questions?: RawQuestionItem[];
    }) || {};

    const questionsList = snapshot.questions ?? [];
    const matchedItem = questionsList.find((item) => {
      const qId = item.question?.id ?? item.id;
      return qId === questionId;
    });

    const q = matchedItem?.question ?? matchedItem;
    let isCorrect = false;

    if (q) {
      const opts = q.options ?? [];
      const correctKey = (q.correct_option_key ?? "").trim().toUpperCase();

      if (selectedOptionId) {
        const chosenOpt = opts.find(
          (opt) => opt.id === selectedOptionId || opt.option_key === selectedOptionId
        );
        if (chosenOpt && chosenOpt.option_key.trim().toUpperCase() === correctKey) {
          isCorrect = true;
        }
      } else if (answerText && correctKey) {
        const correctOpt = opts.find(
          (opt) => opt.option_key.trim().toUpperCase() === correctKey
        );
        if (
          correctOpt &&
          correctOpt.option_text.trim().toLowerCase() === answerText.trim().toLowerCase()
        ) {
          isCorrect = true;
        }
      }
    }

    const scoreAwarded = isCorrect ? 100 : 0;

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
