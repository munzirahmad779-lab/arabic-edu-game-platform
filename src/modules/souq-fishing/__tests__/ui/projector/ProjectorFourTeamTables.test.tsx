import React from "react";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderToString } from "react-dom/server";
import { createInitialWorldState } from "../../../engine/world";
import { ProjectorFourTeamTables } from "../../../ui/projector/ProjectorFourTeamTables";

describe("Phase 3 UI: ProjectorFourTeamTables & Active Tilt Flex Suite", () => {
  it("renders 4 columns with flex-basis 25% when N = 0", () => {
    const world = createInitialWorldState(); // N = 0
    const html = renderToString(<ProjectorFourTeamTables worldState={world} />);

    assert.ok(html.includes("flex-basis:25%"));
    // Count occurrences of flex-basis:25% (should be 4)
    const matches = html.match(/flex-basis:25%/g);
    assert.equal(matches?.length, 4);
    assert.ok(html.includes("projector-four-team-tables"));
  });

  it("renders active column at 55% and three columns at 15% when N = 1", () => {
    let world = createInitialWorldState();
    world = {
      ...world,
      teams: {
        ...world.teams,
        MERAH: { ...world.teams.MERAH, status: "IN_GATE_QUESTION" },
      },
    };

    const html = renderToString(<ProjectorFourTeamTables worldState={world} />);
    assert.ok(html.includes("flex-basis:55%"));
    const matches15 = html.match(/flex-basis:15%/g);
    assert.equal(matches15?.length, 3);
  });

  it("renders active columns for teams 1 & 2 (35/35/15/15) when N = 2", () => {
    let world = createInitialWorldState();
    world = {
      ...world,
      teams: {
        ...world.teams,
        MERAH: { ...world.teams.MERAH, status: "IN_GATE_QUESTION" },
        BIRU: { ...world.teams.BIRU, status: "IN_FISHING_QUESTION" },
      },
    };

    const html = renderToString(<ProjectorFourTeamTables worldState={world} />);
    assert.match(html, /flex-basis:35%[^>]*data-testid="team-box-merah"/);
    assert.match(html, /flex-basis:35%[^>]*data-testid="team-box-biru"/);
    assert.match(html, /flex-basis:15%[^>]*data-testid="team-box-kuning"/);
    assert.match(html, /flex-basis:15%[^>]*data-testid="team-box-hijau"/);
  });

  it("renders active columns for teams 1 & 3 (35/15/35/15) when N = 2", () => {
    let world = createInitialWorldState();
    world = {
      ...world,
      teams: {
        ...world.teams,
        MERAH: { ...world.teams.MERAH, status: "IN_GATE_QUESTION" },
        KUNING: { ...world.teams.KUNING, status: "IN_FISHING_QUESTION" },
      },
    };

    const html = renderToString(<ProjectorFourTeamTables worldState={world} />);
    assert.match(html, /flex-basis:35%[^>]*data-testid="team-box-merah"/);
    assert.match(html, /flex-basis:15%[^>]*data-testid="team-box-biru"/);
    assert.match(html, /flex-basis:35%[^>]*data-testid="team-box-kuning"/);
    assert.match(html, /flex-basis:15%[^>]*data-testid="team-box-hijau"/);
  });

  it("renders three active columns at 28% and one inactive at 16% when N = 3", () => {
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

    const html = renderToString(<ProjectorFourTeamTables worldState={world} />);
    const matches28 = html.match(/flex-basis:28%/g);
    const matches16 = html.match(/flex-basis:16%/g);
    assert.equal(matches28?.length, 3);
    assert.equal(matches16?.length, 1);
  });

  it("renders 4 columns with flex-basis 25% when N = 4", () => {
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

    const html = renderToString(<ProjectorFourTeamTables worldState={world} />);
    const matches25 = html.match(/flex-basis:25%/g);
    assert.equal(matches25?.length, 4);
  });

  it("enforces min-width: 0 in style on all TeamBox components", () => {
    const world = createInitialWorldState();
    const html = renderToString(<ProjectorFourTeamTables worldState={world} />);

    // Check min-width:0 occurrences (should be at least 4 for the 4 team boxes)
    const matchesMinWidth = html.match(/min-width:0/g);
    assert.ok(matchesMinWidth && matchesMinWidth.length >= 4);
  });
});
