/**
 * World State Management & State Machine Transitions.
 * Pure functional state machine — no side effects, no mutation.
 */

import type {
  WorldState,
  TeamState,
  TeamColor,
  LocationId,
  ZoneId,
} from "./types";
import { getActiveBuffMultipliers, pruneExpiredBuffs } from "./buffs";

export const BASE_WALK_DURATIONS_MS: Record<LocationId, number> = {
  ALUN: 0,
  KIOS: 6000,
  GERBANG_KANTIN: 6000,
  KANTIN: 4000,
  DERMAGA_1: 8000,
  DERMAGA_VIP: 10000,
};

export const ALL_TEAM_COLORS: readonly TeamColor[] = [
  "MERAH",
  "BIRU",
  "KUNING",
  "HIJAU",
];

function resolveZone(location: LocationId): ZoneId {
  return location === "DERMAGA_1" || location === "DERMAGA_VIP"
    ? "DERMAGA"
    : "PASAR";
}

/**
 * Initializes WorldState with all 4 teams placed at ALUN (PASAR zone).
 */
export function createInitialWorldState(
  roster?: Partial<Record<TeamColor, { characterId?: string }>>
): WorldState {
  const teams: Record<TeamColor, TeamState> = {
    MERAH: createDefaultTeamState("MERAH", roster?.MERAH?.characterId ?? "putri_hijab"),
    BIRU: createDefaultTeamState("BIRU", roster?.BIRU?.characterId ?? "putra_peci"),
    KUNING: createDefaultTeamState("KUNING", roster?.KUNING?.characterId ?? "putra_non_peci"),
    HIJAU: createDefaultTeamState("HIJAU", roster?.HIJAU?.characterId ?? "putri_non_hijab"),
  };

  return {
    teams,
    tick: 0,
  };
}

function createDefaultTeamState(color: TeamColor, characterId: string): TeamState {
  return {
    id: `team-${color.toLowerCase()}`,
    color,
    characterId,
    zone: "PASAR",
    location: "ALUN",
    status: "IDLE_AT_GATE",
    pinsUnlocked: 0,
    gateAttempts: 0,
    consecutiveWrong: 0,
    restUntilMs: 0,
    restCount: 0,
    assisted: false,
    buffsActive: {
      canteenBuffUntilMs: 0,
    },
    points: 0,
  };
}

/**
 * Transitions a team to a new location, applying travel time and buff duration reduction.
 * Returns updated WorldState with duration traveled calculated.
 */
export function transitionTo(
  world: WorldState,
  teamColor: TeamColor,
  nextLocation: LocationId,
  nowMs: number = 0
): { world: WorldState; travelDurationMs: number } {
  const team = world.teams[teamColor];
  if (!team) return { world, travelDurationMs: 0 };

  const baseDuration = BASE_WALK_DURATIONS_MS[nextLocation] ?? 5000;
  const multipliers = getActiveBuffMultipliers(world, teamColor, nowMs);
  const effectiveDuration = Math.round(baseDuration * multipliers.walkMultiplier);

  const updatedTeam: TeamState = {
    ...team,
    location: nextLocation,
    zone: resolveZone(nextLocation),
    status: "TRAVELING",
  };

  const updatedWorld: WorldState = {
    ...world,
    teams: {
      ...world.teams,
      [teamColor]: updatedTeam,
    },
  };

  return {
    world: updatedWorld,
    travelDurationMs: effectiveDuration,
  };
}

/**
 * Enqueues a team challenge when N >= 3, transitioning status to QUEUED_QUESTION.
 */
export function enqueueChallenge(
  world: WorldState,
  teamColor: TeamColor
): WorldState {
  const team = world.teams[teamColor];
  if (!team) return world;

  return {
    ...world,
    teams: {
      ...world.teams,
      [teamColor]: {
        ...team,
        status: "QUEUED_QUESTION",
      },
    },
  };
}

/**
 * Ticks world state by 1 unit: prunes expired buffs and lifts assistance rest cooldowns.
 */
export function tickWorld(world: WorldState, nowMs: number): WorldState {
  const state = pruneExpiredBuffs(world, nowMs);
  let changed = false;
  const updatedTeams = { ...state.teams };

  for (const [color, team] of Object.entries(state.teams) as [TeamColor, TeamState][]) {
    // If team is in ASSISTED_WAITING and rest time has elapsed, revert to IDLE_AT_GATE
    if (team.status === "ASSISTED_WAITING" && team.restUntilMs <= nowMs) {
      changed = true;
      updatedTeams[color] = {
        ...team,
        status: "IDLE_AT_GATE",
        restUntilMs: 0,
      };
    }
  }

  return {
    teams: changed ? updatedTeams : state.teams,
    tick: state.tick + 1,
  };
}
