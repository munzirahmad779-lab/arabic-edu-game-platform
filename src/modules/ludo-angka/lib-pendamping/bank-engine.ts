/**
 * Mesin bank soal bersama seri banua (tipe soal, daftar mapel, parser
 * bank JSON/Markdown/CSV, template, dan prompt pembuat soal).
 *
 * Diekstrak utuh dari banua-fruit-blast/logic versi proyek mandiri,
 * sama seperti Jejak Angka dan Ludo Angka versi mandiri mengimpornya
 * dari Banua Fruit Blast. Versi LMS dari logic Fruit Blast tidak
 * dipakai karena daftar mapelnya berbeda: mesin ini mempertahankan
 * mapel "indonesia" yang memang menjadi mapel bawaan kedua game.
 */

export type SubjectId = "indonesia" | "arab" | "inggris" | "matematika" | "biologi" | "fisika" | "guru";
/** Mapel yang bank bawaannya tersimpan di Bank (guru disimpan terpisah). */
export type ContentSubjectId = "indonesia" | "arab" | "inggris" | "matematika" | "biologi" | "fisika";
export const CONTENT_SUBJECTS: ContentSubjectId[] = ["indonesia", "arab", "inggris", "matematika", "biologi", "fisika"];

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

export type Bank = Record<ContentSubjectId, Q[]>;

export const SUBJECTS: { id: ContentSubjectId; title: string; icon: string }[] = [
  { id: "indonesia", title: "Bahasa Indonesia", icon: "🇮🇩" },
  { id: "arab", title: "Bahasa Arab", icon: "📖" },
  { id: "inggris", title: "Bahasa Inggris", icon: "🔤" },
  { id: "matematika", title: "Matematika", icon: "🔢" },
  { id: "biologi", title: "Biologi SMA", icon: "🧬" },
  { id: "fisika", title: "Fisika SMA", icon: "⚡" },
];

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
  const opts = r.options
    .filter((o): o is string => typeof o === "string" && o.trim().length > 0)
    .map((o) => o.trim());
  if (opts.length !== 4) return false;
  // opsi kembar sesudah trim membuat jawaban ambigu: soal ditolak
  if (new Set(opts).size !== opts.length) return false;
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
  const out: Bank = { indonesia: [], arab: [], inggris: [], matematika: [], biologi: [], fisika: [] };
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
 * Kunci jawaban impor hanya sah sebagai huruf A-D atau angka bulat 1-4
 * persis (satu titik di akhir kalimat ditoleransi). Token berawalan angka
 * seperti "2.5" atau "1x" DITOLAK: parseInt lama membacanya sebagai 2 dan
 * 1 sehingga soal tercatat berkunci menyimpang dari maksud penulisnya.
 */
const parseAnswerKey = (token: string): number => {
  const v = token.trim().toUpperCase().replace(/\.$/, "");
  if (/^[A-D]$/.test(v)) return v.charCodeAt(0) - 65;
  if (/^[1-4]$/.test(v)) return Number(v) - 1;
  return -1;
};

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
    const jawab = line.match(/^jawaban\s*:\s*(\S+)\s*$/i);
    if (jawab) {
      blok.correct = parseAnswerKey(jawab[1]);
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
    // Pilihan kembar ditolak seperti di isQ: buildStream menandai buah
    // benar dari teks, jadi dua pilihan berteks sama akan sama-sama benar.
    const unik = new Set(b.options).size === b.options.length;
    if (prompt && b.options.length === 4 && unik && b.correct >= 0 && b.correct <= 3) {
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
 * Belah satu baris CSV: koma/titik koma di dalam kutip ganda tidak ikut
 * membelah, dan "" di dalam kutip berarti satu kutip. Baris tanpa kutip
 * dibelah persis seperti sebelumnya (pada koma atau titik koma).
 */
const splitCsvLine = (line: string): string[] => {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === "," || ch === ";") {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
};

/**
 * Impor CSV sederhana: satu soal per baris, enam kolom, yaitu
 * soal, pilihan A, pilihan B, pilihan C, pilihan D, jawaban (huruf A-D
 * atau angka 1-4). Pemisah koma atau titik koma. Teks yang mengandung
 * pemisah boleh dibungkus kutip ganda.
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
    // Kutip tak berpasangan (jumlah karakter " ganjil) membuat sisa baris
    // tertelan sebagai dalam-kutip; untuk baris seperti itu pakai pembelah
    // polos lama agar teks dan pemisah dipertahankan apa adanya.
    const quoteCount = (line.match(/"/g) || []).length;
    const rawCells = quoteCount % 2 === 1 ? line.split(/[;,]/) : splitCsvLine(line);
    const cells = rawCells.map((c) => c.trim());
    if (cells.length < 6) {
      skipped += 1;
      continue;
    }
    const [prompt, a, b, c, d, ans] = cells;
    // parseAnswerKey menolak kunci tak bulat ("2.5", "1x") dan huruf di
    // luar A-D; pilihan kembar ditolak dengan alasan yang sama seperti
    // pada impor Markdown di atas.
    const correct = parseAnswerKey(ans);
    if (!prompt || !a || !b || !c || !d || correct < 0 || correct > 3 || new Set([a, b, c, d]).size !== 4) {
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
