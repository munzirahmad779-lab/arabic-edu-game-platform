import {
  DEFAULT_STANDALONE_QUESTIONS,
  type StandaloneQuestion,
} from "./data/default-questions";
import type {
  StandaloneRoomState,
  StandaloneTeamState,
  TeamColor,
  LocationId,
  FishRarity,
} from "./types";

export const LOCATION_COORDINATES: Record<
  LocationId,
  { name: string; x: number; y: number; zone: "PASAR" | "DERMAGA" }
> = {
  START: { name: "Pintu Masuk Pasar", x: 8, y: 50, zone: "PASAR" },
  KIOS: { name: "Gerbang Kios (G1)", x: 26, y: 44, zone: "PASAR" },
  GERBANG_KANTIN: { name: "Gerbang Kantin (G2)", x: 44, y: 50, zone: "PASAR" },
  KANTIN: { name: "Pujasera & Kantin Santri", x: 58, y: 44, zone: "PASAR" },
  DERMAGA_1: { name: "Dermaga Umum (Bale)", x: 75, y: 66, zone: "DERMAGA" },
  DERMAGA_VIP: { name: "Dermaga VIP (Perahu Emas)", x: 88, y: 34, zone: "DERMAGA" },
};

export const TEAM_LANE_OFFSETS: Record<
  TeamColor,
  { xOffset: number; yOffset: number; label: string; colorHex: string; bgClass: string; borderClass: string }
> = {
  MERAH: {
    xOffset: -8,
    yOffset: -36,
    label: "TIM MERAH",
    colorHex: "#EF4444",
    bgClass: "from-rose-600 to-red-700",
    borderClass: "border-rose-400",
  },
  BIRU: {
    xOffset: -8,
    yOffset: 36,
    label: "TIM BIRU",
    colorHex: "#3B82F6",
    bgClass: "from-sky-600 to-blue-700",
    borderClass: "border-sky-400",
  },
  KUNING: {
    xOffset: 12,
    yOffset: -14,
    label: "TIM KUNING",
    colorHex: "#F59E0B",
    bgClass: "from-amber-500 to-yellow-600",
    borderClass: "border-amber-400",
  },
  HIJAU: {
    xOffset: 12,
    yOffset: 14,
    label: "TIM HIJAU",
    colorHex: "#10B981",
    bgClass: "from-emerald-600 to-teal-700",
    borderClass: "border-emerald-400",
  },
};

export const FISH_POOL: Array<{ name: string; rarity: FishRarity; points: number }> = [
  { name: "Kakap Merah", rarity: "COMMON", points: 150 },
  { name: "Kembung Segar", rarity: "COMMON", points: 120 },
  { name: "Tongkol Pesisir", rarity: "COMMON", points: 200 },
  { name: "Baronang Raja", rarity: "RARE", points: 350 },
  { name: "Kerapu Bintang Emas", rarity: "RARE", points: 420 },
  { name: "Bandeng Mangkoso", rarity: "RARE", points: 450 },
  { name: "Tuna Sirip Biru Samudra", rarity: "EPIC", points: 700 },
  { name: "Cumi-Cumi Raksasa Teluk", rarity: "EPIC", points: 800 },
  { name: "Ikan Pari Emas Barru", rarity: "LEGENDARY", points: 1000 },
  { name: "Barramundi Raja Teluk", rarity: "LEGENDARY", points: 1200 },
];

export function getRandomFish(isVip: boolean): { name: string; rarity: FishRarity; points: number } {
  if (isVip) {
    const vipPool = FISH_POOL.filter((f) => f.rarity === "EPIC" || f.rarity === "LEGENDARY" || f.rarity === "RARE");
    const pick = vipPool[Math.floor(Math.random() * vipPool.length)];
    return pick ?? FISH_POOL[0]!;
  }
  const pick = FISH_POOL[Math.floor(Math.random() * FISH_POOL.length)];
  return pick ?? FISH_POOL[0]!;
}

export function createDefaultTeamState(color: TeamColor, customName?: string): StandaloneTeamState {
  const names: Record<TeamColor, string> = {
    MERAH: "Tim Merah (الفريق الأحمر)",
    BIRU: "Tim Biru (الفريق الأزرق)",
    KUNING: "Tim Kuning (الفريق الأصفر)",
    HIJAU: "Tim Hijau (الفريق الأخضر)",
  };

  return {
    color,
    name: customName || names[color],
    points: 0,
    location: "START",
    zone: "PASAR",
    status: "IDLE",
    pinsUnlocked: 0,
    pinsRequired: 4,
    fishCatches: [],
  };
}

export function createDefaultRoomState(
  roomCode: string,
  mode: "proyektor_4team" | "proyektor_individu" | "siswa_mandiri" = "proyektor_4team",
  customQuestions?: StandaloneQuestion[]
): StandaloneRoomState {
  const questions =
    customQuestions && customQuestions.length > 0
      ? customQuestions
      : DEFAULT_STANDALONE_QUESTIONS;

  return {
    roomCode: roomCode.toUpperCase(),
    mode,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    questions,
    currentQIndex: 0,
    teams: {
      MERAH: createDefaultTeamState("MERAH"),
      BIRU: createDefaultTeamState("BIRU"),
      KUNING: createDefaultTeamState("KUNING"),
      HIJAU: createDefaultTeamState("HIJAU"),
    },
    students: [],
  };
}

/**
 * Calculates dynamic Active Tilt widths (%) for each of the 4 teams.
 * Rules:
 * N = 0 (all idle/traveling) -> 25 / 25 / 25 / 25
 * N = 1 (1 answering)        -> 55% for active team, 15% for others
 * N = 2 (2 answering)        -> 35% each for active, 15% for others
 * N = 3 (3 answering)        -> 28% each for active, 16% for other
 * N = 4 (all answering)      -> 25 / 25 / 25 / 25
 */
export function calculateActiveTiltWidths(
  teams: Record<TeamColor, StandaloneTeamState>
): Record<TeamColor, number> {
  const teamColors: TeamColor[] = ["MERAH", "BIRU", "KUNING", "HIJAU"];
  const activeTeams = teamColors.filter((c) => {
    const st = teams[c]?.status;
    return st === "IN_GATE_QUESTION" || st === "IN_FISHING_QUESTION";
  });

  const n = activeTeams.length;
  const result: Record<TeamColor, number> = {
    MERAH: 25,
    BIRU: 25,
    KUNING: 25,
    HIJAU: 25,
  };

  if (n === 0 || n === 4) {
    return result;
  }

  if (n === 1) {
    teamColors.forEach((c) => {
      result[c] = activeTeams.includes(c) ? 55 : 15;
    });
    return result;
  }

  if (n === 2) {
    teamColors.forEach((c) => {
      result[c] = activeTeams.includes(c) ? 35 : 15;
    });
    return result;
  }

  if (n === 3) {
    teamColors.forEach((c) => {
      result[c] = activeTeams.includes(c) ? 28 : 16;
    });
    return result;
  }

  return result;
}
