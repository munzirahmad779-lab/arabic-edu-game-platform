import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ActiveRoomStore } from "@/lib/game-engine/room-store";

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

    // 1. Submit directly to Supabase submit_game_answer RPC for authoritative persistence
    let rpcResult: { accepted: boolean; is_correct: boolean; score_awarded: number } | null = null;
    let rpcErrorMsg: string | null = null;

    try {
      const supabase = await createClient();
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "submit_game_answer",
        {
          p_join_token: joinToken,
          p_question_id: questionId,
          p_selected_option_id: selectedOptionId || null,
          p_answer_text: answerText || null,
        }
      );

      if (rpcError) {
        rpcErrorMsg = rpcError.message;
      } else if (rpcData && rpcData[0]) {
        rpcResult = {
          accepted: rpcData[0].accepted ?? true,
          is_correct: rpcData[0].is_correct ?? false,
          score_awarded: rpcData[0].score_awarded ?? 0,
        };
      }
    } catch (e) {
      console.warn("[/api/rooms/answer] Supabase answer RPC notice:", e);
    }

    // 2. Also register in ActiveRoomStore for consistent in-memory state
    const storeResult = ActiveRoomStore.submitAnswer({
      joinToken,
      questionId,
      selectedOptionId: selectedOptionId || null,
      answerText: answerText || null,
    });

    if (rpcResult) {
      return NextResponse.json(rpcResult);
    }

    if (rpcErrorMsg) {
      if (rpcErrorMsg.includes("ALREADY")) {
        return NextResponse.json({ error: "ALREADY_SUBMITTED" }, { status: 409 });
      }
      if (rpcErrorMsg.includes("TIMEOUT")) {
        return NextResponse.json({ error: "QUESTION_TIMEOUT" }, { status: 400 });
      }
    }

    // 3. Fallback to ActiveRoomStore result if Supabase is offline/unreachable
    return NextResponse.json({
      accepted: storeResult.accepted,
      is_correct: storeResult.is_correct,
      score_awarded: storeResult.score_awarded,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Error";
    console.error("[/api/rooms/answer] Fatal error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
