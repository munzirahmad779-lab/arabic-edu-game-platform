import React from "react";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderToString } from "react-dom/server";
import { createInitialWorldState } from "../../../engine/world";
import { ProjectorWorldMap } from "../../../ui/projector/ProjectorWorldMap";

describe("Phase 3 UI: ProjectorWorldMap Split 50/50 & Dedicated Lanes Suite", () => {
  it("renders all 4 team avatars on the map", () => {
    const world = createInitialWorldState();
    const html = renderToString(<ProjectorWorldMap worldState={world} />);

    assert.ok(html.includes("avatar-merah"));
    assert.ok(html.includes("avatar-biru"));
    assert.ok(html.includes("avatar-kuning"));
    assert.ok(html.includes("avatar-hijau"));
  });

  it("assigns distinct vertical Y offsets (lanes) for all 4 team avatars", () => {
    const world = createInitialWorldState();
    const html = renderToString(<ProjectorWorldMap worldState={world} />);

    // Look for top positions for each lane
    const topMatches = html.match(/top:(\d+)px/g);
    assert.ok(topMatches && topMatches.length >= 4);

    // Ensure distinct values exist
    const distinctTops = new Set(topMatches);
    assert.ok(distinctTops.size >= 4, "Expected at least 4 distinct top lane coordinates");
  });

  it("strictly ensures NO ChallengeCard is rendered within ProjectorWorldMap", () => {
    const world = createInitialWorldState();
    const html = renderToString(<ProjectorWorldMap worldState={world} />);

    assert.ok(!html.includes("gate-challenge-card"));
    assert.ok(!html.includes("fishing-challenge-card"));
    assert.ok(!html.includes("data-testid=\"gate-challenge-card\""));
    assert.ok(!html.includes("data-testid=\"fishing-challenge-card\""));
  });
});
