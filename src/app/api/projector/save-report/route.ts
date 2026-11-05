import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  saveProjectorReport,
  type ProjectorReportDb,
} from "@/lib/projector-save-report";

interface SaveProjectorReportBody {
  gameId?: string;
  gameName?: string;
  classId?: string;
  roomCode?: string;
  targetRounds?: number;
  teams?: Array<{
    id: string;
    name: string;
    score: number;
    correctCount: number;
    rank: number;
    members?: Array<{ id: string; name: string }>;
  }>;
}

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

    const body = (await req.json()) as SaveProjectorReportBody;
    const { gameId, gameName, classId, roomCode, targetRounds = 5, teams = [] } = body;

    if (!teams || teams.length === 0) {
      return NextResponse.json({ error: "NO_TEAMS_DATA" }, { status: 400 });
    }

    const isUuid = (val?: string): val is string =>
      Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val));

    // Logika penyimpanan (pemakaian ulang room yang sudah ada untuk code
    // terdaftar, pembuatan room baru hanya bila belum ada) ada di
    // src/lib/projector-save-report.ts agar bisa diuji unit.
    const result = await saveProjectorReport(
      supabase as unknown as ProjectorReportDb,
      {
        teacherId: user.id,
        gameId: isUuid(gameId) ? gameId : null,
        gameName,
        classId: isUuid(classId) ? classId : null,
        roomCode,
        targetRounds,
        teams,
      },
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      roomId: result.roomId,
      sessionId: result.sessionId,
      recordedCount: result.recordedCount,
      reusedRoom: result.reusedRoom,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
