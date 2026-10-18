/**
 * Clock Provider & Timer Calculation Utilities.
 * Injected time source — no direct Date.now() or performance.now() calls.
 */

import type { TeamState } from "./types";

export interface ClockProvider {
  /**
   * Returns current unix timestamp in milliseconds.
   */
  nowMs(): number;
}

/**
 * Deterministic test clock provider with manual time advancement.
 */
export class ManualClock implements ClockProvider {
  constructor(private currentTimeMs: number = 0) {}

  nowMs(): number {
    return this.currentTimeMs;
  }

  advanceBy(ms: number): void {
    this.currentTimeMs += ms;
  }

  setTime(ms: number): void {
    this.currentTimeMs = ms;
  }
}

/**
 * Returns remaining active time for Canteen Buff in milliseconds (0 if expired).
 */
export function getRemainingBuffTimeMs(
  team: TeamState,
  clock: ClockProvider
): number {
  const until = team.buffsActive.canteenBuffUntilMs;
  const now = clock.nowMs();
  return Math.max(0, until - now);
}

/**
 * Returns remaining rest time in milliseconds for assistance cooldown (0 if expired).
 */
export function getRemainingRestTimeMs(
  team: TeamState,
  clock: ClockProvider
): number {
  const until = team.restUntilMs;
  const now = clock.nowMs();
  return Math.max(0, until - now);
}

/**
 * Returns remaining question timer in milliseconds for Rare tier fishing (0 if expired/none).
 */
export function getRemainingRareTimerMs(
  team: TeamState,
  clock: ClockProvider
): number {
  const current = team.currentQuestion;
  if (!current || !("timerUntilMs" in current) || current.timerUntilMs == null) {
    return 0;
  }
  const now = clock.nowMs();
  return Math.max(0, current.timerUntilMs - now);
}
