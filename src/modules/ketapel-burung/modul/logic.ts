/**
 * Ketapel Burung — logika murni (tanpa React, tanpa canvas).
 *
 * Burung-burung kartun terbang LAMBAT melintasi lajur sambil membawa
 * papan jawaban yang tergantung di bawahnya. Tiap soal diterbangkan
 * 4 burung: satu membawa jawaban benar, tiga membawa pengecoh. Siswa
 * menembak dengan ketapel: burung benar +10; burung salah membuat
 * soal berganti tanpa poin; batu meleset boleh ditembak lagi.
 *
 * Bank soal memakai sistem yang sama dengan Banua Fruit Blast;
 * simpanan memakai kunci localStorage sendiri.
 */

import {
  DEFAULT_BANK,
  parseBank,
  type Bank,
  type ContentSubjectId,
  type Q,
} from "@/modules/banua-fruit-blast/modul/logic";

export type { Bank, ContentSubjectId, Q };
export {
  SUBJECTS,
  parseCsvBank,
  parseMarkdownBank,
  promptTemplateSoal,
  templateMarkdown,
} from "@/modules/banua-fruit-blast/modul/logic";

export type GameMode = "SOLO" | "DUEL" | "TRIO" | "QUAD";
export type Screen = "home" | "countdown" | "playing" | "result" | "score" | "bank";
export type SpriteId = "anoa" | "tarsius" | "maleo" | "kuskus";
export type SubjectChoice = ContentSubjectId | "guru";

export interface PlayerDef {
  slot: number;
  name: string;
  sprite: SpriteId;
  color: string;
  soft: string;
}

export interface Settings {
  mode: GameMode;
  subject: SubjectChoice;
  sound: boolean;
}

export interface ScoreRec {
  at: string;
  mode: GameMode;
  subject: string;
  results: { name: string; score: number }[];
  winner: string;
}

export interface GuruBank {
  name: string;
  questions: Q[];
}

/** Satu keranjang jawaban di sebuah lajur. */
export interface BirdTarget {
  /** Indeks 0..3 di lajur. */
  idx: number;
  /** Teks jawaban yang dibawa keranjang ini. */
  text: string;
  correct: boolean;
}

/** Keadaan satu lajur selama pertandingan. */
export interface LaneState {
  def: PlayerDef;
  score: number;
  streak: number;
  /** Soal yang sedang aktif di lajur ini. */
  q: Q | null;
  /** Empat burung pembawa jawaban untuk soal aktif. */
  birds: BirdTarget[];
  /** Fase lajur: siap menarik, batu terbang, atau jeda sesudah kena. */
  phase: "aim" | "fly" | "cheer" | "sad";
  phaseUntil: number;
}

export const RULES = {
  durationSec: 180,
  pointsCorrect: 10,
  targetCount: 4,
  /** Fisika batu ketapel (piksel, detik). */
  gravity: 900,
  launchK: 6.5,
  maxDrag: 200,
  stoneR: 13,
  /** Jeda tampilan sesudah batu masuk keranjang (ms). */
  cheerMs: 900,
  sadMs: 900,
} as const;

export const MODES: { id: GameMode; title: string; sub: string; players: number }[] = [
  { id: "SOLO", title: "Solo", sub: "Latihan sendiri", players: 1 },
  { id: "DUEL", title: "Duel", sub: "2 pemain, 1 layar", players: 2 },
  { id: "TRIO", title: "Trio", sub: "3 pemain, 1 layar", players: 3 },
  { id: "QUAD", title: "Quad", sub: "4 pemain, 1 layar", players: 4 },
];

const ALL_SLOTS: PlayerDef[] = [
  { slot: 0, name: "Anoa", sprite: "anoa", color: "#EA580C", soft: "#FFEDD5" },
  { slot: 1, name: "Tarsius", sprite: "tarsius", color: "#0D9488", soft: "#CCFBF1" },
  { slot: 2, name: "Maleo", sprite: "maleo", color: "#7C3AED", soft: "#EDE9FE" },
  { slot: 3, name: "Kuskus", sprite: "kuskus", color: "#DB2777", soft: "#FCE7F3" },
];

export const playersFor = (mode: GameMode): PlayerDef[] => {
  const n = MODES.find((m) => m.id === mode)?.players ?? 1;
  return ALL_SLOTS.slice(0, n);
};

export const emptyLane = (def: PlayerDef): LaneState => ({
  def,
  score: 0,
  streak: 0,
  q: null,
  birds: [],
  phase: "aim",
  phaseUntil: 0,
});

/** Empat burung untuk satu soal: jawaban benar + 3 pengecoh, teracak. */
export function targetsFor(q: Q, rnd: () => number): BirdTarget[] {
  const wrongs = q.options.filter((o) => o !== q.correct);
  const picks: string[] = [q.correct];
  const pool = [...wrongs];
  while (picks.length < RULES.targetCount && pool.length > 0) {
    const i = Math.floor(rnd() * pool.length);
    picks.push(pool.splice(i, 1)[0]);
  }
  // Soal kustom dengan pilihan kurang dari 4: gandakan label SALAH yang ada
  // (tidak pernah menggandakan jawaban benar).
  while (picks.length < RULES.targetCount && wrongs.length > 0) {
    picks.push(wrongs[(picks.length - 1) % wrongs.length]);
  }
  while (picks.length < RULES.targetCount) picks.push(q.correct);
  const shuffled = shuffleArr(picks, rnd);
  return shuffled.map((text, idx) => ({ idx, text, correct: text === q.correct }));
}

export function shuffleArr<T>(arr: readonly T[], rnd: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Dek soal satu lajur: diacak, berputar terus tanpa mengulang berurutan. */
export class Deck {
  private order: Q[] = [];
  private pos = 0;
  constructor(private readonly list: readonly Q[], private readonly rnd: () => number) {
    this.reshuffle(null);
  }
  private reshuffle(avoidFirst: Q | null): void {
    this.order = shuffleArr(this.list, this.rnd);
    if (avoidFirst && this.order.length > 1 && this.order[0].id === avoidFirst.id) {
      [this.order[0], this.order[1]] = [this.order[1], this.order[0]];
    }
    this.pos = 0;
  }
  next(): Q | null {
    if (this.order.length === 0) return null;
    if (this.pos >= this.order.length) this.reshuffle(this.order[this.order.length - 1]);
    return this.order[this.pos++];
  }
}

/* ------------------------------------------------------------ simpanan */

export const STORE_BANK = "ketapel-burung:bank:v1";
export const STORE_GURU = "ketapel-burung:guru:v1";
export const STORE_SCORES = "ketapel-burung:scores:v1";
export const STORE_SETTINGS = "ketapel-burung:settings:v1";

const cloneBank = (b: Bank): Bank => JSON.parse(JSON.stringify(b)) as Bank;

export function loadBank(): Bank {
  if (typeof window === "undefined") return cloneBank(DEFAULT_BANK);
  try {
    const raw = window.localStorage.getItem(STORE_BANK);
    if (!raw) return cloneBank(DEFAULT_BANK);
    return parseBank(raw) ?? cloneBank(DEFAULT_BANK);
  } catch {
    return cloneBank(DEFAULT_BANK);
  }
}

export function saveBank(bank: Bank): void {
  try {
    window.localStorage.setItem(STORE_BANK, JSON.stringify(bank));
  } catch {
    /* abaikan */
  }
}

export function resetBank(): Bank {
  const fresh = cloneBank(DEFAULT_BANK);
  saveBank(fresh);
  return fresh;
}

const isQ = (v: unknown): v is Q => {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.prompt === "string" &&
    Array.isArray(o.options) &&
    o.options.every((x) => typeof x === "string") &&
    typeof o.correct === "string"
  );
};

const normalizeQ = (raw: Q, subjectId: SubjectChoice): Q => ({
  id: typeof raw.id === "string" && raw.id ? raw.id : `q-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
  subjectId: subjectId === "guru" ? "arab" : subjectId,
  prompt: raw.prompt,
  isArabic: raw.isArabic === true,
  options: raw.options.slice(0, 6),
  correct: raw.correct,
  ...(raw.custom ? { custom: true } : {}),
});

export function loadGuru(): GuruBank {
  const fallback: GuruBank = { name: "", questions: [] };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(STORE_GURU);
    if (!raw) return fallback;
    const p = JSON.parse(raw) as Partial<GuruBank>;
    const questions = Array.isArray(p.questions) ? p.questions.filter(isQ).map((q) => normalizeQ(q, "guru")) : [];
    return { name: typeof p.name === "string" ? p.name : "", questions };
  } catch {
    return fallback;
  }
}

export function saveGuru(g: GuruBank): void {
  try {
    window.localStorage.setItem(STORE_GURU, JSON.stringify(g));
  } catch {
    /* abaikan */
  }
}

export function loadSettings(): Settings {
  const fallback: Settings = { mode: "DUEL", subject: "arab", sound: true };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(STORE_SETTINGS);
    if (!raw) return fallback;
    const p = JSON.parse(raw) as Partial<Settings>;
    return {
      mode: p.mode === "SOLO" || p.mode === "DUEL" || p.mode === "TRIO" || p.mode === "QUAD" ? p.mode : fallback.mode,
      subject:
        p.subject === "guru" || p.subject === "arab" || p.subject === "inggris" || p.subject === "matematika" || p.subject === "biologi" || p.subject === "fisika"
          ? p.subject
          : fallback.subject,
      sound: typeof p.sound === "boolean" ? p.sound : fallback.sound,
    };
  } catch {
    return fallback;
  }
}

export function saveSettings(s: Settings): void {
  try {
    window.localStorage.setItem(STORE_SETTINGS, JSON.stringify(s));
  } catch {
    /* abaikan */
  }
}

export function loadScores(): ScoreRec[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORE_SCORES);
    if (!raw) return [];
    const p = JSON.parse(raw) as unknown;
    return Array.isArray(p) ? (p as ScoreRec[]) : [];
  } catch {
    return [];
  }
}

export function saveScore(rec: ScoreRec): ScoreRec[] {
  const rows = [rec, ...loadScores()].slice(0, 50);
  try {
    window.localStorage.setItem(STORE_SCORES, JSON.stringify(rows));
  } catch {
    /* abaikan */
  }
  return rows;
}

export function clearScores(): void {
  try {
    window.localStorage.removeItem(STORE_SCORES);
  } catch {
    /* abaikan */
  }
}

export function scoresCsv(rows: ScoreRec[]): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = ["Waktu,Mode,Mapel,Pemenang,Skor"];
  for (const r of rows) {
    const skor = r.results.map((x) => `${x.name} ${x.score}`).join(" · ");
    lines.push([r.at, r.mode, r.subject, r.winner, skor].map(esc).join(","));
  }
  return lines.join("\n");
}

/** Nama pemenang dari daftar skor lajur; "Seri" bila teratas bersama. */
export function winnerName(lanes: readonly LaneState[]): string {
  if (lanes.length === 0) return "-";
  const top = Math.max(...lanes.map((l) => l.score));
  const winners = lanes.filter((l) => l.score === top);
  return winners.length === 1 ? winners[0].def.name : "Seri";
}
