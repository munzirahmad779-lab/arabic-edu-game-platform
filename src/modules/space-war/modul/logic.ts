/**
 * Perang Antariksa — logika murni (Log 60).
 *
 * Game besar keempat Magguru Game, dibangun ulang dari mesin aksi generik
 * menjadi game ketik-jawaban: asteroid membawa SOAL, pemain MENGETIK
 * jawabannya di keypad besar lajurnya lalu menembak. Mekanik meniru pola
 * yang terbukti di papaninteraktif.com (penelitian 29 Okt 2026), dibungkus
 * gaya khas Magguru: mapel bawaan + Mapel Guru + impor Markdown/CSV,
 * maskot Sulawesi bergilir, musik hijaz, skor lokal.
 *
 * Dua jenis soal (Log 61): "angka" dijawab dengan mengetik di keypad,
 * "teks" (soal biasa) dijawab dengan menembak salah satu tombol pilihan.
 */

export type SpriteId = "anoa" | "tarsius" | "maleo" | "kuskus";
export type SubjectId = "matematika" | "numerasi" | "arab" | "kosakata" | "guru";
export type ModeId = "SOLO" | "DUEL" | "TRIO" | "QUAD";

/** angka = jawaban diketik di keypad; teks = jawaban dipilih dari opsi */
export type QKind = "angka" | "teks";

export interface NQ {
  id: string;
  subjectId: SubjectId;
  prompt: string;
  kind: QKind;
  /** jawaban benar untuk kind "angka": bilangan bulat >= 0 */
  answer: number;
  /** pilihan jawaban untuk kind "teks" */
  options: string[];
  /** teks opsi yang benar untuk kind "teks" */
  correct: string;
  isArabic: boolean;
  custom?: boolean;
}

export const RULES = {
  durationSec: 180,
  scoreCorrect: 10,
  scoreCrash: -5,
  /** asteroid melaju: tingginya arena ditempuh dalam sekian detik (awal) */
  crossSecStart: 16,
  /** ... dan memendek sampai sekian detik di akhir ronde */
  crossSecEnd: 9,
  maxAsteroidsPerLane: 2,
  spawnGapMs: 1500,
  maxInputDigits: 6,
} as const;

export const MODES: { id: ModeId; players: number; label: string; desc: string }[] = [
  { id: "SOLO", players: 1, label: "SOLO", desc: "1 pemain, latihan sendiri" },
  { id: "DUEL", players: 2, label: "DUEL", desc: "2 pemain, satu layar" },
  { id: "TRIO", players: 3, label: "TRIO", desc: "3 pemain, satu layar" },
  { id: "QUAD", players: 4, label: "QUAD", desc: "4 pemain, satu layar" },
];

export interface LaneDef {
  slot: number;
  sprite: SpriteId;
  name: string;
  accent: string;
  gradFrom: string;
  gradTo: string;
  ship: string;
}

export const LANE_DEFS: LaneDef[] = [
  { slot: 0, sprite: "anoa", name: "Anoa", accent: "#FDBA74", gradFrom: "#F97316", gradTo: "#C2410C", ship: "#F97316" },
  { slot: 1, sprite: "tarsius", name: "Tarsius", accent: "#5EEAD4", gradFrom: "#14B8A6", gradTo: "#0F766E", ship: "#14B8A6" },
  { slot: 2, sprite: "maleo", name: "Maleo", accent: "#C4B5FD", gradFrom: "#8B5CF6", gradTo: "#6D28D9", ship: "#8B5CF6" },
  { slot: 3, sprite: "kuskus", name: "Kuskus", accent: "#F9A8D4", gradFrom: "#EC4899", gradTo: "#BE185D", ship: "#EC4899" },
];

/* ------------------------------------------------------------ bank soal */

const q = (id: string, subjectId: SubjectId, prompt: string, answer: number, isArabic = false): NQ => ({
  id, subjectId, prompt, kind: "angka", answer, options: [], correct: "", isArabic,
});

const tq = (id: string, subjectId: SubjectId, prompt: string, options: string[], correct: string, isArabic = false): NQ => ({
  id, subjectId, prompt, kind: "teks", answer: 0, options, correct, isArabic,
});

export const BUILTIN_BANKS: Record<Exclude<SubjectId, "guru" | "numerasi">, NQ[]> = {
  matematika: [
    q("mt1", "matematika", "Ibu membeli 3 kantong permen. Tiap kantong berisi 6 permen. Berapa permen semuanya?", 18),
    q("mt2", "matematika", "Sebuah kelas berisi 28 siswa. Datang lagi 7 siswa. Berapa siswa sekarang?", 35),
    q("mt3", "matematika", "Pak Guru punya 56 pensil dibagikan sama rata ke 8 anak. Tiap anak dapat berapa pensil?", 7),
    q("mt4", "matematika", "Harga 1 buku Rp4.000. Berapa harga 5 buku dalam ribuan rupiah?", 20),
    q("mt5", "matematika", "Di halaman ada 9 baris kursi, tiap baris 9 kursi. Berapa semua kursi?", 81),
    q("mt6", "matematika", "Umur Ayah 36 tahun, umur Ibu 4 tahun lebih muda. Berapa umur Ibu?", 32),
    q("mt7", "matematika", "Sebuah bus memuat 45 penumpang. Turun 18 orang. Berapa penumpang yang tersisa?", 27),
    q("mt8", "matematika", "Rani menabung Rp5.000 tiap hari selama 12 hari. Berapa ribu rupiah tabungannya?", 60),
    q("mt9", "matematika", "Keliling persegi yang sisinya 13 cm adalah ... cm.", 52),
    q("mt10", "matematika", "Ada 7 kotak, tiap kotak 11 kelereng. Berapa kelereng seluruhnya?", 77),
    q("mt11", "matematika", "Satu minggu ada 7 hari. Berapa hari dalam 9 minggu?", 63),
    q("mt12", "matematika", "Toko menjual 144 telur dalam 12 hari sama rata. Berapa telur terjual tiap hari?", 12),
  ],
  arab: [
    q("ar1", "arab", "٥ + ٤ = ?", 9, true),
    q("ar2", "arab", "١٢ − ٥ = ?", 7, true),
    q("ar3", "arab", "٣ × ٤ = ?", 12, true),
    q("ar4", "arab", "ما العدد الذي بعد ٩؟", 10, true),
    q("ar5", "arab", "٢٠ ÷ ٥ = ?", 4, true),
    q("ar6", "arab", "٦ + ٧ = ?", 13, true),
    q("ar7", "arab", "١٥ − ٨ = ?", 7, true),
    q("ar8", "arab", "٨ × ٢ = ?", 16, true),
    q("ar9", "arab", "٩ + ٩ = ?", 18, true),
    q("ar10", "arab", "٣٠ ÷ ٣ = ?", 10, true),
    q("ar11", "arab", "٤ × ٥ = ?", 20, true),
    q("ar12", "arab", "١٧ − ٩ = ?", 8, true),
  ],
  kosakata: [
    tq("kk1", "kosakata", "(نَجْمٌ) artinya ...", ["Bintang", "Bulan", "Matahari", "Langit"], "Bintang"),
    tq("kk2", "kosakata", "(قَمَرٌ) artinya ...", ["Bumi", "Bulan", "Matahari", "Awan"], "Bulan"),
    tq("kk3", "kosakata", "(أَرْضٌ) artinya ...", ["Langit", "Laut", "Bumi", "Udara"], "Bumi"),
    tq("kk4", "kosakata", "(شَمْسٌ) artinya ...", ["Matahari", "Bintang", "Roket", "Orbit"], "Matahari"),
    tq("kk5", "kosakata", "(طَائِرَةٌ) artinya ...", ["Kapal", "Pesawat", "Mobil", "Sepeda"], "Pesawat"),
    tq("kk6", "kosakata", "(فَضَاءٌ) artinya ...", ["Ruang angkasa", "Kamar", "Lautan", "Gurun"], "Ruang angkasa"),
    tq("kk7", "kosakata", "(رَاكِبُ الفَضَاءِ) artinya ...", ["Pilot", "Astronot", "Pelaut", "Penjelajah"], "Astronot"),
    tq("kk8", "kosakata", "(كَوْكَبٌ) artinya ...", ["Planet", "Komet", "Meteor", "Galaksi"], "Planet"),
    tq("kk9", "kosakata", "(قَمَرُ صِنَاعِيٌّ) artinya ...", ["Teleskop", "Satelit", "Roket", "Radar"], "Satelit"),
    tq("kk10", "kosakata", "(مِرْآةٌ فَلَكِيَّةٌ) artinya ...", ["Binokular", "Teleskop", "Mikroskop", "Periskop"], "Teleskop"),
  ],
};

export const SUBJECTS: { id: SubjectId; label: string; desc: string }[] = [
  { id: "matematika", label: "Matematika", desc: "Soal cerita berjawaban angka" },
  { id: "numerasi", label: "Numerasi Cepat", desc: "Hitungan dibuat otomatis, tanpa habis" },
  { id: "arab", label: "Angka Arab", desc: "Hitungan dengan angka Arab ٠١٢٣" },
  { id: "kosakata", label: "Kosakata Arab", desc: "Soal biasa: pilih arti kata yang benar" },
  { id: "guru", label: "Mapel Guru", desc: "Soal buatan gurumu: angka atau pilihan" },
];

export const hasArabic = (s: string): boolean => /[\u0600-\u06FF]/.test(s);

/* ------------------------------------------------- numerasi (dibuatkan) */

const rand = (min: number, max: number): number => min + Math.floor(Math.random() * (max - min + 1));

let genCounter = 0;

/** Soal hitungan yang dibuat otomatis; tingkat naik mengikuti waktu ronde. */
export function genNumerasi(elapsedSec: number): NQ {
  genCounter += 1;
  const id = `gen${genCounter}`;
  const tier = elapsedSec < 45 ? 0 : elapsedSec < 105 ? 1 : 2;
  const pick = Math.random();
  if (tier === 0) {
    if (pick < 0.55) { const a = rand(3, 30), b = rand(2, 25); return q(id, "numerasi", `${a} + ${b} = ?`, a + b); }
    const a = rand(9, 40), b = rand(2, a - 1); return q(id, "numerasi", `${a} − ${b} = ?`, a - b);
  }
  if (tier === 1) {
    if (pick < 0.35) { const a = rand(15, 99), b = rand(11, 89); return q(id, "numerasi", `${a} + ${b} = ?`, a + b); }
    if (pick < 0.65) { const a = rand(25, 120), b = rand(9, a - 5); return q(id, "numerasi", `${a} − ${b} = ?`, a - b); }
    const a = rand(2, 9), b = rand(2, 9); return q(id, "numerasi", `${a} × ${b} = ?`, a * b);
  }
  if (pick < 0.4) { const a = rand(3, 12), b = rand(3, 12); return q(id, "numerasi", `${a} × ${b} = ?`, a * b); }
  if (pick < 0.7) { const b = rand(3, 12), hasil = rand(3, 12); return q(id, "numerasi", `${b * hasil} ÷ ${b} = ?`, hasil); }
  const a = rand(6, 15), b = rand(4, 12), c = rand(2, 20); return q(id, "numerasi", `${a} × ${b} + ${c} = ?`, a * b + c);
}

/* ------------------------------------------------------------- antrean */

export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Pembuat antrean soal satu lajur; bank kecil berputar terus tanpa mengulang soal yang sama berurutan. */
export function makeQueue(bank: readonly NQ[]): () => NQ | null {
  let pool: NQ[] = shuffle(bank);
  let lastId: string | null = null;
  return () => {
    if (bank.length === 0) return null;
    if (pool.length === 0) {
      pool = shuffle(bank);
      if (pool.length > 1 && pool[0].id === lastId) pool.push(pool.shift() as NQ);
    }
    const next = pool.shift() as NQ;
    lastId = next.id;
    return next;
  };
}

/* --------------------------------------------------------- penyimpanan */

export const STORE_BANK = "space-war:bank:v1";
export const STORE_GURU = "space-war:guru:v1";
export const STORE_SCORES = "space-war:scores:v1";
export const STORE_SETTINGS = "space-war:settings:v1";

export type BankOverrides = Partial<Record<Exclude<SubjectId, "guru" | "numerasi">, NQ[]>>;

function isNQ(v: unknown): v is NQ {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return typeof r.id === "string" && typeof r.prompt === "string";
}

function sanitize(list: unknown, subjectId: SubjectId): NQ[] {
  if (!Array.isArray(list)) return [];
  return list.filter(isNQ).map((item) => {
    const options = Array.isArray(item.options)
      ? item.options.filter((o): o is string => typeof o === "string" && o.trim().length > 0).slice(0, 6)
      : [];
    const kind: QKind = item.kind === "teks" || options.length >= 2 ? "teks" : "angka";
    return {
      ...item,
      subjectId,
      kind,
      answer: typeof item.answer === "number" && Number.isFinite(item.answer) ? Math.max(0, Math.round(item.answer)) : 0,
      options: kind === "teks" ? options : [],
      correct: kind === "teks" ? (typeof item.correct === "string" ? item.correct : options[0] ?? "") : "",
      isArabic: typeof item.isArabic === "boolean" ? item.isArabic : hasArabic(item.prompt),
    };
  }).filter((item) => item.kind === "angka" || (item.options.length >= 2 && item.options.includes(item.correct)));
}

export function loadBankOverrides(): BankOverrides {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORE_BANK);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const rec = parsed as Record<string, unknown>;
    const out: BankOverrides = {};
    (["matematika", "arab", "kosakata"] as const).forEach((k) => {
      if (Array.isArray(rec[k])) out[k] = sanitize(rec[k], k);
    });
    return out;
  } catch { return {}; }
}

export function saveBankOverrides(b: BankOverrides): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(STORE_BANK, JSON.stringify(b)); } catch { /* kuota penuh */ }
}

/** Bank efektif: override guru dipakai bila tidak kosong, selain itu bawaan. */
export function effectiveBank(subject: Exclude<SubjectId, "guru" | "numerasi">, overrides: BankOverrides): NQ[] {
  const o = overrides[subject];
  return o && o.length > 0 ? o : BUILTIN_BANKS[subject];
}

export interface GuruBank { name: string; questions: NQ[] }
export const emptyGuru = (): GuruBank => ({ name: "", questions: [] });

export function loadGuru(): GuruBank {
  if (typeof window === "undefined") return emptyGuru();
  try {
    const raw = window.localStorage.getItem(STORE_GURU);
    if (!raw) return emptyGuru();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return emptyGuru();
    const rec = parsed as Record<string, unknown>;
    return {
      name: typeof rec.name === "string" ? rec.name : "",
      questions: sanitize(rec.questions, "guru"),
    };
  } catch { return emptyGuru(); }
}

export function saveGuru(g: GuruBank): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(STORE_GURU, JSON.stringify(g)); } catch { /* kuota penuh */ }
}

export interface ScoreEntry {
  date: string;
  subjectLabel: string;
  mode: ModeId;
  results: { name: string; score: number }[];
}

export function loadScores(): ScoreEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORE_SCORES);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ScoreEntry[]) : [];
  } catch { return []; }
}

export function saveScore(entry: ScoreEntry): void {
  const all = [entry, ...loadScores()].slice(0, 50);
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(STORE_SCORES, JSON.stringify(all)); } catch { /* kuota penuh */ }
}

export interface Settings { mode: ModeId; subject: SubjectId; sound: boolean }
export const defaultSettings = (): Settings => ({ mode: "DUEL", subject: "matematika", sound: true });

export function loadSettings(): Settings {
  if (typeof window === "undefined") return defaultSettings();
  try {
    const raw = window.localStorage.getItem(STORE_SETTINGS);
    if (!raw) return defaultSettings();
    const rec = JSON.parse(raw) as Partial<Settings>;
    const mode = MODES.some((m) => m.id === rec.mode) ? (rec.mode as ModeId) : "DUEL";
    const subject: SubjectId = rec.subject === "numerasi" || rec.subject === "arab" || rec.subject === "kosakata" || rec.subject === "guru" ? rec.subject : "matematika";
    return { mode, subject, sound: rec.sound !== false };
  } catch { return defaultSettings(); }
}

export function saveSettings(s: Settings): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(STORE_SETTINGS, JSON.stringify(s)); } catch { /* kuota penuh */ }
}

export const uid = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/* ------------------------------------------------------------ impor soal */

/**
 * Format Markdown bank soal (dua jenis, boleh dicampur dalam satu berkas):
 *   Mapel: Nama Mapel (opsional, baris pertama)
 *   ## Soal                      <- soal ANGKA
 *   <pertanyaan>
 *   Jawaban: 14
 *   ## Soal                      <- soal TEKS (pilihan)
 *   <pertanyaan>
 *   A. <pilihan>  B. <pilihan>  C. <pilihan>  D. <pilihan>   (satu per baris)
 *   Jawaban: B                   (huruf, atau teks pilihannya persis)
 */
export function parseMarkdownBank(text: string): { name: string; questions: NQ[] } {
  const lines = text.split(/\r?\n/);
  let name = "";
  const questions: NQ[] = [];
  let cur: string[] = [];
  let options: string[] = [];
  let jawaban: string | null = null;
  const flush = () => {
    const prompt = cur.join(" ").trim();
    if (prompt && jawaban !== null) {
      if (options.length >= 2) {
        let correct = "";
        const jm = jawaban.trim();
        const letterIdx = "ABCDEF".indexOf(jm.toUpperCase());
        if (jm.length === 1 && letterIdx >= 0 && letterIdx < options.length) correct = options[letterIdx];
        else if (options.includes(jm)) correct = jm;
        else if (/^\d+$/.test(jm) && options[parseInt(jm, 10) - 1]) correct = options[parseInt(jm, 10) - 1];
        if (correct) {
          questions.push({ id: uid(), subjectId: "guru", prompt, kind: "teks", answer: 0, options, correct, isArabic: hasArabic(prompt), custom: true });
        }
      } else if (/^-?\d+$/.test(jawaban.trim())) {
        questions.push({ id: uid(), subjectId: "guru", prompt, kind: "angka", answer: Math.max(0, parseInt(jawaban.trim(), 10)), options: [], correct: "", isArabic: hasArabic(prompt), custom: true });
      }
    }
    cur = []; options = []; jawaban = null;
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (/^mapel\s*:/i.test(line) && !name) { name = line.replace(/^mapel\s*:/i, "").trim(); continue; }
    if (/^##\s*soal/i.test(line)) { flush(); continue; }
    const jm = line.match(/^jawaban\s*:\s*(.+)$/i);
    if (jm) { jawaban = jm[1].trim(); continue; }
    const om = line.match(/^[-*]?\s*([A-F])[.)]\s*(.+)$/);
    if (om) { options.push(om[2].trim()); continue; }
    if (line) cur.push(line);
  }
  flush();
  return { name, questions };
}

/**
 * Format CSV, dua bentuk baris:
 *   angka: pertanyaan,jawaban            (2 kolom)
 *   teks : pertanyaan,A,B,C,D,jawaban    (6 kolom; jawaban = huruf A-D atau teks pilihan)
 */
export function parseCsvBank(text: string): NQ[] {
  const out: NQ[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const fields = line.split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
    if (fields.length >= 6) {
      const [prompt, ...rest] = fields;
      const kunci = rest[rest.length - 1];
      const options = rest.slice(0, -1).filter((s) => s.length > 0);
      let correct = "";
      const letterIdx = "ABCDEF".indexOf(kunci.toUpperCase());
      if (kunci.length === 1 && letterIdx >= 0 && letterIdx < options.length) correct = options[letterIdx];
      else if (options.includes(kunci)) correct = kunci;
      else if (/^\d+$/.test(kunci) && options[parseInt(kunci, 10) - 1]) correct = options[parseInt(kunci, 10) - 1];
      if (prompt && options.length >= 2 && correct) {
        out.push({ id: uid(), subjectId: "guru", prompt, kind: "teks", answer: 0, options, correct, isArabic: hasArabic(prompt), custom: true });
      }
      continue;
    }
    const idx = line.lastIndexOf(",");
    if (idx < 1) continue;
    const prompt = line.slice(0, idx).trim().replace(/^"|"$/g, "");
    const ans = parseInt(line.slice(idx + 1).trim(), 10);
    if (!prompt || Number.isNaN(ans) || /^soal$/i.test(prompt)) continue;
    out.push({ id: uid(), subjectId: "guru", prompt, kind: "angka", answer: Math.max(0, ans), options: [], correct: "", isArabic: hasArabic(prompt), custom: true });
  }
  return out;
}

export function templateMarkdown(subjectLabel: string): string {
  return [
    `Mapel: ${subjectLabel}`,
    "",
    "## Soal",
    "Ibu membeli 4 kantong kelereng. Tiap kantong berisi 8 kelereng. Berapa kelereng semuanya?",
    "Jawaban: 32",
    "",
    "## Soal",
    "Hewan yang mengeong dan suka menangkap tikus adalah ...",
    "A. Anjing",
    "B. Kucing",
    "C. Ayam",
    "D. Bebek",
    "Jawaban: B",
    "",
  ].join("\n");
}

export function promptTemplateSoal(): string {
  return [
    "Kamu adalah guru. Buatkan bank soal untuk game Perang Antariksa (Magguru Game).",
    "Ada DUA jenis soal, boleh dicampur:",
    "1) Soal ANGKA: pertanyaan yang jawabannya satu bilangan bulat. Akhiri dengan baris: Jawaban: <angka>",
    "2) Soal TEKS (soal biasa): pertanyaan dengan 4 pilihan berlabel A. B. C. D. (satu pilihan per baris). Akhiri dengan baris: Jawaban: <huruf pilihan yang benar>",
    "Aturan format (wajib persis):",
    "- Baris pertama: Mapel: <nama mapel>",
    "- Tiap soal diawali baris: ## Soal",
    "- Buat 10 soal, bahasa yang jelas untuk anak SD kelas 4-6.",
    "Contoh:",
    templateMarkdown("Campuran"),
  ].join("\n");
}
