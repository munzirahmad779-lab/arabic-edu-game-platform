/**
 * Ludo Angka: logika murni (tanpa React).
 *
 * Game Ludo untuk kelas (perintah user 3 Nov 2026: "Ludo juga buat
 * bisa kontrol seperti ular tangga"; rancangan terkunci di
 * DESIGN.md): satu pion per pemain di papan 15x15, setiap lemparan
 * dadu diperoleh dari jawaban benar, jawaban salah melempar soal
 * yang sama ke pemain berikutnya (soal lemparan, pola Jejak Angka).
 * Kotak khusus tercetak: bintang (aman + soal bonus), kilat (+4),
 * mundur (-4), berhenti (lewati satu giliran). Menangkap pion lawan
 * mengembalikannya ke kandang dan memberi lemparan bonus.
 *
 * Mesin bank soal diimpor dari Banua Fruit Blast dan bank bawaan
 * memakai DEFAULT_BANK Jejak Angka, sama seperti saudara segenerasi;
 * yang lokal di sini hanya geometri papan dan aturan main. Simpanan
 * memakai kunci localStorage sendiri.
 */

import {
  parseBank,
  type Bank,
  type ContentSubjectId,
  type Q,
} from "../lib-pendamping/bank-engine";
import { DEFAULT_BANK as JEJAK_DEFAULT_BANK } from "@/modules/jejak-angka/modul/logic";

export type { Bank, ContentSubjectId, Q };
export {
  SUBJECTS,
  parseCsvBank,
  parseMarkdownBank,
  promptTemplateSoal,
  templateMarkdown,
} from "../lib-pendamping/bank-engine";

export type GameMode = "SOLO" | "DUEL" | "TRIO" | "QUAD";
export type Screen = "home" | "countdown" | "playing" | "result" | "score" | "bank";
export type SpriteId = "maleo" | "tarsius" | "anoa" | "kuskus";
export type SubjectChoice = ContentSubjectId | "guru" | "lms";

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

export type WinReason = "finish" | "batas";

export interface ScoreRec {
  at: string;
  mode: GameMode;
  subject: string;
  results: { name: string; pos: number }[];
  winner: string;
  reason: WinReason;
}

export interface GuruBank {
  name: string;
  questions: Q[];
}

export const RULES = {
  /** Batas waktu pertandingan: 15 menit. */
  durationSec: 900,
  kilatStep: 4,
  mundurStep: 4,
  /** Peluang bot menjawab benar (mode Solo). */
  botAccuracy: 0.6,
  /** Lama animasi dadu dan langkah pion (dipakai Game). */
  diceMs: 700,
  stepMs: 240,
  /** Jeda tampil spanduk kejadian sebelum giliran berlanjut (ms). */
  bannerMs: 1600,
} as const;

export const MODES: { id: GameMode; title: string; sub: string; players: number }[] = [
  { id: "SOLO", title: "Solo", sub: "Lawan bot Tarsius", players: 1 },
  { id: "DUEL", title: "Duel", sub: "2 pemain, 1 layar", players: 2 },
  { id: "TRIO", title: "Trio", sub: "3 pemain, 1 layar", players: 3 },
  { id: "QUAD", title: "Quad", sub: "4 pemain, 1 layar", players: 4 },
];

const ALL_SLOTS: PlayerDef[] = [
  { slot: 0, name: "Maleo", sprite: "maleo", color: "#4C1D95", soft: "#EDE9FE" },
  { slot: 1, name: "Tarsius", sprite: "tarsius", color: "#1F7A72", soft: "#CCFBF1" },
  { slot: 2, name: "Anoa", sprite: "anoa", color: "#4E9B47", soft: "#DCF2DC" },
  { slot: 3, name: "Kuskus", sprite: "kuskus", color: "#D9A404", soft: "#FBF0C8" },
];

/** Definisi pemain manusia untuk mode tertentu (Solo hanya Maleo). */
export const playersFor = (mode: GameMode): PlayerDef[] => {
  const n = MODES.find((m) => m.id === mode)?.players ?? 1;
  return ALL_SLOTS.slice(0, n);
};

/** Satu pion dalam pertandingan: definisi pemain + penanda bot. */
export interface RacerDef {
  def: PlayerDef;
  isBot: boolean;
}

/** Pion untuk mode tertentu: Solo menambah bot Tarsius sesudah Maleo. */
export const racersFor = (mode: GameMode): RacerDef[] => {
  const humans = playersFor(mode);
  if (mode === "SOLO") return [{ def: humans[0], isBot: false }, { def: ALL_SLOTS[1], isBot: true }];
  return humans.map((def) => ({ def, isBot: false }));
};

/* ------------------------------------------------------------- papan */

/** Kemajuan tertinggi: 57 berarti FINISH di pusat papan. */
export const FINISH_PROGRESS = 57;

/**
 * Lintasan lingkaran 52 kotak sebagai [baris, kolom] pada kisi 15x15,
 * berurutan searah jarum jam mulai dari kotak start Maleo (6,1).
 */
export const PATH: readonly (readonly [number, number])[] = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  [0, 7], [0, 8],
  [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
  [7, 14], [8, 14],
  [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
  [14, 7], [14, 6],
  [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  [7, 0], [6, 0],
];

/** Indeks lintasan kotak start tiap pemain (urutan ALL_SLOTS). */
export const START_INDEX: readonly number[] = [0, 13, 26, 39];

/** Kolom rumah 5 kotak per pemain, dari pintu masuk menuju pusat. */
export const HOME_COLS: readonly (readonly (readonly [number, number])[])[] = [
  [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
  [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
];

export type SpecialKind = "bintang" | "kilat" | "mundur" | "berhenti";

/** Kotak khusus menurut indeks lintasan: tetap, selalu terlihat. */
export const SPECIALS: Readonly<Record<number, SpecialKind>> = {
  8: "bintang", 21: "bintang", 34: "bintang", 47: "bintang",
  4: "kilat", 17: "kilat", 30: "kilat", 43: "kilat",
  10: "mundur", 23: "mundur", 36: "mundur", 49: "mundur",
  3: "berhenti", 16: "berhenti", 29: "berhenti", 42: "berhenti",
};

/** Kotak aman: kotak start dan kotak bintang (tidak ada tangkapan). */
export const SAFE_INDEXES: ReadonlySet<number> = new Set<number>([
  ...START_INDEX,
  ...Object.keys(SPECIALS)
    .map((k) => Number(k))
    .filter((k) => SPECIALS[k] === "bintang"),
]);

/** Indeks lintasan untuk kemajuan 1..51 pemain tertentu. */
export const trackIndexOf = (playerIdx: number, progress: number): number =>
  (START_INDEX[playerIdx] + progress - 1) % PATH.length;

export type CellRef =
  | { kind: "base" }
  | { kind: "track"; index: number; row: number; col: number }
  | { kind: "home"; step: number; row: number; col: number }
  | { kind: "finish" };

/** Sel papan untuk kemajuan pion: 0 kandang, 57 FINISH. */
export function progressCell(playerIdx: number, progress: number): CellRef {
  if (progress <= 0) return { kind: "base" };
  if (progress >= FINISH_PROGRESS) return { kind: "finish" };
  if (progress <= 51) {
    const index = trackIndexOf(playerIdx, progress);
    const [row, col] = PATH[index];
    return { kind: "track", index, row, col };
  }
  const step = progress - 52;
  const [row, col] = HOME_COLS[playerIdx][step];
  return { kind: "home", step, row, col };
}

/**
 * Kemajuan sesudah lemparan dadu dari kemajuan 1..56: melewati
 * FINISH memantul balik. Keluar kandang diatur pemanggil (hanya 6).
 */
export function advanceProgress(progress: number, roll: number): number {
  const raw = progress + roll;
  return raw > FINISH_PROGRESS ? 2 * FINISH_PROGRESS - raw : raw;
}

/** Label posisi untuk panel dan kontroler. */
export const progressLabel = (progress: number): string =>
  progress <= 0 ? "Di Kandang" : progress >= FINISH_PROGRESS ? "FINISH" : `Langkah ${progress}`;

/* --------------------------------------------------------- pion lomba */

/** Keadaan satu pion selama pertandingan. */
export interface RacerState {
  def: PlayerDef;
  isBot: boolean;
  /** Kemajuan: 0 kandang, 1..51 lintasan, 52..56 kolom rumah, 57 FINISH. */
  progress: number;
  correct: number;
  answered: number;
  captures: number;
  /** Tanda kotak Berhenti: satu giliran berikutnya dilewati. */
  skipNext: boolean;
}

export const emptyRacer = (r: RacerDef): RacerState => ({
  def: r.def,
  isBot: r.isBot,
  progress: 0,
  correct: 0,
  answered: 0,
  captures: 0,
  skipNext: false,
});

/** Urutan peringkat: kemajuan tertinggi, lalu jawaban benar terbanyak. */
export function rankRacers(racers: readonly RacerState[]): RacerState[] {
  return [...racers].sort((a, b) => b.progress - a.progress || b.correct - a.correct);
}

/** Pemenang: kemajuan tertinggi; seri penuh berarti menang bersama. */
export function raceWinners(racers: readonly RacerState[]): RacerState[] {
  const ranked = rankRacers(racers);
  if (ranked.length === 0) return [];
  const top = ranked[0];
  return ranked.filter((r) => r.progress === top.progress && r.correct === top.correct);
}

export function shuffleArr<T>(arr: readonly T[], rnd: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ------------------------------------------------------------- soal */

/** Satu aturan siap main untuk semua soal (sama seperti Jejak Angka). */
export const playableQuestions = (list: readonly Q[]): Q[] =>
  list.filter((q) => q.correct.trim().length > 0 && q.options.length >= 2 && q.options.includes(q.correct));

/** Dek soal satu pertandingan: diacak, tidak diulang sampai habis. */
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

export const rollDice = (rnd: () => number): number => 1 + Math.floor(rnd() * 6);

/* ------------------------------------------------------------ simpanan */

export const DEFAULT_BANK: Bank = JEJAK_DEFAULT_BANK;

export const STORE_BANK = "ludo-angka:bank:v1";
export const STORE_GURU = "ludo-angka:guru:v1";
/** Bank yang dipasang dari Bank Soal LMS lewat pemilih bank di layar bank. */
export const STORE_LMS = "ludo-angka:lms:v1";
export const STORE_SCORES = "ludo-angka:scores:v1";
export const STORE_SETTINGS = "ludo-angka:settings:v1";

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
  subjectId: subjectId === "guru" || subjectId === "lms" ? "arab" : subjectId,
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

/** Bank hasil pemasangan dari Bank Soal LMS; bentuknya sama dengan
 *  GuruBank (nama bank + daftar soal) dan disimpan terpisah agar tidak
 *  tercampur dengan Mapel Guru ketikan tangan. */
export function loadLms(): GuruBank {
  const fallback: GuruBank = { name: "", questions: [] };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(STORE_LMS);
    if (!raw) return fallback;
    const p = JSON.parse(raw) as Partial<GuruBank>;
    const questions = Array.isArray(p.questions) ? p.questions.filter(isQ).map((q) => normalizeQ(q, "lms")) : [];
    return { name: typeof p.name === "string" ? p.name : "", questions };
  } catch {
    return fallback;
  }
}

export function saveLms(g: GuruBank): void {
  try {
    window.localStorage.setItem(STORE_LMS, JSON.stringify(g));
  } catch {
    /* abaikan */
  }
}

export function loadSettings(): Settings {
  const fallback: Settings = { mode: "DUEL", subject: "matematika", sound: true };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(STORE_SETTINGS);
    if (!raw) return fallback;
    const p = JSON.parse(raw) as Partial<Settings>;
    return {
      mode: p.mode === "SOLO" || p.mode === "DUEL" || p.mode === "TRIO" || p.mode === "QUAD" ? p.mode : fallback.mode,
      subject:
        p.subject === "indonesia" || p.subject === "guru" || p.subject === "lms" || p.subject === "arab" || p.subject === "inggris" || p.subject === "matematika" || p.subject === "biologi" || p.subject === "fisika"
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
