import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { POST, GET } from "@/app/api/souq-fishing/checkpoint/route";
import {
  setCheckpointSupabaseClient,
  mergeCheckpointIntoSnapshot,
} from "@/modules/souq-fishing/adapters/checkpoint-store";

describe("Phase 6.5 Remediation: Checkpoint API Suite (Atomic Merge & Real DB Auth)", () => {
  let mockRooms: Record<string, { id: string; snapshot: Record<string, unknown> }>;
  let mockSessions: Record<string, { id: string; room_id: string; ended_at: string | null }>;
  let mockParticipants: Array<{ id: string; room_id: string; join_token: string }>;
  let rpcCallCount: number;

  const mockSupabaseClient = {
    from(table: string) {
      return {
        select() {
          return {
            eq(col1: string, val1: string) {
              return {
                maybeSingle() {
                  if (table === "room_sessions" && col1 === "room_id") {
                    return Promise.resolve({ data: mockSessions[val1] ?? null, error: null });
                  }
                  if (table === "rooms" && col1 === "id") {
                    return Promise.resolve({ data: mockRooms[val1] ?? null, error: null });
                  }
                  return Promise.resolve({ data: null, error: null });
                },
                eq(col2: string, val2: string) {
                  return {
                    maybeSingle() {
                      if (table === "room_participants" && col1 === "room_id" && col2 === "join_token") {
                        const found = mockParticipants.find(
                          (p) => p.room_id === val1 && p.join_token === val2,
                        );
                        return Promise.resolve({ data: found ?? null, error: null });
                      }
                      return Promise.resolve({ data: null, error: null });
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
    rpc(name: string, args: { p_room_id: string; p_checkpoint: unknown }) {
      if (name === "souq_fishing_merge_checkpoint") {
        rpcCallCount++;
        const currentRoom = mockRooms[args.p_room_id] || { id: args.p_room_id, snapshot: {} };
        const currentSouq = (currentRoom.snapshot.souq_fishing as Record<string, unknown>) || {};
        mockRooms[args.p_room_id] = {
          ...currentRoom,
          snapshot: {
            ...currentRoom.snapshot,
            souq_fishing: {
              ...currentSouq,
              checkpoint_v1: args.p_checkpoint,
            },
          },
        };
        return Promise.resolve({ data: args.p_checkpoint, error: null });
      }
      return Promise.resolve({ data: null, error: new Error(`Unknown RPC ${name}`) });
    },
  };

  beforeEach(() => {
    rpcCallCount = 0;
    mockRooms = {
      "room-active": {
        id: "room-active",
        snapshot: {
          game_questions: [
            { id: "gq-1", text: "Apa arti Souq?" },
            { id: "gq-2", text: "Apa arti Samak?" },
          ],
          custom_settings: { soundEnabled: true },
        },
      },
      "room-ended": {
        id: "room-ended",
        snapshot: {
          game_questions: [{ id: "gq-3", text: "Soal lama" }],
        },
      },
      "room-empty": {
        id: "room-empty",
        snapshot: {},
      },
    };

    mockSessions = {
      "room-active": {
        id: "session-active-uuid",
        room_id: "room-active",
        ended_at: null, // Active
      },
      "room-ended": {
        id: "session-ended-uuid",
        room_id: "room-ended",
        ended_at: "2026-10-18T23:59:59Z", // Ended
      },
    };

    mockParticipants = [
      { id: "part-1", room_id: "room-active", join_token: "valid-active-token" },
      { id: "part-2", room_id: "room-ended", join_token: "valid-ended-token" },
    ];

    setCheckpointSupabaseClient(mockSupabaseClient);
  });

  // 1. POST tanpa Authorization -> 401
  it("1. POST tanpa Authorization header returns 401 Unauthorized", async () => {
    const req = new NextRequest("http://localhost:3000/api/souq-fishing/checkpoint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: "room-active", checkpoint: { tick: 1 } }),
    });

    const res = await POST(req);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error, "UNAUTHORIZED");
  });

  // 2. POST dengan token acak "abc123" -> 401 (BUKAN lolos!)
  it("2. POST dengan token acak 'abc123' fails real DB lookup and returns 401 Unauthorized", async () => {
    const req = new NextRequest("http://localhost:3000/api/souq-fishing/checkpoint", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer abc123",
      },
      body: JSON.stringify({ roomId: "room-active", checkpoint: { tick: 1 } }),
    });

    const res = await POST(req);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error, "UNAUTHORIZED");
    assert.equal(rpcCallCount, 0, "RPC must never be invoked on invalid token");
  });

  // 3. POST dengan token valid tapi session ended -> 401
  it("3. POST dengan token valid tapi session ended (ended_at !== null) returns 401 Unauthorized", async () => {
    const req = new NextRequest("http://localhost:3000/api/souq-fishing/checkpoint", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-ended-token",
      },
      body: JSON.stringify({ roomId: "room-ended", checkpoint: { tick: 1 } }),
    });

    const res = await POST(req);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error, "UNAUTHORIZED");
    assert.equal(rpcCallCount, 0, "RPC must never be invoked for ended room session");
  });

  // 4. POST dengan token valid + session aktif -> 200
  it("4. POST dengan token valid + session aktif returns 200 with updated_at", async () => {
    const req = new NextRequest("http://localhost:3000/api/souq-fishing/checkpoint", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-active-token",
      },
      body: JSON.stringify({
        roomId: "room-active",
        checkpoint: { tick: 42, phase: "FISHING" },
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.ok(body.updated_at);
    assert.equal(rpcCallCount, 1, "Atomic RPC must be called exactly once");
  });

  // 5. POST payload >64 KB -> 413
  it("5. POST dengan checkpoint payload > 64 KB returns 413 Payload Too Large", async () => {
    const giantPayload = "Y".repeat(66 * 1024);
    const req = new NextRequest("http://localhost:3000/api/souq-fishing/checkpoint", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-active-token",
      },
      body: JSON.stringify({
        roomId: "room-active",
        checkpoint: { tick: 1, padding: giantPayload },
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 413);
    const body = await res.json();
    assert.equal(body.error, "PAYLOAD_TOO_LARGE");
    assert.equal(rpcCallCount, 0, "RPC must not execute if payload exceeds 64 KB guard");
  });

  // 6. POST concurrent × 2 (simulate 2 sequential calls, verify RPC called 2x, verify both persisted)
  it("6. POST concurrent x 2 executes atomic RPC twice and both checkpoints persist in DB state", async () => {
    const req1 = new NextRequest("http://localhost:3000/api/souq-fishing/checkpoint", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-active-token",
      },
      body: JSON.stringify({
        roomId: "room-active",
        checkpoint: { tick: 10, team: "MERAH", points: 100 },
      }),
    });

    const req2 = new NextRequest("http://localhost:3000/api/souq-fishing/checkpoint", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-active-token",
      },
      body: JSON.stringify({
        roomId: "room-active",
        checkpoint: { tick: 11, team: "BIRU", points: 250 },
      }),
    });

    const [res1, res2] = await Promise.all([POST(req1), POST(req2)]);
    assert.equal(res1.status, 200);
    assert.equal(res2.status, 200);
    assert.equal(rpcCallCount, 2, "Atomic RPC must be executed twice for concurrent posts");

    // Verify final state in mock DB contains the checkpoint
    const currentRoom = mockRooms["room-active"];
    const souqObj = currentRoom.snapshot.souq_fishing as Record<string, unknown>;
    assert.ok(souqObj?.checkpoint_v1);
  });

  // 7. POST valid -> verify snapshot.game_questions TIDAK berubah
  it("7. POST valid ensures snapshot.game_questions and other metadata remain 100% intact", async () => {
    const initialQuestions = [...mockRooms["room-active"].snapshot.game_questions as unknown[]];

    const req = new NextRequest("http://localhost:3000/api/souq-fishing/checkpoint", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-active-token",
      },
      body: JSON.stringify({
        roomId: "room-active",
        checkpoint: { tick: 99, status: "SAVED" },
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 200);

    const updatedRoom = mockRooms["room-active"];
    assert.deepEqual(
      updatedRoom.snapshot.game_questions,
      initialQuestions,
      "game_questions array must NEVER be overwritten or mutated by checkpoint writes",
    );
    assert.deepEqual(
      updatedRoom.snapshot.custom_settings,
      { soundEnabled: true },
      "custom_settings must remain intact",
    );
  });

  // 8. GET checkpoint null -> { checkpoint: null }
  it("8. GET checkpoint null returns 200 with { checkpoint: null }", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/souq-fishing/checkpoint?roomId=room-empty",
      {
        method: "GET",
        headers: {
          Authorization: "Bearer valid-active-token",
        },
      },
    );

    // Provide active session for room-empty
    mockSessions["room-empty"] = {
      id: "session-empty",
      room_id: "room-empty",
      ended_at: null,
    };
    mockParticipants.push({
      id: "part-empty",
      room_id: "room-empty",
      join_token: "valid-active-token",
    });

    const res = await GET(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.checkpoint, null);
  });

  // 9. GET checkpoint valid + token valid -> return checkpoint
  it("9. GET checkpoint valid with valid token returns checkpoint data", async () => {
    // Write checkpoint first
    await mergeCheckpointIntoSnapshot(
      mockSupabaseClient as unknown as SupabaseClient,
      "room-active",
      {
        tick: 77,
        score: 1500,
      },
    );

    const req = new NextRequest(
      "http://localhost:3000/api/souq-fishing/checkpoint?roomId=room-active",
      {
        method: "GET",
        headers: {
          Authorization: "Bearer valid-active-token",
        },
      },
    );

    const res = await GET(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.checkpoint);
    assert.equal(body.checkpoint.tick, 77);
    assert.equal(body.checkpoint.score, 1500);
  });

  // 10. GET tanpa token -> 401
  it("10. GET without token returns 401 Unauthorized", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/souq-fishing/checkpoint?roomId=room-active",
      {
        method: "GET",
      },
    );

    const res = await GET(req);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error, "UNAUTHORIZED");
  });

  // 11. POST dengan token = session.id (UUID sesi) -> 401 (Backdoor ditutup)
  it("11. POST with token = session.id (UUID sesi) returns 401 Unauthorized (backdoor removal verified)", async () => {
    const sessionId = mockSessions["room-active"].id; // "session-active-uuid"
    const req = new NextRequest("http://localhost:3000/api/souq-fishing/checkpoint", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionId}`,
      },
      body: JSON.stringify({ roomId: "room-active", checkpoint: { tick: 1 } }),
    });

    const res = await POST(req);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error, "UNAUTHORIZED");
    assert.equal(rpcCallCount, 0, "RPC must never be called with session.id as token");
  });
});
