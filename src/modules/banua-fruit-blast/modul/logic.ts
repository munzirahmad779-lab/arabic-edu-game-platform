/**
 * Banua Fruit Blast — aturan permainan, bank soal, penyimpanan lokal.
 *
 * Semua tipe domain, konstanta aturan (RULES), dan helper murni ada di sini.
 * Game.tsx hanya boleh memakai tipe dari berkas ini, bukan mendefinisikan ulang.
 */

/* ------------------------------------------------------------------ tipe */

export type SubjectId = "arab" | "inggris" | "matematika" | "biologi" | "fisika" | "guru";
/** Mapel yang bank bawaannya tersimpan di Bank (guru disimpan terpisah). */
export type ContentSubjectId = "arab" | "inggris" | "matematika" | "biologi" | "fisika";
export const CONTENT_SUBJECTS: ContentSubjectId[] = ["arab", "inggris", "matematika", "biologi", "fisika"];

/** Enam buah khas Sulawesi yang tampil sebagai buah foto (folder buah-sulawesi). */
export type FruitSpriteId = "markisa" | "langsat" | "durian" | "pamelo" | "terong-belanda" | "kakao";
export const FRUIT_SPRITE_IDS: FruitSpriteId[] = ["markisa", "langsat", "durian", "pamelo", "terong-belanda", "kakao"];
export type GameMode = "DUEL" | "TRIO" | "SQUAD";
export type EndReason = "timeup" | "exit";

export type Screen =
  | "home"
  | "mode"
  | "countdown"
  | "playing"
  | "result"
  | "score"
  | "bank";

export type SpriteId = "anoa" | "tarsius" | "maleo" | "kuskus";

/** Satu soal: selalu 4 pilihan, jawaban benar unik di dalam options. */
export interface Q {
  id: string;
  subjectId: SubjectId;
  prompt: string;
  isArabic: boolean;
  options: string[];
  correct: string;
  custom?: boolean;
}

/** Definisi peserta: warna gradien panel, border, tombol, label. */
export interface PlayerDef {
  slot: number;
  name: string;
  sprite: SpriteId;
  /** gradien panel (dua warna) — tiap peserta wajib berbeda */
  gradFrom: string;
  gradTo: string;
  /** warna border + label + tombol */
  accent: string;
  /** teks di atas gradien gelap */
  onAccent: string;
}

export interface PlayerScore {
  name: string;
  sprite: SpriteId;
  score: number;
  correct: number;
  wrong: number;
}

export interface Settings {
  mode: GameMode;
  subject: SubjectId;
  questionCount: number;
  sound: boolean;
}

export interface ScoreRec {
  id: string;
  timestamp: number;
  mode: GameMode;
  subject: SubjectId;
  reason: EndReason;
  winner: string;
  players: PlayerScore[];
}

export type FruitKind = "option" | "impostor";

/** Buah foto yang jatuh membawa pita teks jawaban; dipotong dengan geseran. */
export interface Fruit {
  id: number;
  lane: number;
  text: string;
  correct: boolean;
  /** option = satu dari 4 jawaban soal berjalan; impostor = pengecoh */
  kind: FruitKind;
  /** indeks opsi (0..3) untuk kind option; -1 untuk impostor */
  optionIndex: number;
  /** isi sembunyi: bom hanya di buah salah, emas hanya di buah benar */
  hasBomb: boolean;
  hasGold: boolean;
  sprite: FruitSpriteId;
  /** posisi pusat, koordinat CSS px di dalam kanvas */
  x: number;
  y: number;
  vy: number;
  w: number;
  h: number;
  wobble: number;
  /** kemajuan animasi muncul (1 -> 0) */
  pop: number;
  /** waktu (ms) animasi jungkir label saat reshuffle berakhir */
  flipUntil: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

/** Form tambah soal di layar bank. */
export interface DraftQ {
  subjectId: SubjectId;
  prompt: string;
  options: [string, string, string, string];
  correctIndex: number;
}

export type Bank = Record<ContentSubjectId, Q[]>;

/* ------------------------------------------------------------------ aturan */

export const RULES = {
  /** durasi satu pertandingan (detik) */
  durationSec: 180,
  /** poin memotong buah jawaban benar biasa */
  correctPoints: 1,
  /** poin memotong buah benar yang berisi emas sembunyi */
  goldPoints: 2,
  /** pengurangan poin memotong buah salah biasa / impostor */
  wrongPenalty: 1,
  /** pengurangan poin memotong buah salah yang berisi bom sembunyi */
  bombPenalty: 2,
  /** skor tidak boleh negatif */
  minScore: 0,
  /** jumlah buah yang mengalir per soal (4 jawaban + impostor) */
  streamMin: 6,
  streamMax: 8,
  /** buah serentak maksimum per lajur */
  maxFruitsPerLane: 6,
  /** jeda spawn antar buah dalam satu lajur (ms) */
  spawnEveryMs: 430,
  /** satu buah melintasi arena dalam rentang ini (detik), kecepatan sedang */
  crossSecMin: 2.6,
  crossSecMax: 3.4,
  /** label 4 jawaban diacak ulang penempatannya tiap jeda ini (ms) */
  reshuffleMs: 4000,
  /** peluang buah salah berisi bom sembunyi */
  bombChance: 0.35,
  /** peluang buah benar berisi emas sembunyi */
  goldChance: 0.4,
  /** tinggi tampil buah foto (CSS px); lebar mengikuti aspek sprite */
  fruitH: 116,
  /** batas partikel agar tidak tumbuh tanpa henti */
  maxParticles: 160,
  /** riwayat skor maksimum */
  maxScoreRecords: 50,
  /** pilihan jumlah soal per sesi (0 = semua soal di bank) */
  questionCountOptions: [5, 8, 12, 0],
  defaultQuestionCount: 8,
  /** hitung mundur sebelum bertanding (detik) */
  countdownSec: 3,
} as const;

export const SUBJECTS: { id: ContentSubjectId; title: string; icon: string }[] = [
  { id: "arab", title: "Bahasa Arab", icon: "📖" },
  { id: "inggris", title: "Bahasa Inggris", icon: "🔤" },
  { id: "matematika", title: "Matematika", icon: "🔢" },
  { id: "biologi", title: "Biologi SMA", icon: "🧬" },
  { id: "fisika", title: "Fisika SMA", icon: "⚡" },
];

export const MODES: { id: GameMode; title: string; sub: string; players: number }[] = [
  { id: "DUEL", title: "Duel", sub: "2 pemain", players: 2 },
  { id: "TRIO", title: "Trio", sub: "3 pemain", players: 3 },
  { id: "SQUAD", title: "Squad", sub: "4 pemain", players: 4 },
];

/** Warna tiap peserta — gradien, border, dan label semuanya berbeda. */
export const PLAYER_SLOTS: Record<GameMode, PlayerDef[]> = {
  TRIO: [
    {
      slot: 0,
      name: "Anoa",
      sprite: "anoa",
      gradFrom: "#FF9F1C",
      gradTo: "#C2410C",
      accent: "#FDE68A",
      onAccent: "#3B1502",
    },
    {
      slot: 1,
      name: "Tarsius",
      sprite: "tarsius",
      gradFrom: "#2EC4B6",
      gradTo: "#0F5E63",
      accent: "#A7F3D0",
      onAccent: "#052E2B",
    },
    {
      slot: 2,
      name: "Maleo",
      sprite: "maleo",
      gradFrom: "#8B5CF6",
      gradTo: "#4C1D95",
      accent: "#DDD6FE",
      onAccent: "#2E1065",
    },
  ],
  DUEL: [
    {
      slot: 0,
      name: "Anoa",
      sprite: "anoa",
      gradFrom: "#FF9F1C",
      gradTo: "#C2410C",
      accent: "#FDE68A",
      onAccent: "#3B1502",
    },
    {
      slot: 1,
      name: "Tarsius",
      sprite: "tarsius",
      gradFrom: "#2EC4B6",
      gradTo: "#0F5E63",
      accent: "#A7F3D0",
      onAccent: "#052E2B",
    },
  ],
  SQUAD: [
    {
      slot: 0,
      name: "Anoa",
      sprite: "anoa",
      gradFrom: "#FF9F1C",
      gradTo: "#C2410C",
      accent: "#FDE68A",
      onAccent: "#3B1502",
    },
    {
      slot: 1,
      name: "Tarsius",
      sprite: "tarsius",
      gradFrom: "#2EC4B6",
      gradTo: "#0F5E63",
      accent: "#A7F3D0",
      onAccent: "#052E2B",
    },
    {
      slot: 2,
      name: "Maleo",
      sprite: "maleo",
      gradFrom: "#8B5CF6",
      gradTo: "#4C1D95",
      accent: "#DDD6FE",
      onAccent: "#2E1065",
    },
    {
      slot: 3,
      name: "Kuskus",
      sprite: "kuskus",
      gradFrom: "#EC4899",
      gradTo: "#831843",
      accent: "#FBCFE8",
      onAccent: "#4C0519",
    },
  ],
};

export const playersFor = (mode: GameMode): PlayerDef[] => PLAYER_SLOTS[mode];

/* --------------------------------------------------------------- bank soal */

const q = (
  id: string,
  subjectId: SubjectId,
  prompt: string,
  options: string[],
  correct: string,
): Q => ({
  id,
  subjectId,
  prompt,
  isArabic: /[\u0600-\u06FF]/.test(prompt),
  options,
  correct,
});

/** Bank bawaan: tiap subjek minimal 8 soal, 4 pilihan, satu jawaban benar. */
export const DEFAULT_BANK: Bank = {
  arab: [
    q("ar1", "arab", "مَا هَذَا؟ (gambar buku)", ["كِتَابٌ", "قَلَمٌ", "مَكْتَبٌ", "كُرْسِيٌّ"], "كِتَابٌ"),
    q("ar2", "arab", "مَا هَذَا؟ (gambar pena)", ["قَلَمٌ", "بَابٌ", "مَسْجِدٌ", "كِتَابٌ"], "قَلَمٌ"),
    q("ar3", "arab", "مَا هَذَا؟ (gambar pintu)", ["بَابٌ", "نَافِذَةٌ", "جِدَارٌ", "سَقْفٌ"], "بَابٌ"),
    q("ar4", "arab", "مَا هَذِهِ؟ (gambar sekolah)", ["مَدْرَسَةٌ", "مَكْتَبَةٌ", "مَسْجِدٌ", "مَزْرَعَةٌ"], "مَدْرَسَةٌ"),
    q("ar5", "arab", "Arti kata بَيْتٌ adalah ...", ["rumah", "pasar", "jalan", "kebun"], "rumah"),
    q("ar6", "arab", "مَا هَذَا؟ (gambar matahari)", ["شَمْسٌ", "قَمَرٌ", "نَجْمٌ", "سَحَابٌ"], "شَمْسٌ"),
    q("ar7", "arab", "Arti kata مَاءٌ adalah ...", ["air", "susu", "madu", "roti"], "air"),
    q("ar8", "arab", "مَا هَذَا؟ (gambar ikan)", ["سَمَكٌ", "طَيْرٌ", "قِطٌّ", "كَلْبٌ"], "سَمَكٌ"),
    q("ar9", "arab", "Lawan kata كَبِيرٌ adalah ...", ["صَغِيرٌ", "طَوِيلٌ", "جَدِيدٌ", "قَصِيرٌ"], "صَغِيرٌ"),
  ],
  inggris: [
    q("en1", "inggris", "Apple", ["Apel", "Jeruk", "Mangga", "Pisang"], "Apel"),
    q("en2", "inggris", "Elephant", ["Gajah", "Harimau", "Singa", "Jerapah"], "Gajah"),
    q("en3", "inggris", "Bird", ["Burung", "Ikan", "Katak", "Ular"], "Burung"),
    q("en4", "inggris", "Teacher", ["Guru", "Dokter", "Petani", "Nelayan"], "Guru"),
    q("en5", "inggris", "Rice", ["Nasi", "Air", "Garam", "Gula"], "Nasi"),
    q("en6", "inggris", "Chair", ["Kursi", "Meja", "Pintu", "Jendela"], "Kursi"),
    q("en7", "inggris", "Blue", ["Biru", "Merah", "Hijau", "Kuning"], "Biru"),
    q("en8", "inggris", "Monday", ["Senin", "Selasa", "Rabu", "Kamis"], "Senin"),
    q("en9", "inggris", "Seven", ["Tujuh", "Delapan", "Sembilan", "Enam"], "Tujuh"),
  ],
  matematika: [
    q("mt1", "matematika", "7 × 8 = ...", ["56", "54", "48", "64"], "56"),
    q("mt2", "matematika", "15 + 27 = ...", ["42", "32", "44", "52"], "42"),
    q("mt3", "matematika", "100 ÷ 4 = ...", ["25", "20", "30", "15"], "25"),
    q("mt4", "matematika", "9 × 6 = ...", ["54", "45", "63", "48"], "54"),
    q("mt5", "matematika", "72 − 38 = ...", ["34", "36", "44", "46"], "34"),
    q("mt6", "matematika", "6 × 7 = ...", ["42", "36", "48", "54"], "42"),
    q("mt7", "matematika", "81 ÷ 9 = ...", ["9", "8", "7", "6"], "9"),
    q("mt8", "matematika", "125 + 75 = ...", ["200", "190", "210", "180"], "200"),
    q("mt9", "matematika", "12 × 12 = ...", ["144", "124", "134", "154"], "144"),
  ],
  biologi: [
    q("bio1", "biologi", "Organel sel yang berfungsi sebagai pusat sintesis protein adalah...", ["Mitokondria", "Ribosom", "Lisosom", "Vakuola"], "Ribosom"),
    q("bio2", "biologi", "Proses fotosintesis berlangsung di bagian sel...", ["Nukleus", "Ribosom", "Kloroplas", "Badan Golgi"], "Kloroplas"),
    q("bio3", "biologi", "Molekul yang membawa informasi genetik adalah...", ["ATP", "Protein", "DNA", "Lipid"], "DNA"),
    q("bio4", "biologi", "Enzim yang memecah amilum menjadi maltosa adalah...", ["Lipase", "Amilase", "Protease", "Katalase"], "Amilase"),
    q("bio5", "biologi", "Hubungan dua organisme yang keduanya untung disebut...", ["Parasitisme", "Komensalisme", "Predasi", "Simbiosis mutualisme"], "Simbiosis mutualisme"),
    q("bio6", "biologi", "Pembelahan sel yang menghasilkan empat sel gamet adalah...", ["Mitosis", "Meiosis", "Amitosis", "Fragmentasi"], "Meiosis"),
    q("bio7", "biologi", "Bagian nefron yang berperan menyaring darah adalah...", ["Tubulus", "Ureter", "Glomerulus", "Vesika urinaria"], "Glomerulus"),
    q("bio8", "biologi", "Fungsi utama klorofil pada tumbuhan adalah...", ["Menyerap cahaya", "Menyerap air", "Mengangkut mineral", "Menyimpan gula"], "Menyerap cahaya"),
  ],
  fisika: [
    q("fis1", "fisika", "Satuan SI dari gaya adalah...", ["Joule", "Newton", "Watt", "Pascal"], "Newton"),
    q("fis2", "fisika", "Energi kinetik benda bermassa 2 kg bergerak 3 m/s adalah...", ["6 J", "12 J", "9 J", "18 J"], "9 J"),
    q("fis3", "fisika", "Besaran yang memiliki nilai dan arah disebut besaran...", ["Skalar", "Vektor", "Pokok", "Turunan"], "Vektor"),
    q("fis4", "fisika", "Hukum Ohm menyatakan hubungan antara...", ["Massa dan percepatan", "Tegangan, arus, hambatan", "Usaha dan waktu", "Kalor dan suhu"], "Tegangan, arus, hambatan"),
    q("fis5", "fisika", "Satuan medan listrik adalah...", ["C/N", "V/m\u00B2", "N/C", "A/m"], "N/C"),
    q("fis6", "fisika", "Cepat rambat gelombang dengan frekuensi 5 Hz dan panjang 2 m adalah...", ["2,5 m/s", "7 m/s", "0,4 m/s", "10 m/s"], "10 m/s"),
    q("fis7", "fisika", "Proses kenaikan suhu gas pada volume tetap disebut...", ["Isobarik", "Isokhorik", "Isotermik", "Adiabatik"], "Isokhorik"),
  ],
};

const cloneBank = (b: Bank): Bank => {
  const out = {} as Bank;
  CONTENT_SUBJECTS.forEach((k) => {
    out[k] = b[k].map((x) => ({ ...x, options: [...x.options] }));
  });
  return out;
};

export const defaultBank = (): Bank => cloneBank(DEFAULT_BANK);

/* ------------------------------------------------------------ penyimpanan */

export const STORE_BANK = "banua-fruit-blast:bank:v1";
export const STORE_SCORES = "banua-fruit-blast:scores:v1";
export const STORE_SETTINGS = "banua-fruit-blast:settings:v1";

const isSubject = (v: unknown): v is SubjectId =>
  v === "arab" || v === "inggris" || v === "matematika" || v === "biologi" || v === "fisika" || v === "guru";

const isQ = (v: unknown): v is Q => {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.id !== "string" || r.id.length === 0) return false;
  if (typeof r.prompt !== "string" || r.prompt.trim().length === 0) return false;
  if (typeof r.correct !== "string" || r.correct.trim().length === 0) return false;
  if (!isSubject(r.subjectId)) return false;
  if (!Array.isArray(r.options)) return false;
  const opts = r.options.filter((o): o is string => typeof o === "string" && o.trim().length > 0);
  if (opts.length !== 4) return false;
  return opts.includes((r.correct as string).trim());
};

/** Terima data apa pun; kalau rusak, kembalikan null agar pemanggil memakai bawaan. */
export function parseBank(raw: string): Bank | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const src = parsed as Record<string, unknown>;
  const out: Bank = { arab: [], inggris: [], matematika: [], biologi: [], fisika: [] };
  CONTENT_SUBJECTS.forEach((key) => {
    const arr = src[key];
    if (!Array.isArray(arr)) return;
    out[key] = arr.filter(isQ).map((item) => ({
      ...item,
      subjectId: key,
      isArabic: /[\u0600-\u06FF]/.test(item.prompt),
      options: item.options.map((o) => o.trim()).filter(Boolean),
      correct: item.correct.trim(),
    }));
  });
  const empty = CONTENT_SUBJECTS.every((k) => out[k].length === 0);
  return empty ? null : out;
}

export function loadBank(): Bank {
  const base = defaultBank();
  if (typeof window === "undefined") return base;
  try {
    const raw = window.localStorage.getItem(STORE_BANK);
    if (!raw) return base;
    const parsed = parseBank(raw);
    if (!parsed) return base;
    CONTENT_SUBJECTS.forEach((k) => {
      if (parsed[k].length > 0) base[k] = parsed[k];
    });
    return base;
  } catch {
    return base;
  }
}

export function saveBank(bank: Bank): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORE_BANK, JSON.stringify(bank));
  } catch {
    /* kuota penuh — abaikan */
  }
}

export function resetBankToDefault(): Bank {
  const fresh = defaultBank();
  saveBank(fresh);
  return fresh;
}

export function makeQuestion(draft: DraftQ): Q {
  const options = draft.options.map((o) => o.trim());
  return {
    id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    subjectId: draft.subjectId,
    prompt: draft.prompt.trim(),
    isArabic: /[\u0600-\u06FF]/.test(draft.prompt),
    options,
    correct: options[draft.correctIndex],
    custom: true,
  };
}

export const emptyDraft = (subject: SubjectId): DraftQ => ({
  subjectId: subject,
  prompt: "",
  options: ["", "", "", ""],
  correctIndex: 0,
});

export function loadSettings(): Settings {
  const fallback: Settings = {
    mode: "DUEL",
    subject: "matematika",
    questionCount: RULES.defaultQuestionCount,
    sound: true,
  };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(STORE_SETTINGS);
    if (!raw) return fallback;
    const p = JSON.parse(raw) as Partial<Settings>;
    return {
      mode: p.mode === "DUEL" || p.mode === "TRIO" || p.mode === "SQUAD" ? p.mode : fallback.mode,
      subject: isSubject(p.subject) ? p.subject : fallback.subject,
      questionCount:
        typeof p.questionCount === "number" && p.questionCount >= 0
          ? p.questionCount
          : fallback.questionCount,
      sound: typeof p.sound === "boolean" ? p.sound : fallback.sound,
    };
  } catch {
    return fallback;
  }
}

export function saveSettings(s: Settings): void {
  if (typeof window === "undefined") return;
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
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    const valid = arr.filter((r): r is ScoreRec => Boolean(r) && typeof (r as ScoreRec).id === "string");
    const kept = valid.slice(0, RULES.maxScoreRecords);
    // pemangkasan ikut ditulis balik supaya penyimpanan tidak menyimpan
    // catatan berlebih dari versi lama / impor manual
    if (kept.length !== valid.length) {
      try {
        window.localStorage.setItem(STORE_SCORES, JSON.stringify(kept));
      } catch {
        /* abaikan */
      }
    }
    return kept;
  } catch {
    return [];
  }
}

export function saveScore(rec: ScoreRec): ScoreRec[] {
  const all = [rec, ...loadScores()].slice(0, RULES.maxScoreRecords);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORE_SCORES, JSON.stringify(all));
    } catch {
      /* abaikan */
    }
  }
  return all;
}

export function clearScores(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORE_SCORES);
  } catch {
    /* abaikan */
  }
}

export function scoresCsv(rows: ScoreRec[]): string {
  const head = "waktu,mode,subjek,alasan,pemenang,detail_skor";
  const body = rows.map((r) => {
    const detail = r.players.map((p) => `${p.name}=${p.score}`).join(" | ");
    return [
      new Date(r.timestamp).toISOString(),
      r.mode,
      r.subject,
      r.reason,
      r.winner,
      detail,
    ]
      .map((cell) => `"${cell.replace(/"/g, '""')}"`)
      .join(",");
  });
  return [head, ...body].join("\n");
}

/* ------------------------------------------------------------------ utils */

/** Fisher-Yates, mengembalikan array baru. */
export function shuffleArr<T>(arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

/** Dek soal satu peserta: diacak ulang tiap sesi. */
export function buildDeck(list: readonly Q[], count: number): Q[] {
  if (list.length === 0) return [];
  const shuffled = shuffleArr(list);
  if (count <= 0 || count >= shuffled.length) return shuffled;
  return shuffled.slice(0, count);
}

export const fmtTime = (s: number): string =>
  `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;

export const pct = (a: number, b: number): number => (b <= 0 ? 0 : Math.round((a / b) * 100));

/** Labuh/tertinggi: nama pemenang; seri ditandai "Seri". */
export function winnerOf(scores: readonly PlayerScore[]): string {
  if (scores.length === 0) return "-";
  const best = Math.max(...scores.map((s) => s.score));
  const top = scores.filter((s) => s.score === best);
  return top.length > 1 ? "Seri" : top[0].name;
}

export const uid = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/* ------------------------------------------------------------ Mapel Guru */

/** Mapel kustom guru: nama bebas + bank sendiri, tersimpan terpisah. */
export interface GuruBank {
  name: string;
  questions: Q[];
}

export const STORE_GURU = "banua-fruit-blast:guru:v1";

export const emptyGuru = (): GuruBank => ({ name: "", questions: [] });

export function loadGuru(): GuruBank {
  if (typeof window === "undefined") return emptyGuru();
  try {
    const raw = window.localStorage.getItem(STORE_GURU);
    if (!raw) return emptyGuru();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return emptyGuru();
    const rec = parsed as Record<string, unknown>;
    const name = typeof rec.name === "string" ? rec.name : "";
    const list = Array.isArray(rec.questions) ? rec.questions : [];
    const questions = list
      .filter(isQ)
      .map((item) => ({ ...item, subjectId: "guru" as SubjectId }));
    return { name, questions };
  } catch {
    return emptyGuru();
  }
}

export function saveGuru(g: GuruBank): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORE_GURU, JSON.stringify(g));
  } catch {
    /* kuota penuh — abaikan */
  }
}

/* ------------------------------------------------- aliran buah per soal */

/** Satu entri antrean spawn: muatan label + isi sembunyi + sprite buah. */
export interface StreamEntry {
  text: string;
  kind: FruitKind;
  optionIndex: number;
  correct: boolean;
  hasBomb: boolean;
  hasGold: boolean;
  sprite: FruitSpriteId;
}

/**
 * Label impostor: kunci jawaban soal-soal LAIN dalam bank yang sama,
 * dibuang yang sama dengan opsi soal berjalan. Guru tidak menulis opsi
 * tambahan; semuanya dicomot otomatis dari bank yang sudah ada.
 */
export function impostorPool(list: readonly Q[], q: Q): string[] {
  const banned = new Set<string>([...q.options, q.correct]);
  const out: string[] = [];
  for (const item of list) {
    if (item.id === q.id) continue;
    if (banned.has(item.correct)) continue;
    if (!out.includes(item.correct)) out.push(item.correct);
  }
  return out;
}

/**
 * Susun antrean buah untuk satu soal: 4 buah membawa 4 jawaban, sisanya
 * (total 6 s.d. 8) impostor. Isi sembunyi ditetapkan di sini: buah benar
 * berpeluang berisi emas, buah salah berpeluang berisi bom. Urutan spawn
 * diacak; Game yang mengatur tempo dan pengembalian muatan jawaban yang
 * lolos tanpa dipotong (soal tidak berhenti sampai terjawab).
 */
export function buildStream(q: Q, list: readonly Q[]): StreamEntry[] {
  const total =
    RULES.streamMin + Math.floor(Math.random() * (RULES.streamMax - RULES.streamMin + 1));
  const sprites = shuffleArr(FRUIT_SPRITE_IDS);
  let si = 0;
  const nextSprite = (): FruitSpriteId => sprites[si++ % sprites.length];

  const entries: StreamEntry[] = q.options.map((text, optionIndex) => {
    const isCorrect = text === q.correct;
    return {
      text,
      kind: "option" as FruitKind,
      optionIndex,
      correct: isCorrect,
      hasBomb: !isCorrect && Math.random() < RULES.bombChance,
      hasGold: isCorrect && Math.random() < RULES.goldChance,
      sprite: nextSprite(),
    };
  });

  const pool = shuffleArr(impostorPool(list, q));
  const wrongs = q.options.filter((o) => o !== q.correct);
  const need = Math.max(0, total - 4);
  for (let i = 0; i < need; i++) {
    // Cadangan bila bank terlalu kecil: gandakan label opsi SALAH yang ada
    // (tidak pernah label benar, supaya buah berlabel benar selalu benar).
    const label = pool.length > 0 ? pool[i % pool.length] : wrongs[i % wrongs.length];
    entries.push({
      text: label,
      kind: "impostor",
      optionIndex: -1,
      correct: false,
      hasBomb: Math.random() < RULES.bombChance,
      hasGold: false,
      sprite: nextSprite(),
    });
  }
  return shuffleArr(entries);
}

/* ------------------------------------------- impor soal Markdown / CSV */

const makeImportedQ = (
  prompt: string,
  options: [string, string, string, string],
  correctIndex: number,
  subjectId: SubjectId,
): Q => ({
  id: `imp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
  subjectId,
  prompt,
  isArabic: /[\u0600-\u06FF]/.test(prompt),
  options,
  correct: options[correctIndex],
  custom: true,
});

/**
 * Impor Markdown (pola yang sama dengan game Basket): baris "Mapel:"
 * opsional, blok "## Soal", pilihan A. s.d. D., baris "Jawaban: X".
 * Blok tidak lengkap dihitung sebagai dilewati.
 */
export function parseMarkdownBank(
  text: string,
  subjectId: SubjectId,
): { name: string; items: Q[]; skipped: number } {
  const bersih = text.replace(/<!--[\s\S]*?-->/g, "");
  interface Blok {
    prompt: string[];
    options: string[];
    correct: number;
  }
  const blocks: Blok[] = [];
  let cur: Blok | null = null;
  let name = "";
  const mulai = (): Blok => {
    const b: Blok = { prompt: [], options: [], correct: -1 };
    blocks.push(b);
    cur = b;
    return b;
  };
  for (const rawLine of bersih.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const mapel = line.match(/^mapel\s*:\s*(.+)$/i);
    if (mapel) {
      name = mapel[1].trim();
      continue;
    }
    const heading = line.match(/^#{1,6}\s*(.*)$/);
    if (heading) {
      const soal = heading[1].match(/^soal\s*\d*\s*[:.]?\s*(.*)$/i);
      if (soal) {
        const b = mulai();
        if (soal[1]) b.prompt.push(soal[1].trim());
      }
      continue;
    }
    if (/^soal\s+\d+\s*$/i.test(line)) {
      mulai();
      continue;
    }
    const blok: Blok = cur ?? mulai();
    const jawab = line.match(/^jawaban\s*:\s*([A-Da-d1-4])\b/i);
    if (jawab) {
      const v = jawab[1].toUpperCase();
      blok.correct = v >= "A" && v <= "D" ? v.charCodeAt(0) - 65 : parseInt(v, 10) - 1;
      continue;
    }
    if (/^penjelasan\s*:/i.test(line)) continue;
    const opsiHuruf = line.match(/^(?:[-*•]\s*)?([A-Da-d])\s*[.)]\s*(.+)$/);
    if (opsiHuruf && blok.options.length < 4) {
      blok.options.push(opsiHuruf[2].trim());
      continue;
    }
    const opsiPolos = line.match(/^[-*•]\s+(.+)$/);
    if (opsiPolos && blok.prompt.length > 0 && blok.options.length < 4) {
      blok.options.push(opsiPolos[1].trim());
      continue;
    }
    blok.prompt.push(line);
  }
  const items: Q[] = [];
  let skipped = 0;
  for (const b of blocks) {
    const prompt = b.prompt.join(" ").trim();
    if (prompt && b.options.length === 4 && b.correct >= 0 && b.correct <= 3) {
      items.push(
        makeImportedQ(
          prompt,
          [b.options[0], b.options[1], b.options[2], b.options[3]],
          b.correct,
          subjectId,
        ),
      );
    } else if (b.prompt.length > 0 || b.options.length > 0) {
      skipped += 1;
    }
  }
  return { name, items, skipped };
}

/**
 * Impor CSV sederhana: satu soal per baris, enam kolom, yaitu
 * soal, pilihan A, pilihan B, pilihan C, pilihan D, jawaban (huruf A-D
 * atau angka 1-4). Pemisah koma atau titik koma.
 */
export function parseCsvBank(
  text: string,
  subjectId: SubjectId,
): { items: Q[]; skipped: number } {
  const items: Q[] = [];
  let skipped = 0;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const cells = line.split(/[;,]/).map((c) => c.trim());
    if (cells.length < 6) {
      skipped += 1;
      continue;
    }
    const [prompt, a, b, c, d, ans] = cells;
    const v = ans.toUpperCase();
    const correct = v >= "A" && v <= "D" ? v.charCodeAt(0) - 65 : parseInt(v, 10) - 1;
    if (!prompt || !a || !b || !c || !d || correct < 0 || correct > 3) {
      skipped += 1;
      continue;
    }
    items.push(makeImportedQ(prompt, [a, b, c, d], correct, subjectId));
  }
  return { items, skipped };
}

export function templateMarkdown(): string {
  return `<!-- ============================================================
TEMPLATE BANK SOAL — Banua Fruit Blast (Magguru Game)
Cara pakai:
1. Baris "Mapel:" khusus untuk Mapel Guru (nama mapel bebas).
2. Satu soal dimulai dengan baris ## Soal.
3. Tulis pertanyaannya, lalu 4 pilihan diawali A. B. C. D.
4. Baris Jawaban: isi huruf jawaban yang benar.
5. Simpan berkas .md ini, lalu impor dari layar Bank Soal game.
============================================================ -->
Mapel: IPA Kelas 5

## Soal
Hewan pemakan tumbuhan disebut...
A. Herbivora
B. Karnivora
C. Omnivora
D. Insektivora
Jawaban: A

## Soal
Fotosintesis terjadi di bagian...
A. Akar
B. Batang
C. Daun
D. Bunga
Jawaban: C
`;
}

/** Prompt siap salin: ditempel ke asisten AI mana pun untuk membuatkan
 *  soal berformat Markdown yang bisa langsung diimpor ke game ini. */
export function promptTemplateSoal(): string {
  return `Kamu adalah pembuat soal untuk permainan potong buah edukasi di kelas.
Buatkan 10 soal pilihan ganda untuk:
- Mapel: [tulis mapelnya, mis. IPA Kelas 5]
- Topik: [tulis topiknya, mis. Fotosintesis]
- Tingkat kesulitan: [mudah / sedang / sulit]

Tulis hasilnya PERSIS dalam format Markdown berikut, tanpa teks pembuka atau penutup:

Mapel: [nama mapel]

## Soal
[Tulis pertanyaannya di sini]
A. [pilihan 1]
B. [pilihan 2]
C. [pilihan 3]
D. [pilihan 4]
Jawaban: [huruf jawaban yang benar]

## Soal
... (lanjutkan pola yang sama untuk soal berikutnya)`;
}
