import React from "react";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderToString } from "react-dom/server";
import { createInitialWorldState } from "../../../engine/world";
import { FishingQuestionView } from "../../../ui/controller/FishingQuestionView";
import type { QuestionData } from "../../../ui/projector/GateChallengeCard";

describe("Phase 4 UI: FishingQuestionView Component Suite", () => {
  it("tombol 'Lempar Kail' ada di state idle", () => {
    const world = createInitialWorldState();
    world.teams.MERAH.status = "FISHING_WAITING"; // Idle state

    const html = renderToString(<FishingQuestionView team={world.teams.MERAH} />);

    assert.ok(html.includes('data-testid="fishing-question-view-idle"'));
    assert.ok(html.includes('data-testid="cast-line-button"'));
    assert.ok(html.includes("Lempar Kail Sekarang"));
    assert.ok(!html.includes('data-testid="jumping-fish-svg"'));
    assert.ok(!html.includes('data-testid="tension-bar"'));
  });

  it("setelah hook, SVG ikan + pita poin + tension bar + soal + opsi muncul", () => {
    const world = createInitialWorldState();
    world.teams.MERAH.status = "IN_FISHING_QUESTION"; // Hooked state
    world.teams.MERAH.currentQuestion = {
      tier: "COMMON",
      targetPoints: 75,
      timerUntilMs: null,
    };

    const html = renderToString(<FishingQuestionView team={world.teams.MERAH} />);

    assert.ok(html.includes('data-testid="fishing-question-view-hooked"'));
    assert.ok(html.includes('data-testid="jumping-fish-svg"'));
    assert.ok(html.includes('data-testid="point-ribbon"'));
    assert.ok(html.includes("+75 Poin"));
    assert.ok(html.includes('data-testid="tension-bar"'));
    assert.ok(html.includes('data-testid="question-text"'));
    assert.ok(html.includes('data-testid="option-a"'));
    assert.ok(html.includes('data-testid="option-b"'));
    assert.ok(html.includes('data-testid="option-c"'));
    assert.ok(html.includes('data-testid="option-d"'));
  });

  it("timer 20s muncul untuk Rare, tidak muncul untuk Common", () => {
    const world = createInitialWorldState();
    world.teams.MERAH.status = "IN_FISHING_QUESTION";

    // 1. Common tier: timer must NOT appear
    world.teams.MERAH.currentQuestion = {
      tier: "COMMON",
      targetPoints: 75,
      timerUntilMs: null,
    };
    const htmlCommon = renderToString(
      <FishingQuestionView team={world.teams.MERAH} />
    );
    assert.ok(!htmlCommon.includes('data-testid="rare-timer"'));
    assert.ok(!htmlCommon.includes("Timer Soal: 20 Detik"));

    // 2. Rare tier: timer MUST appear
    world.teams.MERAH.currentQuestion = {
      tier: "RARE",
      targetPoints: 250,
      timerUntilMs: 20000,
    };
    const htmlRare = renderToString(
      <FishingQuestionView team={world.teams.MERAH} />
    );
    assert.ok(htmlRare.includes('data-testid="rare-timer"'));
    assert.ok(htmlRare.includes("Timer Soal: 20 Detik"));
  });

  it("correctOptionId TIDAK ada di DOM (privacy & anti-cheat check)", () => {
    const world = createInitialWorldState();
    world.teams.MERAH.status = "IN_FISHING_QUESTION";
    world.teams.MERAH.currentQuestion = {
      tier: "LEGENDARY",
      targetPoints: 1000,
      timerUntilMs: null,
    };

    const unsafeQuestion = {
      id: "q-secret",
      text: "Pertanyaan Uji Rahasia",
      options: [
        { id: "opt-1", label: "A", text: "Opsi 1" },
        { id: "opt-2", label: "B", text: "Opsi 2" },
      ],
      correctOptionId: "SECRET_KEY_123",
    };

    const html = renderToString(
      <FishingQuestionView
        team={world.teams.MERAH}
        question={unsafeQuestion as unknown as QuestionData}
      />
    );

    assert.ok(!html.includes("SECRET_KEY_123"));
    assert.ok(!html.includes("correctOptionId"));
    assert.ok(!html.includes("correct_option_id"));
  });
});
