/**
 * Question Adapters for Magguru Game Platform.
 * Transforms raw database/snapshot question structures into game-specific playable models.
 * Preserves the single educational source of truth without altering DB schemas.
 */

import { splitIntoGraphemes } from "./arabic-utils";
import type { RawQuestion } from "./types";

export interface RunnerLane {
  readonly laneIndex: number;
  readonly optionId: string;
  readonly optionKey: string;
  readonly text: string;
}

export interface RunnerPlayableQuestion {
  readonly id: string;
  readonly questionText: string;
  readonly difficulty: string;
  readonly lanes: readonly RunnerLane[];
  readonly timeLimitSeconds: number;
}

export interface MatchingCard {
  readonly id: string;
  readonly pairId: string;
  readonly text: string;
  readonly role: "prompt" | "target";
}

export interface MatchingPlayableQuestion {
  readonly id: string;
  readonly title: string;
  readonly cards: readonly MatchingCard[];
  readonly targetPairsCount: number;
  readonly correctOptionId: string;
  readonly timeLimitSeconds: number;
}

export type PenaltyZone =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "center";

export interface PenaltyTarget {
  readonly optionId: string;
  readonly optionKey: string;
  readonly text: string;
  readonly zone: PenaltyZone;
}

export interface PenaltyPlayableQuestion {
  readonly id: string;
  readonly questionText: string;
  readonly targets: readonly PenaltyTarget[];
  readonly difficulty: string;
  readonly timeLimitSeconds: number;
}

export interface AnagramTile {
  readonly id: string;
  readonly unit: string;
}

export interface AnagramPlayableQuestion {
  readonly id: string;
  readonly promptText: string;
  readonly correctAnswer: string;
  readonly tiles: readonly AnagramTile[];
  readonly timeLimitSeconds: number;
}

const PENALTY_ZONES: readonly PenaltyZone[] = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
  "center",
];

export class QuestionAdapter {
  /**
   * Adapts raw question into Runner track with 2 to 4 lanes.
   */
  public static toRunner(raw: RawQuestion): RunnerPlayableQuestion {
    const lanes: RunnerLane[] = raw.options.map((opt, idx) => ({
      laneIndex: idx,
      optionId: opt.id,
      optionKey: opt.option_key,
      text: opt.option_text,
    }));

    return {
      id: raw.id,
      questionText: raw.question_text,
      difficulty: raw.difficulty || "easy",
      lanes,
      timeLimitSeconds: raw.time_limit_seconds ?? 20,
    };
  }

  /**
   * Adapts raw question into a pedagogically valid set of matching cards.
   * Prioritizes semantic delimiter pairs (e.g. "كتاب : Buku").
   * Falls back to prompt target word matched against options with active decoys.
   */
  public static toMatching(raw: RawQuestion): MatchingPlayableQuestion {
    const cards: MatchingCard[] = [];
    const correctOpt =
      raw.options.find((o) => o.option_key === raw.correct_option_key) ??
      raw.options[0];
    const correctOptionId = correctOpt?.id ?? raw.options[0]?.id ?? "";

    const delimiterRegex = /\s*[:=—]\s*|\s+-\s+/;
    const delimitedOptions = raw.options.filter((opt) =>
      delimiterRegex.test(opt.option_text),
    );

    let targetPairsCount = 1;

    if (delimitedOptions.length >= 2) {
      // Strategy 1: Multi-pair vocabulary matching (authentic word ↔ meaning)
      delimitedOptions.forEach((opt) => {
        const parts = opt.option_text.split(delimiterRegex);
        const left = parts[0]?.trim() || opt.option_text;
        const right = parts.slice(1).join(" : ").trim() || opt.option_text;
        const pairId = `pair_${opt.id}`;

        cards.push({
          id: `prompt_${opt.id}`,
          pairId,
          text: left,
          role: "prompt",
        });

        cards.push({
          id: `target_${opt.id}`,
          pairId,
          text: right,
          role: "target",
        });
      });
      targetPairsCount = delimitedOptions.length;
    } else {
      // Strategy 2: Standard MCQ Target Word Match with Decoys
      // Extract target term from quotes/brackets or Arabic word in question text
      const quoteMatch = raw.question_text.match(
        /\(([^)]+)\)|"([^"]+)"|'([^']+)'|«([^»]+)»/,
      );
      const arabicMatch = raw.question_text.match(
        /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]+(?:\s+[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]+)*/,
      );

      const promptText = (
        quoteMatch?.[1] ||
        quoteMatch?.[2] ||
        quoteMatch?.[3] ||
        quoteMatch?.[4] ||
        arabicMatch?.[0] ||
        raw.question_text
      ).trim();

      const pairId = `pair_${correctOptionId}`;

      cards.push({
        id: `prompt_${raw.id}`,
        pairId,
        text: promptText,
        role: "prompt",
      });

      raw.options.forEach((opt) => {
        const isCorrect = opt.id === correctOptionId;
        cards.push({
          id: `target_${opt.id}`,
          pairId: isCorrect ? pairId : `decoy_${opt.id}`,
          text: opt.option_text,
          role: "target",
        });
      });

      targetPairsCount = 1;
    }

    // Interleave cards deterministically based on ID to avoid hydration mismatch
    const shuffled = [...cards].sort((a, b) =>
      a.id.localeCompare(b.id),
    );

    return {
      id: raw.id,
      title: raw.question_text,
      cards: shuffled,
      targetPairsCount,
      correctOptionId,
      timeLimitSeconds: raw.time_limit_seconds ?? 30,
    };
  }

  /**
   * Adapts raw question into penalty shootout targets.
   */
  public static toPenalty(raw: RawQuestion): PenaltyPlayableQuestion {
    const targets: PenaltyTarget[] = raw.options.map((opt, idx) => ({
      optionId: opt.id,
      optionKey: opt.option_key,
      text: opt.option_text,
      zone: PENALTY_ZONES[idx % PENALTY_ZONES.length],
    }));

    return {
      id: raw.id,
      questionText: raw.question_text,
      targets,
      difficulty: raw.difficulty || "easy",
      timeLimitSeconds: raw.time_limit_seconds ?? 20,
    };
  }

  /**
   * Adapts raw question into Anagram letter tiles with Arabic grapheme safety.
   */
  public static toAnagram(raw: RawQuestion): AnagramPlayableQuestion {
    const correctOption =
      raw.options.find((o) => o.option_key === raw.correct_option_key) ??
      raw.options[0];
    const answer = correctOption?.option_text ?? "";
    const units = splitIntoGraphemes(answer);

    const tiles: AnagramTile[] = units
      .map((unit, idx) => ({
        id: `tile_${idx}_${unit}`,
        unit,
      }))
      .sort(() => Math.random() - 0.5);

    return {
      id: raw.id,
      promptText: raw.question_text,
      correctAnswer: answer,
      tiles,
      timeLimitSeconds: raw.time_limit_seconds ?? 40,
    };
  }
}
