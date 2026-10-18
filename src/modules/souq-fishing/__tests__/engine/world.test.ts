import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createInitialWorldState,
  transitionTo,
  tickWorld,
  BASE_WALK_DURATIONS_MS,
} from "../../engine/world";
import { activateCanteenBuff } from "../../engine/buffs";

describe("Phase 2 Engine: World State & Navigation Suite", () => {
  it("initializes 4 teams at ALUN in PASAR zone with 0 points", () => {
    const world = createInitialWorldState();

    assert.equal(Object.keys(world.teams).length, 4);
    assert.equal(world.teams.MERAH.location, "ALUN");
    assert.equal(world.teams.MERAH.zone, "PASAR");
    assert.equal(world.teams.MERAH.points, 0);
    assert.equal(world.teams.BIRU.location, "ALUN");
    assert.equal(world.teams.KUNING.location, "ALUN");
    assert.equal(world.teams.HIJAU.location, "ALUN");
  });

  it("calculates normal travel duration vs -50% reduction under Canteen Buff", () => {
    const world = createInitialWorldState();
    const nowMs = 1000;

    // Normal transition to KIOS (base duration 6000ms)
    const normal = transitionTo(world, "MERAH", "KIOS", nowMs);
    assert.equal(normal.travelDurationMs, BASE_WALK_DURATIONS_MS.KIOS);
    assert.equal(normal.travelDurationMs, 6000);
    assert.equal(normal.world.teams.MERAH.location, "KIOS");
    assert.equal(normal.world.teams.MERAH.status, "TRAVELING");

    // Activate Canteen Buff (+20% points, -50% travel time)
    const buffedWorld = activateCanteenBuff(world, "BIRU", nowMs);
    const buffed = transitionTo(buffedWorld, "BIRU", "KIOS", nowMs);
    assert.equal(buffed.travelDurationMs, 3000); // 6000 * 0.5 = 3000ms
  });

  it("advances tick and prunes expired buffs and lifts assistance cooldown in tickWorld", () => {
    let world = createInitialWorldState();
    const nowMs = 1000;

    // Set MERAH with expired buff and BIRU with expired rest
    world = {
      ...world,
      teams: {
        ...world.teams,
        MERAH: {
          ...world.teams.MERAH,
          buffsActive: { canteenBuffUntilMs: 900 }, // expired at nowMs 1000
        },
        BIRU: {
          ...world.teams.BIRU,
          status: "ASSISTED_WAITING",
          restUntilMs: 950, // expired at nowMs 1000
        },
      },
    };

    const nextWorld = tickWorld(world, nowMs);

    assert.equal(nextWorld.tick, 1);
    assert.equal(nextWorld.teams.MERAH.buffsActive.canteenBuffUntilMs, 0);
    assert.equal(nextWorld.teams.BIRU.status, "IDLE_AT_GATE");
    assert.equal(nextWorld.teams.BIRU.restUntilMs, 0);
  });
});
