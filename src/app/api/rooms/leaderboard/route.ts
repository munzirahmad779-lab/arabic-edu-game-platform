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

    // 1. Check in-memory store
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

    // 2. Supabase fallback
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.rpc("get_room_leaderboard_student", {
        p_join_token: token,
      });

      if (!error && Array.isArray(data)) {
        return NextResponse.json(data);
      }
    } catch {
      // ignore
    }

    return NextResponse.json([]);
  } catch (err: unknown) {
    console.error("[/api/rooms/leaderboard] Error:", err);
    return NextResponse.json([]);
  }
}
