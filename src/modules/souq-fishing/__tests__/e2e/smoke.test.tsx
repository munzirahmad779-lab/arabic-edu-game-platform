import React from "react";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderToString } from "react-dom/server";
import { createInitialWorldState } from "../../engine/world";
import { ControllerShell } from "../../ui/controller/ControllerShell";
import { ProjectorShell } from "../../ui/projector/ProjectorShell";

describe("Phase 6 E2E Smoke Suite: Headless UI & State Switcher Verification", () => {
  it("renders ControllerShell in TRAVELING state with walking view and zero challenge cards", () => {
    let world = createInitialWorldState();
    world = {
      ...world,
      teams: {
        ...world.teams,
        MERAH: {
          ...world.teams.MERAH,
          status: "TRAVELING",
          location: "KIOS",
        },
      },
    };

    const html = renderToString(
      <ControllerShell worldState={world} currentTeamColor="MERAH" />,
    );

    assert.ok(html.includes("controller-shell"));
    assert.ok(html.includes("walking-view"));
    assert.ok(html.includes("Sedang Berjalan..."));
    assert.equal(html.includes("gate-challenge-card"), false);
    assert.equal(html.includes("fishing-challenge-card"), false);
  });

  it("renders ControllerShell in IN_GATE_QUESTION state displaying 3-pin gate progress indicators", () => {
    let world = createInitialWorldState();
    world = {
      ...world,
      teams: {
        ...world.teams,
        BIRU: {
          ...world.teams.BIRU,
          status: "IN_GATE_QUESTION",
          location: "KIOS",
          pinsUnlocked: 1,
        },
      },
    };

    const html = renderToString(
      <ControllerShell worldState={world} currentTeamColor="BIRU" />,
    );

    assert.ok(html.includes("controller-shell"));
    assert.ok(html.includes("gate-question-view"));
    assert.ok(html.includes("1 / 3 Pin"));
    assert.ok(html.includes("🔓")); // Pin 1 unlocked
    assert.ok(html.includes("🔒")); // Pin 2 & 3 locked
  });

  it("renders ProjectorShell with N=1 active tilt allocating [55%, 15%, 15%, 15%] flex ratio", () => {
    let world = createInitialWorldState();
    world = {
      ...world,
      teams: {
        ...world.teams,
        MERAH: {
          ...world.teams.MERAH,
          status: "IN_GATE_QUESTION",
          location: "KIOS",
        },
        BIRU: { ...world.teams.BIRU, status: "TRAVELING" },
        KUNING: { ...world.teams.KUNING, status: "TRAVELING" },
        HIJAU: { ...world.teams.HIJAU, status: "TRAVELING" },
      },
    };

    const html = renderToString(<ProjectorShell worldState={world} />);

    assert.ok(html.includes("projector-shell"));
    assert.ok(html.includes("grid-rows-[58fr_42fr]"));
    assert.ok(html.includes("flex-basis:55%"));
    const matches15 = html.match(/flex-basis:15%/g);
    assert.equal(matches15?.length, 3);
  });
});
