import React from "react";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderToString } from "react-dom/server";
import { createInitialWorldState } from "../../../engine/world";
import { ControllerShell } from "../../../ui/controller/ControllerShell";

describe("Phase 4 UI: ControllerShell 4-State Switcher Suite", () => {
  it("status PRE_GAME: renders PreGameDashboard SAJA, tidak ada komponen lain", () => {
    const world = createInitialWorldState();
    (world.teams.MERAH as unknown as { status: string }).status = "PRE_GAME";

    const html = renderToString(
      <ControllerShell worldState={world} currentTeamColor="MERAH" />
    );

    assert.ok(html.includes('data-testid="pre-game-dashboard"'));
    assert.ok(!html.includes('data-testid="walking-view"'));
    assert.ok(!html.includes('data-testid="gate-question-view"'));
    assert.ok(!html.includes('data-testid="fishing-question-view-hooked"'));
    assert.ok(!html.includes('data-testid="assisted-rest-view"'));
  });

  it("status TRAVELING: renders WalkingView SAJA", () => {
    const world = createInitialWorldState();
    world.teams.MERAH.status = "TRAVELING";

    const html = renderToString(
      <ControllerShell worldState={world} currentTeamColor="MERAH" />
    );

    assert.ok(!html.includes('data-testid="pre-game-dashboard"'));
    assert.ok(html.includes('data-testid="walking-view"'));
    assert.ok(!html.includes('data-testid="gate-question-view"'));
    assert.ok(!html.includes('data-testid="fishing-question-view-hooked"'));
    assert.ok(!html.includes('data-testid="assisted-rest-view"'));
  });

  it("status IN_GATE_QUESTION: renders GateQuestionView SAJA", () => {
    const world = createInitialWorldState();
    world.teams.MERAH.status = "IN_GATE_QUESTION";

    const html = renderToString(
      <ControllerShell worldState={world} currentTeamColor="MERAH" />
    );

    assert.ok(!html.includes('data-testid="pre-game-dashboard"'));
    assert.ok(!html.includes('data-testid="walking-view"'));
    assert.ok(html.includes('data-testid="gate-question-view"'));
    assert.ok(!html.includes('data-testid="fishing-question-view-hooked"'));
    assert.ok(!html.includes('data-testid="assisted-rest-view"'));
  });

  it("status IN_FISHING_QUESTION: renders FishingQuestionView SAJA", () => {
    const world = createInitialWorldState();
    world.teams.MERAH.status = "IN_FISHING_QUESTION";

    const html = renderToString(
      <ControllerShell worldState={world} currentTeamColor="MERAH" />
    );

    assert.ok(!html.includes('data-testid="pre-game-dashboard"'));
    assert.ok(!html.includes('data-testid="walking-view"'));
    assert.ok(!html.includes('data-testid="gate-question-view"'));
    assert.ok(html.includes('data-testid="fishing-question-view-hooked"'));
    assert.ok(!html.includes('data-testid="assisted-rest-view"'));
  });

  it("status ASSISTED_WAITING: renders AssistedRestView SAJA", () => {
    const world = createInitialWorldState();
    world.teams.MERAH.status = "ASSISTED_WAITING";

    const html = renderToString(
      <ControllerShell worldState={world} currentTeamColor="MERAH" />
    );

    assert.ok(!html.includes('data-testid="pre-game-dashboard"'));
    assert.ok(!html.includes('data-testid="walking-view"'));
    assert.ok(!html.includes('data-testid="gate-question-view"'));
    assert.ok(!html.includes('data-testid="fishing-question-view-hooked"'));
    assert.ok(html.includes('data-testid="assisted-rest-view"'));
  });

  it("hanya 1 state mounted pada satu waktu (mutual exclusivity)", () => {
    const world = createInitialWorldState();
    const statuses = [
      { status: "PRE_GAME", testId: "pre-game-dashboard" },
      { status: "TRAVELING", testId: "walking-view" },
      { status: "IN_GATE_QUESTION", testId: "gate-question-view" },
      { status: "IN_FISHING_QUESTION", testId: "fishing-question-view-hooked" },
      { status: "ASSISTED_WAITING", testId: "assisted-rest-view" },
    ];

    const allTestIds = [
      "pre-game-dashboard",
      "walking-view",
      "gate-question-view",
      "fishing-question-view-hooked",
      "assisted-rest-view",
    ];

    for (const s of statuses) {
      (world.teams.BIRU as unknown as { status: string }).status = s.status;
      const html = renderToString(
        <ControllerShell worldState={world} currentTeamColor="BIRU" />
      );

      // Verify the active state is mounted
      assert.ok(html.includes(`data-testid="${s.testId}"`));

      // Verify all other 4 states are strictly unmounted
      for (const otherId of allTestIds) {
        if (otherId !== s.testId) {
          assert.ok(
            !html.includes(`data-testid="${otherId}"`),
            `Expected ${otherId} to NOT be in DOM when status is ${s.status}`
          );
        }
      }
    }
  });
});
