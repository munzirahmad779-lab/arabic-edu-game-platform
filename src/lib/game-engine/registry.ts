/**
 * Singleton Game Registry for Magguru Game Platform.
 * Provides unified registration, lookup, and normalization for all educational game types.
 * Strictly typed — zero `as any` or `@ts-ignore`.
 */

import type {
  GameDefinition,
  GameMode,
  NormalizedGameType,
} from "./types";

const DEFINITIONS: Record<NormalizedGameType, GameDefinition> = {
  runner: {
    id: "runner",
    nameKey: "game_runner_title",
    descriptionKey: "game_runner_desc",
    icon: "🏃‍♂️",
    accentColor: "emerald",
    capabilities: {
      supportedModes: ["competitive", "practice"],
      hasLanes: true,
      hasTimer: true,
      supportsTouch: true,
      supportsKeyboard: true,
      supportsArabicRTL: true,
      supportsSingleQuestion: true,
    },
    defaultDifficulty: "easy",
  },
  matching: {
    id: "matching",
    nameKey: "game_matching_title",
    descriptionKey: "game_matching_desc",
    icon: "🧩",
    accentColor: "indigo",
    capabilities: {
      supportedModes: ["competitive", "practice"],
      hasLanes: false,
      hasTimer: true,
      supportsTouch: true,
      supportsKeyboard: true,
      supportsArabicRTL: true,
      supportsSingleQuestion: true,
    },
    defaultDifficulty: "medium",
  },
  penalty: {
    id: "penalty",
    nameKey: "game_penalty_title",
    descriptionKey: "game_penalty_desc",
    icon: "⚽",
    accentColor: "amber",
    capabilities: {
      supportedModes: ["competitive", "practice"],
      hasLanes: false,
      hasTimer: true,
      supportsTouch: true,
      supportsKeyboard: true,
      supportsArabicRTL: true,
      supportsSingleQuestion: true,
    },
    defaultDifficulty: "easy",
  },
  anagram: {
    id: "anagram",
    nameKey: "game_anagram_title",
    descriptionKey: "game_anagram_desc",
    icon: "🔤",
    accentColor: "violet",
    capabilities: {
      supportedModes: ["competitive", "practice"],
      hasLanes: false,
      hasTimer: true,
      supportsTouch: true,
      supportsKeyboard: true,
      supportsArabicRTL: true,
      supportsSingleQuestion: true,
    },
    defaultDifficulty: "medium",
  },
  quiz: {
    id: "quiz",
    nameKey: "game_quiz_title",
    descriptionKey: "game_quiz_desc",
    icon: "📝",
    accentColor: "sky",
    capabilities: {
      supportedModes: ["competitive", "cooperative", "practice", "endless"],
      hasLanes: false,
      hasTimer: true,
      supportsTouch: true,
      supportsKeyboard: true,
      supportsArabicRTL: true,
      supportsSingleQuestion: true,
    },
    defaultDifficulty: "easy",
  },
};

export class GameRegistry {
  /**
   * Resolves raw game_type or legacy game_mode string into a standard NormalizedGameType.
   */
  public static resolve(
    rawType?: string | null,
    rawMode?: string | null,
  ): NormalizedGameType {
    const cleanType = (rawType ?? "").trim().toLowerCase();
    const cleanMode = (rawMode ?? "").trim().toLowerCase();

    // Legacy compatibility: In historical schema (0001 to 0060),
    // public.games.game_type was constrained exclusively to 'arabic_chase_race'.
    // Historical games designated their true mechanic in `mode`.
    if (cleanType === "arabic_chase_race") {
      if (cleanMode === "anagram") return "anagram";
      if (cleanMode === "matching") return "matching";
      return "runner";
    }

    // Canonical modern game types
    if (cleanType === "runner") return "runner";
    if (cleanType === "matching") return "matching";
    if (cleanType === "penalty") return "penalty";
    if (cleanType === "anagram") return "anagram";
    if (cleanType === "quiz") return "quiz";

    // Fallback when game_type is null or empty, inspecting mode
    if (cleanMode === "anagram") return "anagram";
    if (cleanMode === "matching") return "matching";
    if (cleanMode === "speed_run") return "runner";

    return "quiz";
  }

  /**
   * Retrieves the definition for a normalized game type.
   */
  public static get(type: NormalizedGameType): GameDefinition {
    return DEFINITIONS[type];
  }

  /**
   * Returns all registered game definitions.
   */
  public static getAll(): readonly GameDefinition[] {
    return Object.values(DEFINITIONS);
  }

  /**
   * Checks whether a specific game mode is supported by the given game type.
   */
  public static isModeSupported(type: NormalizedGameType, mode: GameMode): boolean {
    const def = DEFINITIONS[type];
    return def.capabilities.supportedModes.includes(mode);
  }
}
