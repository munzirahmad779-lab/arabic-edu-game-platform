/**
 * Core Game Engine Type Definitions for Magguru Game Platform.
 * Strict, discriminated contracts separating:
 * QUESTION (educational content) ≠ GAME TYPE (mechanics) ≠ GAME MODE (session rules).
 */

export type GameType =
  | "quiz"
  | "anagram"
  | "runner"
  | "matching"
  | "penalty"
  | "arabic_chase_race";

export type NormalizedGameType = "quiz" | "anagram" | "runner" | "matching" | "penalty";

export type GameMode =
  | "competitive"
  | "cooperative"
  | "endless"
  | "practice"
  | "learning";

export type QuestionDifficulty = "easy" | "medium" | "hard";

export type EngineGameState =
  | "initializing"
  | "ready"
  | "countdown"
  | "playing"
  | "answering"
  | "feedback"
  | "transitioning"
  | "completed"
  | "error";

export interface GameCapabilities {
  readonly supportedModes: readonly GameMode[];
  readonly hasLanes: boolean;
  readonly hasTimer: boolean;
  readonly supportsTouch: boolean;
  readonly supportsKeyboard: boolean;
  readonly supportsArabicRTL: boolean;
  readonly supportsSingleQuestion: boolean;
}

export interface GameDefinition {
  readonly id: NormalizedGameType;
  readonly nameKey: string;
  readonly descriptionKey: string;
  readonly icon: string;
  readonly accentColor: string;
  readonly capabilities: GameCapabilities;
  readonly defaultDifficulty: QuestionDifficulty;
}

export interface RawOption {
  readonly id: string;
  readonly option_key: string;
  readonly option_text: string;
}

export interface RawMedia {
  readonly id: string;
  readonly media_type: "image" | "audio" | "video" | string;
  readonly public_url: string;
  readonly mime_type?: string;
  readonly max_play_count?: number | null;
}

export interface RawQuestion {
  readonly id: string;
  readonly position?: number;
  readonly question_text: string;
  readonly difficulty: string;
  readonly explanation_timing?: string;
  readonly time_limit_seconds?: number;
  readonly options: RawOption[];
  readonly media?: RawMedia[];
  readonly correct_option_key?: string;
}

export interface AnswerSubmission {
  readonly questionId: string;
  readonly selectedOptionId: string | null;
  readonly answerText: string | null;
  readonly responseTimeMs: number;
}

export interface AnswerResult {
  readonly accepted: boolean;
  readonly isCorrect: boolean;
  readonly scoreAwarded?: number;
}

export type ConsequenceType =
  | "boost"
  | "stumble"
  | "goal"
  | "saved"
  | "match"
  | "mismatch"
  | "neutral";

export interface ScoreEvent {
  readonly isCorrect: boolean;
  readonly scoreAwarded: number;
  readonly comboMultiplier: number;
  readonly streak: number;
  readonly consequence: ConsequenceType;
  readonly message?: string;
}

export interface GameSessionContext {
  readonly roomId: string;
  readonly roomCode: string;
  readonly gameName: string;
  readonly gameType: NormalizedGameType;
  readonly gameMode: GameMode;
  readonly durationSeconds: number;
  readonly participantId: string;
  readonly participantName: string;
  readonly questionIndex: number;
  readonly questionCount: number;
  readonly isRtl: boolean;
}

export interface GamePlayerProps<TQuestion = RawQuestion> {
  readonly question: TQuestion;
  readonly session: GameSessionContext;
  readonly onSubmitAnswer: (submission: AnswerSubmission) => Promise<AnswerResult>;
  readonly isRtl: boolean;
  readonly dict: Record<string, unknown>;
  readonly singleQuestionMode?: boolean;
  readonly questionNumber?: number;
  readonly totalQuestions?: number;
  readonly timeLimitSeconds?: number | null;
  readonly onGameEvent?: (event: ScoreEvent) => void;
  readonly onFinish?: () => void;
}
