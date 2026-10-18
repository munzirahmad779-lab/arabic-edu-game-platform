/**
 * Fishing Minigame Logic & Scoring Tiers.
 * Canonical Rules:
 * - Common: {50, 75, 100}, 1 question, no timer.
 * - Rare: {200, 250, 300}, 1 question, 20-second timer (20000ms).
 * - Epic: {450, 500, 550, 600}, 2-question chain (n = 2).
 * - Legendary: {800, 1000, 1200}, 3-question chain (n = 3).
 * - Chain Failure: partial points = floor(0.25 * value * correct / n).
 * - Canteen Buff: +20% points, rounded up via Math.ceil.
 */

import type {
  WorldState,
  TeamColor,
  FishTier,
  FishingAnswerResult,
  FishingEvent,
  TeamState,
} from "./types";
import type { RngProvider } from "./rng";
import { getActiveBuffMultipliers } from "./buffs";

export interface FishTierConfig {
  points: readonly number[];
  chain: number;
  timerMs: number | null;
}

export const FISH_TIER_CONFIG: Record<FishTier, FishTierConfig> = {
  COMMON: {
    points: [50, 75, 100],
    chain: 1,
    timerMs: null,
  },
  RARE: {
    points: [200, 250, 300],
    chain: 1,
    timerMs: 20000, // 20 detik
  },
  EPIC: {
    points: [450, 500, 550, 600],
    chain: 2,
    timerMs: null,
  },
  LEGENDARY: {
    points: [800, 1000, 1200],
    chain: 3,
    timerMs: null,
  },
};

/**
 * Initiates a fishing bite for a team based on tier and RNG.
 * Pure function: sets target points, timer, chainProgress, and status to IN_FISHING_QUESTION.
 */
export function hookFish(
  world: WorldState,
  teamColor: TeamColor,
  tier: FishTier,
  rng: RngProvider,
  nowMs: number = 0
): { world: WorldState; targetPoints: number } {
  const currentTeam = world.teams[teamColor];
  if (!currentTeam) {
    throw new Error(`Team ${teamColor} not found in world state.`);
  }

  const config = FISH_TIER_CONFIG[tier];
  if (!config) {
    throw new Error(`Unknown fish tier: ${tier}`);
  }

  // Select point value discretely using RNG
  const pointIndex = Math.min(
    config.points.length - 1,
    Math.floor(rng.nextFloat() * config.points.length)
  );
  const targetPoints = config.points[pointIndex];

  const timerUntilMs = config.timerMs != null ? nowMs + config.timerMs : null;

  const updatedTeam: TeamState = {
    ...currentTeam,
    status: "IN_FISHING_QUESTION",
    currentQuestion: {
      tier,
      targetPoints,
      timerUntilMs,
    },
    chainProgress: {
      targetLength: config.chain,
      correctCount: 0,
      totalPoints: targetPoints,
    },
  };

  return {
    world: {
      ...world,
      teams: {
        ...world.teams,
        [teamColor]: updatedTeam,
      },
    },
    targetPoints,
  };
}

/**
 * Submits an answer for the active fishing question.
 * Handles single questions, chain progressions, partial failure points, and Canteen Buff +20% (Math.ceil).
 */
export function submitFishingAnswer(
  world: WorldState,
  teamColor: TeamColor,
  isCorrect: boolean,
  nowMs: number = 0
): FishingAnswerResult {
  const currentTeam = world.teams[teamColor];
  if (!currentTeam) {
    throw new Error(`Team ${teamColor} not found in world state.`);
  }

  const chain = currentTeam.chainProgress;
  if (!chain) {
    throw new Error(`Team ${teamColor} does not have an active fishing question.`);
  }

  const multipliers = getActiveBuffMultipliers(world, teamColor, nowMs);
  const isBuffActive = multipliers.pointsMultiplier > 1.0;

  if (isCorrect) {
    const nextCorrectCount = chain.correctCount + 1;
    const isChainComplete = nextCorrectCount >= chain.targetLength;

    if (isChainComplete) {
      let finalPoints = chain.totalPoints;
      if (isBuffActive) {
        finalPoints = Math.ceil(finalPoints * multipliers.pointsMultiplier);
      }

      const updatedTeam: TeamState = {
        ...currentTeam,
        points: currentTeam.points + finalPoints,
        status: "FISHING_WAITING",
        currentQuestion: undefined,
        chainProgress: undefined,
      };

      return {
        world: {
          ...world,
          teams: {
            ...world.teams,
            [teamColor]: updatedTeam,
          },
        },
        pointsAwarded: finalPoints,
        event: "FISH_CAUGHT",
      };
    }

    // Chain step passed, awaiting next question in chain
    const updatedTeam: TeamState = {
      ...currentTeam,
      chainProgress: {
        ...chain,
        correctCount: nextCorrectCount,
      },
    };

    return {
      world: {
        ...world,
        teams: {
          ...world.teams,
          [teamColor]: updatedTeam,
        },
      },
      pointsAwarded: 0,
      event: "CHAIN_STEP_PASSED",
    };
  }

  // Answer incorrect: calculate failure outcome
  let pointsAwarded = 0;
  let event: FishingEvent = "WRONG_ANSWER";

  if (chain.targetLength >= 2) {
    // Partial points formula: floor(0.25 * totalPoints * correct / n)
    const basePartial = Math.floor(
      0.25 * chain.totalPoints * (chain.correctCount / chain.targetLength)
    );
    pointsAwarded = isBuffActive
      ? Math.ceil(basePartial * multipliers.pointsMultiplier)
      : basePartial;
    event = "CHAIN_FAILED";
  }

  const updatedTeam: TeamState = {
    ...currentTeam,
    points: currentTeam.points + pointsAwarded,
    status: "FISHING_WAITING",
    currentQuestion: undefined,
    chainProgress: undefined,
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
