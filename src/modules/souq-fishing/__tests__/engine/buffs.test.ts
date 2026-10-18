import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createInitialWorldState } from "../../engine/world";
import {
  activateCanteenBuff,
  getActiveBuffMultipliers,
  pruneExpiredBuffs,
  CANTEEN_BUFF_DURATION_MS,
} from "../../engine/buffs";
import { ManualClock, getRemainingBuffTimeMs } from "../../engine/clock";

describe("Phase 2 Engine: Canteen Buff Logic Suite", () => {
  it("activates Canteen Buff with exact 180,000ms duration", () => {
    const world = createInitialWorldState();
    const nowMs = 50000;
    const buffed = activateCanteenBuff(world, "MERAH", nowMs);

    assert.equal(
      buffed.teams.MERAH.buffsActive.canteenBuffUntilMs,
      nowMs + CANTEEN_BUFF_DURATION_MS
    );
    assert.equal(CANTEEN_BUFF_DURATION_MS, 180000); // 180 seconds
  });

  it("yields walkMultiplier=0.5 and pointsMultiplier=1.20 when active, and 1.0 when inactive", () => {
    const world = createInitialWorldState();
    const nowMs = 100000;

    // Inactive test
    const inactiveMult = getActiveBuffMultipliers(world, "BIRU", nowMs);
    assert.equal(inactiveMult.walkMultiplier, 1.0);
    assert.equal(inactiveMult.pointsMultiplier, 1.0);

    // Active test
    const buffed = activateCanteenBuff(world, "BIRU", nowMs);
    const activeMult = getActiveBuffMultipliers(buffed, "BIRU", nowMs + 5000);
    assert.equal(activeMult.walkMultiplier, 0.5);
    assert.equal(activeMult.pointsMultiplier, 1.2);
  });

  it("prunes expired buffs across teams and correctly calculates remaining time via clock", () => {
    const world = createInitialWorldState();
    const nowMs = 100000;
    const buffed = activateCanteenBuff(world, "KUNING", nowMs);
    const clock = new ManualClock(nowMs + 60000); // 60s elapsed

    // 180s - 60s = 120s remaining
    const remainingMs = getRemainingBuffTimeMs(buffed.teams.KUNING, clock);
    assert.equal(remainingMs, 120000);

    // Advance clock past expiration (180s + 1s = 181s)
    clock.advanceBy(121000);
    const expiredRemaining = getRemainingBuffTimeMs(buffed.teams.KUNING, clock);
    assert.equal(expiredRemaining, 0);

    // Prune
    const pruned = pruneExpiredBuffs(buffed, clock.nowMs());
    assert.equal(pruned.teams.KUNING.buffsActive.canteenBuffUntilMs, 0);
  });
});
