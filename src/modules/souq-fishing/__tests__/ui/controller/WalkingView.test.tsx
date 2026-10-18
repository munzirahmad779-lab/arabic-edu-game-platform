import React from "react";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderToString } from "react-dom/server";
import { createInitialWorldState } from "../../../engine/world";
import { WalkingView } from "../../../ui/controller/WalkingView";

describe("Phase 4 UI: WalkingView Component Suite", () => {
  it("saat TRAVELING, tidak ada ChallengeCard di DOM", () => {
    const world = createInitialWorldState();
    world.teams.MERAH.status = "TRAVELING";

    const html = renderToString(<WalkingView team={world.teams.MERAH} />);

    // Must not contain any challenge card or card test ids
    assert.ok(!html.includes('data-testid="challenge-card"'));
    assert.ok(!html.includes('data-testid="gate-challenge-card"'));
    assert.ok(!html.includes('data-testid="fishing-challenge-card"'));
    assert.ok(!html.includes("Pertanyaan Pembuka Gembok"));
    assert.ok(!html.includes("Pertanyaan Tarik Ikan"));
  });

  it("mini-map SVG ada dan merender avatar", () => {
    const world = createInitialWorldState();
    world.teams.MERAH.location = "ALUN";

    const html = renderToString(<WalkingView team={world.teams.MERAH} />);

    assert.ok(html.includes('data-testid="mini-map-svg"'));
    assert.ok(html.includes("<svg"));
    assert.ok(html.includes("Alun"));
    assert.ok(html.includes("Dermaga 1"));
    assert.ok(html.includes('data-testid="character-avatar-putri-hijab"'));
  });

  it("tombol tujuan disabled saat gate belum unlock atau butuh VIP key", () => {
    const world = createInitialWorldState();
    world.teams.MERAH.location = "ALUN";

    const html = renderToString(
      <WalkingView
        team={world.teams.MERAH}
        gatesUnlocked={{ GERBANG_KANTIN: false }}
        hasVIPKey={false}
      />
    );

    // Kantin button must be disabled
    assert.ok(html.includes('data-testid="dest-button-kantin"'));
    assert.ok(html.includes('disabled="" data-testid="dest-button-kantin"'));

    // Dermaga VIP button must be disabled
    assert.ok(html.includes('data-testid="dest-button-dermaga-vip"'));
    assert.ok(html.includes('disabled="" data-testid="dest-button-dermaga-vip"'));

    // Kios button should be enabled
    assert.ok(html.includes('data-testid="dest-button-kios"'));
    assert.ok(!html.includes('disabled="" data-testid="dest-button-kios"'));
  });
});
