export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { ActiveRoomStore } from "@/lib/game-engine/room-store";
import { MIN_QUESTION_DURATION_SECONDS } from "@/lib/game-engine/question-duration";

type RoomUpdate = Database["public"]["Tables"]["rooms"]["Update"];

type ControlAction = "advance" | "end" | "reset" | "set_duration";

/**
 * Kontrol room guru: database adalah SATU-SATUNYA sumber kebenaran.
 *
 * Latar (terverifikasi live 29 Okt 2026): versi lama menurunkan hasil
 * advance dari ActiveRoomStore (memori per instance server) dan menulis ke
 * DB tanpa memeriksa baris yang terubah. Di Vercel multi-instance, klik
 * guru dan polling siswa dilayani instance berbeda dengan salinan memori
 * berbeda: soal berikutnya tidak pernah sampai dan tombol Akhiri hilang
 * tanpa jejak. Sekarang setiap aksi (kecuali reset, yang sudah memakai RPC)
 * membaca keadaan dari DB, menghitung hasil dari keadaan DB itu, menulis
 * dengan .select(), dan GAGAL TEGAS (409) bila 0 baris terubah. Memori
 * hanya diperbarui SESUDAH DB berhasil, sebagai cache untuk konsumen lain.
 */
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
    const { roomId, action, durationSeconds } = body as {
      roomId?: string;
      action?: ControlAction;
      durationSeconds?: number | null;
    };

    if (!roomId || !action) {
      return NextResponse.json({ error: "INVALID_PAYLOAD" }, { status: 400 });
    }

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, teacher_id, state, current_question_index, question_duration_seconds, snapshot")
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

    if (action === "set_duration") {
      // Durasi per soal diatur guru (keputusan user 29 Okt 2026): nilai NULL
      // berarti kembali ikut difficulty (dengan lantai 30 detik dari fungsi
      // DB game_effective_time_limit_seconds, migrasi 0074). Nilai angka
      // harus utuh dan tidak di bawah lantai minimum.
      if (room.state === "ended") {
        return NextResponse.json({ error: "ROOM_ALREADY_ENDED" }, { status: 409 });
      }

      let nextDuration: number | null;
      if (durationSeconds === null || durationSeconds === undefined) {
        nextDuration = null;
      } else if (
        typeof durationSeconds === "number" &&
        Number.isInteger(durationSeconds) &&
        durationSeconds >= MIN_QUESTION_DURATION_SECONDS &&
        durationSeconds <= 300
      ) {
        nextDuration = durationSeconds;
      } else {
        return NextResponse.json({ error: "INVALID_DURATION" }, { status: 400 });
      }

      const { data: updated, error: durationError } = await supabase
        .from("rooms")
        .update({ question_duration_seconds: nextDuration })
        .eq("id", roomId)
        .eq("teacher_id", user.id)
        .select("id, question_duration_seconds");

      if (durationError) {
        return NextResponse.json({ error: durationError.message }, { status: 500 });
      }

      if (!updated || updated.length === 0) {
        return NextResponse.json(
          { error: "ROOM_UPDATE_AFFECTED_NO_ROWS" },
          { status: 409 },
        );
      }

      return NextResponse.json({
        success: true,
        room_state: room.state,
        question_duration_seconds: updated[0].question_duration_seconds,
      });
    }

    if (action === "end") {
      const updatePayload: RoomUpdate = {
        state: "ended",
        ended_at: new Date().toISOString(),
      };

      const { data: updated, error: endError } = await supabase
        .from("rooms")
        .update(updatePayload)
        .eq("id", roomId)
        .eq("teacher_id", user.id)
        .select("id, state");

      if (endError) {
        return NextResponse.json({ error: endError.message }, { status: 500 });
      }

      if (!updated || updated.length === 0) {
        return NextResponse.json(
          { error: "ROOM_UPDATE_AFFECTED_NO_ROWS" },
          { status: 409 },
        );
      }

      // Cache memori diperbarui hanya sesudah DB berhasil.
      ActiveRoomStore.endRoom(roomId);

      return NextResponse.json({
        success: true,
        room_state: "ended",
        current_question_index: currentIndex,
      });
    }

    if (action === "advance") {
      // Indeks berikutnya dihitung dari keadaan DB yang baru dibaca di atas,
      // BUKAN dari salinan memori instance ini.
      const nextIndex = Math.min(currentIndex + 1, totalQuestions);
      const isEnded = nextIndex >= totalQuestions;

      const updatePayload: RoomUpdate = {
        current_question_index: nextIndex,
        question_started_at: new Date().toISOString(),
      };

      if (isEnded) {
        updatePayload.state = "ended";
        updatePayload.ended_at = new Date().toISOString();
      }

      const { data: updated, error: updateError } = await supabase
        .from("rooms")
        .update(updatePayload)
        .eq("id", roomId)
        .eq("teacher_id", user.id)
        .select("id, state, current_question_index");

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      if (!updated || updated.length === 0) {
        return NextResponse.json(
          { error: "ROOM_UPDATE_AFFECTED_NO_ROWS" },
          { status: 409 },
        );
      }

      // Cache memori diselaraskan ke nilai DB yang terbukti tertulis
      // (hanya bila instance ini memang sudah mengenal room-nya).
      if (ActiveRoomStore.getRoomById(roomId)) {
        ActiveRoomStore.registerRoom({
          id: roomId,
          code: "",
          game_name: "",
          state: isEnded ? "ended" : "running",
          current_question_index: updated[0].current_question_index ?? nextIndex,
          question_started_at: updatePayload.question_started_at ?? null,
        });
      }

      return NextResponse.json({
        success: true,
        room_state: isEnded ? "ended" : room.state,
        current_question_index: updated[0].current_question_index ?? nextIndex,
        total_questions: totalQuestions,
      });
    }

    return NextResponse.json({ error: "UNKNOWN_ACTION" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
