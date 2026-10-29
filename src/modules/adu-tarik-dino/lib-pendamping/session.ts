/**
 * Player session persistence — localStorage key `magguru_game_session`.
 * Client-only by design: every access is guarded and fail-safe.
 */

export type AvatarId = "dino" | "tarsius" | "kuskus" | "elang" | "astronot";
export type PlayerMode = "siswa" | "tamu" | "guru";

export interface AvatarDef {
  readonly id: AvatarId;
  readonly name: string;
  readonly emoji: string;
  readonly gradient: string;
  readonly ring: string;
}

export const AVATARS: readonly AvatarDef[] = [
  { id: "dino", name: "Dino T-Rex", emoji: "🦖", gradient: "from-emerald-400 to-teal-600", ring: "#34D399" },
  { id: "tarsius", name: "Tarsius Rimba", emoji: "🐒", gradient: "from-amber-400 to-orange-600", ring: "#FBBF24" },
  { id: "kuskus", name: "Kuskus Ceria", emoji: "🐿️", gradient: "from-sky-400 to-indigo-600", ring: "#38BDF8" },
  { id: "elang", name: "Elang Angkasa", emoji: "🦅", gradient: "from-slate-300 to-slate-600", ring: "#94A3B8" },
  { id: "astronot", name: "Astronot Cyber", emoji: "👨‍🚀", gradient: "from-fuchsia-400 to-purple-700", ring: "#A855F7" },
];

export function avatarById(id: string): AvatarDef {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0];
}

export interface GameStat {
  highScore: number;
  bestStreak: number;
  stars: number;
  plays: number;
}

export interface PlayerProfile {
  mode: PlayerMode;
  nickname: string;
  avatar: AvatarId;
  pin?: string;
  email?: string;
  loggedInAt: string;
}

export interface GameSession {
  profile: PlayerProfile | null;
  coins: number;
  stats: Record<string, GameStat>;
}

const SESSION_KEY = "magguru_game_session";

export function emptySession(): GameSession {
  return { profile: null, coins: 0, stats: {} };
}

export function loadSession(): GameSession {
  if (typeof window === "undefined") return emptySession();
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return emptySession();
    const parsed = JSON.parse(raw) as Partial<GameSession>;
    return {
      profile: parsed.profile ?? null,
      coins: typeof parsed.coins === "number" ? parsed.coins : 0,
      stats: parsed.stats && typeof parsed.stats === "object" ? parsed.stats : {},
    };
  } catch {
    return emptySession();
  }
}

export function saveSession(session: GameSession): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Storage full or blocked — gameplay must keep running regardless.
  }
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

export function setProfile(profile: PlayerProfile): GameSession {
  const session = loadSession();
  session.profile = profile;
  saveSession(session);
  return session;
}

export interface ResultInput {
  slug: string;
  score: number;
  streak: number;
  stars: number;
  coinsEarned: number;
}

/** Record a finished run: high scores, best streak, star rating, coins. */
export function recordGameResult(input: ResultInput): GameSession {
  const session = loadSession();
  const prev: GameStat = session.stats[input.slug] ?? { highScore: 0, bestStreak: 0, stars: 0, plays: 0 };
  session.stats[input.slug] = {
    highScore: Math.max(prev.highScore, input.score),
    bestStreak: Math.max(prev.bestStreak, input.streak),
    stars: Math.max(prev.stars, input.stars),
    plays: prev.plays + 1,
  };
  session.coins = Math.max(0, session.coins + Math.max(0, input.coinsEarned));
  saveSession(session);
  return session;
}

export function gameStat(slug: string): GameStat | null {
  const session = loadSession();
  return session.stats[slug] ?? null;
}

/** Star rating standard: accuracy >= 90% → 3, >= 65% → 2, else 1. */
export function starsForAccuracy(accuracy: number): number {
  if (accuracy >= 0.9) return 3;
  if (accuracy >= 0.65) return 2;
  return 1;
}
