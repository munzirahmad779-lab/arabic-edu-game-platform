/**
 * Jejak Angka: logika murni (tanpa React, tanpa canvas).
 *
 * Sejak Log 77 game ini adalah Ular Tangga Sembunyi (keputusan user
 * 3 Nov 2026; rancangan terkunci di DESIGN.md): papan 100 kotak,
 * pemain bergiliran menjawab soal untuk bisa melempar dadu dan
 * berjalan. Jawaban salah melempar soal yang sama ke pemain
 * berikutnya (soal lemparan). Tangga (10) dan ular (10) bersembunyi
 * tanpa tanda dan diacak ulang setiap pertandingan oleh
 * generateHidden; terungkap permanen sesudah pertama kali terinjak.
 * Khusus tercetak: bintang (soal bonus), kilat (+4), mundur (-4),
 * dan Kotak Ujian. Pertandingan berakhir bila ada yang masuk kotak
 * 100 dengan angka pas (kelebihan memantul) atau waktu 15 menit
 * habis (posisi tertinggi menang).
 *
 * Mesin bank soal (tipe, parser Markdown/CSV, template, prompt)
 * diimpor dari Banua Fruit Blast, sama seperti seri ketapel; yang
 * lokal di sini hanya bank bawaan dan aturan main. Semua soal kini
 * satu aturan siap main: jawaban benar termasuk dalam pilihan dan
 * pilihan minimal 2. Simpanan memakai kunci localStorage sendiri;
 * bank tetap v2 agar bank guru yang tersimpan tidak hilang, skor
 * naik ke v2 karena semantiknya berubah dari poin menjadi posisi.
 */

import {
  parseBank,
  type Bank,
  type ContentSubjectId,
  type Q,
} from "../lib-pendamping/bank-engine";

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
  ladderCount: 10,
  snakeCount: 10,
  /** Peluang bot menjawab benar (mode Solo). */
  botAccuracy: 0.6,
  /** Lama animasi dadu dan langkah pion (dipakai Game dan render). */
  diceMs: 700,
  stepMs: 260,
  /** Jeda tampil spanduk kejutan sebelum giliran berlanjut (ms). */
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

/** Keadaan satu pion selama pertandingan. */
export interface RacerState {
  def: PlayerDef;
  isBot: boolean;
  /** Kotak saat ini, 1 sampai 100. */
  pos: number;
  correct: number;
  answered: number;
  ladders: number;
  snakes: number;
  /** Tanda Kotak Ujian aktif: dinilai pada soal giliran sendiri berikutnya. */
  ujian: boolean;
  /** Kehilangan satu giliran (akibat ujian gagal); dikonsumsi saat dilewati. */
  skipNext: boolean;
}

export const emptyRacer = (r: RacerDef): RacerState => ({
  def: r.def,
  isBot: r.isBot,
  pos: 1,
  correct: 0,
  answered: 0,
  ladders: 0,
  snakes: 0,
  ujian: false,
  skipNext: false,
});

export function shuffleArr<T>(arr: readonly T[], rnd: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ------------------------------------------------------------- soal */

/** Satu aturan siap main untuk semua soal (Log 77). */
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

/* ------------------------------------------------------------- papan */

export const BOARD_LAST = 100;

export type PrintedKind = "bintang" | "kilat" | "mundur" | "ujian";

/** Kotak khusus tercetak: posisi tetap, selalu terlihat. */
export const PRINTED: Readonly<Record<number, PrintedKind>> = {
  12: "bintang",
  37: "bintang",
  58: "bintang",
  77: "bintang",
  89: "bintang",
  95: "bintang",
  15: "kilat",
  26: "kilat",
  44: "kilat",
  69: "kilat",
  83: "kilat",
  24: "mundur",
  35: "mundur",
  42: "mundur",
  60: "mundur",
  93: "mundur",
  30: "ujian",
  50: "ujian",
  67: "ujian",
  75: "ujian",
};

export type HiddenKind = "tangga" | "ular";

export interface HiddenSpecial {
  kind: HiddenKind;
  from: number;
  to: number;
}

const randInt = (rnd: () => number, min: number, max: number): number =>
  min + Math.floor(rnd() * (max - min + 1));

/**
 * Mengacak 10 tangga dan 10 ular untuk satu pertandingan.
 * Invarian (DESIGN.md Bagian 3): semua awal khusus berbeda dan
 * bersih dari kotak 1 dan 100; jarak antar awal sembunyi minimal 3
 * (dilonggarkan ke 2 lalu 1 hanya bila penempatan gagal berulang);
 * tangga naik 10..60, ular turun 10..60 kecuali kepala di atas
 * kotak 80 yang turun maksimal 25; semua ujung adalah kotak polos
 * (bukan tercetak, bukan awal sembunyi mana pun), jadi kejutan tidak
 * pernah berantai. Fungsi murni terhadap rnd agar bisa diuji satuan.
 */
function generateHiddenOnce(rnd: () => number): HiddenSpecial[] {
  const starts = new Set<number>([1, BOARD_LAST, ...Object.keys(PRINTED).map(Number)]);
  const targets = new Set<number>();
  const out: HiddenSpecial[] = [];

  const candidate = (kind: HiddenKind): HiddenSpecial | null => {
    if (kind === "tangga") {
      const from = randInt(rnd, 2, 89);
      const rise = randInt(rnd, 10, Math.min(60, 99 - from));
      return { kind, from, to: from + rise };
    }
    const from = randInt(rnd, 12, 99);
    const maxDrop = from > 80 ? 25 : Math.min(60, from - 2);
    const drop = randInt(rnd, 10, maxDrop);
    return { kind, from, to: from - drop };
  };

  const place = (kind: HiddenKind, minGap: number): boolean => {
    for (let attempt = 0; attempt < 300; attempt++) {
      const c = candidate(kind);
      if (!c) continue;
      if (starts.has(c.from) || targets.has(c.from)) continue;
      if (starts.has(c.to) || targets.has(c.to) || c.to < 2 || c.to > 99) continue;
      if (out.some((h) => Math.abs(h.from - c.from) < minGap)) continue;
      starts.add(c.from);
      targets.add(c.to);
      out.push(c);
      return true;
    }
    return false;
  };

  const kinds: HiddenKind[] = [
    ...Array<HiddenKind>(RULES.ladderCount).fill("tangga"),
    ...Array<HiddenKind>(RULES.snakeCount).fill("ular"),
  ];
  for (const gap of [3, 2, 1]) {
    for (const kind of kinds) {
      const placed = out.filter((h) => h.kind === kind).length;
      const want = kind === "tangga" ? RULES.ladderCount : RULES.snakeCount;
      if (placed >= want) continue;
      let guard = 0;
      while (out.filter((h) => h.kind === kind).length < want && guard++ < want + 2) {
        if (!place(kind, gap)) break;
      }
    }
    if (out.length >= kinds.length) break;
  }

  // Lintasan pengisian deterministik: penjamin hasil akhir. Memindai
  // semua pasangan (awal, rentang) dalam urutan tetap dan menempatkan
  // pasangan sah pertama, dengan aturan penolakan yang sama persis
  // seperti jalur acak (awal dan ujung bersih dari kotak tercetak, 1,
  // 100, awal lain, dan ujung lain, jadi tidak pernah berantai); hanya
  // syarat jarak antar awal yang gugur, setara pelonggaran jarak ke 1
  // yang memang sudah menjadi tingkat terakhir jalur acak. Diulang
  // sampai kuota tiap jenis penuh, jadi satu pembangkitan selalu
  // menghasilkan tepat ladderCount tangga dan snakeCount ular selama
  // masih ada pasangan sah, tanpa bergantung pada keberuntungan rnd.
  const placeDeterministic = (kind: HiddenKind): boolean => {
    const fromMin = kind === "tangga" ? 2 : 12;
    const fromMax = kind === "tangga" ? 89 : 99;
    for (let from = fromMin; from <= fromMax; from++) {
      if (starts.has(from) || targets.has(from)) continue;
      const maxSpan =
        kind === "tangga" ? Math.min(60, 99 - from) : from > 80 ? 25 : Math.min(60, from - 2);
      for (let span = 10; span <= maxSpan; span++) {
        const to = kind === "tangga" ? from + span : from - span;
        if (starts.has(to) || targets.has(to) || to < 2 || to > 99) continue;
        starts.add(from);
        targets.add(to);
        out.push({ kind, from, to });
        return true;
      }
    }
    return false;
  };
  for (const kind of kinds) {
    const want = kind === "tangga" ? RULES.ladderCount : RULES.snakeCount;
    while (out.filter((h) => h.kind === kind).length < want) {
      if (!placeDeterministic(kind)) break;
    }
  }
  return out;
}

/**
 * Pembangkit papan sembunyi untuk satu pertandingan. Satu pembangkitan
 * sudah menjamin tepat RULES.ladderCount tangga dan RULES.snakeCount
 * ular lewat lintasan pengisian deterministik di generateHiddenOnce;
 * pemeriksaan di sini hanya jaring pengaman: bila suatu hasil entah
 * bagaimana tetap kurang dari target rancangan, bangkitkan ulang
 * sampai 8 percobaan dan pakai hasil dengan jumlah khusus terbanyak.
 */
export function generateHidden(rnd: () => number): HiddenSpecial[] {
  const countOf = (list: HiddenSpecial[], kind: HiddenKind): number =>
    list.filter((h) => h.kind === kind).length;
  let best = generateHiddenOnce(rnd);
  for (let attempt = 1; attempt < 8; attempt++) {
    if (countOf(best, "tangga") >= RULES.ladderCount && countOf(best, "ular") >= RULES.snakeCount) break;
    const next = generateHiddenOnce(rnd);
    if (next.length > best.length) best = next;
  }
  return best;
}

/** Lemparan dadu: 1 sampai 6. */
export const rollDice = (rnd: () => number): number => 1 + Math.floor(rnd() * 6);

/** Gerak maju dengan pantulan di kotak 100 (kelebihan angka memantul mundur). */
export function moveWithBounce(pos: number, roll: number): { to: number; bounced: boolean } {
  const raw = pos + roll;
  if (raw <= BOARD_LAST) return { to: raw, bounced: false };
  return { to: 2 * BOARD_LAST - raw, bounced: true };
}

/** Urutan peringkat: posisi tertinggi, seri diputus jumlah jawaban benar. */
export function rankRacers(racers: readonly RacerState[]): RacerState[] {
  return [...racers].sort((a, b) => b.pos - a.pos || b.correct - a.correct);
}

/** Pemenang: semua pion yang berbagi peringkat pertama (seri penuh). */
export function raceWinners(racers: readonly RacerState[]): RacerState[] {
  const ranked = rankRacers(racers);
  if (ranked.length === 0) return [];
  const top = ranked[0];
  return ranked.filter((r) => r.pos === top.pos && r.correct === top.correct);
}

/* ---------------------------------------------------------- bank bawaan */

const mkQ = (subjectId: ContentSubjectId, n: number, prompt: string, correct: string, wrongs: [string, string, string], isArabic = false): Q => ({
  id: `jejak-${subjectId}-${n}`,
  subjectId,
  prompt,
  isArabic,
  options: shuffleSeeded([correct, ...wrongs], n),
  correct,
});

/** Acakan tetap untuk menyusun pilihan bank bawaan (tanpa Math.random). */
function shuffleSeeded(arr: string[], seed: number): string[] {
  const a = [...arr];
  let s = seed * 2654435761 % 4294967296;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Bank bawaan Jejak Angka: 6 mapel x 10 soal, dipertahankan dari
 * versi sungai. Sejak Log 77 semua soal dimainkan dengan cara yang
 * sama (jawab pilihan), jadi bank angka dan bank kosakata sama-sama
 * berlaku apa adanya.
 */
export const DEFAULT_BANK: Bank = {
  matematika: [
    mkQ("matematika", 1, "7 + 8 = ...", "15", ["13", "14", "16"]),
    mkQ("matematika", 2, "9 × 3 = ...", "27", ["21", "24", "30"]),
    mkQ("matematika", 3, "25 - 9 = ...", "16", ["14", "15", "17"]),
    mkQ("matematika", 4, "6 + 7 + 5 = ...", "18", ["16", "17", "19"]),
    mkQ("matematika", 5, "4 × 6 = ...", "24", ["20", "22", "26"]),
    mkQ("matematika", 6, "36 - 17 = ...", "19", ["17", "18", "21"]),
    mkQ("matematika", 7, "20 - 8 = ...", "12", ["11", "13", "14"]),
    mkQ("matematika", 8, "5 × 6 = ...", "30", ["25", "28", "32"]),
    mkQ("matematika", 9, "13 + 8 = ...", "21", ["19", "20", "22"]),
    mkQ("matematika", 10, "30 - 16 = ...", "14", ["13", "15", "16"]),
  ],
  inggris: [
    mkQ("inggris", 1, "'Buku' in English is ...", "book", ["pen", "bag", "desk"]),
    mkQ("inggris", 2, "'Sekolah' in English is ...", "school", ["hospital", "market", "mosque"]),
    mkQ("inggris", 3, "'Air' in English is ...", "water", ["fire", "milk", "bread"]),
    mkQ("inggris", 4, "'Rumah' in English is ...", "house", ["door", "window", "wall"]),
    mkQ("inggris", 5, "'Guru' in English is ...", "teacher", ["student", "doctor", "farmer"]),
    mkQ("inggris", 6, "'Matahari' in English is ...", "sun", ["moon", "star", "cloud"]),
    mkQ("inggris", 7, "'Kucing' in English is ...", "cat", ["dog", "bird", "fish"]),
    mkQ("inggris", 8, "'Pintu' in English is ...", "door", ["chair", "table", "window"]),
    mkQ("inggris", 9, "'Susu' in English is ...", "milk", ["water", "juice", "coffee"]),
    mkQ("inggris", 10, "'Makan' in English is ...", "eat", ["drink", "sleep", "read"]),
  ],
  arab: [
    mkQ("arab", 1, "Bahasa Arabnya 'buku' adalah ...", "كتاب", ["مدرسة", "قلم", "باب"]),
    mkQ("arab", 2, "Bahasa Arabnya 'sekolah' adalah ...", "مدرسة", ["مكتبة", "مسجد", "سوق"]),
    mkQ("arab", 3, "Bahasa Arabnya 'air' adalah ...", "ماء", ["نار", "خبز", "حليب"]),
    mkQ("arab", 4, "Bahasa Arabnya 'rumah' adalah ...", "بيت", ["باب", "شباك", "جدار"]),
    mkQ("arab", 5, "Bahasa Arabnya 'guru' adalah ...", "معلم", ["طالب", "طبيب", "مهندس"]),
    mkQ("arab", 6, "Bahasa Arabnya 'matahari' adalah ...", "شمس", ["قمر", "نجم", "سحاب"]),
    mkQ("arab", 7, "Bahasa Arabnya 'kucing' adalah ...", "قطة", ["كلب", "حصان", "طائر"]),
    mkQ("arab", 8, "Bahasa Arabnya 'pintu' adalah ...", "باب", ["شباك", "كرسي", "طاولة"]),
    mkQ("arab", 9, "Bahasa Arabnya 'susu' adalah ...", "لبن", ["ماء", "عصير", "قهوة"]),
    mkQ("arab", 10, "Bahasa Arabnya 'makan' (kata kerja) adalah ...", "يأكل", ["يشرب", "ينام", "يقرأ"]),
  ],
  biologi: [
    mkQ("biologi", 1, "Berapa jumlah kaki seekor laba-laba?", "8", ["6", "7", "10"]),
    mkQ("biologi", 2, "Berapa jumlah sayap seekor kupu-kupu?", "4", ["2", "3", "6"]),
    mkQ("biologi", 3, "Berapa jumlah kaki seekor semut?", "6", ["4", "8", "10"]),
    mkQ("biologi", 4, "Berapa jumlah jantung seekor gurita?", "3", ["1", "2", "4"]),
    mkQ("biologi", 5, "Berapa jumlah mata seekor lebah?", "5", ["3", "4", "6"]),
    mkQ("biologi", 6, "Berapa jumlah kaki seekor kepiting?", "10", ["6", "8", "12"]),
    mkQ("biologi", 7, "Berapa hari telur ayam dierami sampai menetas?", "21", ["18", "19", "20"]),
    mkQ("biologi", 8, "Berapa jumlah gigi orang dewasa yang lengkap?", "32", ["28", "30", "34"]),
    mkQ("biologi", 9, "Berapa jumlah warna pada pelangi?", "7", ["5", "6", "8"]),
    mkQ("biologi", 10, "Berapa jumlah sayap seekor lebah?", "4", ["2", "3", "6"]),
  ],
  fisika: [
    mkQ("fisika", 1, "Sebuah mobil menempuh 40 km dalam 2 jam. Berapa kecepatannya tiap jam (km/jam)?", "20", ["15", "18", "25"]),
    mkQ("fisika", 2, "Berapa jumlah detik dalam setengah menit?", "30", ["15", "20", "45"]),
    mkQ("fisika", 3, "Sebuah kipas berputar 6 kali tiap detik. Berapa putarannya dalam 4 detik?", "24", ["20", "22", "26"]),
    mkQ("fisika", 4, "Berapa jumlah sisi (permukaan) sebuah kubus?", "6", ["4", "5", "8"]),
    mkQ("fisika", 5, "Satu lusin ada berapa buah?", "12", ["10", "11", "13"]),
    mkQ("fisika", 6, "Berapa jumlah roda pada dua sepeda motor?", "4", ["2", "3", "5"]),
    mkQ("fisika", 7, "Gaya 10 newton dibagi massa 2 kg menghasilkan percepatan berapa?", "5", ["3", "4", "6"]),
    mkQ("fisika", 8, "Tiga orang mendorong dengan gaya 5 newton tiap orang. Berapa total gayanya?", "15", ["13", "14", "16"]),
    mkQ("fisika", 9, "Sebuah benda bergerak 8 meter tiap detik. Berapa meter jaraknya dalam 4 detik?", "32", ["28", "30", "34"]),
    mkQ("fisika", 10, "Berapa jumlah sisi (permukaan) pada dua kubus?", "12", ["10", "11", "13"]),
  ],
  indonesia: [
    mkQ("indonesia", 1, "Lawan kata 'besar' adalah ...", "Kecil", ["Panjang", "Tinggi", "Luas"]),
    mkQ("indonesia", 2, "Lawan kata 'panas' adalah ...", "Dingin", ["Hangat", "Gerah", "Terik"]),
    mkQ("indonesia", 3, "Kata 'gembira' artinya sama dengan ...", "Senang", ["Sedih", "Marah", "Takut"]),
    mkQ("indonesia", 4, "Ibu kota negara Indonesia adalah ...", "Jakarta", ["Bandung", "Surabaya", "Medan"]),
    mkQ("indonesia", 5, "Lambang negara Indonesia adalah ...", "Garuda Pancasila", ["Bhinneka Tunggal Ika", "Bendera Merah Putih", "Burung Merak"]),
    mkQ("indonesia", 6, "Hewan yang dijuluki raja hutan adalah ...", "Singa", ["Harimau", "Gajah", "Serigala"]),
    mkQ("indonesia", 7, "Warna bendera negara Indonesia adalah ...", "Merah dan putih", ["Merah dan kuning", "Putih dan hijau", "Biru dan putih"]),
    mkQ("indonesia", 8, "Sesudah hari Senin adalah hari ...", "Selasa", ["Rabu", "Kamis", "Minggu"]),
    mkQ("indonesia", 9, "Buah berkulit kuning yang sangat disukai monyet adalah ...", "Pisang", ["Mangga", "Nanas", "Pepaya"]),
    mkQ("indonesia", 10, "Sesudah hujan reda, di langit kadang terlihat ...", "Pelangi", ["Petir", "Kabut tebal", "Awan hitam"]),
  ],
};

/* ------------------------------------------------------------ simpanan */

/** Bank tetap v2 (Log 73) agar bank guru yang tersimpan tidak hilang. */
export const STORE_BANK = "jejak-angka:bank:v2";
export const STORE_GURU = "jejak-angka:guru:v1";
/** Bank yang dipasang dari Bank Soal LMS lewat pemilih bank di layar bank. */
export const STORE_LMS = "jejak-angka:lms:v1";
/** Skor naik ke v2 pada Log 77: semantik berubah dari poin ke posisi. */
export const STORE_SCORES = "jejak-angka:scores:v2";
export const STORE_SETTINGS = "jejak-angka:settings:v1";

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

export function scoresCsv(rows: ScoreRec[]): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = ["Waktu,Mode,Mapel,Pemenang,Sebab,Posisi Akhir"];
  for (const r of rows) {
    const sebab = r.reason === "finish" ? "Mencapai kotak 100" : "Waktu habis";
    const posisi = r.results.map((x) => `${x.name} kotak ${x.pos}`).join(" · ");
    lines.push([r.at, r.mode, r.subject, r.winner, sebab, posisi].map(esc).join(","));
  }
  return lines.join("\n");
}
