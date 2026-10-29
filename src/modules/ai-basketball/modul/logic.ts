/**
 * AI BASKETBALL — tipe, aturan poin, bank soal, dan penyimpanan skor.
 * Semua tipe domain hidup di sini; Game.tsx tidak boleh mendefinisikan tipe sendiri.
 *
 * Log 38 — game didesain ulang menjadi DUEL 2 PEMAIN (2 tim) mengikuti
 * rujukan papan interaktif: bank soal & pilihan mata pelajaran diselaraskan
 * dengan game pertama (Adu Tarik): Bahasa Arab, Matematika SMA, Biologi SMA,
 * Fisika SMA — soal yang sama persis, format disesuaikan (correctIndex +
 * penjelasan "Jawaban yang benar: ...").
 */

export type SubjectId = "arab" | "matematika" | "biologi" | "fisika";

export interface Q {
  readonly id: string;
  readonly subject: SubjectId;
  readonly prompt: string;
  readonly options: readonly string[];
  readonly correctIndex: number;
  readonly explanation: string;
}

export const SUBJECTS: { id: SubjectId; title: string; icon: string }[] = [
  { id: "arab", title: "Bahasa Arab", icon: "📖" },
  { id: "matematika", title: "Matematika SMA", icon: "📐" },
  { id: "biologi", title: "Biologi SMA", icon: "🧬" },
  { id: "fisika", title: "Fisika SMA", icon: "⚡" },
];

export const SUBJECT_LABEL: Record<SubjectId, string> = {
  arab: "Bahasa Arab",
  matematika: "Matematika SMA",
  biologi: "Biologi SMA",
  fisika: "Fisika SMA",
};

/** Aturan poin & pertandingan — bukan angka sihir tersebar.
 *  Log 44: poin berasal dari LEMPARAN MANUAL siswa (perintah user):
 *  jawaban benar memberi kesempatan melempar; bola masuk = 2 poin,
 *  meleset = tetap 1 poin karena jawabannya benar. */
export const RULES = {
  questionTime: 20, // detik per soal, per panel
  matchTime: 180, // detik per pertandingan
  targetScore: 10, // capai poin ini = langsung menang
  throwMake: 2, // poin bila lemparan masuk
  throwMiss: 1, // poin bila lemparan meleset (jawaban tetap benar)
  aimTime: 10, // detik untuk melempar sebelum lemparan otomatis
  maxScoreRecords: 50,
} as const;

const ARAB_BANK: readonly Q[] = [
  { id: "ar1", subject: "arab", prompt: "Kedudukan kata كُتَابُْ dalam kalimat كُتَابُْ مُفِيْدٌ adalah...", options: ["Mubtada'", "Khabar", "Fa'il", "Maf'ul Bih"], correctIndex: 0, explanation: "Jawaban yang benar: Mubtada'." },
  { id: "ar2", subject: "arab", prompt: "Lawan makna dari kata كَبِيْرٌ adalah...", options: ["صَغِيْرٌ", "طَوِيْلٌ", "قَصِيْرٌ", "جَدِيْدٌ"], correctIndex: 0, explanation: "Jawaban yang benar: صَغِيْرٌ." },
  { id: "ar3", subject: "arab", prompt: "Bentuk jamak taksir dari kata طَالِبٌ adalah...", options: ["طُلَّابٌ", "طَالِبَاتٌ", "طَالِبُوْنَ", "طَلَبَةٌ"], correctIndex: 0, explanation: "Jawaban yang benar: طُلَّابٌ." },
  { id: "ar4", subject: "arab", prompt: "Tanda i'rab rofa' asli untuk isim mufrad adalah...", options: ["Dhammah", "Fathah", "Kasrah", "Sukun"], correctIndex: 0, explanation: "Jawaban yang benar: Dhammah." },
  { id: "ar5", subject: "arab", prompt: "Fi'il madhi dari كَتَبَ jika diubah ke fi'il mudhari' menjadi...", options: ["يَكْتُبُ", "يَكْتَبُ", "كَاتِبٌ", "مَكْتُوْبٌ"], correctIndex: 0, explanation: "Jawaban yang benar: يَكْتُبُ." },
  { id: "ar6", subject: "arab", prompt: "Huruf jar yang bermakna 'di dalam' adalah...", options: ["فِيْ", "مِنْ", "إِلَى", "عَلَى"], correctIndex: 0, explanation: "Jawaban yang benar: فِيْ." },
  { id: "ar7", subject: "arab", prompt: "Kata الرَّجُلُ adalah isim...", options: ["Mudzakkar", "Muannats", "Jamak", "Mashdar"], correctIndex: 0, explanation: "Jawaban yang benar: Mudzakkar." },
  { id: "ar8", subject: "arab", prompt: "Kalimat 'ذَهَبَ أَحْمَدُ إِلَى الْمَدْرَسَةِ' memiliki mubtada' berupa...", options: ["أَحْمَدُ", "ذَهَبَ", "الْمَدْرَسَةِ", "إِلَى"], correctIndex: 0, explanation: "Jawaban yang benar: أَحْمَدُ." },
  { id: "ar9", subject: "arab", prompt: "Isim yang menunjukkan tempat dinamakan...", options: ["Isim makan", "Isim zaman", "Isim alat", "Isim fa'il"], correctIndex: 0, explanation: "Jawaban yang benar: Isim makan." },
];

const MATH_BANK: readonly Q[] = [
  { id: "mat1", subject: "matematika", prompt: "Turunan pertama dari f(x) = 3x² + 4x − 5 adalah...", options: ["6x + 4", "3x + 4", "6x − 5", "6x² + 4"], correctIndex: 0, explanation: "Jawaban yang benar: 6x + 4." },
  { id: "mat2", subject: "matematika", prompt: "Nilai dari sin 30° + cos 60° adalah...", options: ["1", "1/2", "0", "√3"], correctIndex: 0, explanation: "Jawaban yang benar: 1." },
  { id: "mat3", subject: "matematika", prompt: "Determinan matriks [[2, 3], [1, 4]] adalah...", options: ["5", "8", "11", "2"], correctIndex: 0, explanation: "Jawaban yang benar: 5." },
  { id: "mat4", subject: "matematika", prompt: "Nilai lim x→2 (x² − 4)/(x − 2) adalah...", options: ["4", "0", "2", "tidak ada"], correctIndex: 0, explanation: "Jawaban yang benar: 4." },
  { id: "mat5", subject: "matematika", prompt: "∫ 2x dx sama dengan...", options: ["x² + C", "2x² + C", "x + C", "2 + C"], correctIndex: 0, explanation: "Jawaban yang benar: x² + C." },
  { id: "mat6", subject: "matematika", prompt: "Jika log₂ 8 = x, maka x adalah...", options: ["3", "2", "4", "8"], correctIndex: 0, explanation: "Jawaban yang benar: 3." },
  { id: "mat7", subject: "matematika", prompt: "Suku ke-5 barisan aritmetika 3, 7, 11, ... adalah...", options: ["19", "15", "23", "20"], correctIndex: 0, explanation: "Jawaban yang benar: 19." },
  { id: "mat8", subject: "matematika", prompt: "Peluang muncul angka genap pada satu dadu adalah...", options: ["1/2", "1/3", "1/6", "2/3"], correctIndex: 0, explanation: "Jawaban yang benar: 1/2." },
];

const BIO_BANK: readonly Q[] = [
  { id: "bio1", subject: "biologi", prompt: "Organel sel yang berfungsi sebagai pusat sintesis protein adalah...", options: ["Ribosom", "Mitokondria", "Lisosom", "Vakuola"], correctIndex: 0, explanation: "Jawaban yang benar: Ribosom." },
  { id: "bio2", subject: "biologi", prompt: "Proses fotosintesis berlangsung di bagian sel...", options: ["Kloroplas", "Nukleus", "Ribosom", "Badan Golgi"], correctIndex: 0, explanation: "Jawaban yang benar: Kloroplas." },
  { id: "bio3", subject: "biologi", prompt: "Molekul yang membawa informasi genetik adalah...", options: ["DNA", "ATP", "Protein", "Lipid"], correctIndex: 0, explanation: "Jawaban yang benar: DNA." },
  { id: "bio4", subject: "biologi", prompt: "Enzim yang memecah amilum menjadi maltosa adalah...", options: ["Amilase", "Lipase", "Protease", "Katalase"], correctIndex: 0, explanation: "Jawaban yang benar: Amilase." },
  { id: "bio5", subject: "biologi", prompt: "Hubungan dua organisme yang keduanya untung disebut...", options: ["Simbiosis mutualisme", "Parasitisme", "Komensalisme", "Predasi"], correctIndex: 0, explanation: "Jawaban yang benar: Simbiosis mutualisme." },
  { id: "bio6", subject: "biologi", prompt: "Pembelahan sel yang menghasilkan empat sel gamet adalah...", options: ["Meiosis", "Mitosis", "Amitosis", "Fragmenasi"], correctIndex: 0, explanation: "Jawaban yang benar: Meiosis." },
  { id: "bio7", subject: "biologi", prompt: "Bagian nefron yang berperan menyaring darah adalah...", options: ["Glomerulus", "Tubulus", "Ureter", "Vesika"], correctIndex: 0, explanation: "Jawaban yang benar: Glomerulus." },
  { id: "bio8", subject: "biologi", prompt: "Fungsi utama klorofil pada tumbuhan adalah...", options: ["Menyerap cahaya", "Menyerap air", "Mengangkut mineral", "Menyimpan gula"], correctIndex: 0, explanation: "Jawaban yang benar: Menyerap cahaya." },
];

const FISIKA_BANK: readonly Q[] = [
  { id: "fis1", subject: "fisika", prompt: "Satuan SI dari gaya adalah...", options: ["Newton", "Joule", "Watt", "Pascal"], correctIndex: 0, explanation: "Jawaban yang benar: Newton." },
  { id: "fis2", subject: "fisika", prompt: "Energi kinetik benda bermassa 2 kg bergerak 3 m/s adalah...", options: ["9 J", "6 J", "12 J", "18 J"], correctIndex: 0, explanation: "Jawaban yang benar: 9 J." },
  { id: "fis3", subject: "fisika", prompt: "Besaran yang memiliki nilai dan arah disebut besaran...", options: ["Vektor", "Skalar", "Pokok", "Turunan"], correctIndex: 0, explanation: "Jawaban yang benar: Vektor." },
  { id: "fis4", subject: "fisika", prompt: "Hukum Ohm menyatakan hubungan antara...", options: ["Tegangan, arus, hambatan", "Massa, percepatan", "Usaha, waktu", "Kalor, suhu"], correctIndex: 0, explanation: "Jawaban yang benar: Tegangan, arus, hambatan." },
  { id: "fis5", subject: "fisika", prompt: "Satuan medan listrik adalah...", options: ["N/C", "C/N", "V/m²", "A/m"], correctIndex: 0, explanation: "Jawaban yang benar: N/C." },
  { id: "fis6", subject: "fisika", prompt: "Cepat rambat gelombang dengan frekuensi 5 Hz dan panjang 2 m adalah...", options: ["10 m/s", "2,5 m/s", "7 m/s", "0,4 m/s"], correctIndex: 0, explanation: "Jawaban yang benar: 10 m/s." },
  { id: "fis7", subject: "fisika", prompt: "Proses kenaikan suhu gas pada volume tetap disebut...", options: ["Isobarik", "Isokhorik", "Isotermik", "Adiabatik"], correctIndex: 1, explanation: "Jawaban yang benar: Isokhorik." },
];

export function bankFor(subject: SubjectId): readonly Q[] {
  switch (subject) {
    case "arab": return ARAB_BANK;
    case "matematika": return MATH_BANK;
    case "biologi": return BIO_BANK;
    case "fisika": return FISIKA_BANK;
  }
}

export function shuffle<T>(items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/**
 * Satu dek bank diacak lalu dibagikan bergiliran ke dua tim (pola Log 35
 * game pertama): antrean kedua panel saling lepas, jadi soal yang sama
 * tidak pernah tampil di dua panel pada saat yang sama.
 */
export function dealQueues(list: readonly Q[]): { p1: Q[]; p2: Q[] } {
  const src = list.length > 0 ? list : bankFor("arab");
  const deck = shuffle(src);
  const p1: Q[] = [];
  const p2: Q[] = [];
  deck.forEach((item, i) => (i % 2 === 0 ? p1 : p2).push(item));
  return { p1, p2 };
}

/**
 * Putaran segar untuk satu panel yang antreannya habis: seluruh bank
 * diacak ulang, menyisihkan soal yang sedang tampil di panel lawan dan
 * soal yang baru selesai (bila sisa bank memungkinkan).
 */
export function freshQueue(list: readonly Q[], excludeIds: ReadonlySet<string>): Q[] {
  const pool = list.filter((item) => !excludeIds.has(item.id));
  return shuffle(pool.length >= 2 ? pool : [...list]);
}

/* ================= MAPEL GURU (mapel kustom — Log 45) =================
 * Guru bebas menamai mapelnya sendiri (IPA, IPS, Bahasa Indonesia, ...)
 * dan mengisi bank soalnya. Tersimpan lokal di perangkat ini. */

export interface CustomBank {
  name: string;
  questions: Q[];
}

const CUSTOM_KEY = "ai-basketball:guru:v1";

function isQ(q: unknown): q is Q {
  if (!q || typeof q !== "object") return false;
  const item = q as Partial<Q>;
  return (
    typeof item.prompt === "string" &&
    Array.isArray(item.options) &&
    item.options.length === 4 &&
    typeof item.correctIndex === "number"
  );
}

export function loadCustomBank(): CustomBank {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    if (!raw) return { name: "", questions: [] };
    const parsed = JSON.parse(raw) as Partial<CustomBank>;
    const questions = Array.isArray(parsed.questions) ? parsed.questions.filter(isQ) : [];
    return { name: typeof parsed.name === "string" ? parsed.name : "", questions };
  } catch {
    return { name: "", questions: [] };
  }
}

export function saveCustomBank(bank: CustomBank): void {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(bank));
  } catch {
    /* penyimpanan tidak tersedia — abaikan */
  }
}

let customSeq = 0;
export function makeCustomQ(
  prompt: string,
  options: [string, string, string, string],
  correctIndex: number,
  explanation: string,
  subject: SubjectId = "arab",
): Q {
  customSeq += 1;
  return {
    id: `guru-${Date.now().toString(36)}-${customSeq}`,
    subject,
    prompt,
    options,
    correctIndex,
    explanation: explanation || `Jawaban yang benar: ${options[correctIndex]}.`,
  };
}

/**
 * Impor CSV bank guru. Satu soal per baris:
 * Soal;Opsi A;Opsi B;Opsi C;Opsi D;NomorBenar(1-4);Penjelasan (opsional)
 * Pemisah koma juga diterima bila titik koma tidak ada.
 */
export function parseCustomCsv(text: string, subject: SubjectId = "arab"): { items: Q[]; skipped: number } {
  const items: Q[] = [];
  let skipped = 0;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = (trimmed.includes(";") ? trimmed.split(";") : trimmed.split(",")).map((p) => p.trim());
    if (parts.length < 6 || !parts[0] || !parts[1] || !parts[2] || !parts[3] || !parts[4]) {
      skipped += 1;
      continue;
    }
    const benar = Math.min(4, Math.max(1, parseInt(parts[5], 10) || 1));
    items.push(
      makeCustomQ(
        parts[0],
        [parts[1], parts[2], parts[3], parts[4]],
        benar - 1,
        parts[6] ?? "",
        subject,
      ),
    );
  }
  return { items, skipped };
}


export interface ScoreRecord {
  readonly score: number;
  readonly correct: number;
  readonly total: number;
  readonly bestStreak: number;
  readonly at: string;
}

const SCORES_KEY = "ai-basketball:scores:v1";

export function loadScores(): ScoreRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SCORES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is ScoreRecord =>
        typeof r === "object" && r !== null && "score" in r && "at" in r,
    );
  } catch {
    return [];
  }
}

export function saveScore(record: ScoreRecord): ScoreRecord[] {
  const next = [record, ...loadScores()].slice(0, RULES.maxScoreRecords);
  try {
    window.localStorage.setItem(SCORES_KEY, JSON.stringify(next));
  } catch {
    // Penyimpanan penuh/diblokir — permainan tetap berjalan.
  }
  return next;
}

export function bestScore(records: readonly ScoreRecord[]): number {
  return records.reduce((max, r) => Math.max(max, r.score), 0);
}

/* ================= BANK BAWAAN YANG DIEDIT GURU (Log 46) =================
 * Guru juga bisa mengubah bank 4 mapel bawaan: tambah/hapus soal per
 * mapel. Hasil edit disimpan sebagai salinan; mapel tanpa salinan (atau
 * salinannya dikosongkan) memakai bank bawaan asli saat bermain.
 * "Kembalikan ke bawaan" = hapus salinannya. */

export type BankOverrides = Partial<Record<SubjectId, Q[]>>;

const BANK_KEY = "ai-basketball:bank:v1";

export function loadBankOverrides(): BankOverrides {
  try {
    const raw = localStorage.getItem(BANK_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<Record<SubjectId, unknown>>;
    const out: BankOverrides = {};
    (Object.keys(SUBJECT_LABEL) as SubjectId[]).forEach((id) => {
      const list = parsed[id];
      if (Array.isArray(list)) out[id] = list.filter(isQ);
    });
    return out;
  } catch {
    return {};
  }
}

export function saveBankOverrides(overrides: BankOverrides): void {
  try {
    localStorage.setItem(BANK_KEY, JSON.stringify(overrides));
  } catch {
    /* penyimpanan tidak tersedia — abaikan */
  }
}

/** Bank yang benar-benar dipakai bermain untuk mapel bawaan. */
export function effectiveBank(subject: SubjectId, overrides: BankOverrides): Q[] {
  const edited = overrides[subject];
  return edited && edited.length > 0 ? edited : [...bankFor(subject)];
}

/* ================= IMPOR MARKDOWN (Log 51) =================
 * Guru menyiapkan soal sebagai berkas .md mengikuti template:
 *   Mapel: IPA Kelas 5            (opsional, untuk nama Mapel Guru)
 *   ## Soal
 *   Pertanyaannya...
 *   A. Pilihan satu
 *   B. Pilihan dua
 *   C. Pilihan tiga
 *   D. Pilihan empat
 *   Jawaban: B
 *   Penjelasan: ... (opsional)
 * Blok tanpa pertanyaan lengkap / tanpa 4 pilihan / tanpa Jawaban
 * dihitung sebagai dilewati. Komentar HTML <!-- ... --> diabaikan. */

export function templateMarkdown(): string {
  return `<!-- ============================================================
TEMPLATE BANK SOAL — Magguru Game Basket
Cara pakai:
1. Tulis nama mapel pada baris "Mapel:" di bawah (khusus Mapel Guru).
2. Satu soal dimulai dengan baris ## Soal.
3. Tulis pertanyaannya, lalu 4 pilihan diawali A. B. C. D.
4. Baris Jawaban: isi huruf jawaban yang benar.
5. Baris Penjelasan: boleh kosong atau dihapus.
6. Simpan berkas ini, lalu di game buka Bank Soal dan pilih berkas .md ini.
============================================================ -->
Mapel: IPA Kelas 5

## Soal
Hewan pemakan tumbuhan disebut...
A. Herbivora
B. Karnivora
C. Omnivora
D. Insektivora
Jawaban: A
Penjelasan: Herbivora adalah hewan pemakan tumbuhan.

## Soal
Fotosintesis terjadi di bagian...
A. Akar
B. Batang
C. Daun
D. Bunga
Jawaban: C

## Soal
Air mendidih pada suhu...
A. 50 derajat
B. 80 derajat
C. 90 derajat
D. 100 derajat
Jawaban: D
`;
}

export function parseMarkdownBank(
  text: string,
  subject: SubjectId = "arab",
): { name: string; items: Q[]; skipped: number } {
  const bersih = text.replace(/<!--[\s\S]*?-->/g, "");
  interface Blok {
    prompt: string[];
    options: string[];
    correct: number;
    expl: string;
  }
  const blokBaru = (): Blok => ({ prompt: [], options: [], correct: -1, expl: "" });
  const blocks: Blok[] = [];
  let cur: Blok | null = null;
  let name = "";
  const mulai = (): Blok => {
    const b = blokBaru();
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
    const jelas = line.match(/^penjelasan\s*:\s*(.+)$/i);
    if (jelas) {
      blok.expl = jelas[1].trim();
      continue;
    }
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
        makeCustomQ(prompt, [b.options[0], b.options[1], b.options[2], b.options[3]], b.correct, b.expl, subject),
      );
    } else if (b.prompt.length > 0 || b.options.length > 0) {
      skipped += 1;
    }
  }
  return { name, items, skipped };
}

/** Prompt siap salin untuk guru (Log 52): ditempel ke asisten AI mana
 *  pun untuk membuatkan soal berformat Markdown yang bisa langsung
 *  diimpor ke game, atau dipakai sebagai pola isi manual. */
export function promptTemplateSoal(): string {
  return `Kamu adalah pembuat soal untuk permainan basket edukasi di kelas.
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
Penjelasan: [satu kalimat penjelasan]

## Soal
... (lanjutkan pola yang sama untuk soal berikutnya)

Aturan:
- Setiap soal wajib punya 4 pilihan A sampai D dan tepat satu jawaban benar.
- Variasikan posisi jawaban benar, jangan selalu di huruf yang sama.
- Jangan beri nomor pada baris ## Soal.`;
}
