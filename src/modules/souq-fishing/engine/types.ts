/**
 * Pure Engine Types for Souq & Fishing Game Module.
 * Deterministic state machine contracts — zero DOM, zero network.
 * Strictly typed: zero `any` or `@ts-ignore`.
 */

export type ZoneId = "PASAR" | "DERMAGA";

export type LocationId =
  | "ALUN"
  | "KIOS"
  | "GERBANG_KANTIN"
  | "KANTIN"
  | "DERMAGA_1"
  | "DERMAGA_VIP";

export type TeamColor = "MERAH" | "BIRU" | "KUNING" | "HIJAU";

export type TeamStatus =
  | "TRAVELING"
  | "IDLE_AT_GATE"
  | "IN_GATE_QUESTION"
  | "FISHING_WAITING"
  | "IN_FISHING_QUESTION"
  | "ASSISTED_WAITING"
  | "QUEUED_QUESTION";

export type GateId = "KIOS" | "GERBANG_KANTIN";

export type FishTier = "COMMON" | "RARE" | "EPIC" | "LEGENDARY";

export interface ActiveBuffs {
  canteenBuffUntilMs: number;
}

export interface GateQuestionState {
  gateId: GateId;
  questionId: string;
}

export interface FishingQuestionState {
  tier: FishTier;
  targetPoints: number;
  timerUntilMs: number | null;
}

export interface ChainProgress {
  targetLength: number;
  correctCount: number;
  totalPoints: number;
}

export interface TeamState {
  id: string;
  color: TeamColor;
  characterId: string;
  zone: ZoneId;
  location: LocationId;
  status: TeamStatus;
  pinsUnlocked: number;
  gateAttempts: number;
  consecutiveWrong: number;
  restUntilMs: number;
  restCount: number;
  assisted: boolean;
  buffsActive: ActiveBuffs;
  currentQuestion?: GateQuestionState | FishingQuestionState;
  chainProgress?: ChainProgress;
  points: number;
}

export interface WorldState {
  teams: Record<TeamColor, TeamState>;
  tick: number;
}

export type GateUnlockEvent =
  | "PIN_UNLOCKED"
  | "GATE_CLEARED"
  | "ASSISTED_CLEARED"
  | "HIDE_WRONG_OPTION"
  | "REST_15S"
  | "WRONG_ANSWER";

export interface GateUnlockResult {
  world: WorldState;
  pointsAwarded: number;
  event: GateUnlockEvent;
}

export type FishingEvent =
  | "CHAIN_STEP_PASSED"
  | "FISH_CAUGHT"
  | "CHAIN_FAILED"
  | "WRONG_ANSWER";

export interface FishingAnswerResult {
  world: WorldState;
  pointsAwarded: number;
  event: FishingEvent;
}
