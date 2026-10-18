import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createInitialWorldState, enqueueChallenge } from "../../engine/world";
import { computeActiveTilt } from "../../engine/active-tilt";

describe("Phase 2 Engine: Active Tilt Calculations Suite", () => {
  it("computes [25, 25, 25, 25] for N = 0 (all teams idle/traveling)", () => {
    const world = createInitialWorldState();
    const { n, widths } = computeActiveTilt(world);

    assert.equal(n, 0);
    assert.deepEqual(widths, [25, 25, 25, 25]);
  });

  it("computes [55, 15, 15, 15] for N = 1 (one team active in question)", () => {
    let world = createInitialWorldState();
    world = {
      ...world,
      teams: {
        ...world.teams,
        MERAH: {
          ...world.teams.MERAH,
          status: "IN_GATE_QUESTION",
        },
      },
    };

    const { n, widths } = computeActiveTilt(world);
    assert.equal(n, 1);
    assert.deepEqual(widths, [55, 15, 15, 15]);
  });

  it("computes [35, 15, 35, 15] for N = 2 (two teams active in questions)", () => {
    let world = createInitialWorldState();
    world = {
      ...world,
      teams: {
        ...world.teams,
        MERAH: {
          ...world.teams.MERAH,
          status: "IN_GATE_QUESTION",
        },
        KUNING: {
          ...world.teams.KUNING,
          status: "IN_FISHING_QUESTION",
        },
      },
    };

    const { n, widths } = computeActiveTilt(world);
    assert.equal(n, 2);
    assert.deepEqual(widths, [35, 15, 35, 15]);
  });

  it("computes [28, 28, 28, 16] for N = 3 and queues excess challenge via enqueueChallenge", () => {
    let world = createInitialWorldState();
    world = {
      ...world,
      teams: {
        ...world.teams,
        MERAH: { ...world.teams.MERAH, status: "IN_GATE_QUESTION" },
        BIRU: { ...world.teams.BIRU, status: "IN_FISHING_QUESTION" },
        KUNING: { ...world.teams.KUNING, status: "IN_GATE_QUESTION" },
      },
    };

    const { n, widths } = computeActiveTilt(world);
    assert.equal(n, 3);
    assert.deepEqual(widths, [28, 28, 28, 16]);

    // Enqueue excess team (HIJAU) to avoid projector clutter
    const enqueuedWorld = enqueueChallenge(world, "HIJAU");
    assert.equal(enqueuedWorld.teams.HIJAU.status, "QUEUED_QUESTION");
  });

  it("computes [25, 25, 25, 25] for N = 4 (all teams challenged)", () => {
    let world = createInitialWorldState();
    world = {
      ...world,
      teams: {
        ...world.teams,
        MERAH: { ...world.teams.MERAH, status: "IN_GATE_QUESTION" },
        BIRU: { ...world.teams.BIRU, status: "IN_FISHING_QUESTION" },
        KUNING: { ...world.teams.KUNING, status: "IN_GATE_QUESTION" },
        HIJAU: { ...world.teams.HIJAU, status: "IN_FISHING_QUESTION" },
      },
    };

    const { n, widths } = computeActiveTilt(world);
    assert.equal(n, 4);
    assert.deepEqual(widths, [25, 25, 25, 25]);
  });
});
