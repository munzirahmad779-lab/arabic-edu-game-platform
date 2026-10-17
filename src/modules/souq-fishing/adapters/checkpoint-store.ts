import type {
  CheckpointData,
  CheckpointStoreAdapter,
} from "./types";

export const CHECKPOINT_MAX_BYTES = 64 * 1024; // 64 KB strict guard
export const CHECKPOINT_NAMESPACE = "snapshot.souq_fishing.checkpoint_v1";

/**
 * MagguruCheckpointStoreAdapter stub.
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
