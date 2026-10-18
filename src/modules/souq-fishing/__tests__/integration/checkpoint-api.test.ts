import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import {
  POST,
  GET,
  mergeCheckpointIntoSnapshot,
} from "@/app/api/souq-fishing/checkpoint/route";

describe("Phase 5 Integration: Checkpoint API Suite", () => {
  it("POST returns 401 when projector token is invalid or missing", async () => {
    // Missing token
    const reqNoToken = new NextRequest("http://localhost:3000/api/souq-fishing/checkpoint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: "room-123", checkpoint: { tick: 1 } }),
    });

    const resNoToken = await POST(reqNoToken);
    assert.equal(resNoToken.status, 401);
    const bodyNoToken = await resNoToken.json();
    assert.equal(bodyNoToken.error, "UNAUTHORIZED");

    // Invalid token
    const reqInvalidToken = new NextRequest("http://localhost:3000/api/souq-fishing/checkpoint", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer invalid",
      },
      body: JSON.stringify({ roomId: "room-123", checkpoint: { tick: 1 } }),
    });

    const resInvalidToken = await POST(reqInvalidToken);
    assert.equal(resInvalidToken.status, 401);
  });

  it("POST returns 413 when checkpoint payload exceeds 64 KB limit", async () => {
    // Large payload > 64 KB
    const giantPadding = "X".repeat(65 * 1024);
    const largeCheckpoint = {
      tick: 99,
      giantPadding,
    };

    const reqLarge = new NextRequest("http://localhost:3000/api/souq-fishing/checkpoint", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-projector-token",
      },
      body: JSON.stringify({ roomId: "room-123", checkpoint: largeCheckpoint }),
    });

    const resLarge = await POST(reqLarge);
    assert.equal(resLarge.status, 413);
    const bodyLarge = await resLarge.json();
    assert.equal(bodyLarge.error, "PAYLOAD_TOO_LARGE");
  });

  it("POST correctly merges checkpoint into rooms.snapshot without overwriting existing questions or fields", async () => {
    const existingSnapshot = {
      game_theme: "souq_fishing",
      questions: [
        { id: "q-1", text: "Existing question 1" },
        { id: "q-2", text: "Existing question 2" },
      ],
      custom_settings: { soundEnabled: true },
    };

    const newCheckpoint = {
      tick: 15,
      teams: {
        MERAH: { points: 100, location: "KIOS" },
      },
    };

    const { snapshot: merged, updated_at } = mergeCheckpointIntoSnapshot(
      existingSnapshot,
      newCheckpoint,
    );

    // Verify existing fields are 100% preserved
    assert.equal(merged.game_theme, "souq_fishing");
    assert.deepEqual(merged.questions, existingSnapshot.questions);
    assert.deepEqual(merged.custom_settings, existingSnapshot.custom_settings);

    // Verify versioned envelope in souq_fishing.checkpoint_v1
    const souqObj = merged.souq_fishing as Record<string, unknown>;
    assert.ok(souqObj);
    const cpEnvelope = souqObj.checkpoint_v1 as Record<string, unknown>;
    assert.ok(cpEnvelope);
    assert.equal(cpEnvelope.version, 1);
    assert.equal(cpEnvelope.updated_at, updated_at);
    assert.deepEqual(cpEnvelope.data, newCheckpoint);
  });

  it("GET returns { checkpoint: null } when checkpoint does not exist or room has no checkpoint", async () => {
    const reqGet = new NextRequest(
      "http://localhost:3000/api/souq-fishing/checkpoint?roomId=non-existent-room",
      {
        method: "GET",
        headers: {
          Authorization: "Bearer valid-projector-token",
        },
      },
    );

    const resGet = await GET(reqGet);
    assert.equal(resGet.status, 200);
    const bodyGet = await resGet.json();
    assert.equal(bodyGet.checkpoint, null);
  });
});
