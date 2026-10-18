import React from "react";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderToString } from "react-dom/server";
import { createInitialWorldState } from "../../../engine/world";
import { GateQuestionView } from "../../../ui/controller/GateQuestionView";
import type { QuestionData } from "../../../ui/projector/GateChallengeCard";

describe("Phase 4 UI: GateQuestionView Component Suite", () => {
  it("pin indicator menampilkan 3 pin untuk KIOS", () => {
    const world = createInitialWorldState();
    world.teams.MERAH.location = "KIOS";
    world.teams.MERAH.pinsUnlocked = 0;

    const html = renderToString(<GateQuestionView team={world.teams.MERAH} />);

    // Kios requires 3 pins
    assert.ok(html.includes("0 / 3 Pin"));
    assert.ok(html.includes('data-testid="pin-0-locked"'));
    assert.ok(html.includes('data-testid="pin-1-locked"'));
    assert.ok(html.includes('data-testid="pin-2-locked"'));
    assert.ok(!html.includes('data-testid="pin-3-locked"'));
  });

  it("pin indicator menampilkan 4 pin untuk GERBANG_KANTIN", () => {
    const world = createInitialWorldState();
    world.teams.MERAH.location = "GERBANG_KANTIN";
    world.teams.MERAH.pinsUnlocked = 0;

    const html = renderToString(<GateQuestionView team={world.teams.MERAH} />);

    // Gerbang kantin requires 4 pins
    assert.ok(html.includes("0 / 4 Pin"));
    assert.ok(html.includes('data-testid="pin-0-locked"'));
    assert.ok(html.includes('data-testid="pin-1-locked"'));
    assert.ok(html.includes('data-testid="pin-2-locked"'));
    assert.ok(html.includes('data-testid="pin-3-locked"'));
  });

  it("pin unlocked vs locked visual (icon 🔓 vs 🔒)", () => {
    const world = createInitialWorldState();
    world.teams.MERAH.location = "KIOS";
    world.teams.MERAH.pinsUnlocked = 2; // 2 unlocked, 1 locked

    const html = renderToString(<GateQuestionView team={world.teams.MERAH} />);

    assert.ok(html.includes("2 / 3 Pin"));
    assert.ok(html.includes('data-testid="pin-0-unlocked"'));
    assert.ok(html.includes('data-testid="pin-1-unlocked"'));
    assert.ok(html.includes('data-testid="pin-2-locked"'));
    assert.ok(html.includes("🔓"));
    assert.ok(html.includes("🔒"));
  });

  it("correctOptionId TIDAK ada di DOM (privacy & anti-cheat check)", () => {
    const world = createInitialWorldState();
    world.teams.MERAH.location = "KIOS";

    // Pass question that might have correctOptionId in a simulated raw object
    const unsafeQuestion = {
      id: "q-test-gate",
      text: "Pertanyaan Uji Rahasia",
      options: [
        { id: "opt-1", label: "A", text: "Pilihan A" },
        { id: "opt-2", label: "B", text: "Pilihan B" },
      ],
      correctOptionId: "opt-1", // Must NEVER leak
    };

    const html = renderToString(
      <GateQuestionView
        team={world.teams.MERAH}
        question={unsafeQuestion as unknown as QuestionData}
      />
    );

    assert.ok(!html.includes("correctOptionId"));
    assert.ok(!html.includes("correct_option_id"));
    assert.ok(!html.includes("opt-1\" data-correct"));
  });
});
