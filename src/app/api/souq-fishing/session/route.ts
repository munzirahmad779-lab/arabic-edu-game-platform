import { NextResponse } from "next/server";
import {
  createDefaultRoomState,
  getRandomFish,
} from "@/modules/souq-fishing/standalone/engine";
import { DEFAULT_STANDALONE_QUESTIONS } from "@/modules/souq-fishing/standalone/data/default-questions";
import type {
  StandaloneRoomState,
  TeamColor,
  LocationId,
  ActiveStudent,
  StandaloneQuestion,
} from "@/modules/souq-fishing/standalone/types";

// In-memory global store to share rooms across server requests
declare global {
  // eslint-disable-next-line no-var
  var __SOUQ_ROOMS__: Record<string, StandaloneRoomState> | undefined;
}

if (!globalThis.__SOUQ_ROOMS__) {
  globalThis.__SOUQ_ROOMS__ = {};
}

const roomsStore = globalThis.__SOUQ_ROOMS__;

function getOrCreateRoom(roomCode: string): StandaloneRoomState {
  const code = (roomCode || "SOUQ01").toUpperCase();
  if (!roomsStore[code]) {
    roomsStore[code] = createDefaultRoomState(code, "proyektor_4team");
  }
  return roomsStore[code]!;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const roomCode = searchParams.get("roomCode") || "SOUQ01";
  const room = getOrCreateRoom(roomCode);

  return NextResponse.json({
    success: true,
    room,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, roomCode = "SOUQ01", payload } = body;
    const room = getOrCreateRoom(roomCode);

    switch (action) {
      case "MOVE_TEAM": {
        const { team, targetLocation } = payload as {
          team: TeamColor;
          targetLocation: LocationId;
        };
        const tm = room.teams[team];
        if (tm) {
          tm.location = targetLocation;
          tm.status = "TRAVELING";
          tm.travelStartMs = Date.now();
          tm.travelDurationMs = 1500;
          tm.zone = targetLocation.startsWith("DERMAGA") ? "DERMAGA" : "PASAR";

          // If moved to gate or pier, prepare corresponding challenge
          if (targetLocation === "KIOS" || targetLocation === "GERBANG_KANTIN") {
            const q =
              room.questions[room.currentQIndex % room.questions.length] ||
              DEFAULT_STANDALONE_QUESTIONS[0]!;
            room.currentQIndex++;
            tm.currentQuestion = q;
            tm.status = "IN_GATE_QUESTION";
          } else if (targetLocation === "DERMAGA_1" || targetLocation === "DERMAGA_VIP") {
            const isVip = targetLocation === "DERMAGA_VIP";
            const fish = getRandomFish(isVip);
            const q =
              room.questions[room.currentQIndex % room.questions.length] ||
              DEFAULT_STANDALONE_QUESTIONS[0]!;
            room.currentQIndex++;
            tm.currentQuestion = q;
            tm.currentFishCatch = fish;
            tm.status = "IN_FISHING_QUESTION";
          } else {
            tm.status = "IDLE";
          }
        }
        break;
      }

      case "START_GATE": {
        const { team } = payload as { team: TeamColor };
        const tm = room.teams[team];
        if (tm) {
          const q =
            room.questions[room.currentQIndex % room.questions.length] ||
            DEFAULT_STANDALONE_QUESTIONS[0]!;
          room.currentQIndex++;
          tm.currentQuestion = q;
          tm.status = "IN_GATE_QUESTION";
        }
        break;
      }

      case "START_FISHING": {
        const { team, isVip = false } = payload as { team: TeamColor; isVip?: boolean };
        const tm = room.teams[team];
        if (tm) {
          const fish = getRandomFish(isVip);
          const q =
            room.questions[room.currentQIndex % room.questions.length] ||
            DEFAULT_STANDALONE_QUESTIONS[0]!;
          room.currentQIndex++;
          tm.currentQuestion = q;
          tm.currentFishCatch = fish;
          tm.status = "IN_FISHING_QUESTION";
        }
        break;
      }

      case "ANSWER_QUESTION": {
        const { team, optionKey, studentId } = payload as {
          team: TeamColor;
          optionKey: "A" | "B" | "C" | "D";
          studentId?: string;
        };
        const tm = room.teams[team];
        if (tm && tm.currentQuestion) {
          const isCorrect = tm.currentQuestion.correct_option === optionKey;

          if (tm.status === "IN_GATE_QUESTION") {
            if (isCorrect) {
              tm.points += 150;
              tm.pinsUnlocked = Math.min(tm.pinsRequired, tm.pinsUnlocked + 1);
            } else {
              tm.points = Math.max(0, tm.points - 20);
            }
            tm.status = "IDLE";
            tm.currentQuestion = undefined;
          } else if (tm.status === "IN_FISHING_QUESTION") {
            if (isCorrect && tm.currentFishCatch) {
              const catchItem = {
                id: `catch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                name: tm.currentFishCatch.name,
                rarity: tm.currentFishCatch.rarity,
                points: tm.currentFishCatch.points,
                caughtAt: Date.now(),
              };
              tm.points += catchItem.points;
              tm.fishCatches.push(catchItem);
            } else {
              tm.points = Math.max(0, tm.points - 30);
            }
            tm.status = "IDLE";
            tm.currentQuestion = undefined;
            tm.currentFishCatch = undefined;
          }

          // Update student stats if present
          if (studentId) {
            const st = room.students.find((s) => s.id === studentId);
            if (st) {
              st.totalQAnswered++;
              if (isCorrect) st.correctCount++;
              st.lastActive = Date.now();
            }
          }
        }
        break;
      }

      case "TEACHER_UNLOCK": {
        const { team } = payload as { team: TeamColor };
        const tm = room.teams[team];
        if (tm) {
          tm.pinsUnlocked = Math.min(tm.pinsRequired, tm.pinsUnlocked + 1);
          tm.points += 100;
          tm.status = "IDLE";
          tm.currentQuestion = undefined;
        }
        break;
      }

      case "JOIN_STUDENT": {
        const { student } = payload as { student: ActiveStudent };
        const existingIdx = room.students.findIndex((s) => s.id === student.id);
        if (existingIdx >= 0) {
          room.students[existingIdx] = {
            ...room.students[existingIdx]!,
            ...student,
            lastActive: Date.now(),
          };
        } else {
          room.students.push({
            ...student,
            lastActive: Date.now(),
          });
        }
        break;
      }

      case "UPDATE_QUESTIONS": {
        const { questions } = payload as { questions: StandaloneQuestion[] };
        if (Array.isArray(questions) && questions.length > 0) {
          room.questions = questions;
        }
        break;
      }

      case "RESET_ROOM": {
        roomsStore[room.roomCode] = createDefaultRoomState(
          room.roomCode,
          room.mode,
          room.questions
        );
        break;
      }

      default:
        return NextResponse.json(
          { success: false, error: "Action not recognized" },
          { status: 400 }
        );
    }

    room.updatedAt = Date.now();

    return NextResponse.json({
      success: true,
      room,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
