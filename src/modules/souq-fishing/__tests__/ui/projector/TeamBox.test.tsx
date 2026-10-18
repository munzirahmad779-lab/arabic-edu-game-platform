import React from "react";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderToString } from "react-dom/server";
import { createInitialWorldState } from "../../../engine/world";
import { TeamBox } from "../../../ui/projector/TeamBox";

describe("Phase 3 UI: TeamBox Component Suite", () => {
  it("does NOT render ChallengeCard when team status is TRAVELING", () => {
    const world = createInitialWorldState();
    const team = {
      ...world.teams.MERAH,
      status: "TRAVELING" as const,
      location: "KIOS" as const,
    };

    const html = renderToString(<TeamBox team={team} widthPercent={25} />);

    assert.ok(html.includes("status-traveling"));
    assert.ok(!html.includes("gate-challenge-card"));
    assert.ok(!html.includes("fishing-challenge-card"));
    assert.ok(html.includes("Sedang Melangkah Menuju Pos"));
  });

  it("renders GateChallengeCard when team status is IN_GATE_QUESTION", () => {
    const world = createInitialWorldState();
    const team = {
      ...world.teams.MERAH,
      status: "IN_GATE_QUESTION" as const,
      location: "KIOS" as const,
      pinsUnlocked: 1,
    };

    const html = renderToString(<TeamBox team={team} widthPercent={55} />);

    assert.ok(html.includes("gate-challenge-card"));
    assert.ok(html.includes("Gerbang 1: Kios"));
    assert.ok(html.includes("gate-pins"));
  });

  it("renders FishingChallengeCard when team status is IN_FISHING_QUESTION", () => {
    const world = createInitialWorldState();
    const team = {
      ...world.teams.BIRU,
      status: "IN_FISHING_QUESTION" as const,
      zone: "DERMAGA" as const,
      location: "DERMAGA_1" as const,
      currentQuestion: {
        tier: "COMMON" as const,
        targetPoints: 100,
        timerUntilMs: null,
      },
    };

    const html = renderToString(<TeamBox team={team} widthPercent={55} />);

    assert.ok(html.includes("fishing-challenge-card"));
    assert.ok(html.includes("COMMON"));
    assert.ok(html.includes("+100 Poin"));
    assert.ok(html.includes("Tension Bar"));
  });

  it("renders queue message and NO ChallengeCard when status is QUEUED_QUESTION", () => {
    const world = createInitialWorldState();
    const team = {
      ...world.teams.HIJAU,
      status: "QUEUED_QUESTION" as const,
    };

    const html = renderToString(<TeamBox team={team} widthPercent={16} />);

    assert.ok(html.includes("status-queued"));
    assert.ok(html.includes("Menunggu Giliran Antrian Layar"));
    assert.ok(!html.includes("gate-challenge-card"));
    assert.ok(!html.includes("fishing-challenge-card"));
  });

  it("ensures correctOptionId is NEVER rendered anywhere in the DOM", () => {
    const world = createInitialWorldState();
    const team = {
      ...world.teams.MERAH,
      status: "IN_GATE_QUESTION" as const,
    };

    const html = renderToString(<TeamBox team={team} widthPercent={55} />);

    assert.ok(!html.includes("correctOptionId"));
    assert.ok(!html.includes("correct_option_id"));
    assert.ok(!html.includes("isCorrect"));
  });
});
