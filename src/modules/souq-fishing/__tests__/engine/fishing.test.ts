import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createInitialWorldState } from "../../engine/world";
import { hookFish, submitFishingAnswer } from "../../engine/fishing";
import { activateCanteenBuff } from "../../engine/buffs";
import { SequenceRng } from "../../engine/rng";

describe("Phase 2 Engine: Fishing Minigame & Scoring Suite", () => {
  it("draws Common tier points strictly within {50, 75, 100}", () => {
    const world = createInitialWorldState();
    // Test multiple RNG seeds
    const values = [0.0, 0.4, 0.9].map((val) => {
      const rng = new SequenceRng([val]);
      const res = hookFish(world, "MERAH", "COMMON", rng, 1000);
      return res.targetPoints;
    });

    for (const v of values) {
      assert.ok([50, 75, 100].includes(v), `Expected ${v} to be in {50, 75, 100}`);
    }
  });

  it("sets 20000ms timer for Rare tier fishing", () => {
    const world = createInitialWorldState();
    const rng = new SequenceRng([0.5]);
    const nowMs = 10000;
    const { world: hookedWorld } = hookFish(world, "BIRU", "RARE", rng, nowMs);

    const question = hookedWorld.teams.BIRU.currentQuestion;
    assert.ok(question && "timerUntilMs" in question);
    assert.equal(question.timerUntilMs, nowMs + 20000);
    assert.ok([200, 250, 300].includes(question.targetPoints));
  });

  it("awards partial points for Epic chain n=2 failure: floor(0.25 * value * correct / 2)", () => {
    let state = createInitialWorldState();
    // Hook an Epic fish with 600 points
    const rng = new SequenceRng([0.99]); // index 3 in [450, 500, 550, 600] -> 600
    const hooked = hookFish(state, "KUNING", "EPIC", rng, 1000);
    state = hooked.world;
    assert.equal(hooked.targetPoints, 600);

    // Pass Step 1 (1 correct out of 2)
    let res = submitFishingAnswer(state, "KUNING", true, 2000);
    state = res.world;
    assert.equal(res.event, "CHAIN_STEP_PASSED");
    assert.equal(res.pointsAwarded, 0);

    // Fail Step 2: floor(0.25 * 600 * 1 / 2) = floor(75) = 75
    res = submitFishingAnswer(state, "KUNING", false, 3000);
    state = res.world;

    assert.equal(res.event, "CHAIN_FAILED");
    assert.equal(res.pointsAwarded, 75);
    assert.equal(state.teams.KUNING.points, 75);
    assert.equal(state.teams.KUNING.status, "FISHING_WAITING");
  });

  it("awards partial points for Legendary chain n=3 failure: floor(0.25 * value * correct / 3)", () => {
    let state = createInitialWorldState();
    // Hook a Legendary fish with 1200 points
    const rng = new SequenceRng([0.99]); // index 2 in [800, 1000, 1200] -> 1200
    const hooked = hookFish(state, "HIJAU", "LEGENDARY", rng, 1000);
    state = hooked.world;
    assert.equal(hooked.targetPoints, 1200);

    // Pass Step 1
    state = submitFishingAnswer(state, "HIJAU", true, 2000).world;
    // Pass Step 2 (2 correct out of 3)
    state = submitFishingAnswer(state, "HIJAU", true, 3000).world;

    // Fail Step 3: floor(0.25 * 1200 * 2 / 3) = floor(300 * 2 / 3) = floor(200) = 200
    const res = submitFishingAnswer(state, "HIJAU", false, 4000);
    assert.equal(res.event, "CHAIN_FAILED");
    assert.equal(res.pointsAwarded, 200);
    assert.equal(res.world.teams.HIJAU.points, 200);
  });

  it("applies +20% point multiplier (rounded up with Math.ceil) when Canteen Buff is active", () => {
    let state = createInitialWorldState();
    const nowMs = 10000;
    // Activate buff for 180 seconds
    state = activateCanteenBuff(state, "MERAH", nowMs);

    // Hook 100-point Common fish
    const rng = new SequenceRng([0.99]); // index 2 in [50, 75, 100] -> 100
    state = hookFish(state, "MERAH", "COMMON", rng, nowMs + 1000).world;

    // Correct answer: 100 * 1.2 = 120 points
    const res = submitFishingAnswer(state, "MERAH", true, nowMs + 2000);
    assert.equal(res.event, "FISH_CAUGHT");
    assert.equal(res.pointsAwarded, 120);
    assert.equal(res.world.teams.MERAH.points, 120);
  });
});
