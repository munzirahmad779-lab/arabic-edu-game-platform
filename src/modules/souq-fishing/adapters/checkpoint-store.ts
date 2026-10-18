import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  CheckpointData,
  CheckpointStoreAdapter,
} from "./types";

export const CHECKPOINT_MAX_BYTES = 64 * 1024; // 64 KB strict guard
export const CHECKPOINT_NAMESPACE = "snapshot.souq_fishing.checkpoint_v1";

let _testClient: SupabaseClient | null = null;

export function setCheckpointSupabaseClient(client: unknown) {
  _testClient = client as SupabaseClient | null;
}

export function getCheckpointSupabaseClient(): SupabaseClient {
  if (_testClient) {
    return _testClient;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://test-ci.supabase.co";
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "ci-testing-key-magguru";

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Atomic Checkpoint Merge Helper.
 * Calls PostgreSQL RPC souq_fishing_merge_checkpoint to guarantee single-statement
 * atomic JSONB merge, preventing multi-lambda read-modify-write race conditions.
 */
export async function mergeCheckpointIntoSnapshot(
  supabaseAdmin: SupabaseClient,
  roomId: string,
  checkpoint: unknown,
): Promise<{ ok: boolean; updated_at: string }> {
  const updatedAt =
    (checkpoint && typeof checkpoint === "object" && "updated_at" in checkpoint
      ? String((checkpoint as Record<string, unknown>).updated_at)
      : null) || new Date().toISOString();

  const versionedCheckpoint = {
    version: 1,
    updated_at: updatedAt,
    data: checkpoint,
  };

  const { error } = await supabaseAdmin.rpc("souq_fishing_merge_checkpoint", {
    p_room_id: roomId,
    p_checkpoint: versionedCheckpoint,
  });

  if (error) {
    throw error;
  }

  return { ok: true, updated_at: updatedAt };
}

/**
 * MagguruCheckpointStoreAdapter.
 * Stores and recovers session state atomically without overwriting Magguru question snapshots.
 */
export class MagguruCheckpointStoreAdapter implements CheckpointStoreAdapter {
  private inMemoryStore: Map<string, CheckpointData> = new Map();

  async saveCheckpoint(roomCode: string, checkpoint: CheckpointData): Promise<boolean> {
    const serialized = JSON.stringify(checkpoint);
    const byteLength = new TextEncoder().encode(serialized).length;

    // Strict 64 KB Size Guard
    if (byteLength > CHECKPOINT_MAX_BYTES) {
      console.error(
        `[CheckpointStore] Checkpoint size exceeds 64 KB limit (${byteLength} bytes) for room ${roomCode}`,
      );
      return false;
    }

    const versionedCheckpoint: CheckpointData = {
      ...checkpoint,
      version: (checkpoint.version || 0) + 1,
      updatedAt: new Date().toISOString(),
    };

    this.inMemoryStore.set(roomCode.toUpperCase().trim(), versionedCheckpoint);
    return true;
  }

  async loadCheckpoint(roomCode: string): Promise<CheckpointData | null> {
    const found = this.inMemoryStore.get(roomCode.toUpperCase().trim());
    return found ?? null;
  }

  async clearCheckpoint(roomCode: string): Promise<boolean> {
    return this.inMemoryStore.delete(roomCode.toUpperCase().trim());
  }
}
