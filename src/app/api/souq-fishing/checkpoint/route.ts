import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CHECKPOINT_MAX_BYTES,
  getCheckpointSupabaseClient,
  mergeCheckpointIntoSnapshot,
} from "@/modules/souq-fishing/adapters/checkpoint-store";

function extractToken(req: NextRequest, body?: Record<string, unknown>): string | null {
  const authHeader = req.headers.get("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.replace(/^Bearer\s+/, "").trim();
    if (token) return token;
  }
  if (body && typeof body.token === "string" && body.token.trim()) {
    return body.token.trim();
  }
  const queryToken = req.nextUrl.searchParams.get("token");
  if (queryToken && queryToken.trim()) {
    return queryToken.trim();
  }
  return null;
}

/**
 * Real Database Token Validation (Blocker #2 Resolution)
 * Validates against room_sessions for active session (ended_at IS NULL),
 * and verifies token against room_participants (join_token) or session.id.
 */
async function validateSessionAndToken(
  supabase: SupabaseClient,
  roomId: string,
  token: string | null,
): Promise<{ ok: boolean; status: number; error?: string }> {
  if (!token) {
    return { ok: false, status: 401, error: "UNAUTHORIZED" };
  }

  // 1. Query room_sessions to verify active session
  const { data: session, error: sessError } = await supabase
    .from("room_sessions")
    .select("id, room_id, ended_at")
    .eq("room_id", roomId)
    .maybeSingle();

  if (sessError || !session || session.ended_at !== null) {
    return { ok: false, status: 401, error: "UNAUTHORIZED" };
  }

  // 2. Query room_participants or session token
  const { data: participant } = await supabase
    .from("room_participants")
    .select("id, room_id, join_token")
    .eq("room_id", roomId)
    .eq("join_token", token)
    .maybeSingle();

  if (!participant) {
    return { ok: false, status: 401, error: "UNAUTHORIZED" };
  }

  return { ok: true, status: 200 };
}

/**
 * POST /api/souq-fishing/checkpoint
 * Atomically merges checkpoint state via PostgreSQL RPC souq_fishing_merge_checkpoint.
 * Eliminates read-modify-write race conditions.
 */
export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "INVALID_JSON_BODY" }, { status: 400 });
    }

    const checkpoint = body.checkpoint;
    if (checkpoint === undefined) {
      return NextResponse.json({ error: "MISSING_CHECKPOINT_PAYLOAD" }, { status: 400 });
    }

    // Strict 64 KB Size Guard
    const serialized = JSON.stringify(checkpoint);
    const byteLength = Buffer.byteLength(serialized, "utf8");
    if (byteLength > CHECKPOINT_MAX_BYTES) {
      return NextResponse.json(
        {
          error: "PAYLOAD_TOO_LARGE",
          message: `Checkpoint size (${byteLength} bytes) exceeds 64 KB limit`,
        },
        { status: 413 },
      );
    }

    const roomId = (body.roomId as string) || (body.room_id as string);
    if (!roomId) {
      return NextResponse.json({ error: "MISSING_ROOM_ID" }, { status: 400 });
    }

    const token = extractToken(req, body);
    const supabase = getCheckpointSupabaseClient();

    // Real DB Token & Active Session Verification
    const authCheck = await validateSessionAndToken(supabase, roomId, token);
    if (!authCheck.ok) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    // Single-Statement Atomic RPC Call
    const { updated_at } = await mergeCheckpointIntoSnapshot(supabase, roomId, checkpoint);
    return NextResponse.json({ ok: true, updated_at });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR", message }, { status: 500 });
  }
}

/**
 * GET /api/souq-fishing/checkpoint?roomId=...
 * Retrieves checkpoint from rooms.snapshot.souq_fishing.checkpoint_v1 after real DB token verification.
 */
export async function GET(req: NextRequest) {
  try {
    const roomId = req.nextUrl.searchParams.get("roomId") || req.nextUrl.searchParams.get("room_id");
    if (!roomId) {
      return NextResponse.json({ error: "MISSING_ROOM_ID" }, { status: 400 });
    }

    const token = extractToken(req);
    const supabase = getCheckpointSupabaseClient();

    // Real DB Token & Active Session Verification
    const authCheck = await validateSessionAndToken(supabase, roomId, token);
    if (!authCheck.ok) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const { data: room, error: fetchError } = await supabase
      .from("rooms")
      .select("id, snapshot")
      .eq("id", roomId)
      .maybeSingle();

    if (fetchError || !room) {
      return NextResponse.json({ checkpoint: null });
    }

    const snapshot = room.snapshot as Record<string, unknown> | undefined;
    const souqData = snapshot?.souq_fishing as Record<string, unknown> | undefined;
    const checkpointEnvelope = souqData?.checkpoint_v1 as Record<string, unknown> | undefined;

    if (!checkpointEnvelope) {
      return NextResponse.json({ checkpoint: null });
    }

    return NextResponse.json({
      checkpoint: checkpointEnvelope.data ?? checkpointEnvelope,
      updated_at: checkpointEnvelope.updated_at,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR", message }, { status: 500 });
  }
}
