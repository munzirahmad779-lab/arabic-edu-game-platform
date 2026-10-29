import { NextRequest, NextResponse } from "next/server";
import {
  buildSyncedGameState,
  createDefaultProjectorRoomData,
  fetchProjectorRoomData,
  pressProjectorButton,
  syncProjectorGameState,
  touchProjectorController,
  PROJECTOR_CONTROLLER_ACTIVE_MS,
  PROJECTOR_EVENT_TTL_MS,
} from "@/lib/game-engine/projector-controller-store";

// State room dibaca/ditulis lewat store bersama berbasis Supabase
// (projector_room_states, migrasi 0078): semua instance server melihat
// state yang sama. Sebelumnya route ini memakai Map in-memory per
// instance, sehingga jawaban stik bisa hilang dan stik terdesinkron dari
// proyektor di Vercel serverless. Bentuk payload di bawah tidak berubah.

// GET /api/projector/controller?roomCode=HOTSEAT&since=123456789&teamId=team-1
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const roomCode = searchParams.get("roomCode") || "HOTSEAT";
  const since = Number(searchParams.get("since") || "0");
  const teamId = searchParams.get("teamId") || "";

  // Room yang belum ada / sudah kedaluwarsa dijawab dengan state bawaan
  // tanpa dibuat permanen (room hanya lahir dari sync proyektor / press /
  // heartbeat, bukan dari polling).
  const roomData =
    (await fetchProjectorRoomData(roomCode)) ??
    createDefaultProjectorRoomData();
  const now = Date.now();

  // Clean old events (> 60s)
  const freshEvents = roomData.events.filter(
    (e) => now - e.timestamp < PROJECTOR_EVENT_TTL_MS,
  );

  // Filter events strictly newer than 'since'
  const newEvents = freshEvents.filter((e) => e.timestamp > since);

  // Active controllers connected within last 15 seconds
  const activeControllers = Object.entries(roomData.heartbeats)
    .filter(([, lastSeen]) => now - lastSeen < PROJECTOR_CONTROLLER_ACTIVE_MS)
    .map(([tId]) => tId);

  const gs = roomData.gameState;
  const hasMyTeamAnswered = Boolean(teamId && gs.answeredTeams[teamId]);
  const myTeamAnswer = teamId ? gs.answeredTeams[teamId]?.optionKey ?? null : null;
  const isLocked = gs.phase !== "question" || hasMyTeamAnswered;

  return NextResponse.json({
    roomCode: roomCode.toUpperCase(),
    events: newEvents,
    activeControllers,
    serverTime: now,
    gameState: {
      phase: gs.phase,
      currentQuestionIndex: gs.currentQuestionIndex,
      timerSeconds: gs.timerSeconds,
      totalQuestions: gs.totalQuestions,
      questionText: gs.questionText,
      hasMyTeamAnswered,
      myTeamAnswer,
      isLocked,
      answeredCount: Object.keys(gs.answeredTeams).length,
    },
  });
}

// POST /api/projector/controller
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      roomCode = "HOTSEAT",
      teamId,
      playerName = "Pemain",
      optionId,
      optionKey,
      questionIndex,
      action = "press",
      // State sync parameters (from Projector Screen)
      phase,
      currentQuestionIndex,
      timerSeconds,
      totalQuestions,
      questionText,
      answeredTeams,
    } = body;

    const now = Date.now();

    // 1. PROJECTOR SYNC ACTION (Sent by Teacher's Projector Screen)
    if (action === "sync_state") {
      const prevData =
        (await fetchProjectorRoomData(roomCode)) ??
        createDefaultProjectorRoomData(now);

      const targetGameState = buildSyncedGameState(
        prevData.gameState,
        {
          phase,
          currentQuestionIndex,
          timerSeconds,
          totalQuestions,
          questionText,
          answeredTeams,
        },
        now,
      );

      // The store re-applies the union-merge against the authoritative
      // stored state, so a press recorded after our read survives the sync.
      const gameState = await syncProjectorGameState(roomCode, targetGameState);

      return NextResponse.json({ success: true, gameState });
    }

    if (!teamId) {
      return NextResponse.json({ error: "MISSING_TEAM_ID" }, { status: 400 });
    }

    // 2. STUDENT BUTTON PRESS ACTION
    if (action === "press") {
      // Guards (inside the store/RPC): the press must carry the question
      // index shown on the stick and it must equal the room's current
      // question index, otherwise the press is rejected as STALE_QUESTION
      // and nothing is recorded (ghost-answer guard); a team can only
      // answer ONCE per question (ALREADY_ANSWERED); the press also
      // records the team's heartbeat.
      const result = await pressProjectorButton(roomCode, {
        teamId,
        playerName,
        optionId,
        optionKey,
        questionIndex:
          typeof questionIndex === "number" ? questionIndex : null,
      });

      if (!result.success) {
        if (result.error === "STALE_QUESTION") {
          return NextResponse.json(
            {
              success: false,
              error: "STALE_QUESTION",
              message:
                "Soal sudah berganti; jawaban untuk soal sebelumnya tidak dicatat.",
              existingAnswer: null,
            },
            { status: 409 },
          );
        }
        return NextResponse.json(
          {
            success: false,
            error: "ALREADY_ANSWERED",
            message: "Jawaban tim Anda sudah tercatat dan terkunci!",
            existingAnswer: result.existingAnswer,
          },
          { status: 409 },
        );
      }

      return NextResponse.json({
        success: true,
        eventId: result.eventId,
        optionKey: result.optionKey,
        timestamp: result.timestamp,
        isLocked: true,
      });
    }

    // 3. HEARTBEAT ACTION
    const timestamp = await touchProjectorController(roomCode, teamId);
    return NextResponse.json({ success: true, action: "heartbeat", timestamp });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
