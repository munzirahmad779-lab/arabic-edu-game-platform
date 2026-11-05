/**
 * Ketapel Buah — logika murni (tanpa React, tanpa canvas).
 *
 * Satu pohon besar tiap lajur dipenuhi buah foto Sulawesi yang
 * menggantung. Tiap soal mengisi pohon dengan 7 buah: 4 buah jawaban
 * (satu benar, tiga pengecoh soal itu) dan 3 buah PENYAMAR yang
 * labelnya meminjam jawaban benar soal LAIN dalam mapel yang sama,
 * persis sistem acakan Banua Fruit Blast. Siswa menembak buah dengan
 * ketapel: buah benar +10 dan soal berganti; buah salah atau penyamar
 * jatuh, skor -1 (lantai 0), dan soal yang sama berlanjut sampai buah
 * benarnya kena.
 *
 * Bank soal memakai sistem yang sama dengan Banua Fruit Blast;
 * simpanan memakai kunci localStorage sendiri.
 */

import {
  DEFAULT_BANK,
  parseBank,
  type Bank,
  type ContentSubjectId,
  type FruitSpriteId,
  type Q,
} from "@/modules/banua-fruit-blast/modul/logic";

export type { FruitSpriteId };

export const FRUIT_IDS: FruitSpriteId[] = ["markisa", "langsat", "durian", "pamelo", "terong-belanda", "kakao"];

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
export interface FruitTarget {
  /** Indeks 0..6 di lajur. */
  idx: number;
  /** Teks jawaban yang dibawa keranjang ini. */
  text: string;
  correct: boolean;
  /** Buah penyamar: label pinjaman dari soal lain. */
  impostor: boolean;
  /** Jenis buah foto yang digambar. */
  fruitId: FruitSpriteId;
  /** Keadaan buah: menggantung, sedang jatuh, atau sudah hilang. */
  state: "hang" | "fall" | "gone";
  /** Jarak jatuh dari titik gantung (px) dan kecepatan jatuhnya. */
  fallY: number;
  vy: number;
}

/** Keadaan satu lajur selama pertandingan. */
export interface LaneState {
  def: PlayerDef;
  score: number;
  streak: number;
  /** Soal yang sedang aktif di lajur ini. */
  q: Q | null;
  /** Tujuh buah untuk soal aktif (4 jawaban + 3 penyamar). */
  targets: FruitTarget[];
  /** Fase lajur: siap menarik, batu terbang, atau jeda sorak. */
  phase: "aim" | "fly" | "cheer";
  phaseUntil: number;
}

export const RULES = {
  durationSec: 180,
  pointsCorrect: 10,
  pointsWrong: -1,
  impostorCount: 3,
  /** Fisika batu ketapel (piksel, detik). */
  gravity: 900,
  launchK: 8,
  maxDrag: 230,
  stoneR: 13,
  /** Pantulan batu di tanah: koefisien pantul, laju tegak minimum agar
      masih memantul, dan batas jumlah pantulan per tembakan. */
  bounceRest: 0.62,
  bounceMinVy: 210,
  maxBounces: 4,
  /** Jeda tampilan sesudah buah benar kena (ms). */
  cheerMs: 900,
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
  targets: [],
  phase: "aim",
  phaseUntil: 0,
});

/**
 * Tujuh buah untuk satu soal: 4 jawaban soal itu (teracak) + 3 penyamar
 * berlabel jawaban benar soal lain dari daftar mapel yang sama (sistem
 * acakan Fruit Blast). Bila bank terlalu kecil, penyamar memakai ulang
 * label salah soal itu sendiri (tidak pernah label benar).
 */
export function targetsFor(q: Q, subjectList: readonly Q[], rnd: () => number): FruitTarget[] {
  const labels: { text: string; correct: boolean; impostor: boolean }[] = q.options.map((o) => ({
    text: o,
    correct: o === q.correct,
    impostor: false,
  }));
  const pool: string[] = [];
  for (const other of subjectList) {
    if (other.id !== q.id && !q.options.includes(other.correct) && !pool.includes(other.correct)) {
      pool.push(other.correct);
    }
  }
  const wrongs = q.options.filter((o) => o !== q.correct);
  for (let i = 0; i < RULES.impostorCount; i++) {
    if (pool.length > 0) {
      const j = Math.floor(rnd() * pool.length);
      labels.push({ text: pool.splice(j, 1)[0], correct: false, impostor: true });
    } else if (wrongs.length > 0) {
      labels.push({ text: wrongs[i % wrongs.length], correct: false, impostor: true });
    }
  }
  const fruits = shuffleArr(FRUIT_IDS, rnd);
  const shuffled = shuffleArr(labels, rnd);
  return shuffled.map((l, idx) => ({
    idx,
    text: l.text,
    correct: l.correct,
    impostor: l.impostor,
    fruitId: fruits[idx % fruits.length],
    state: "hang" as const,
    fallY: 0,
    vy: 0,
  }));
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

export const STORE_BANK = "ketapel-buah:bank:v1";
export const STORE_GURU = "ketapel-buah:guru:v1";
export const STORE_SCORES = "ketapel-buah:scores:v1";
export const STORE_SETTINGS = "ketapel-buah:settings:v1";

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
    o.options.length >= 2 &&
    o.options.every((x) => typeof x === "string") &&
    typeof o.correct === "string" &&
    // Soal hanya diterima bila kuncinya termasuk dalam pilihan; soal yang
    // kuncinya di luar pilihan dibuang diam-diam saat pemuatan.
    (o.options as string[]).includes(o.correct)
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
    const questions = Array.isArray(p.questions)
      ? p.questions
          .filter(isQ)
          .map((q) => normalizeQ(q, "guru"))
          // Saringan akhir sesudah normalisasi (pilihan dipotong 6): soal yang
          // kuncinya tidak lagi termasuk dalam pilihan dibuang diam-diam.
          .filter((q) => q.options.length >= 2 && q.options.includes(q.correct))
      : [];
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
