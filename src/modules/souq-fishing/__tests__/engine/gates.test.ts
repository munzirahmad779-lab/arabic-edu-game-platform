import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createInitialWorldState } from "../../engine/world";
import { attemptUnlockGate } from "../../engine/gates";

describe("Phase 2 Engine: Gates & Assistance Ladder Suite", () => {
  it("awards +20 points per correct pin answer", () => {
    const world = createInitialWorldState();
    const res = attemptUnlockGate(world, "MERAH", "KIOS", true, 1000);

    assert.equal(res.pointsAwarded, 20);
    assert.equal(res.event, "PIN_UNLOCKED");
    assert.equal(res.world.teams.MERAH.pinsUnlocked, 1);
    assert.equal(res.world.teams.MERAH.points, 20);
  });

  it("awards +100 completion bonus on 3rd pin for KIOS (total 160 points)", () => {
    let state = createInitialWorldState();
    // Pin 1: +20
    let res = attemptUnlockGate(state, "MERAH", "KIOS", true, 1000);
    state = res.world;
    assert.equal(state.teams.MERAH.pinsUnlocked, 1);

    // Pin 2: +20
    res = attemptUnlockGate(state, "MERAH", "KIOS", true, 2000);
    state = res.world;
    assert.equal(state.teams.MERAH.pinsUnlocked, 2);

    // Pin 3: +20 + 100 bonus = +120
    res = attemptUnlockGate(state, "MERAH", "KIOS", true, 3000);
    state = res.world;

    assert.equal(res.event, "GATE_CLEARED");
    assert.equal(res.pointsAwarded, 120);
    assert.equal(state.teams.MERAH.pinsUnlocked, 3);
    assert.equal(state.teams.MERAH.points, 160);
  });

  it("rejects GERBANG_KANTIN attempt without clearing KIOS prerequisite", () => {
    const world = createInitialWorldState(); // ALUN, 0 pins
    assert.throws(
      () => attemptUnlockGate(world, "MERAH", "GERBANG_KANTIN", true, 1000),
      /Syarat lulus KIOS belum terpenuhi/
    );
  });

  it("triggers HIDE_WRONG_OPTION on 2 consecutive wrong answers", () => {
    let state = createInitialWorldState();
    // Wrong 1: regular wrong answer
    let res = attemptUnlockGate(state, "BIRU", "KIOS", false, 1000);
    state = res.world;
    assert.equal(res.event, "WRONG_ANSWER");
    assert.equal(state.teams.BIRU.consecutiveWrong, 1);

    // Wrong 2: 50:50 assistance trigger
    res = attemptUnlockGate(state, "BIRU", "KIOS", false, 2000);
    assert.equal(res.event, "HIDE_WRONG_OPTION");
    assert.equal(res.world.teams.BIRU.consecutiveWrong, 2);
  });

  it("triggers REST_15S with restUntilMs = now + 15000 on 3 consecutive wrong answers", () => {
    let state = createInitialWorldState();
    // Wrong 1 & 2
    state = attemptUnlockGate(state, "KUNING", "KIOS", false, 1000).world;
    state = attemptUnlockGate(state, "KUNING", "KIOS", false, 2000).world;

    // Wrong 3: Rest 15s cooldown
    const nowMs = 5000;
    const res = attemptUnlockGate(state, "KUNING", "KIOS", false, nowMs);
    state = res.world;

    assert.equal(res.event, "REST_15S");
    assert.equal(state.teams.KUNING.status, "ASSISTED_WAITING");
    assert.equal(state.teams.KUNING.restUntilMs, nowMs + 15000);
    assert.equal(state.teams.KUNING.restCount, 1);
  });

  it("graduates team as assisted=true without +100 bonus after 3 rest cycles", () => {
    let state = createInitialWorldState();
    const team = state.teams.HIJAU;

    // Simulate 2 previous rest cycles already completed
    state = {
      ...state,
      teams: {
        ...state.teams,
        HIJAU: {
          ...team,
          consecutiveWrong: 2,
          restCount: 2,
          points: 40,
        },
      },
    };

    // 3rd rest cycle trigger -> reaches restCount = 3 -> graduates assisted
    const nowMs = 60000;
    const res = attemptUnlockGate(state, "HIJAU", "KIOS", false, nowMs);
    state = res.world;

    assert.equal(res.event, "ASSISTED_CLEARED");
    assert.equal(state.teams.HIJAU.assisted, true);
    assert.equal(state.teams.HIJAU.pinsUnlocked, 3);
    assert.equal(res.pointsAwarded, 0); // NO +100 bonus awarded!
    assert.equal(state.teams.HIJAU.points, 40); // points unchanged
  });
});
