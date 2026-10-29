import { hasSupabaseEnv } from "../supabase/env";
import { MIN_QUESTION_DURATION_SECONDS } from "./question-duration";
import type { Json } from "../../types/database";

export interface ControllerEvent {
  id: string;
  roomCode: string;
  teamId: string;
  playerName: string;
  optionId?: string | null;
  optionKey?: string | null;
  action?: "press" | "heartbeat";
  timestamp: number;
}

export interface ProjectorGameState {
  phase: "lobby" | "question" | "reveal" | "leaderboard" | "finished";
  currentQuestionIndex: number;
  timerSeconds: number;
  totalQuestions: number;
  questionText?: string;
  answeredTeams: Record<string, { optionKey: string; timestamp: number }>;
  lastUpdated: number;
}

export interface RoomControllerData {
  events: ControllerEvent[];
  heartbeats: Record<string, number>;
  gameState: ProjectorGameState;
}

// Global in-memory storage for active hotseat projector controller sessions
declare global {
  // eslint-disable-next-line no-var
  var __projectorControllerStore: Map<string, RoomControllerData> | undefined;
}

const store =
  globalThis.__projectorControllerStore ??
  new Map<string, RoomControllerData>();
globalThis.__projectorControllerStore = store;

export function normalizeProjectorRoomCode(roomCode: string): string {
  return roomCode.toUpperCase().trim();
}

export function createDefaultProjectorRoomData(
  now: number = Date.now(),
): RoomControllerData {
  return {
    events: [],
    heartbeats: {},
    gameState: {
      phase: "lobby",
      currentQuestionIndex: 0,
      // Lantai durasi soal bersama (30 detik) — selaras mode room DB.
      timerSeconds: MIN_QUESTION_DURATION_SECONDS,
      totalQuestions: 1,
      answeredTeams: {},
      lastUpdated: now,
    },
  };
}

export function getProjectorRoomData(roomCode: string): RoomControllerData {
  const normalized = normalizeProjectorRoomCode(roomCode);
  let data = store.get(normalized);
  if (!data) {
    data = createDefaultProjectorRoomData();
    store.set(normalized, data);
  }
  return data;
}

export function isProjectorRoomActive(roomCode: string): boolean {
  const normalized = normalizeProjectorRoomCode(roomCode);
  return store.has(normalized);
}

// ===========================================================================
// Shared Supabase-backed store (Migration 0078: projector_room_states)
//
// The in-memory Map above remains as the fallback for environments without
// Supabase env vars (local dev and the regression suites, which import the
// sync helpers directly). Production paths (the controller API route and
// /join) use the async functions below: every server instance reads and
// writes the same public.projector_room_states rows through SECURITY
// DEFINER RPCs, so a press recorded on one instance is visible to the
// projector and to every stick polling any other instance, and /join checks
// the shared store instead of one instance's memory. A room counts as
// inactive after PROJECTOR_ROOM_TTL_MS without any write, mirroring the
// 60-second horizons the in-memory store already used (event retention);
// the projector syncs about once a second while a room is open.
// ===========================================================================

export const PROJECTOR_ROOM_TTL_MS = 60_000;
export const PROJECTOR_EVENT_TTL_MS = 60_000;
export const PROJECTOR_CONTROLLER_ACTIVE_MS = 15_000;

export function isProjectorRoomExpired(
  lastWriteMs: number,
  now: number = Date.now(),
): boolean {
  return now - lastWriteMs >= PROJECTOR_ROOM_TTL_MS;
}

/**
 * Union-merge for projector syncs (same semantics as migration 0078 and the
 * d6ce939 route fix): on the same question index the incoming map is merged
 * over the previous one so a sync can never erase a recorded answer; on a
 * new question index the incoming map (or an empty map when none is sent)
 * replaces it.
 */
export function mergeAnsweredTeamsForSync(
  previous: Record<string, { optionKey: string; timestamp: number }>,
  incoming:
    | Record<string, { optionKey: string; timestamp: number }>
    | undefined,
  sameQuestionIndex: boolean,
): Record<string, { optionKey: string; timestamp: number }> {
  if (incoming && typeof incoming === "object") {
    return sameQuestionIndex ? { ...previous, ...incoming } : { ...incoming };
  }
  return sameQuestionIndex ? previous : {};
}

export interface ProjectorSyncInput {
  phase?: ProjectorGameState["phase"];
  currentQuestionIndex?: number;
  timerSeconds?: number;
  totalQuestions?: number;
  questionText?: string;
  answeredTeams?: Record<string, { optionKey: string; timestamp: number }>;
}

/**
 * Builds the next game state from a projector sync payload, inheriting any
 * field the payload omits from the previous state (route parity with the
 * pre-0078 in-memory implementation).
 */
export function buildSyncedGameState(
  prev: ProjectorGameState,
  input: ProjectorSyncInput,
  now: number = Date.now(),
): ProjectorGameState {
  const prevQIndex = prev.currentQuestionIndex;
  const newQIndex =
    typeof input.currentQuestionIndex === "number"
      ? input.currentQuestionIndex
      : prevQIndex;

  return {
    phase: input.phase ?? prev.phase,
    currentQuestionIndex: newQIndex,
    timerSeconds:
      typeof input.timerSeconds === "number"
        ? input.timerSeconds
        : prev.timerSeconds,
    totalQuestions:
      typeof input.totalQuestions === "number"
        ? input.totalQuestions
        : prev.totalQuestions,
    questionText: input.questionText ?? prev.questionText,
    answeredTeams: mergeAnsweredTeamsForSync(
      prev.answeredTeams,
      input.answeredTeams,
      newQIndex === prevQIndex,
    ),
    lastUpdated: now,
  };
}

export interface ProjectorPressInput {
  teamId: string;
  playerName: string;
  optionId?: string | null;
  optionKey?: string | null;
}

export type ProjectorPressResult =
  | {
      success: true;
      eventId: string;
      optionKey: string;
      timestamp: number;
      isLocked: true;
    }
  | {
      success: false;
      error: "ALREADY_ANSWERED";
      existingAnswer: string | null;
    };

/**
 * Applies a stick press to room data: heartbeat first, then one locked
 * answer per team per question. Used by the in-memory fallback; the
 * Supabase path performs the same steps atomically inside the
 * press_projector_button RPC (migration 0078).
 */
export function applyPressToRoomData(
  data: RoomControllerData,
  roomCode: string,
  input: ProjectorPressInput,
  now: number = Date.now(),
): ProjectorPressResult {
  data.heartbeats[input.teamId] = now;

  const gs = data.gameState;
  const existing = gs.answeredTeams[input.teamId];
  if (existing) {
    return {
      success: false,
      error: "ALREADY_ANSWERED",
      existingAnswer: existing.optionKey ?? null,
    };
  }

  const keyUpper = (input.optionKey || "A").toUpperCase().trim();
  gs.answeredTeams[input.teamId] = { optionKey: keyUpper, timestamp: now };

  const event: ControllerEvent = {
    id: `evt-${now}-${Math.random().toString(36).slice(2, 6)}`,
    roomCode: normalizeProjectorRoomCode(roomCode),
    teamId: input.teamId,
    playerName: input.playerName,
    optionId: input.optionId ?? null,
    optionKey: keyUpper,
    action: "press",
    timestamp: now,
  };
  // Same 60-second event retention as the SQL press path.
  data.events = data.events.filter(
    (e) => now - e.timestamp < PROJECTOR_EVENT_TTL_MS,
  );
  data.events.push(event);

  return {
    success: true,
    eventId: event.id,
    optionKey: keyUpper,
    timestamp: now,
    isLocked: true,
  };
}

// Last write time per room, for the in-memory fallback's expiry bookkeeping.
const fallbackLastWriteAt = new Map<string, number>();

function markFallbackWrite(roomCode: string, now: number = Date.now()): void {
  fallbackLastWriteAt.set(normalizeProjectorRoomCode(roomCode), now);
}

async function createSharedStoreClient() {
  const { createClient } = await import("@/lib/supabase/server");
  return createClient();
}

function coerceRoomControllerData(raw: unknown): RoomControllerData {
  const base = createDefaultProjectorRoomData();
  if (!raw || typeof raw !== "object") return base;
  const blob = raw as Partial<RoomControllerData>;
  const gs = (
    blob.gameState && typeof blob.gameState === "object" ? blob.gameState : {}
  ) as Partial<ProjectorGameState>;
  return {
    events: Array.isArray(blob.events) ? blob.events : base.events,
    heartbeats:
      blob.heartbeats && typeof blob.heartbeats === "object"
        ? blob.heartbeats
        : base.heartbeats,
    gameState: {
      ...base.gameState,
      ...gs,
      answeredTeams:
        gs.answeredTeams && typeof gs.answeredTeams === "object"
          ? gs.answeredTeams
          : {},
    },
  };
}

/**
 * Loads the shared room state. Returns null when the room does not exist or
 * has expired, so GET polling no longer fabricates a ghost room the way the
 * per-instance Map did. Falls back to the in-memory Map when Supabase env
 * vars are absent or the RPC fails (logged), which keeps local dev and a
 * not-yet-migrated database degraded rather than down.
 */
export async function fetchProjectorRoomData(
  roomCode: string,
): Promise<RoomControllerData | null> {
  const code = normalizeProjectorRoomCode(roomCode);

  if (!hasSupabaseEnv()) {
    return getProjectorRoomData(code);
  }

  try {
    const supabase = await createSharedStoreClient();
    const { data, error } = await supabase.rpc("get_projector_room_state", {
      p_room_code: code,
    });
    if (error) throw error;
    if (data === null || data === undefined) return null;
    return coerceRoomControllerData(data);
  } catch (err) {
    console.error(
      "[projector-store] get_projector_room_state gagal, fallback ke memori:",
      err,
    );
    return getProjectorRoomData(code);
  }
}

/**
 * Persists a projector game-state sync and returns the authoritative merged
 * game state. The RPC re-applies the union-merge against the stored state,
 * so a press that landed after the caller's read is never erased.
 */
export async function syncProjectorGameState(
  roomCode: string,
  gameState: ProjectorGameState,
): Promise<ProjectorGameState> {
  const code = normalizeProjectorRoomCode(roomCode);

  if (!hasSupabaseEnv()) {
    const data = getProjectorRoomData(code);
    data.gameState = gameState;
    markFallbackWrite(code, gameState.lastUpdated);
    return data.gameState;
  }

  try {
    const supabase = await createSharedStoreClient();
    const { data, error } = await supabase.rpc("sync_projector_room_state", {
      p_room_code: code,
      p_game_state: gameState as unknown as Json,
    });
    if (error) throw error;
    const merged = data as unknown as Partial<ProjectorGameState> | null;
    if (!merged || typeof merged !== "object") return gameState;
    return { ...gameState, ...merged };
  } catch (err) {
    console.error(
      "[projector-store] sync_projector_room_state gagal, fallback ke memori:",
      err,
    );
    const data = getProjectorRoomData(code);
    data.gameState = gameState;
    markFallbackWrite(code, gameState.lastUpdated);
    return data.gameState;
  }
}

interface PressProjectorButtonRpcResult {
  success?: boolean;
  eventId?: string;
  optionKey?: string;
  timestamp?: number;
  existingAnswer?: string | null;
}

/**
 * Records a stick press in the shared store. The RPC checks and records the
 * answer atomically per room row, so two instances can no longer accept or
 * lose the same team's answer independently.
 */
export async function pressProjectorButton(
  roomCode: string,
  input: ProjectorPressInput,
): Promise<ProjectorPressResult> {
  const code = normalizeProjectorRoomCode(roomCode);
  const now = Date.now();

  if (!hasSupabaseEnv()) {
    const data = getProjectorRoomData(code);
    const result = applyPressToRoomData(data, code, input, now);
    markFallbackWrite(code, now);
    return result;
  }

  try {
    const supabase = await createSharedStoreClient();
    const { data, error } = await supabase.rpc("press_projector_button", {
      p_room_code: code,
      p_team_id: input.teamId,
      p_player_name: input.playerName,
      p_option_id: input.optionId ?? null,
      p_option_key: input.optionKey ?? null,
    });
    if (error) throw error;
    const raw = (data ?? null) as PressProjectorButtonRpcResult | null;
    if (raw?.success) {
      return {
        success: true,
        eventId: String(raw.eventId ?? ""),
        optionKey: String(raw.optionKey ?? ""),
        timestamp: Number(raw.timestamp ?? now),
        isLocked: true,
      };
    }
    return {
      success: false,
      error: "ALREADY_ANSWERED",
      existingAnswer: raw?.existingAnswer ?? null,
    };
  } catch (err) {
    console.error(
      "[projector-store] press_projector_button gagal, fallback ke memori:",
      err,
    );
    const data = getProjectorRoomData(code);
    const result = applyPressToRoomData(data, code, input, now);
    markFallbackWrite(code, now);
    return result;
  }
}

/** Records a stick heartbeat in the shared store; returns the timestamp. */
export async function touchProjectorController(
  roomCode: string,
  teamId: string,
): Promise<number> {
  const code = normalizeProjectorRoomCode(roomCode);
  const now = Date.now();

  if (!hasSupabaseEnv()) {
    const data = getProjectorRoomData(code);
    data.heartbeats[teamId] = now;
    markFallbackWrite(code, now);
    return now;
  }

  try {
    const supabase = await createSharedStoreClient();
    const { data, error } = await supabase.rpc("touch_projector_controller", {
      p_room_code: code,
      p_team_id: teamId,
    });
    if (error) throw error;
    const serverNow = Number(data);
    return Number.isFinite(serverNow) && serverNow > 0 ? serverNow : now;
  } catch (err) {
    console.error(
      "[projector-store] touch_projector_controller gagal, fallback ke memori:",
      err,
    );
    const data = getProjectorRoomData(code);
    data.heartbeats[teamId] = now;
    markFallbackWrite(code, now);
    return now;
  }
}

/**
 * Shared-store replacement for the /join projector check: true only while
 * some instance has written the room within PROJECTOR_ROOM_TTL_MS.
 */
export async function isProjectorRoomActiveShared(
  roomCode: string,
): Promise<boolean> {
  const code = normalizeProjectorRoomCode(roomCode);

  if (!hasSupabaseEnv()) {
    if (!store.has(code)) return false;
    const lastWrite = fallbackLastWriteAt.get(code);
    // Entries created through the legacy sync helpers (regression suites)
    // carry no fallback timestamp: keep the legacy "present = active"
    // meaning for them.
    if (lastWrite === undefined) return true;
    return !isProjectorRoomExpired(lastWrite);
  }

  try {
    const supabase = await createSharedStoreClient();
    const { data, error } = await supabase.rpc("is_projector_room_active", {
      p_room_code: code,
    });
    if (error) throw error;
    return data === true;
  } catch (err) {
    console.error(
      "[projector-store] is_projector_room_active gagal, fallback ke memori:",
      err,
    );
    return isProjectorRoomActive(code);
  }
}
