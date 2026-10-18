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
import {
  isSouqFishingEnabled,
  getSouqFishingGameDefinition,
  SOUQ_FISHING_METADATA,
} from "@/modules/souq-fishing/bridge/magguru-bridge";

const defaultCapabilities = {
  supportedModes: ["competitive", "cooperative", "practice", "endless"] as const,
  hasLanes: false,
  hasTimer: true,
  supportsTouch: true,
  supportsKeyboard: true,
  supportsArabicRTL: true,
  supportsSingleQuestion: true,
};

const DEFINITIONS: Record<NormalizedGameType, GameDefinition> = {
  runner: {
    id: "runner",
    nameKey: "game_runner_title",
    descriptionKey: "game_runner_desc",
    icon: "🏃‍♂️",
    accentColor: "emerald",
    capabilities: { ...defaultCapabilities, supportedModes: ["competitive", "practice"], hasLanes: true },
    defaultDifficulty: "easy",
  },
  matching: {
    id: "matching",
    nameKey: "game_matching_title",
    descriptionKey: "game_matching_desc",
    icon: "🧩",
    accentColor: "indigo",
    capabilities: { ...defaultCapabilities, supportedModes: ["competitive", "practice"] },
    defaultDifficulty: "medium",
  },
  penalty: {
    id: "penalty",
    nameKey: "game_penalty_title",
    descriptionKey: "game_penalty_desc",
    icon: "⚽",
    accentColor: "amber",
    capabilities: { ...defaultCapabilities, supportedModes: ["competitive", "practice"] },
    defaultDifficulty: "easy",
  },
  anagram: {
    id: "anagram",
    nameKey: "game_anagram_title",
    descriptionKey: "game_anagram_desc",
    icon: "🔤",
    accentColor: "violet",
    capabilities: { ...defaultCapabilities, supportedModes: ["competitive", "practice"] },
    defaultDifficulty: "medium",
  },
  quiz: {
    id: "quiz",
    nameKey: "game_quiz_title",
    descriptionKey: "game_quiz_desc",
    icon: "📝",
    accentColor: "sky",
    capabilities: defaultCapabilities,
    defaultDifficulty: "easy",
  },
  kahoot: {
    id: "kahoot",
    nameKey: "Kahoot Arena Showdown",
    descriptionKey: "Kuis Panggung Pilihan Ganda Interaktif",
    icon: "▲",
    accentColor: "rose",
    capabilities: defaultCapabilities,
    defaultDifficulty: "easy",
  },
  millionaire: {
    id: "millionaire",
    nameKey: "Who Wants to Be a Millionaire",
    descriptionKey: "Kuis Tangga Hadiah Studio TV",
    icon: "💰",
    accentColor: "amber",
    capabilities: defaultCapabilities,
    defaultDifficulty: "medium",
  },
  jeopardy: {
    id: "jeopardy",
    nameKey: "Cerdas Cermat Matriks (Jeopardy)",
    descriptionKey: "Papan Matriks Poin Kategori",
    icon: "📋",
    accentColor: "indigo",
    capabilities: defaultCapabilities,
    defaultDifficulty: "medium",
  },
  memory_card: {
    id: "memory_card",
    nameKey: "3D Memory Card Flip",
    descriptionKey: "Mencocokkan Kartu Memori Mufrodat",
    icon: "🃏",
    accentColor: "purple",
    capabilities: defaultCapabilities,
    defaultDifficulty: "medium",
  },
  wordle: {
    id: "wordle",
    nameKey: "Arabic Wordle (Katla)",
    descriptionKey: "Menebak Kata Hijaiyah 5 Huruf",
    icon: "🟩",
    accentColor: "emerald",
    capabilities: defaultCapabilities,
    defaultDifficulty: "medium",
  },
  scramble: {
    id: "scramble",
    nameKey: "Word Scramble",
    descriptionKey: "Susun Huruf Hijaiyah Menjadi Kata",
    icon: "🔤",
    accentColor: "violet",
    capabilities: defaultCapabilities,
    defaultDifficulty: "medium",
  },
  hangman: {
    id: "hangman",
    nameKey: "Manusia Salju Kata (Hangman)",
    descriptionKey: "Tebak Huruf Rahasia",
    icon: "⛄",
    accentColor: "sky",
    capabilities: defaultCapabilities,
    defaultDifficulty: "medium",
  },
  wheel_fortune: {
    id: "wheel_fortune",
    nameKey: "Wheel of Fortune",
    descriptionKey: "Roda Karnaval Keberuntungan Poin",
    icon: "🎡",
    accentColor: "amber",
    capabilities: defaultCapabilities,
    defaultDifficulty: "medium",
  },
  whack_mole: {
    id: "whack_mole",
    nameKey: "Whack-a-Mole Vocab",
    descriptionKey: "Pukul Tikus Kata Target",
    icon: "🔨",
    accentColor: "orange",
    capabilities: defaultCapabilities,
    defaultDifficulty: "easy",
  },
  matching_column: {
    id: "matching_column",
    nameKey: "Drag & Drop Matching Column",
    descriptionKey: "Hubungkan Garis Kolom Kiri & Kanan",
    icon: "↔️",
    accentColor: "cyan",
    capabilities: defaultCapabilities,
    defaultDifficulty: "medium",
  },
};

export class GameRegistry {
  public static readonly SOUQ_FISHING = SOUQ_FISHING_METADATA;
  public static readonly souq_fishing = SOUQ_FISHING_METADATA;

  public static resolve(
    rawType?: string | null,
    rawMode?: string | null,
  ): NormalizedGameType {
    const cleanType = (rawType ?? "").trim().toLowerCase();
    const cleanMode = (rawMode ?? "").trim().toLowerCase();

    if (isSouqFishingEnabled() && (cleanType === "souq_fishing" || cleanType === "souq-fishing")) {
      return "souq_fishing" as NormalizedGameType;
    }

    if (cleanType === "arabic_chase_race") {
      if (cleanMode === "anagram") return "anagram";
      if (cleanMode === "matching") return "matching";
      return "runner";
    }

    if (cleanType === "runner") return "runner";
    if (cleanType === "matching") return "matching";
    if (cleanType === "penalty") return "penalty";
    if (cleanType === "anagram") return "anagram";
    if (cleanType === "quiz") return "quiz";

    if (cleanType === "kahoot") return "kahoot";
    if (cleanType === "millionaire") return "millionaire";
    if (cleanType === "jeopardy") return "jeopardy";
    if (cleanType === "memory_card") return "memory_card";
    if (cleanType === "wordle") return "wordle";
    if (cleanType === "scramble") return "scramble";
    if (cleanType === "hangman") return "hangman";
    if (cleanType === "wheel_fortune") return "wheel_fortune";
    if (cleanType === "whack_mole") return "whack_mole";
    if (cleanType === "matching_column") return "matching_column";

    if (cleanMode === "anagram") return "anagram";
    if (cleanMode === "matching") return "matching";
    if (cleanMode === "speed_run") return "runner";

    return "quiz";
  }

  public static get(type: NormalizedGameType | string): GameDefinition {
    if (isSouqFishingEnabled() && (type === "souq_fishing" || type === "souq-fishing")) {
      return getSouqFishingGameDefinition();
    }
    return DEFINITIONS[type as NormalizedGameType] ?? DEFINITIONS["quiz"];
  }

  public static getAll(): GameDefinition[] {
    const list = Object.values(DEFINITIONS);
    if (isSouqFishingEnabled()) {
      return [...list, getSouqFishingGameDefinition()];
    }
    return list;
  }

  public static isModeSupported(
    type: NormalizedGameType,
    mode: GameMode,
  ): boolean {
    const def = this.get(type);
    return def ? def.capabilities.supportedModes.includes(mode) : false;
  }
}
