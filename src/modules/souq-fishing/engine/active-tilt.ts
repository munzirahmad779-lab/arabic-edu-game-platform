/**
 * Active Tilt Calculation for Projector Bottom Row (42vh).
 * Calculates dynamic column flex-basis percentages based on active team count N (0..4).
 * Pure mathematical engine — zero DOM access.
 */

import type { WorldState, TeamColor } from "./types";
import { ALL_TEAM_COLORS } from "./world";

export interface ActiveTiltResult {
  n: number;
  widths: [number, number, number, number];
}

/**
 * Computes Active Tilt flex-basis widths for the 4 teams in canonical order:
 * ['MERAH', 'BIRU', 'KUNING', 'HIJAU'].
 *
 * Rules:
 * - N = 0: [25, 25, 25, 25]
 * - N = 1: Active team gets 55%, 3 inactive teams get 15% each.
 * - N = 2: 2 Active teams get 35% each, 2 inactive teams get 15% each.
 * - N = 3: 3 Active teams get 28% each, 1 inactive team gets 16% (28*3 + 16 = 100).
 * - N = 4: [25, 25, 25, 25]
 */
export function computeActiveTilt(world: WorldState): ActiveTiltResult {
  const activeFlags: boolean[] = ALL_TEAM_COLORS.map((color: TeamColor) => {
    const team = world.teams[color];
    if (!team) return false;
    return (
      team.status === "IN_GATE_QUESTION" ||
      team.status === "IN_FISHING_QUESTION"
    );
  });

  const n = activeFlags.filter(Boolean).length;

  if (n === 0) {
    return { n: 0, widths: [25, 25, 25, 25] };
  }

  if (n === 1) {
    const widths = activeFlags.map((isActive) =>
      isActive ? 55 : 15
    ) as [number, number, number, number];
    return { n: 1, widths };
  }

  if (n === 2) {
    const widths = activeFlags.map((isActive) =>
      isActive ? 35 : 15
    ) as [number, number, number, number];
    return { n: 2, widths };
  }

  if (n === 3) {
    const widths = activeFlags.map((isActive) =>
      isActive ? 28 : 16
    ) as [number, number, number, number];
    return { n: 3, widths };
  }

  // N = 4
  return { n: 4, widths: [25, 25, 25, 25] };
}
