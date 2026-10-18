/**
 * Canteen Buff Management Module.
 * Canonical rule: 180 seconds duration, -50% walk duration (2x speed), +20% fish catch points (Math.ceil).
 * Pure functions: input old world -> output new world, no mutation.
 */

import type { WorldState, TeamColor } from "./types";

export const CANTEEN_BUFF_DURATION_MS = 180000; // 180 detik

export interface BuffMultipliers {
  walkMultiplier: number;
  pointsMultiplier: number;
}

/**
 * Activates Canteen Buff for a team lasting 180,000 ms.
 */
export function activateCanteenBuff(
  world: WorldState,
  teamColor: TeamColor,
  nowMs: number
): WorldState {
  const currentTeam = world.teams[teamColor];
  if (!currentTeam) return world;

  const updatedTeam = {
    ...currentTeam,
    buffsActive: {
      ...currentTeam.buffsActive,
      canteenBuffUntilMs: nowMs + CANTEEN_BUFF_DURATION_MS,
    },
  };

  return {
    ...world,
    teams: {
      ...world.teams,
      [teamColor]: updatedTeam,
    },
  };
}

/**
 * Returns speed and points multipliers for a team at timestamp nowMs.
 * When buff is active: walkMultiplier = 0.5 (-50% walk duration), pointsMultiplier = 1.20 (+20% points).
 */
export function getActiveBuffMultipliers(
  world: WorldState,
  teamColor: TeamColor,
  nowMs: number
): BuffMultipliers {
  const team = world.teams[teamColor];
  if (!team) {
    return { walkMultiplier: 1.0, pointsMultiplier: 1.0 };
  }

  const isActive = team.buffsActive.canteenBuffUntilMs > nowMs;
  if (isActive) {
    return {
      walkMultiplier: 0.5, // 50% walk duration reduction (2x walking speed)
      pointsMultiplier: 1.2, // +20% points, to be rounded up via Math.ceil
    };
  }

  return {
    walkMultiplier: 1.0,
    pointsMultiplier: 1.0,
  };
}

/**
 * Prunes expired buffs across all teams.
 */
export function pruneExpiredBuffs(world: WorldState, nowMs: number): WorldState {
  let changed = false;
  const updatedTeams = { ...world.teams };

  for (const [color, team] of Object.entries(world.teams) as [TeamColor, typeof world.teams[TeamColor]][]) {
    if (
      team.buffsActive.canteenBuffUntilMs > 0 &&
      team.buffsActive.canteenBuffUntilMs <= nowMs
    ) {
      changed = true;
      updatedTeams[color] = {
        ...team,
        buffsActive: {
          ...team.buffsActive,
          canteenBuffUntilMs: 0,
        },
      };
    }
  }

  return changed ? { ...world, teams: updatedTeams } : world;
}
