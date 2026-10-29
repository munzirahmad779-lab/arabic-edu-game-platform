export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { ActiveRoomStore } from "@/lib/game-engine/room-store";

type RoomUpdate = Database["public"]["Tables"]["rooms"]["Update"];

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = await req.json();
    const { roomId, action } = body as {
      roomId?: string;
      action?: "advance" | "end" | "reset";
    };

    if (!roomId || !action) {
      return NextResponse.json({ error: "INVALID_PAYLOAD" }, { status: 400 });
    }

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, teacher_id, state, current_question_index, snapshot")
      .eq("id", roomId)
      .eq("teacher_id", user.id)
      .maybeSingle();

    if (roomError || !room) {
      return NextResponse.json({ error: "ROOM_NOT_FOUND_OR_FORBIDDEN" }, { status: 404 });
    }

    const snapshotObj = room.snapshot as { questions?: unknown[] } | null;
    const questions = snapshotObj?.questions ?? [];
    const totalQuestions = questions.length;
    const currentIndex = room.current_question_index ?? 0;

    // FITUR: Reset Room kembali ke Data Awal (Soal 1, Skor 0, siap dimainkan ulang)
    if (action === "reset") {
      ActiveRoomStore.resetRoom(roomId);
      // Hapus jawaban + reset room lewat SECURITY DEFINER RPC (migrasi 0068):
      // tabel submissions tidak punya policy DELETE untuk peran mana pun
      // (migrasi 0002), jadi penghapusan lewat klien RLS guru selalu mengenai
      // 0 baris TANPA error - jawaban siswa tidak pernah terhapus di DB dan
      // indeks soal siswa (dihitung dari submissions) tidak kembali ke 1.
      const { error: resetError } = await supabase.rpc("reset_room_session", {
        p_room_id: roomId,
      });

      if (resetError) {
        return NextResponse.json({ error: resetError.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        room_state: "running",
        current_question_index: 0,
        total_questions: totalQuestions,
      });
    }

    if (action === "end") {
      ActiveRoomStore.endRoom(roomId);
      const updatePayload: RoomUpdate = {
        state: "ended",
        ended_at: new Date().toISOString(),
      };

      const { error: endError } = await supabase
        .from("rooms")
        .update(updatePayload)
        .eq("id", roomId);

      if (endError) {
        return NextResponse.json({ error: endError.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        room_state: "ended",
        current_question_index: currentIndex,
      });
    }

    if (action === "advance") {
      const advanceResult = ActiveRoomStore.advanceRoom(roomId);
      const nextIndex = advanceResult.current_question_index;
      const isEnded = advanceResult.room_state === "ended" || nextIndex >= totalQuestions;

      const updatePayload: RoomUpdate = {
        current_question_index: nextIndex,
        question_started_at: new Date().toISOString(),
      };

      if (isEnded) {
        updatePayload.state = "ended";
        updatePayload.ended_at = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from("rooms")
        .update(updatePayload)
        .eq("id", roomId);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        room_state: isEnded ? "ended" : room.state,
        current_question_index: nextIndex,
        total_questions: totalQuestions,
      });
    }

    return NextResponse.json({ error: "UNKNOWN_ACTION" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
