/**
 * Gate Unlock & Assistance Ladder Logic.
 * Canonical Rules:
 * - Pin: +20 points per correct answer.
 * - Gate 1 (KIOS): 3 pins, +100 completion bonus (NOT awarded if assisted).
 * - Gate 2 (GERBANG_KANTIN): 4 pins (requires G1 cleared), +100 completion bonus (NOT awarded if assisted).
 * - Assistance Ladder:
 *   - 2 consecutive wrong -> HIDE_WRONG_OPTION (50:50).
 *   - 3 consecutive wrong -> REST_15S (15-second study cooldown, restUntilMs = nowMs + 15000).
 *   - After 3rd rest cycle completed -> assisted = true, gate cleared WITHOUT +100 bonus.
 */

import type {
  WorldState,
  TeamColor,
  GateId,
  GateUnlockResult,
  GateUnlockEvent,
  TeamState,
} from "./types";

export interface GateDefinition {
  id: GateId;
  requiredPins: number;
  pointsPerPin: number;
  completionBonus: number;
  requiresGate?: GateId;
}

export const GATE_CONFIG: Record<GateId, GateDefinition> = {
  KIOS: {
    id: "KIOS",
    requiredPins: 3,
    pointsPerPin: 20,
    completionBonus: 100,
  },
  GERBANG_KANTIN: {
    id: "GERBANG_KANTIN",
    requiredPins: 4,
    pointsPerPin: 20,
    completionBonus: 100,
    requiresGate: "KIOS",
  },
};

export const REST_DURATION_MS = 15000; // 15 detik

/**
 * Attempts to unlock a pin at a given gate.
 * Pure function: returns updated WorldState, points awarded, and event triggered.
 */
export function attemptUnlockGate(
  world: WorldState,
  teamColor: TeamColor,
  gateId: GateId,
  isCorrect: boolean,
  nowMs: number = 0
): GateUnlockResult {
  const currentTeam = world.teams[teamColor];
  if (!currentTeam) {
    throw new Error(`Team ${teamColor} not found in world state.`);
  }

  const config = GATE_CONFIG[gateId];
  if (!config) {
    throw new Error(`Unknown gate ID: ${gateId}`);
  }

  // Pre-requisite check for Gate 2: must have cleared Gate 1
  if (config.requiresGate) {
    const prereq = GATE_CONFIG[config.requiresGate];
    // A team has cleared G1 if they reached KANTIN/GERBANG_KANTIN/DERMAGA or pins >= 3
    const hasClearedG1 =
      currentTeam.location !== "ALUN" &&
      currentTeam.location !== "KIOS" &&
      currentTeam.pinsUnlocked >= prereq.requiredPins;

    if (!hasClearedG1) {
      throw new Error(
        `Syarat lulus ${config.requiresGate} belum terpenuhi untuk mengakses ${gateId}.`
      );
    }
  }

  if (isCorrect) {
    const nextPins = currentTeam.pinsUnlocked + 1;
    let pointsAwarded = config.pointsPerPin; // +20
    let event: GateUnlockEvent = "PIN_UNLOCKED";

    const isCleared = nextPins >= config.requiredPins;

    if (isCleared) {
      if (currentTeam.assisted) {
        // Assisted graduation: NO +100 bonus!
        event = "ASSISTED_CLEARED";
      } else {
        // Standard graduation: award +100 bonus!
        pointsAwarded += config.completionBonus;
        event = "GATE_CLEARED";
      }
    }

    const updatedTeam: TeamState = {
      ...currentTeam,
      pinsUnlocked: nextPins,
      gateAttempts: currentTeam.gateAttempts + 1,
      consecutiveWrong: 0,
      points: currentTeam.points + pointsAwarded,
      status: isCleared ? "IDLE_AT_GATE" : "IN_GATE_QUESTION",
    };

    return {
      world: {
        ...world,
        teams: {
          ...world.teams,
          [teamColor]: updatedTeam,
        },
      },
      pointsAwarded,
      event,
    };
  }

  // Incorrect submission: progress assistance ladder
  const nextConsecutiveWrong = currentTeam.consecutiveWrong + 1;
  let event: GateUnlockEvent = "WRONG_ANSWER";
  let nextRestCount = currentTeam.restCount;
  let nextRestUntilMs = currentTeam.restUntilMs;
  let nextAssisted = currentTeam.assisted;
  let nextStatus = currentTeam.status;
  let nextPins = currentTeam.pinsUnlocked;
  let pointsAwarded = 0;

  if (nextConsecutiveWrong === 2) {
    // 2 consecutive wrong -> 50:50 assistance
    event = "HIDE_WRONG_OPTION";
  } else if (nextConsecutiveWrong >= 3) {
    nextRestCount += 1;
    nextRestUntilMs = nowMs + REST_DURATION_MS;
    nextStatus = "ASSISTED_WAITING";

    if (nextRestCount >= 3) {
      // After 3rd rest cycle: Lulus Dibantu (assisted = true)
      nextAssisted = true;
      nextPins = config.requiredPins;
      event = "ASSISTED_CLEARED";
      nextStatus = "IDLE_AT_GATE";
      // NO +100 bonus awarded!
      pointsAwarded = 0;
    } else {
      event = "REST_15S";
    }
  }

  const updatedTeam: TeamState = {
    ...currentTeam,
    gateAttempts: currentTeam.gateAttempts + 1,
    consecutiveWrong: nextConsecutiveWrong,
    restCount: nextRestCount,
    restUntilMs: nextRestUntilMs,
    assisted: nextAssisted,
    status: nextStatus,
    pinsUnlocked: nextPins,
  };

  return {
    world: {
      ...world,
      teams: {
        ...world.teams,
        [teamColor]: updatedTeam,
      },
    },
    pointsAwarded,
    event,
  };
}
