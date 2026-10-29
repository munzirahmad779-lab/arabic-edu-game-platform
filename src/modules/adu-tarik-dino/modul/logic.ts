/** Aturan, data soal, papan skor, penyimpanan lokal, editor bank soal. */

export type SubjectId = "arab" | "matematika" | "biologi" | "fisika" | "lms";
export type GameMode = "DUEL" | "SQUAD";

export interface Q {
  id: string;
  subjectId: SubjectId;
  prompt: string;
  isArabic?: boolean;
  options: string[];
  correct: string;
  custom?: boolean;
}

export const SUBJECTS: { id: SubjectId; title: string; icon: string }[] = [
  { id: "arab", title: "Bahasa Arab", icon: "📖" },
  { id: "matematika", title: "Matematika SMA", icon: "📐" },
  { id: "biologi", title: "Biologi SMA", icon: "🧬" },
  { id: "fisika", title: "Fisika SMA", icon: "⚡" },
  { id: "lms", title: "Bank Soal LMS", icon: "🏦" },
];

const q = (
  id: string,
  subjectId: SubjectId,
  prompt: string,
  options: string[],
  correct: string,
): Q => ({ id, subjectId, prompt, isArabic: /[\u0600-\u06FF]/.test(prompt), options, correct });

export const BANK_SOAL: Record<SubjectId, Q[]> = {
  lms: [],
  arab: [
    q("ar1", "arab", "Kedudukan kata كُتَابُْ dalam kalimat كُتَابُْ مُفِيْدٌ adalah...", ["Mubtada'", "Khabar", "Fa'il", "Maf'ul Bih"], "Mubtada'"),
    q("ar2", "arab", "Lawan makna dari kata كَبِيْرٌ adalah...", ["صَغِيْرٌ", "طَوِيْلٌ", "قَصِيْرٌ", "جَدِيْدٌ"], "صَغِيْرٌ"),
    q("ar3", "arab", "Bentuk jamak taksir dari kata طَالِبٌ adalah...", ["طُلَّابٌ", "طَالِبَاتٌ", "طَالِبُوْنَ", "طَلَبَةٌ"], "طُلَّابٌ"),
    q("ar4", "arab", "Tanda i'rab rofa' asli untuk isim mufrad adalah...", ["Dhammah", "Fathah", "Kasrah", "Sukun"], "Dhammah"),
    q("ar5", "arab", "Fi'il madhi dari كَتَبَ jika diubah ke fi'il mudhari' menjadi...", ["يَكْتُبُ", "يَكْتَبُ", "كَاتِبٌ", "مَكْتُوْبٌ"], "يَكْتُبُ"),
    q("ar6", "arab", "Huruf jar yang bermakna 'di dalam' adalah...", ["فِيْ", "مِنْ", "إِلَى", "عَلَى"], "فِيْ"),
    q("ar7", "arab", "Kata الرَّجُلُ adalah isim...", ["Mudzakkar", "Muannats", "Jamak", "Mashdar"], "Mudzakkar"),
    q("ar8", "arab", "Kalimat 'ذَهَبَ أَحْمَدُ إِلَى الْمَدْرَسَةِ' memiliki mubtada' berupa...", ["أَحْمَدُ", "ذَهَبَ", "الْمَدْرَسَةِ", "إِلَى"], "أَحْمَدُ"),
    q("ar9", "arab", "Isim yang menunjukkan tempat dinamakan...", ["Isim makan", "Isim zaman", "Isim alat", "Isim fa'il"], "Isim makan"),
  ],
  matematika: [
    q("mat1", "matematika", "Turunan pertama dari f(x) = 3x² + 4x − 5 adalah...", ["6x + 4", "3x + 4", "6x − 5", "6x² + 4"], "6x + 4"),
    q("mat2", "matematika", "Nilai dari sin 30° + cos 60° adalah...", ["1", "1/2", "0", "√3"], "1"),
    q("mat3", "matematika", "Determinan matriks [[2, 3], [1, 4]] adalah...", ["5", "8", "11", "2"], "5"),
    q("mat4", "matematika", "Nilai lim x→2 (x² − 4)/(x − 2) adalah...", ["4", "0", "2", "tidak ada"], "4"),
    q("mat5", "matematika", "∫ 2x dx sama dengan...", ["x² + C", "2x² + C", "x + C", "2 + C"], "x² + C"),
    q("mat6", "matematika", "Jika log₂ 8 = x, maka x adalah...", ["3", "2", "4", "8"], "3"),
    q("mat7", "matematika", "Suku ke-5 barisan aritmetika 3, 7, 11, ... adalah...", ["19", "15", "23", "20"], "19"),
    q("mat8", "matematika", "Peluang muncul angka genap pada satu dadu adalah...", ["1/2", "1/3", "1/6", "2/3"], "1/2"),
  ],
  biologi: [
    q("bio1", "biologi", "Organel sel yang berfungsi sebagai pusat sintesis protein adalah...", ["Ribosom", "Mitokondria", "Lisosom", "Vakuola"], "Ribosom"),
    q("bio2", "biologi", "Proses fotosintesis berlangsung di bagian sel...", ["Kloroplas", "Nukleus", "Ribosom", "Badan Golgi"], "Kloroplas"),
    q("bio3", "biologi", "Molekul yang membawa informasi genetik adalah...", ["DNA", "ATP", "Protein", "Lipid"], "DNA"),
    q("bio4", "biologi", "Enzim yang memecah amilum menjadi maltosa adalah...", ["Amilase", "Lipase", "Protease", "Katalase"], "Amilase"),
    q("bio5", "biologi", "Hubungan dua organisme yang keduanya untung disebut...", ["Simbiosis mutualisme", "Parasitisme", "Komensalisme", "Predasi"], "Simbiosis mutualisme"),
    q("bio6", "biologi", "Pembelahan sel yang menghasilkan empat sel gamet adalah...", ["Meiosis", "Mitosis", "Amitosis", "Fragmenasi"], "Meiosis"),
    q("bio7", "biologi", "Bagian nefron yang berperan menyaring darah adalah...", ["Glomerulus", "Tubulus", "Ureter", "Vesika"], "Glomerulus"),
    q("bio8", "biologi", "Fungsi utama klorofil pada tumbuhan adalah...", ["Menyerap cahaya", "Menyerap air", "Mengangkut mineral", "Menyimpan gula"], "Menyerap cahaya"),
  ],
  fisika: [
    q("fis1", "fisika", "Satuan SI dari gaya adalah...", ["Newton", "Joule", "Watt", "Pascal"], "Newton"),
    q("fis2", "fisika", "Energi kinetik benda bermassa 2 kg bergerak 3 m/s adalah...", ["9 J", "6 J", "12 J", "18 J"], "9 J"),
    q("fis3", "fisika", "Besaran yang memiliki nilai dan arah disebut besaran...", ["Vektor", "Skalar", "Pokok", "Turunan"], "Vektor"),
    q("fis4", "fisika", "Hukum Ohm menyatakan hubungan antara...", ["Tegangan, arus, hambatan", "Massa, percepatan", "Usaha, waktu", "Kalor, suhu"], "Tegangan, arus, hambatan"),
    q("fis5", "fisika", "Satuan medan listrik adalah...", ["N/C", "C/N", "V/m²", "A/m"], "N/C"),
    q("fis6", "fisika", "Cepat rambat gelombang dengan frekuensi 5 Hz dan panjang 2 m adalah...", ["10 m/s", "2,5 m/s", "7 m/s", "0,4 m/s"], "10 m/s"),
    q("fis7", "fisika", "Proses kenaikan suhu gas pada volume tetap disebut...", ["Isobarik", "Isokhorik", "Isotermik", "Adiabatik"], "Isokhorik"),
  ],
};

export const RULES = {
  durationSec: 180,
  winLimit: 85,
  scorePerCorrect: 10,
  maxOffset: 100,
  /**
   * Angka kekuatan ala defn: pil "KEKUATAN n" melayang di atas maskot utama.
   * Tarikan per jawaban benar = pullBase + kekuatan * pullPerPower, jadi tim
   * yang kekuatannya tumbuh menarik tali makin jauh.
   */
  powerStart: 3,
  powerMin: 1,
  powerMax: 10,
  /** Jawaban benar cepat (<= fastAnswerSec sejak soal tampil): kekuatan +2. */
  powerFastBonus: 2,
  /** Jawaban benar biasa: kekuatan +1. */
  powerNormalGain: 1,
  /** Tidak menjawab sampai waktu soal habis: kekuatan -1 dan soal berganti. */
  powerTimeoutPenalty: 1,
  fastAnswerSec: 5,
  questionTimeSec: 12,
  pullBase: 12,
  pullPerPower: 4,
};

export const fmtTimer = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** ---------------- papan skor ---------------- */

export interface Rec {
  id: string;
  winnerName: string;
  mode: GameMode;
  subject: string;
  score: number;
  timestamp: number;
}

const STORE_SCORES = "adu-tarik-dino:scores:v1";
const STORE_BANK = "adu-tarik-dino:bank:v1";
const STORE_SET = "adu-tarik-dino:settings:v1";

export const ls = (): Rec[] => {
  try {
    const raw = localStorage.getItem(STORE_SCORES);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? (arr as Rec[]) : [];
  } catch {
    return [];
  }
};

export const saveScore = (rec: Rec) => {
  try {
    const all = [rec, ...ls()].slice(0, 50);
    localStorage.setItem(STORE_SCORES, JSON.stringify(all));
  } catch {
    /* penyimpanan penuh */
  }
};

export const clearScores = () => {
  try {
    localStorage.removeItem(STORE_SCORES);
  } catch {
    /* abaikan */
  }
};

export const csv = (records: Rec[]) =>
  ["Winner,Mode,Subject,Score,Timestamp"]
    .concat(records.map((r) => [r.winnerName, r.mode, r.subject, r.score, new Date(r.timestamp).toISOString()].join(",")))
    .join("\n");

/** ---------------- bank soal (khusus game ini) ---------------- */

export type Bank = Record<SubjectId, Q[]>;

export const defaultBank = (): Bank => ({
  arab: [...BANK_SOAL.arab],
  matematika: [...BANK_SOAL.matematika],
  biologi: [...BANK_SOAL.biologi],
  fisika: [...BANK_SOAL.fisika],
  lms: [...BANK_SOAL.lms],
});

export const loadBank = (): Bank => {
  const base = defaultBank();
  try {
    const raw = localStorage.getItem(STORE_BANK);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<Bank>;
    (Object.keys(base) as SubjectId[]).forEach((k) => {
      const arr = parsed[k];
      if (Array.isArray(arr)) base[k] = arr.filter((x) => x && typeof x.prompt === "string" && Array.isArray(x.options));
    });
    (Object.keys(base) as SubjectId[]).forEach((k) => {
      if (base[k].length === 0) base[k] = defaultBank()[k];
    });
    return base;
  } catch {
    return base;
  }
};

export const saveBank = (bank: Bank) => {
  try {
    localStorage.setItem(STORE_BANK, JSON.stringify(bank));
  } catch {
    /* abaikan */
  }
};

export const resetBank = (bank: Bank, subject?: SubjectId): Bank => {
  const fresh = defaultBank();
  if (!subject) return fresh;
  return { ...bank, [subject]: fresh[subject] };
};

export const makeQuestion = (subject: SubjectId, prompt: string, options: string[], correct: string): Q => ({
  id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  subjectId: subject,
  prompt: prompt.trim(),
  isArabic: /[\u0600-\u06FF]/.test(prompt),
  options: options.map((o) => o.trim()).filter(Boolean),
  correct: correct.trim(),
  custom: true,
});

/** ---------------- acak ---------------- */

export const shuffleArr = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export interface Settings {
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
}

export const loadSettings = (): Settings => {
  try {
    const raw = localStorage.getItem(STORE_SET);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Settings>;
      return { shuffleQuestions: p.shuffleQuestions !== false, shuffleOptions: p.shuffleOptions !== false };
    }
  } catch {
    /* abaikan */
  }
  return { shuffleQuestions: true, shuffleOptions: true };
};

export const saveSettings = (s: Settings) => {
  try {
    localStorage.setItem(STORE_SET, JSON.stringify(s));
  } catch {
    /* abaikan */
  }
};

/** urutan soal + opsi untuk satu sesi bermain */
export const buildOrders = (bank: Bank, subject: SubjectId, slots: number, playerSlots: number[], s: Settings) => {
  const list = bank[subject] ?? [];
  const orders: number[][] = [];
  playerSlots.forEach(() => {
    const idx = list.map((_, i) => i);
    orders.push(s.shuffleQuestions ? shuffleArr(idx) : idx);
  });
  const options = new Map<string, string[]>();
  list.forEach((item) => {
    options.set(item.id, s.shuffleOptions ? shuffleArr(item.options) : [...item.options]);
  });
  return { orders, options, list, slots };
};
