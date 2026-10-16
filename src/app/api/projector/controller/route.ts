import { NextRequest, NextResponse } from "next/server";
import {
  type ControllerEvent,
  getProjectorRoomData,
} from "@/lib/game-engine/projector-controller-store";

// GET /api/projector/controller?roomCode=HOTSEAT&since=123456789&teamId=team-1
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const roomCode = searchParams.get("roomCode") || "HOTSEAT";
  const since = Number(searchParams.get("since") || "0");
  const teamId = searchParams.get("teamId") || "";

  const roomData = getProjectorRoomData(roomCode);
  const now = Date.now();

  // Clean old events (> 60s)
  roomData.events = roomData.events.filter((e) => now - e.timestamp < 60000);

  // Filter events strictly newer than 'since'
  const newEvents = roomData.events.filter((e) => e.timestamp > since);

  // Active controllers connected within last 15 seconds
  const activeControllers = Object.entries(roomData.heartbeats)
    .filter(([, lastSeen]) => now - lastSeen < 15000)
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
      action = "press",
      // State sync parameters (from Projector Screen)
      phase,
      currentQuestionIndex,
      timerSeconds,
      totalQuestions,
      questionText,
      answeredTeams,
    } = body;

    const roomData = getProjectorRoomData(roomCode);
    const now = Date.now();

    // 1. PROJECTOR SYNC ACTION (Sent by Teacher's Projector Screen)
    if (action === "sync_state") {
      const prevQIndex = roomData.gameState.currentQuestionIndex;
      const newQIndex = typeof currentQuestionIndex === "number" ? currentQuestionIndex : prevQIndex;

      // If new question started, reset answeredTeams if not explicitly provided
      let updatedAnsweredTeams = roomData.gameState.answeredTeams;
      if (newQIndex !== prevQIndex) {
        updatedAnsweredTeams = {};
      }
      if (answeredTeams && typeof answeredTeams === "object") {
        updatedAnsweredTeams = { ...answeredTeams };
      }

      roomData.gameState = {
        phase: phase ?? roomData.gameState.phase,
        currentQuestionIndex: newQIndex,
        timerSeconds: typeof timerSeconds === "number" ? timerSeconds : roomData.gameState.timerSeconds,
        totalQuestions: typeof totalQuestions === "number" ? totalQuestions : roomData.gameState.totalQuestions,
        questionText: questionText ?? roomData.gameState.questionText,
        answeredTeams: updatedAnsweredTeams,
        lastUpdated: now,
      };

      return NextResponse.json({ success: true, gameState: roomData.gameState });
    }

    if (!teamId) {
      return NextResponse.json({ error: "MISSING_TEAM_ID" }, { status: 400 });
    }

    // Update heartbeat
    roomData.heartbeats[teamId] = now;

    // 2. STUDENT BUTTON PRESS ACTION
    if (action === "press") {
      const gs = roomData.gameState;

      // Guard 1: Must be in question phase
      if (gs.phase !== "question") {
        return NextResponse.json(
          {
            success: false,
            error: "LOCKED_PHASE",
            message: "Waktu menjawab telah ditutup atau belum dimulai!",
          },
          { status: 403 },
        );
      }

      // Guard 2: Team can only answer ONCE per question
      if (gs.answeredTeams[teamId]) {
        return NextResponse.json(
          {
            success: false,
            error: "ALREADY_ANSWERED",
            message: "Jawaban tim Anda sudah tercatat dan terkunci!",
            existingAnswer: gs.answeredTeams[teamId]?.optionKey,
          },
          { status: 409 },
        );
      }

      const keyUpper = (optionKey || "A").toUpperCase().trim();

      // Record lock immediately on server
      gs.answeredTeams[teamId] = {
        optionKey: keyUpper,
        timestamp: now,
      };

      const event: ControllerEvent = {
        id: `evt-${now}-${Math.random().toString(36).slice(2, 6)}`,
        roomCode: roomCode.toUpperCase(),
        teamId,
        playerName,
        optionId: optionId ?? null,
        optionKey: keyUpper,
        action: "press",
        timestamp: now,
      };

      roomData.events.push(event);

      return NextResponse.json({
        success: true,
        eventId: event.id,
        optionKey: keyUpper,
        timestamp: now,
        isLocked: true,
      });
    }

    return NextResponse.json({ success: true, action: "heartbeat", timestamp: now });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
