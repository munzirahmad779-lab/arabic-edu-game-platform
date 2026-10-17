/**
 * Magguru Bridge for Souq & Fishing Game Module.
 * This is the SINGLE plug-and-play gateway connecting the module to Magguru web routes.
 * When feature flag is OFF, this module has ZERO effect on runtime behavior.
 * Strictly typed — zero `any` or `@ts-ignore`.
 */

import { isSouqFishingEnabled } from "../config/feature-flag";
import themeLabels from "../config/theme-labels.json";
import { MagguruQuestionSourceAdapter, sanitizeQuestionForClient } from "../adapters/question-source";
import { MagguruTransportAdapter } from "../adapters/transport";
import { MagguruCheckpointStoreAdapter } from "../adapters/checkpoint-store";
import { MagguruResultSinkAdapter } from "../adapters/result-sink";
import type {
  QuestionSourceAdapter,
  TransportAdapter,
  CheckpointStoreAdapter,
  ResultSinkAdapter,
  SanitizedQuestion,
  AuthoritativeQuestion,
} from "../adapters/types";

export { isSouqFishingEnabled, sanitizeQuestionForClient };
export type {
  QuestionSourceAdapter,
  TransportAdapter,
  CheckpointStoreAdapter,
  ResultSinkAdapter,
  SanitizedQuestion,
  AuthoritativeQuestion,
};

export const SOUQ_FISHING_ENGINE_ID = "souq_fishing";

/**
 * Returns localized theme metadata for the game mode selector in teacher dashboard.
 */
export function getSouqFishingEngineMetadata(locale: "id" | "ar" | "en" = "id") {
  const dict = themeLabels[locale] || themeLabels.id;
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

/**
 * Game Definition compatible with Magguru's GameRegistry.
 */
export function getSouqFishingGameDefinition() {
  return {
    id: SOUQ_FISHING_ENGINE_ID,
    nameKey: "game_souq_fishing_title",
    descriptionKey: "game_souq_fishing_desc",
    icon: "🎣",
    accentColor: "teal",
    capabilities: {
      supportedModes: ["competitive", "cooperative", "practice", "endless"] as const,
      hasLanes: false,
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
