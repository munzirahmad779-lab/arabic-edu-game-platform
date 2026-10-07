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
   * Adapts raw question into a set of matching pairs.
   */
  public static toMatching(raw: RawQuestion): MatchingPlayableQuestion {
    const cards: MatchingCard[] = [];

    // Each option forms a target; the question or option key pairs with them
    raw.options.forEach((opt, idx) => {
      const pairId = `pair_${raw.id}_${idx}`;

      cards.push({
        id: `prompt_${opt.id}`,
        pairId,
        text: opt.option_key,
        role: "prompt",
      });

      cards.push({
        id: `target_${opt.id}`,
        pairId,
        text: opt.option_text,
        role: "target",
      });
    });

    // Shuffle cards so prompts and targets are interleaved
    const shuffled = [...cards].sort(() => Math.random() - 0.5);

    return {
      id: raw.id,
      title: raw.question_text,
      cards: shuffled,
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
