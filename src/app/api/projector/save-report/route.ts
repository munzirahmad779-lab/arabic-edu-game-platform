import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

    const now = new Date();
    const startedAt = new Date(now.getTime() - targetRounds * 60 * 1000).toISOString();
    const endedAt = now.toISOString();
    const code = roomCode || `PROJ-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const isUuid = (val?: string): val is string =>
      Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val));

    const validGameId = isUuid(gameId) ? gameId : null;
    const validClassId = isUuid(classId) ? classId : null;

    // 1. Create completed room entry
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .insert({
        code,
        teacher_id: user.id,
        game_id: validGameId,
        class_id: validClassId,
        state: "ended",
        capacity: 40,
        current_question_index: targetRounds,
        started_at: startedAt,
        ended_at: endedAt,
        snapshot: {
          game: {
            id: validGameId,
            name: gameName || "Mode Proyektor Hotseat",
            mode: "projector",
          },
          targetRounds,
        },
      })
      .select("id")
      .single();

    if (roomError || !room) {
      console.error("[save-projector-report] Error creating room:", roomError);
      return NextResponse.json(
        { error: roomError?.message || "FAILED_TO_CREATE_ROOM" },
        { status: 500 },
      );
    }

    // 2. Create room_sessions entry
    const { data: session, error: sessionError } = await supabase
      .from("room_sessions")
      .insert({
        room_id: room.id,
        session_number: 1,
        started_at: startedAt,
        ended_at: endedAt,
      })
      .select("id")
      .single();

    if (sessionError || !session) {
      console.error("[save-projector-report] Error creating room session:", sessionError);
      return NextResponse.json(
        { error: sessionError?.message || "FAILED_TO_CREATE_SESSION" },
        { status: 500 },
      );
    }

    // 3. Sort teams by score descending and assign 1-based ranks
    const sortedTeams = [...teams].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    // 4. Insert participants: both team entries and individual student entries
    const participantRows: Array<{
      session_id: string;
      participant_name: string;
      final_score: number;
      rank: number;
      correct_count: number;
      total_questions: number;
      avg_response_ms: number;
    }> = [];

    sortedTeams.forEach((t, idx) => {
      const calculatedRank = typeof t.rank === "number" && t.rank > 0 ? t.rank : idx + 1;
      const studentNames = (t.members || []).map((m) => m.name).filter(Boolean);
      const studentLabel = studentNames.length > 0 ? ` (${studentNames.join(", ")})` : "";

      // Team collective row
      participantRows.push({
        session_id: session.id,
        participant_name: `${t.name}${studentLabel}`,
        final_score: t.score ?? 0,
        rank: calculatedRank,
        correct_count: t.correctCount ?? 0,
        total_questions: targetRounds,
        avg_response_ms: 2500,
      });

      // Individual student rows so they appear directly by student name in daily report
      (t.members || []).forEach((m) => {
        participantRows.push({
          session_id: session.id,
          participant_name: `${m.name} [${t.name.split(" ")[0] || "Tim"}]`,
          final_score: t.score ?? 0,
          rank: calculatedRank,
          correct_count: t.correctCount ?? 0,
          total_questions: targetRounds,
          avg_response_ms: 2500,
        });
      });
    });

    if (participantRows.length > 0) {
      const { error: partError } = await supabase
        .from("room_session_participants")
        .insert(participantRows);

      if (partError) {
        console.error("[save-projector-report] Error inserting participants:", partError);
        return NextResponse.json(
          { error: partError.message || "FAILED_TO_INSERT_PARTICIPANTS" },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({
      success: true,
      roomId: room.id,
      sessionId: session.id,
      recordedCount: participantRows.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
