import React from "react";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderToString } from "react-dom/server";
import { createInitialWorldState } from "../../../engine/world";
import { ProjectorShell } from "../../../ui/projector/ProjectorShell";

describe("Phase 3 UI: ProjectorShell Root Layout Suite", () => {
  it("renders without error and wraps layout in root main element", () => {
    const world = createInitialWorldState();
    const html = renderToString(<ProjectorShell worldState={world} />);

    assert.ok(html.includes("projector-shell"));
    assert.ok(html.includes("projector-world-map"));
    assert.ok(html.includes("projector-four-team-tables"));
  });

  it("enforces overflow: hidden and 100vh on root shell", () => {
    const world = createInitialWorldState();
    const html = renderToString(<ProjectorShell worldState={world} />);

    assert.ok(html.includes("h-screen"));
    assert.ok(html.includes("w-screen"));
    assert.ok(html.includes("overflow:hidden") || html.includes("overflow-hidden"));
    assert.ok(html.includes("overscroll-behavior:none"));
  });

  it("enforces vertical grid ratio 58fr / 42fr", () => {
    const world = createInitialWorldState();
    const html = renderToString(<ProjectorShell worldState={world} />);

    assert.ok(html.includes("grid-rows-[58fr_42fr]"));
  });

  it("ensures no position: fixed anywhere across projector shell hierarchy", () => {
    const world = createInitialWorldState();
    const html = renderToString(<ProjectorShell worldState={world} />);

    assert.ok(!html.includes("position:fixed") && !html.includes("position: fixed"));
    assert.ok(!html.includes("fixed inset"));
  });
});
