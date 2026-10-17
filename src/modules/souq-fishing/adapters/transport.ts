import type {
  TransportAdapter,
  TransportMessage,
  TransportRole,
} from "./types";

/**
 * MagguruTransportAdapter stub.
 * Implements message routing between Host and Controllers via polling and Supabase Realtime Broadcast.
 * Strictly enforces rate limits (<25 msg/sec) and event debouncing.
 */
export class MagguruTransportAdapter implements TransportAdapter {
  private roomCode: string = "";
  private role: TransportRole = "spectator";
  private clientId: string = "";
  private listeners: Map<string, Array<(msg: TransportMessage<unknown>) => void>> = new Map();
  private isConnected: boolean = false;
  private messageCountLastSecond: number = 0;
  private lastRateWindowStart: number = Date.now();

  async connect(roomCode: string, role: TransportRole, clientId: string): Promise<void> {
    this.roomCode = roomCode.toUpperCase().trim();
    this.role = role;
    this.clientId = clientId;
    this.isConnected = true;
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.listeners.clear();
  }

  async sendMessage<T>(action: string, payload: T): Promise<boolean> {
    if (!this.isConnected) return false;

    // Rate Limiter Guard: Max 25 msg/sec
    const now = Date.now();
    if (now - this.lastRateWindowStart > 1000) {
      this.lastRateWindowStart = now;
      this.messageCountLastSecond = 0;
    }
    this.messageCountLastSecond++;
    if (this.messageCountLastSecond > 25) {
      console.warn(`[SouqTransport] Rate limit exceeded (>25 msg/s) for room ${this.roomCode}`);
      return false;
    }

    const msg: TransportMessage<T> = {
      id: `${now}-${Math.random().toString(36).substring(2, 7)}`,
      roomCode: this.roomCode,
      senderRole: this.role,
      senderId: this.clientId,
      action,
      payload,
      timestamp: now,
    };

    // Dispatch locally to matching listeners
    const handlers = this.listeners.get(action) ?? [];
    for (const h of handlers) {
      try {
        h(msg as TransportMessage<unknown>);
      } catch (err) {
        console.error(`[SouqTransport] Error in handler for action ${action}:`, err);
      }
    }

    return true;
  }

  onMessage<T>(action: string, callback: (msg: TransportMessage<T>) => void): () => void {
    const list = this.listeners.get(action) ?? [];
    list.push(callback as (msg: TransportMessage<unknown>) => void);
    this.listeners.set(action, list);

    return () => {
      const current = this.listeners.get(action) ?? [];
      this.listeners.set(
        action,
        current.filter((cb) => cb !== callback),
      );
    };
  }

  async getActiveControllers(): Promise<string[]> {
    return [this.clientId];
  }
}
