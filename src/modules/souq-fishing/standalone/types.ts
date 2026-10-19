import type { StandaloneQuestion } from "./data/default-questions";
export type { StandaloneQuestion };

export type TeamColor = "MERAH" | "BIRU" | "KUNING" | "HIJAU";

export type LocationId =
  | "START"
  | "KIOS"
  | "GERBANG_KANTIN"
  | "KANTIN"
  | "DERMAGA_1"
  | "DERMAGA_VIP";

export type ZoneId = "PASAR" | "DERMAGA";

export type TeamStatus =
  | "IDLE"
  | "TRAVELING"
  | "IN_GATE_QUESTION"
  | "IN_FISHING_QUESTION"
  | "RESTING";

export type FishRarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY";

export type CharacterChoice =
  | "putri_hijab"
  | "putri_non_hijab"
  | "putra_peci"
  | "putra_non_peci";

export interface FishCatch {
  id: string;
  name: string;
  rarity: FishRarity;
  points: number;
  caughtAt: number;
}

export interface ActiveStudent {
  id: string;
  name: string;
  team: TeamColor;
  character: CharacterChoice;
  currentQIndex: number;
  totalQAnswered: number;
  correctCount: number;
  currentZone: string;
  fishBadges: FishRarity[];
  lastActive: number;
}

export interface StandaloneTeamState {
  color: TeamColor;
  name: string;
  points: number;
  location: LocationId;
  targetLocation?: LocationId;
  travelStartMs?: number;
  travelDurationMs?: number;
  zone: ZoneId;
  status: TeamStatus;
  pinsUnlocked: number;
  pinsRequired: number;
  currentQuestion?: StandaloneQuestion;
  currentFishCatch?: {
    name: string;
    rarity: FishRarity;
    points: number;
  };
  fishCatches: FishCatch[];
}

export interface StandaloneRoomState {
  roomCode: string;
  mode: "proyektor_4team" | "proyektor_individu" | "siswa_mandiri";
  createdAt: number;
  updatedAt: number;
  questions: StandaloneQuestion[];
  currentQIndex: number;
  teams: Record<TeamColor, StandaloneTeamState>;
  students: ActiveStudent[];
}
