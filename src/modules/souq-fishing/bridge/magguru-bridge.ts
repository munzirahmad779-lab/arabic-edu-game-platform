/**
 * Magguru Bridge for Souq & Fishing Game Module.
 * This is the SINGLE plug-and-play gateway connecting the module to Magguru web routes.
 * When feature flag is OFF, this module has ZERO effect on runtime behavior.
 * Strictly typed — zero `any` or `@ts-ignore`.
 */

import React from "react";
import themeLabels from "../config/theme-labels.json";
import { createInitialWorldState } from "../engine/world";
import type { WorldState, TeamColor } from "../engine/types";
import { ControllerShell } from "../ui/controller";
import type {
  QuestionSourceAdapter,
  TransportAdapter,
  CheckpointStoreAdapter,
  ResultSinkAdapter,
  AuthoritativeQuestion,
} from "../adapters/types";
import { MagguruQuestionSourceAdapter } from "../adapters/question-source";
import { MagguruTransportAdapter } from "../adapters/transport";
import { MagguruCheckpointStoreAdapter } from "../adapters/checkpoint-store";
import { MagguruResultSinkAdapter } from "../adapters/result-sink";

export const FEATURE_FLAG_ENV_KEY = "NEXT_PUBLIC_ENABLE_SOUQ_FISHING_MODULE";
export const SOUQ_FISHING_ENGINE_ID = "souq_fishing";

/**
 * Returns true only if Souq & Fishing module is explicitly enabled via environment variable.
 * Defaults to false when unset, empty, 'false', or '0'.
 */
export function isSouqFishingEnabled(customEnv?: Record<string, string | undefined>): boolean {
  const envSource = customEnv ?? (typeof process !== "undefined" ? process.env : {});
  const val = envSource[FEATURE_FLAG_ENV_KEY] ?? envSource.ENABLE_SOUQ_FISHING_MODULE;
  if (val === "true" || val === "1") {
    return true;
  }
  return false;
}

type ThemeDict = { game: { title: string; badge: string; description: string } };

/**
 * Returns localized theme metadata for the game mode selector in teacher dashboard.
 */
export function getSouqFishingEngineMetadata(locale: "id" | "ar" | "en" | "bugis_lontara" = "id") {
  const dict = ((themeLabels as Record<string, unknown>)[locale] ?? themeLabels.id) as ThemeDict;
  return {
    id: SOUQ_FISHING_ENGINE_ID,
    name: dict.game.title,
    icon: "🎣",
    badge: dict.game.badge,
    desc: dict.game.description,
    color: "from-amber-600 via-teal-700 to-sky-800",
    border: "border-teal-400",
  };
}

export const SOUQ_FISHING_METADATA = getSouqFishingEngineMetadata("id");

/**
 * Game Definition compatible with Magguru's GameRegistry.
 */
export function getSouqFishingGameDefinition() {
  return {
    id: SOUQ_FISHING_ENGINE_ID as unknown as import("@/lib/game-engine/types").NormalizedGameType,
    nameKey: "Ekspedisi Pasar & Dermaga Pancing",
    descriptionKey: "Petualangan edukatif kooperatif: jelajahi pasar, taklukkan gerbang mufrodat, dan pancing ikan di dermaga.",
    icon: "🎣",
    accentColor: "teal",
    capabilities: {
      supportedModes: ["competitive", "cooperative", "practice", "endless"] as const,
      hasLanes: true,
      hasTimer: true,
      supportsTouch: true,
      supportsKeyboard: true,
      supportsArabicRTL: true,
      supportsSingleQuestion: true,
    },
    defaultDifficulty: "medium" as const,
  };
}

/**
 * Sanitizes a question for client transport, stripping out all correct answer keys and explanations.
 * Prevents answer leakage on student HP controller views.
 */
export function sanitizeQuestionForClient(q: Record<string, unknown>): Record<string, unknown> {
  if (!q || typeof q !== "object") return {};

  const forbiddenKeys = new Set([
    "correctOptionId",
    "correct_option_id",
    "correctOptionKey",
    "correct_option_key",
    "explanation",
    "isCorrect",
    "is_correct",
  ]);

  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(q)) {
    if (!forbiddenKeys.has(key)) {
      rest[key] = value;
    }
  }

  let sanitizedOptions: unknown[] = [];
  if (Array.isArray(q.options)) {
    const optForbidden = new Set(["isCorrect", "is_correct", "correct"]);
    sanitizedOptions = q.options.map((opt) => {
      if (!opt || typeof opt !== "object") return opt;
      const optClean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(opt as Record<string, unknown>)) {
        if (!optForbidden.has(k)) {
          optClean[k] = v;
        }
      }
      return optClean;
    });
  }

  return {
    ...rest,
    options: sanitizedOptions,
  };
}

/**
 * Hydrates or recovers WorldState from a checkpoint payload.
 * Returns a valid default WorldState if checkpoint is null, undefined, or corrupt.
 */
export function computeWorldStateFromCheckpoint(checkpoint: unknown): WorldState {
  if (!checkpoint || typeof checkpoint !== "object") {
    return createInitialWorldState();
  }

  const cp = checkpoint as Record<string, unknown>;
  const teamsCandidate = (cp.teams ?? cp.teamsState) as Record<string, unknown> | undefined;

  if (
    teamsCandidate &&
    typeof teamsCandidate === "object" &&
    "MERAH" in teamsCandidate &&
    "BIRU" in teamsCandidate &&
    "KUNING" in teamsCandidate &&
    "HIJAU" in teamsCandidate
  ) {
    return {
      teams: teamsCandidate as unknown as Record<TeamColor, import("../engine/types").TeamState>,
      tick: typeof cp.tick === "number" ? cp.tick : 0,
    };
  }

  return createInitialWorldState();
}

/**
 * Builds or extracts a WorldState snapshot from a Magguru room object.
 */
export function buildProjectorSnapshot(room?: Record<string, unknown> | null): WorldState {
  if (!room) {
    return createInitialWorldState();
  }

  const snapshot = room.snapshot as Record<string, unknown> | undefined;
  const souqData = snapshot?.souq_fishing as Record<string, unknown> | undefined;
  const checkpointEnvelope = souqData?.checkpoint_v1 as Record<string, unknown> | undefined;

  if (checkpointEnvelope?.data) {
    return computeWorldStateFromCheckpoint(checkpointEnvelope.data);
  }

  if (checkpointEnvelope) {
    return computeWorldStateFromCheckpoint(checkpointEnvelope);
  }

  return createInitialWorldState();
}

/**
 * Persists checkpoint state to the server-side isolated API route.
 */
export async function persistCheckpoint(
  roomId: string,
  checkpoint: unknown,
  token?: string,
): Promise<{ ok: boolean; updated_at?: string; error?: string }> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch("/api/souq-fishing/checkpoint", {
      method: "POST",
      headers,
      body: JSON.stringify({ roomId, checkpoint }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { ok: false, error: errData.error || `HTTP ${res.status}` };
    }

    const data = await res.json();
    return { ok: true, updated_at: data.updated_at };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

/**
 * Loads checkpoint state from the server-side isolated API route.
 */
export async function loadCheckpoint(
  roomId: string,
  token?: string,
): Promise<{ checkpoint: unknown | null; error?: string }> {
  try {
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const url = `/api/souq-fishing/checkpoint?roomId=${encodeURIComponent(roomId)}`;
    const res = await fetch(url, { method: "GET", headers });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { checkpoint: null, error: errData.error || `HTTP ${res.status}` };
    }

    const data = await res.json();
    return { checkpoint: data.checkpoint ?? null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { checkpoint: null, error: message };
  }
}

/**
 * Self-paced / Student controller component wrapper for room participation.
 */
export function SouqFishingSelfPacedView({
  session,
  teamColor = "MERAH",
}: {
  session?: Record<string, unknown>;
  teamColor?: TeamColor;
}): React.ReactElement {
  const worldState = React.useMemo(() => buildProjectorSnapshot(session), [session]);

  return React.createElement(ControllerShell, {
    worldState,
    currentTeamColor: teamColor,
  });
}

/**
 * Factory creating default runtime adapters for Souq & Fishing.
 */
export function createSouqFishingAdapters(initialQuestions?: Record<string, AuthoritativeQuestion[]>): {
  questionSource: QuestionSourceAdapter;
  transport: TransportAdapter;
  checkpointStore: CheckpointStoreAdapter;
  resultSink: ResultSinkAdapter;
} {
  return {
    questionSource: new MagguruQuestionSourceAdapter(initialQuestions),
    transport: new MagguruTransportAdapter(),
    checkpointStore: new MagguruCheckpointStoreAdapter(),
    resultSink: new MagguruResultSinkAdapter(),
  };
}
