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

    // 2. RPC berhasil: hasil RPC adalah satu-satunya jawaban resmi.
    // ActiveRoomStore hanya diperbarui sebagai cache tulis agar keadaan
    // memori instance ini konsisten; hasil penilaiannya TIDAK pernah
    // dipakai sebagai jawaban (pola yang sama dengan rooms/session dan
    // rooms/control: memori per instance bukan sumber kebenaran).
    if (rpcResult) {
      ActiveRoomStore.submitAnswer({
        joinToken,
        questionId,
        selectedOptionId: selectedOptionId || null,
        answerText: answerText || null,
      });
      return NextResponse.json(rpcResult);
    }

    if (rpcErrorMsg) {
      if (rpcErrorMsg.includes("ALREADY")) {
        return NextResponse.json({ error: "ALREADY_SUBMITTED" }, { status: 409 });
      }
      if (rpcErrorMsg.includes("TIMEOUT")) {
        return NextResponse.json({ error: "QUESTION_TIMEOUT" }, { status: 400 });
      }
      console.error(
        "[/api/rooms/answer] submit_game_answer RPC error:",
        rpcErrorMsg
      );
    }

    // 3. RPC otoritatif gagal (atau tidak mengembalikan hasil): jawaban
    // TIDAK boleh dinyatakan diterima/dinilai dari memori instance, karena
    // hasil itu tidak pernah tersimpan di database dan skor yang dilihat
    // siswa akan berbeda dari catatan guru. Gagal tegas, selaras dengan
    // rooms/control yang menjawab 409 bila tulisan DB tidak terbukti.
    return NextResponse.json(
      { error: "ANSWER_NOT_RECORDED" },
      { status: 503 }
    );
  } catch (err: unknown) {
    console.error("[/api/rooms/answer] Fatal error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
