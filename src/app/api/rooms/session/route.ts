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

/**
 * Sesi siswa: database adalah SATU-SATUNYA sumber kebenaran.
 *
 * Latar (terverifikasi live 29 Okt 2026): versi lama menjawab polling dari
 * ActiveRoomStore (memori per instance) bila RPC utama gagal, dan
 * registerParticipant dapat mengarang room placeholder beku. Di Vercel
 * multi-instance siswa mendarat di instance acak: snapshot beku dari saat
 * join menjawab selamanya (waiting tidak pernah berubah, soal tiba sudah
 * kedaluwarsa, keadaan mundur). Sekarang:
 * - Jalur utama: RPC get_game_session, respons dibangun MURNI dari hasil RPC.
 * - Jalur cadangan: RPC/kueri DB lain (get_join_session, tabel lewat RPC
 *   reconnect) - tetap data DB, tidak pernah memori instance.
 * - Registrasi ke ActiveRoomStore dipertahankan HANYA sebagai cache tulis
 *   untuk konsumen server lain; ia tidak pernah menyusun respons di sini.
 */
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

    // 1. Authoritative Supabase RPC get_game_session
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

        // Cache tulis saja: hasil registrasi TIDAK dipakai menyusun respons.
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

    // 2. Fallback DB: RPC get_join_session + baris room dari tabel rooms.
    // (Langkah lama yang menjawab dari memori ActiveRoomStore.getByToken
    // DIHAPUS: snapshot memori per instance adalah akar keadaan beku/mundur
    // di produksi multi-instance.)
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

        // Selalu baca baris room terbaru dari DB (bukan cache memori).
        const { data: roomRow } = await supabase
          .from("rooms")
          .select("id, code, state, started_at, current_question_index, question_started_at, question_duration_seconds, snapshot, capacity")
          .eq("id", row.room_id)
          .maybeSingle();

        const snap = roomRow?.snapshot as {
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

        const qIdx = roomRow?.current_question_index ?? 0;
        const currentQ = normQs[qIdx] ?? null;

        // Cache tulis saja.
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
          game_name: snap?.game?.name || row.game_name || "Game",
          game_type: snap?.game?.game_type || (snap?.game?.mode === "anagram" ? "anagram" : "quiz"),
          game_mode: snap?.game?.mode || "competitive",
          game_duration_seconds: snap?.game?.duration_seconds || 300,
          question_duration_seconds: roomRow?.question_duration_seconds ?? null,
          started_at: roomRow?.started_at ?? null,
          room_state: (roomRow?.state as string) || rState,
          participant_id: row.participant_id,
          participant_name: row.participant_name || "Santri Magguru",
          participant_count: row.participant_count || 1,
          capacity: row.capacity || roomRow?.capacity || 30,
          question_index: qIdx,
          question_count: normQs.length,
          question_started_at: roomRow?.question_started_at ?? null,
          question: toPublicQuestion(currentQ),
          answer_submitted: false,
          server_time: new Date().toISOString(),
        });
      }
    } catch (fallbackErr) {
      console.warn("[/api/rooms/session] get_join_session fallback notice:", fallbackErr);
    }

    // 3. Direct Table Check on room_participants (data DB; tunduk RLS)
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
            question_started_at,
            question_duration_seconds
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
          question_duration_seconds: number | null;
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

        const { count: dbParticipantCount } = await supabase
          .from("room_participants")
          .select("id", { count: "exact", head: true })
          .eq("room_id", rData.id);

        // Cache tulis saja.
        ActiveRoomStore.registerRoom({
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
          game_type: snap?.game?.game_type || (snap?.game?.mode === "anagram" ? "anagram" : "quiz"),
          game_mode: snap?.game?.mode || "competitive",
          game_duration_seconds: snap?.game?.duration_seconds || 300,
          question_duration_seconds: rData.question_duration_seconds ?? null,
          started_at: rData.started_at,
          room_state: rState,
          participant_id: partRow.id,
          participant_name: pName,
          participant_count: dbParticipantCount ?? 1,
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

    // 4. Auto-reconnect by Room Code via SECURITY DEFINER RPC.
    // Jalur lama membaca tabel rooms dan menyisipkan room_participants secara
    // langsung sebagai anon; RLS (migrasi 0002) hanya memberi policy kepada
    // authenticated pemilik ruangan, sehingga jalur itu selalu kosong di
    // produksi dan siswa yang tokennya hilang terkunci di SESSION_NOT_FOUND.
    // RPC reconnect_room_participant (migrasi 0068) melakukan pencarian yang
    // sama dari sisi definer. Bila token pulih, jawaban akhir tetap dibangun
    // dari RPC get_game_session (sumber DB yang sama dengan jalur utama).
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
          // Jawaban otoritatif dari RPC utama memakai token yang pulih.
          const { data: sessData, error: sessError } = await supabase.rpc(
            "get_game_session",
            { p_join_token: rec.join_token }
          );

          if (!sessError && sessData && sessData[0]) {
            const sess = { ...(sessData[0] as Record<string, unknown>) };
            const sIdx = Number(sess.question_index ?? 0);
            sess.question = toPublicQuestion(
              normalizeSnapshotQuestion(sess.question, sIdx)
            );
            return NextResponse.json({
              ...sess,
              new_join_token: rec.join_token,
            });
          }

          // Cadangan terakhir: susun dari snapshot DB yang dikembalikan RPC
          // reconnect itu sendiri (tetap data DB, bukan memori instance).
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

          // Cache tulis saja.
          ActiveRoomStore.registerRoom({
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
            game_type: String(
              snapGame?.game_type ??
                (snapGame?.mode === "anagram" ? "anagram" : "quiz")
            ),
            game_mode: String(snapGame?.mode ?? "competitive"),
            game_duration_seconds: Number(snapGame?.duration_seconds ?? 300),
            question_duration_seconds: null,
            started_at: rec.started_at,
            room_state: rState,
            participant_id: rec.participant_id,
            participant_name: rec.participant_name || "Santri Magguru",
            participant_count: 1,
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
