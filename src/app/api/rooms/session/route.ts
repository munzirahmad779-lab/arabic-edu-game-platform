export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

type RawOption = { id: string; option_key: string; option_text: string };
type RawMedia = { id: string; media_type: string; public_url: string; mime_type?: string | null; max_play_count?: number | null };
type RawQuestionItem = {
  id?: string;
  position?: number;
  question_text?: string;
  difficulty?: string;
  explanation_timing?: string;
  time_limit_seconds?: number;
  options?: RawOption[];
  media?: RawMedia[];
  question?: {
    id: string;
    question_text: string;
    difficulty?: string;
    correct_option_key?: string;
    explanation?: string | null;
    time_limit_seconds?: number;
    options?: RawOption[];
    media?: RawMedia[];
  };
};

function normalizeQuestion(item: RawQuestionItem | null | undefined, index: number) {
  if (!item) return null;
  const inner = item.question ?? item;
  if (!inner || (!inner.id && !inner.question_text)) return null;
  return {
    id: inner.id ?? `q-${index}`,
    position: item.position ?? index + 1,
    question_text: inner.question_text ?? "",
    difficulty: inner.difficulty ?? item.difficulty ?? "easy",
    explanation_timing: item.explanation_timing ?? "after_each_question",
    time_limit_seconds: inner.time_limit_seconds ?? item.time_limit_seconds ?? 30,
    options: Array.isArray(inner.options) ? inner.options : [],
    media: Array.isArray(inner.media) ? inner.media : [],
  };
}

function getDbClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && serviceKey) {
    return createSupabaseAdmin(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token")?.trim();

    if (!token) {
      return NextResponse.json({ error: "INVALID_JOIN_TOKEN" }, { status: 400 });
    }

    const supabase = await createClient();
    const adminDb = getDbClient() ?? supabase;

    // 1. Panggil RPC get_game_session (SECURITY DEFINER, selalu menembus RLS untuk siswa)
    let rpcSession: Record<string, unknown> | null = null;
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "get_game_session",
        { p_join_token: token }
      );
      if (rpcError && rpcError.message?.includes("INVALID")) {
        return NextResponse.json({ error: "INVALID_JOIN_TOKEN", ended: true }, { status: 404 });
      }
      if (!rpcError && rpcData && rpcData[0]) {
        rpcSession = { ...(rpcData[0] as Record<string, unknown>) };
      }
    } catch (e) {
      console.warn("[/api/rooms/session] RPC warning:", e);
    }

    // Jika RPC berhasil dan question_text serta options sudah lengkap, kembalikan langsung
    if (rpcSession) {
      const qObj = rpcSession.question as RawQuestionItem | null;
      const normFromRpc = normalizeQuestion(qObj, Number(rpcSession.question_index ?? 0));
      if (normFromRpc && normFromRpc.question_text && normFromRpc.options.length > 0) {
        rpcSession.question = normFromRpc;
        return NextResponse.json(rpcSession);
      }

      // Jika RPC mengembalikan question kosong karena format nested snapshot.questions[i].question,
      // ambil snapshot dari tabel rooms berdasarkan room_id dari rpcSession
      const roomId = String(rpcSession.room_id ?? "");
      if (roomId) {
        const { data: roomRow } = await adminDb
          .from("rooms")
          .select("snapshot, current_question_index")
          .eq("id", roomId)
          .maybeSingle();

        if (roomRow && roomRow.snapshot) {
          const snap = roomRow.snapshot as { questions?: RawQuestionItem[] };
          const qIdx = Number(rpcSession.question_index ?? roomRow.current_question_index ?? 0);
          const rawItem = (snap.questions ?? [])[qIdx] ?? null;
          const patchedQ = normalizeQuestion(rawItem, qIdx);
          if (patchedQ) {
            rpcSession.question = patchedQ;
            rpcSession.question_count = (snap.questions ?? []).length;
          }
        }
      }
      return NextResponse.json(rpcSession);
    }

    // 2. Fallback penuh jika RPC tidak tersedia
    const { data: participant, error: partError } = await adminDb
      .from("room_participants")
      .select("id, room_id, guest_name, student_id, connection_state")
      .eq("join_token", token)
      .maybeSingle();

    if (partError || !participant) {
      return NextResponse.json({ error: "INVALID_JOIN_TOKEN", ended: true }, { status: 404 });
    }

    const { data: room, error: roomError } = await adminDb
      .from("rooms")
      .select("id, code, state, current_question_index, capacity, snapshot, question_started_at, started_at")
      .eq("id", participant.room_id)
      .maybeSingle();

    if (roomError || !room) {
      return NextResponse.json({ error: "ROOM_NOT_FOUND", ended: true }, { status: 404 });
    }

    const snapshot = (room.snapshot as {
      game?: {
        name?: string;
        mode?: string;
        type?: string;
        game_type?: string;
        duration_seconds?: number;
      };
      questions?: RawQuestionItem[];
    }) || {};

    const questionsList = snapshot.questions ?? [];
    const questionIndex = room.current_question_index ?? 0;
    const normalizedQ = normalizeQuestion(questionsList[questionIndex], questionIndex);

    const { count: participantCount } = await adminDb
      .from("room_participants")
      .select("id", { count: "exact", head: true })
      .eq("room_id", room.id);

    let answerSubmitted = false;
    if (normalizedQ) {
      const { data: ansRow } = await adminDb
        .from("submissions")
        .select("id")
        .eq("room_id", room.id)
        .eq("room_participant_id", participant.id)
        .eq("question_id", normalizedQ.id)
        .maybeSingle();

      if (ansRow) answerSubmitted = true;
    }

    const rawGameName = snapshot.game?.name ?? "Latihan Magguru";
    const cleanGameName = rawGameName.replace(/\[(THEME|EMBED):.*?\]/g, "").trim();

    return NextResponse.json({
      room_id: room.id,
      room_code: room.code,
      game_name: cleanGameName,
      game_type: snapshot.game?.game_type ?? snapshot.game?.type ?? "quiz",
      game_mode: snapshot.game?.mode ?? "competitive",
      game_duration_seconds: snapshot.game?.duration_seconds ?? 300,
      started_at: room.started_at,
      room_state: room.state,
      participant_id: participant.id,
      participant_name: participant.guest_name ?? "Santri Magguru",
      participant_count: participantCount ?? 1,
      capacity: room.capacity ?? 50,
      question_index: questionIndex,
      question_count: questionsList.length,
      question_started_at: room.question_started_at,
      question: normalizedQ,
      answer_submitted: answerSubmitted,
      server_time: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Error";
    console.error("[/api/rooms/session] Unexpected error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
