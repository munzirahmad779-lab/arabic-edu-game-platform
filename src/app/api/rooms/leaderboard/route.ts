export const dynamic = "force-dynamic";
export const revalidate = 0;
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ActiveRoomStore } from "@/lib/game-engine/room-store";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token")?.trim();

    if (!token) {
      return NextResponse.json([]);
    }

    // 1. Jalur otoritatif: RPC database. Store memori per-instance hanya
    // mengenal peserta & jawaban yang kebetulan mendarat di instance ini dan
    // menilai dengan skala lokalnya sendiri; bila didahulukan, peringkat dan
    // skor yang dilihat siswa menyimpang dari data guru (terbukti pada uji
    // matriks gameplay: correct_count/final_score berbeda dari RPC).
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.rpc("get_room_leaderboard_student", {
        p_join_token: token,
      });

      if (!error && Array.isArray(data) && data.length > 0) {
        return NextResponse.json(data);
      }
    } catch {
      // ignore: jatuh ke cadangan memori
    }

    // 2. Cadangan: in-memory store (hanya bila RPC tidak menjawab)
    const memoryMatch = ActiveRoomStore.getByToken(token);
    if (memoryMatch) {
      const rows = ActiveRoomStore.getLeaderboard(
        memoryMatch.room.id,
        memoryMatch.participant.id
      );
      if (rows && rows.length > 0) {
        return NextResponse.json(rows);
      }
    }

    return NextResponse.json([]);
  } catch (err: unknown) {
    console.error("[/api/rooms/leaderboard] Error:", err);
    return NextResponse.json([]);
  }
}
