import { NextResponse } from "next/server";
import * as XLSX from "xlsx-js-style";

export const runtime = "nodejs";

type AssessmentType = "toefl_itp" | "toafl" | "custom";

type SectionConfig = {
  type: "listening" | "structure" | "reading";
  title: string;
  duration: number;
  audioOnce: string;
  allowReview: string;
  instructions: string;
};

const TOEFL_SECTIONS: SectionConfig[] = [
  {
    type: "listening",
    title: "Listening Comprehension",
    duration: 35,
    audioOnce: "YES",
    allowReview: "NO",
    instructions:
      "You will hear conversations and talks ONCE. Audio cannot be replayed. 50 questions.",
  },
  {
    type: "structure",
    title: "Structure & Written Expression",
    duration: 25,
    audioOnce: "NO",
    allowReview: "YES",
    instructions:
      "Choose the best answer to complete the sentence, or find the error. 40 questions.",
  },
  {
    type: "reading",
    title: "Reading Comprehension",
    duration: 55,
    audioOnce: "NO",
    allowReview: "YES",
    instructions:
      "Read each passage, then answer questions about it. 50 questions.",
  },
];

const TOAFL_SECTIONS: SectionConfig[] = [
  {
    type: "listening",
    title: "Istima' (Fahmul Masmu')",
    duration: 35,
    audioOnce: "YES",
    allowReview: "NO",
    instructions:
      "استمع إلى الحوارات والمحادثات مرة واحدة فقط. لا يمكن إعادة التشغيل. 50 سؤالاً.",
  },
  {
    type: "structure",
    title: "Tarakib wa Qawaid",
    duration: 30,
    audioOnce: "NO",
    allowReview: "YES",
    instructions:
      "اختر الإجابة الصحيحة لإكمال الجملة أو للخطأ في الجملة. 40 سؤالاً.",
  },
  {
    type: "reading",
    title: "Qira'ah (Fahmul Maqru')",
    duration: 45,
    audioOnce: "NO",
    allowReview: "YES",
    instructions: "اقرأ النص ثم أجب عن الأسئلة التالية. 50 سؤالاً.",
  },
];

type CellStyle = {
  font?: Record<string, unknown>;
  fill?: Record<string, unknown>;
  alignment?: Record<string, unknown>;
  border?: Record<string, unknown>;
};

function applyStyle(ws: XLSX.WorkSheet, range: string, style: CellStyle) {
  const r = XLSX.utils.decode_range(range);
  for (let R = r.s.r; R <= r.e.r; R += 1) {
    for (let C = r.s.c; C <= r.e.c; C += 1) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[addr]) {
        ws[addr] = { t: "s", v: "" };
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ws[addr] as any).s = { ...((ws[addr] as any).s || {}), ...style };
    }
  }
}

function applyRowStyle(
  ws: XLSX.WorkSheet,
  rowNum: number,
  style: CellStyle,
  colCount = 1,
) {
  const range = XLSX.utils.encode_range({
    s: { r: rowNum - 1, c: 0 },
    e: { r: rowNum - 1, c: colCount - 1 },
  });
  applyStyle(ws, range, style);
}

const COLOR = {
  terracotta: "D97757",
  teal: "2F6D72",
  sage: "8FA68E",
  cream: "F7F1E8",
  yellow: "FFF3CD",
  yellowDark: "856404",
  red: "F8D7DA",
  redDark: "721C24",
  green: "D4EDDA",
  greenDark: "155724",
  white: "FFFFFF",
  darkText: "1F2937",
};

const STYLE = {
  header: {
    font: { bold: true, color: { rgb: COLOR.white }, sz: 12 },
    fill: { fgColor: { rgb: COLOR.teal } },
    alignment: { vertical: "center", horizontal: "center", wrapText: true },
    border: {
      top: { style: "thin", color: { rgb: "999999" } },
      bottom: { style: "thin", color: { rgb: "999999" } },
      left: { style: "thin", color: { rgb: "999999" } },
      right: { style: "thin", color: { rgb: "999999" } },
    },
  },
  title: {
    font: { bold: true, color: { rgb: COLOR.white }, sz: 16 },
    fill: { fgColor: { rgb: COLOR.terracotta } },
    alignment: { vertical: "center", horizontal: "center", wrapText: true },
  },
  warning: {
    font: { bold: true, color: { rgb: COLOR.yellowDark }, sz: 11 },
    fill: { fgColor: { rgb: COLOR.yellow } },
    alignment: { vertical: "center", wrapText: true },
  },
  danger: {
    font: { bold: true, color: { rgb: COLOR.redDark }, sz: 11 },
    fill: { fgColor: { rgb: COLOR.red } },
    alignment: { vertical: "center", wrapText: true },
  },
  success: {
    font: { bold: true, color: { rgb: COLOR.greenDark }, sz: 11 },
    fill: { fgColor: { rgb: COLOR.green } },
    alignment: { vertical: "center", wrapText: true },
  },
  sectionTitle: {
    font: { bold: true, color: { rgb: COLOR.white }, sz: 13 },
    fill: { fgColor: { rgb: COLOR.teal } },
    alignment: { vertical: "center", horizontal: "left", wrapText: true },
  },
  label: {
    font: { bold: true, color: { rgb: COLOR.teal }, sz: 11 },
    alignment: { vertical: "center", wrapText: true },
  },
  text: {
    font: { sz: 11, color: { rgb: COLOR.darkText } },
    alignment: { vertical: "top", wrapText: true },
  },
  code: {
    font: { name: "Consolas", sz: 10, color: { rgb: COLOR.terracotta } },
    fill: { fgColor: { rgb: COLOR.cream } },
    alignment: { vertical: "center", wrapText: true },
  },
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const rawType = url.searchParams.get("type") ?? "toefl_itp";
  const type: AssessmentType =
    rawType === "toafl" || rawType === "custom"
      ? (rawType as AssessmentType)
      : "toefl_itp";

  const isToafl = type === "toafl";
  const sectionConfig = isToafl ? TOAFL_SECTIONS : TOEFL_SECTIONS;
  const typeLabel = isToafl
    ? "TOAFL (Test of Arabic as Foreign Language)"
    : type === "custom"
      ? "Custom Assessment"
      : "TOEFL ITP (Institutional Testing Program)";

  const wb = XLSX.utils.book_new();

  // ==========================================================
  // Sheet 1: MULAI_DARI_SINI
  // ==========================================================
  const guideRows: string[][] = [
    ["═══════════════════════════════════════════════════════════"],
    ["TEMPLATE UJIAN — " + typeLabel],
    ["═══════════════════════════════════════════════════════════"],
    [""],
    ["📌 LANGKAH CEPAT (ikuti urutan):"],
    [""],
    ["   1. Baca sheet ini sampai habis"],
    ["   2. Kalau Anda sudah punya draft soal → buka sheet 'AI_PROMPT' ⭐"],
    ["   3. Kalau belum ada draft → langsung isi sheet 'QUESTIONS'"],
    ["   4. Isi 'PASSAGES' kalau ada bacaan (Reading)"],
    ["   5. Isi 'AUDIO_GROUPS' kalau ada audio (Listening)"],
    ["   6. Lihat 'CONTOH_SOAL' untuk melihat contoh lengkap"],
    ["   7. Upload file ini di halaman detail ujian"],
    [""],
    ["═══════════════════════════════════════════════════════════"],
    ["⭐ CARA PALING CEPAT (kalau sudah punya draft soal):"],
    ["═══════════════════════════════════════════════════════════"],
    [""],
    ["   1. Buka sheet 'AI_PROMPT'"],
    ["   2. Copy seluruh teks di situ"],
    ["   3. Paste ke ChatGPT / Gemini / Claude"],
    ["   4. Ganti bagian [DRAFT ANDI DI SINI] dengan soal-soal Anda"],
    ["   5. Kirim ke AI"],
    ["   6. AI akan mengembalikan tabel siap-copy"],
    ["   7. Paste hasilnya ke sheet 'QUESTIONS'"],
    [""],
    ["   ✅ Cepat, akurat, tidak perlu paham format manual."],
    [""],
    ["═══════════════════════════════════════════════════════════"],
    ["📋 STRUKTUR UJIAN " + (isToafl ? "TOAFL" : "TOEFL ITP") + ":"],
    ["═══════════════════════════════════════════════════════════"],
    [""],
    ["   Section              Durasi      Audio          Review"],
    ...sectionConfig.map((s): string[] => [
      "   " +
        s.title.padEnd(20) +
        " " +
        (s.duration + " menit").padEnd(12) +
        " " +
        (s.type === "listening" ? "Sekali putar" : "—").padEnd(15) +
        " " +
        (s.allowReview === "YES" ? "Boleh" : "Tidak boleh"),
    ]),
    [""],
    [
      "   Total: 140 soal · " +
        sectionConfig.reduce((sum, s) => sum + s.duration, 0) +
        " menit",
    ],
    [""],
    ["═══════════════════════════════════════════════════════════"],
    ["⚠️  PERINGATAN PENTING:"],
    ["═══════════════════════════════════════════════════════════"],
    [""],
    ["❌ JANGAN ubah nama sheet (SECTIONS, QUESTIONS, dst)"],
    ["❌ JANGAN ubah nama kolom (No, Section, Question_Number, dst)"],
    ["❌ JANGAN ubah nilai kolom Section (harus: listening/structure/reading)"],
    ["✅ Boleh ubah: isi soal, pilihan A/B/C/D, jawaban, judul section"],
    [""],
    ["═══════════════════════════════════════════════════════════"],
    ["❓ Kalau bingung, hubungi guru pembuat ujian."],
    ["═══════════════════════════════════════════════════════════"],
  ];

  const wsGuide = XLSX.utils.aoa_to_sheet(guideRows);
  wsGuide["!cols"] = [{ wch: 90 }];
  XLSX.utils.book_append_sheet(wb, wsGuide, "MULAI_DARI_SINI");

  applyRowStyle(wsGuide, 1, STYLE.title);
  applyRowStyle(wsGuide, 2, STYLE.title);
  applyRowStyle(wsGuide, 3, STYLE.title);
  applyRowStyle(wsGuide, 5, STYLE.sectionTitle);
  for (let i = 7; i <= 13; i += 1) applyRowStyle(wsGuide, i, STYLE.text);
  applyRowStyle(wsGuide, 15, STYLE.sectionTitle);
  applyRowStyle(wsGuide, 16, STYLE.sectionTitle);
  for (let i = 18; i <= 25; i += 1) applyRowStyle(wsGuide, i, STYLE.text);
  applyRowStyle(wsGuide, 27, STYLE.success);
  applyRowStyle(wsGuide, 29, STYLE.sectionTitle);
  applyRowStyle(wsGuide, 30, STYLE.sectionTitle);
  applyRowStyle(wsGuide, 32, STYLE.header);
  for (let i = 33; i <= 36; i += 1) applyRowStyle(wsGuide, i, STYLE.text);
  applyRowStyle(wsGuide, 38, STYLE.warning);
  applyRowStyle(wsGuide, 40, STYLE.sectionTitle);
  applyRowStyle(wsGuide, 41, STYLE.sectionTitle);
  applyRowStyle(wsGuide, 43, STYLE.danger);
  applyRowStyle(wsGuide, 44, STYLE.danger);
  applyRowStyle(wsGuide, 45, STYLE.danger);
  applyRowStyle(wsGuide, 46, STYLE.success);
  applyRowStyle(wsGuide, 48, STYLE.sectionTitle);
  applyRowStyle(wsGuide, 49, STYLE.sectionTitle);

  // ==========================================================
  // Sheet 2: AI_PROMPT
  // ==========================================================
  const aiPromptLines: string[] = [
    "Saya guru yang sedang menyiapkan ujian " +
      (isToafl
        ? "TOAFL (Test of Arabic as Foreign Language)"
        : "TOEFL ITP") +
      ".",
    "",
    "Tugas Anda: bantu saya mengisi template Excel ujian dengan mengubah draft soal saya menjadi tabel siap-copy.",
    "",
    "═══════════════════════════════════════════════",
    "FORMAT OUTPUT YANG SAYA BUTUHKAN",
    "═══════════════════════════════════════════════",
    "",
    "Kembalikan hasil dalam bentuk TABEL (markdown) dengan kolom PERSIS:",
    "",
    "| No | Section | Question_Number | Passage_ID | Audio_ID | Soal | A | B | C | D | Jawaban | Difficulty |",
    "",
    "ATURAN KETAT:",
    "1. Kolom 'Section' HARUS salah satu dari: listening, structure, reading",
    "2. Kolom 'Question_Number' diulang per section — mis. 3 soal listening → 1, 2, 3",
    "3. Kolom 'No' global (1, 2, 3, ...) tidak pernah reset",
    "4. Kolom 'Passage_ID' HANYA untuk soal Reading (mis. P1, P2)",
    "5. Kolom 'Audio_ID' HANYA untuk soal Listening (mis. A1, A2)",
    "6. Kolom 'Jawaban' HARUS salah satu dari: A, B, C, D",
    "7. Kolom 'Difficulty' isi: easy / medium / hard",
    "8. Untuk Reading, soal dengan bacaan sama → Passage_ID sama",
    "9. Untuk Listening, soal dengan audio sama → Audio_ID sama",
    "10. Jangan tambahkan kolom lain, jangan ubah urutan kolom",
    "",
    "═══════════════════════════════════════════════",
    "STRUKTUR UJIAN (default)",
    "═══════════════════════════════════════════════",
    "",
    "• LISTENING: 50 soal, ~35 menit, audio sekali putar",
    "• STRUCTURE: " + (isToafl ? "40 soal, ~30 menit" : "40 soal, ~25 menit"),
    "• READING: " + (isToafl ? "50 soal, ~45 menit" : "50 soal, ~55 menit"),
    "",
    "═══════════════════════════════════════════════",
    "BAHASA SOAL",
    "═══════════════════════════════════════════════",
    "",
    isToafl
      ? "Semua soal dan pilihan jawaban dalam BAHASA ARAB (fusha)."
      : "Semua soal dan pilihan jawaban dalam BAHASA INGGRIS.",
    "",
    "═══════════════════════════════════════════════",
    "DRAFT SOAL SAYA",
    "═══════════════════════════════════════════════",
    "",
    "[DRAFT ANDA DI SINI]",
    "",
    "⬆️ Ganti baris di atas dengan soal-soal Anda (bisa berantakan, AI akan rapikan).",
    "",
    "═══════════════════════════════════════════════",
    "OUTPUT",
    "═══════════════════════════════════════════════",
    "",
    "Kembalikan HANYA tabel markdown. Jangan tambahkan penjelasan tambahan.",
    "",
    "═══════════════════════════════════════════════",
    "SETELAH DAPAT HASIL DARI AI",
    "═══════════════════════════════════════════════",
    "",
    "1. Copy tabel yang AI berikan",
    "2. Buka sheet 'QUESTIONS' di file Excel ini",
    "3. Paste mulai dari baris 2 (di bawah header)",
    "4. Rapikan: pastikan tiap kolom masuk ke kolom yang benar",
    "5. Simpan file",
    "6. Upload di halaman detail ujian",
    "",
    "CATATAN:",
    "• Jika soal Anda punya bacaan atau audio, tulis juga teksnya di DRAFT",
    "• AI akan mengelompokkan dan memberi ID (P1, P2, A1, A2, ...)",
    "• Setelah itu, isi sheet 'PASSAGES' dan 'AUDIO_GROUPS' sesuai ID",
  ];

  const wsAi = XLSX.utils.aoa_to_sheet(aiPromptLines.map((l) => [l]));
  wsAi["!cols"] = [{ wch: 90 }];
  XLSX.utils.book_append_sheet(wb, wsAi, "AI_PROMPT");

  applyRowStyle(wsAi, 1, STYLE.title);
  applyRowStyle(wsAi, 5, STYLE.sectionTitle);
  applyRowStyle(wsAi, 6, STYLE.sectionTitle);
  applyRowStyle(wsAi, 8, STYLE.header);
  for (let i = 10; i <= 20; i += 1) applyRowStyle(wsAi, i, STYLE.text);
  applyRowStyle(wsAi, 22, STYLE.sectionTitle);
  applyRowStyle(wsAi, 23, STYLE.sectionTitle);
  for (let i = 25; i <= 27; i += 1) applyRowStyle(wsAi, i, STYLE.text);
  applyRowStyle(wsAi, 29, STYLE.sectionTitle);
  applyRowStyle(wsAi, 30, STYLE.sectionTitle);
  applyRowStyle(wsAi, 32, STYLE.warning);
  applyRowStyle(wsAi, 34, STYLE.sectionTitle);
  applyRowStyle(wsAi, 35, STYLE.sectionTitle);
  applyRowStyle(wsAi, 37, STYLE.danger);
  applyRowStyle(wsAi, 38, STYLE.danger);
  applyRowStyle(wsAi, 40, STYLE.sectionTitle);
  applyRowStyle(wsAi, 41, STYLE.sectionTitle);
  applyRowStyle(wsAi, 43, STYLE.code);
  applyRowStyle(wsAi, 45, STYLE.warning);
  applyRowStyle(wsAi, 47, STYLE.sectionTitle);
  applyRowStyle(wsAi, 48, STYLE.sectionTitle);
  for (let i = 50; i <= 55; i += 1) applyRowStyle(wsAi, i, STYLE.success);
  applyRowStyle(wsAi, 57, STYLE.sectionTitle);
  applyRowStyle(wsAi, 58, STYLE.sectionTitle);
  for (let i = 60; i <= 62; i += 1) applyRowStyle(wsAi, i, STYLE.text);

  // ==========================================================
  // Sheet 3: SECTIONS
  // ==========================================================
  const sectionsRows: (string | number)[][] = [
    [
      "Section_Type",
      "Title",
      "Duration_Minutes",
      "Audio_Play_Once",
      "Allow_Review",
      "Instructions",
    ],
    ...sectionConfig.map((s) => [
      s.type,
      s.title,
      s.duration,
      s.audioOnce,
      s.allowReview,
      s.instructions,
    ]),
  ];
  const wsSections = XLSX.utils.aoa_to_sheet(sectionsRows);
  wsSections["!cols"] = [
    { wch: 14 },
    { wch: 40 },
    { wch: 18 },
    { wch: 16 },
    { wch: 14 },
    { wch: 70 },
  ];
  XLSX.utils.book_append_sheet(wb, wsSections, "SECTIONS");
  applyStyle(wsSections, "A1:F1", STYLE.header);
  applyStyle(wsSections, "A2:F4", STYLE.text);
  applyStyle(wsSections, "A2:A4", {
    font: { bold: true, color: { rgb: COLOR.terracotta } },
    alignment: { vertical: "center", horizontal: "center" },
  });

  // ==========================================================
  // Sheet 4: PASSAGES
  // ==========================================================
  const passageExample =
    type === "toafl"
      ? "كان يا ما كان، في قديم الزمان، عاش رجلٌ حكيمٌ في قريةٍ صغيرةٍ على ضفاف نهرٍ عظيم. وكان الناس يأتونه من كل مكان ليستشيروه في أمورهم. وكان الرجل يسمعهم بصبرٍ ويقدم لهم النصيحة الصادقة."
      : "The quick brown fox jumps over the lazy dog. This is a classic English sentence used in typing tests because it contains every letter of the alphabet. However, this passage is about a topic you will read in the actual test, followed by several questions testing comprehension of main ideas, details, and inferences.";

  const passagesRows: (string | number)[][] = [
    ["Passage_ID", "Section", "Order", "Title", "Content"],
    [
      "P1",
      "reading",
      1,
      isToafl ? "نص القراءة رقم 1" : "Reading Passage 1",
      passageExample,
    ],
    ["", "", "", "", ""],
    ["CATATAN:", "", "", "", ""],
    ["• Satu baris = satu bacaan", "", "", "", ""],
    ["• Passage_ID harus unik (P1, P2, P3, dst)", "", "", "", ""],
    ["• Content: tulis seluruh isi bacaan dalam 1 sel", "", "", "", ""],
    ["• Kosongkan sheet ini jika tidak ada bacaan", "", "", "", ""],
  ];
  const wsPassages = XLSX.utils.aoa_to_sheet(passagesRows);
  wsPassages["!cols"] = [
    { wch: 14 },
    { wch: 12 },
    { wch: 8 },
    { wch: 30 },
    { wch: 110 },
  ];
  XLSX.utils.book_append_sheet(wb, wsPassages, "PASSAGES");
  applyStyle(wsPassages, "A1:E1", STYLE.header);
  applyStyle(wsPassages, "A2:E2", STYLE.warning);
  applyStyle(wsPassages, "A4:A4", STYLE.sectionTitle);
  applyStyle(wsPassages, "A5:A8", STYLE.text);

  // ==========================================================
  // Sheet 5: AUDIO_GROUPS
  // ==========================================================
  const audioRows: (string | number)[][] = [
    ["Audio_ID", "Section", "Order", "Title", "Filename_Hint", "Notes"],
    [
      "A1",
      "listening",
      1,
      isToafl ? "الجزء أ — حوارات قصيرة" : "Part A — Short Dialogues",
      "part-a.mp3",
      "Upload setelah import selesai",
    ],
    [
      "A2",
      "listening",
      2,
      isToafl ? "الجزء ب — محادثات طويلة" : "Part B — Longer Conversations",
      "part-b.mp3",
      "Upload setelah import selesai",
    ],
    [
      "A3",
      "listening",
      3,
      isToafl ? "الجزء ج — محاضرات" : "Part C — Mini Talks",
      "part-c.mp3",
      "Upload setelah import selesai",
    ],
    ["", "", "", "", "", ""],
    ["⚠️ CATATAN PENTING:", "", "", "", "", ""],
    ["• File MP3 TIDAK di-upload lewat Excel ini.", "", "", "", "", ""],
    [
      "• Setelah import selesai, guru upload file MP3 di halaman detail ujian.",
      "",
      "",
      "",
      "",
      "",
    ],
    [
      "• Audio akan diputar SEKALI saat siswa mengerjakan Listening.",
      "",
      "",
      "",
      "",
      "",
    ],
    ["• Kosongkan sheet ini jika ujian tidak punya audio.", "", "", "", "", ""],
  ];
  const wsAudio = XLSX.utils.aoa_to_sheet(audioRows);
  wsAudio["!cols"] = [
    { wch: 12 },
    { wch: 12 },
    { wch: 8 },
    { wch: 40 },
    { wch: 25 },
    { wch: 45 },
  ];
  XLSX.utils.book_append_sheet(wb, wsAudio, "AUDIO_GROUPS");
  applyStyle(wsAudio, "A1:F1", STYLE.header);
  applyStyle(wsAudio, "A2:F4", STYLE.text);
  applyStyle(wsAudio, "A6:F6", STYLE.warning);
  applyStyle(wsAudio, "A7:F10", STYLE.warning);

  // ==========================================================
  // Sheet 6: QUESTIONS
  // ==========================================================
  const questionsRows: (string | number)[][] = [
    [
      "No",
      "Section",
      "Question_Number",
      "Passage_ID",
      "Audio_ID",
      "Soal",
      "A",
      "B",
      "C",
      "D",
      "Jawaban",
      "Difficulty",
    ],
    [
      1,
      "listening",
      1,
      "",
      "A1",
      isToafl
        ? "ماذا تقترح المرأة على الرجل؟"
        : "What does the woman suggest the man do?",
      isToafl ? "أن يأخذ قسطًا من الراحة" : "Take a break",
      isToafl ? "أن يدرس أكثر" : "Study harder",
      isToafl ? "أن يعود إلى المنزل" : "Go home",
      isToafl ? "أن يتصل بصديق" : "Call a friend",
      "A",
      "easy",
    ],
    [
      2,
      "listening",
      2,
      "",
      "A1",
      isToafl ? "أين يدور الحوار؟" : "Where does the conversation take place?",
      isToafl ? "في المكتبة" : "In the library",
      isToafl ? "في المطعم" : "In a restaurant",
      isToafl ? "في المطار" : "At the airport",
      isToafl ? "في المستشفى" : "At a hospital",
      "C",
      "medium",
    ],
    [
      3,
      "structure",
      1,
      "",
      "",
      isToafl
        ? "لم يذهب الطالب ____ الامتحان أمس."
        : "The teacher ____ the exam yesterday.",
      isToafl ? "إلى" : "correct",
      isToafl ? "في" : "corrected",
      isToafl ? "على" : "correcting",
      isToafl ? "من" : "correction",
      isToafl ? "إلى" : "B",
      "easy",
    ],
    [
      4,
      "reading",
      1,
      "P1",
      "",
      isToafl
        ? "ما هو الموضوع الرئيسي للنص؟"
        : "What is the main topic of the passage?",
      isToafl ? "الحكمة" : "Wisdom",
      isToafl ? "النهر" : "Rivers",
      isToafl ? "القرية" : "Villages",
      isToafl ? "الصداقة" : "Friendship",
      "A",
      "medium",
    ],
  ];
  const wsQuestions = XLSX.utils.aoa_to_sheet(questionsRows);
  wsQuestions["!cols"] = [
    { wch: 6 },
    { wch: 12 },
    { wch: 18 },
    { wch: 12 },
    { wch: 10 },
    { wch: 55 },
    { wch: 25 },
    { wch: 25 },
    { wch: 25 },
    { wch: 25 },
    { wch: 10 },
    { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, wsQuestions, "QUESTIONS");
  applyStyle(wsQuestions, "A1:L1", STYLE.header);
  applyStyle(wsQuestions, "A2:L5", STYLE.text);
  applyStyle(wsQuestions, "B2:B3", {
    font: { bold: true, color: { rgb: COLOR.white } },
    fill: { fgColor: { rgb: COLOR.terracotta } },
    alignment: { vertical: "center", horizontal: "center" },
  });
  applyStyle(wsQuestions, "B4:B4", {
    font: { bold: true, color: { rgb: COLOR.white } },
    fill: { fgColor: { rgb: COLOR.teal } },
    alignment: { vertical: "center", horizontal: "center" },
  });
  applyStyle(wsQuestions, "B5:B5", {
    font: { bold: true, color: { rgb: COLOR.white } },
    fill: { fgColor: { rgb: COLOR.sage } },
    alignment: { vertical: "center", horizontal: "center" },
  });
  applyStyle(wsQuestions, "K2:K5", {
    font: { bold: true, color: { rgb: COLOR.white } },
    fill: { fgColor: { rgb: COLOR.greenDark } },
    alignment: { vertical: "center", horizontal: "center" },
  });

  // ==========================================================
  // Sheet 7: CONTOH_SOAL
  // ==========================================================
  const contohRows: string[][] = [
    ["═══════════════════════════════════════════════════════════"],
    ["CONTOH SOAL LENGKAP — " + typeLabel],
    ["═══════════════════════════════════════════════════════════"],
    [""],
    ["📖 CONTOH 1 — SOAL LISTENING"],
    [""],
    ["Audio: A1 (part-a.mp3) — akan di-upload guru setelah import"],
    ["Transkrip audio (contoh):"],
    [
      isToafl
        ? '   الرجل: "أنا متعب جدًا من العمل طوال اليوم."'
        : '   Man: "I am so tired from working all day."',
    ],
    [
      isToafl
        ? '   المرأة: "لماذا لا تأخذ قسطًا من الراحة؟"'
        : '   Woman: "Why don\'t you take a break?"',
    ],
    [""],
    [
      "Soal: " +
        (isToafl
          ? "ماذا تقترح المرأة على الرجل؟"
          : "What does the woman suggest the man do?"),
    ],
    ["A. " + (isToafl ? "أن يأخذ قسطًا من الراحة" : "Take a break")],
    ["B. " + (isToafl ? "أن يدرس أكثر" : "Study harder")],
    ["C. " + (isToafl ? "أن يعود إلى المنزل" : "Go home")],
    ["D. " + (isToafl ? "أن يتصل بصديق" : "Call a friend")],
    ["Jawaban: A"],
    [""],
    ["Cara isi di sheet QUESTIONS:"],
    ["   No=1 | Section=listening | Question_Number=1 | Audio_ID=A1"],
    ["   Soal=... | A/B/C/D=... | Jawaban=A | Difficulty=easy"],
    [""],
    ["═══════════════════════════════════════════════════════════"],
    ["📖 CONTOH 2 — SOAL STRUCTURE"],
    [""],
    [
      "Soal: " +
        (isToafl
          ? "لم يذهب الطالب ____ الامتحان أمس."
          : "The teacher ____ the exam yesterday."),
    ],
    ["A. " + (isToafl ? "إلى" : "correct")],
    ["B. " + (isToafl ? "في" : "corrected")],
    ["C. " + (isToafl ? "على" : "correcting")],
    ["D. " + (isToafl ? "من" : "correction")],
    ["Jawaban: " + (isToafl ? "A (إلى)" : "B (corrected)")],
    [""],
    ["Cara isi di sheet QUESTIONS:"],
    ["   No=3 | Section=structure | Question_Number=1 | Passage_ID=(kosong)"],
    ["   Audio_ID=(kosong) | Soal=... | A/B/C/D=... | Jawaban=A atau B"],
    [""],
    ["═══════════════════════════════════════════════════════════"],
    ["📖 CONTOH 3 — SOAL READING (dengan bacaan)"],
    [""],
    ["Passage (dari sheet PASSAGES, ID=P1):"],
    ['   "' + passageExample.slice(0, 120) + '..."'],
    [""],
    [
      "Soal: " +
        (isToafl
          ? "ما هو الموضوع الرئيسي للنص؟"
          : "What is the main topic of the passage?"),
    ],
    ["A. " + (isToafl ? "الحكمة" : "Wisdom")],
    ["B. " + (isToafl ? "النهر" : "Rivers")],
    ["C. " + (isToafl ? "القرية" : "Villages")],
    ["D. " + (isToafl ? "الصداقة" : "Friendship")],
    ["Jawaban: A"],
    [""],
    ["Cara isi di sheet QUESTIONS:"],
    ["   No=4 | Section=reading | Question_Number=1 | Passage_ID=P1 (WAJIB!)"],
    ["   Audio_ID=(kosong) | Soal=... | A/B/C/D=... | Jawaban=A"],
    [""],
    ["═══════════════════════════════════════════════════════════"],
    ["📌 ATURAN UMUM — WAJIB DIPATUHI"],
    ["═══════════════════════════════════════════════════════════"],
    [""],
    ["1. Kolom 'Section' harus PERSIS: listening / structure / reading"],
    ["2. 'Question_Number' diulang per section (1,2,3,... untuk tiap section)"],
    ["3. 'Passage_ID' HANYA untuk Reading"],
    ["4. 'Audio_ID' HANYA untuk Listening"],
    ["5. ID di Passage_ID/Audio_ID harus cocok dengan sheet terkait"],
    ["6. Duplikat Question_Number dalam section sama = ERROR"],
    ["7. Setiap section harus punya minimal 1 soal"],
    ["8. Kolom 'Jawaban' harus huruf kapital A/B/C/D"],
    [""],
    ["═══════════════════════════════════════════════════════════"],
  ];
  const wsContoh = XLSX.utils.aoa_to_sheet(contohRows);
  wsContoh["!cols"] = [{ wch: 95 }];
  XLSX.utils.book_append_sheet(wb, wsContoh, "CONTOH_SOAL");

  applyRowStyle(wsContoh, 1, STYLE.title);
  applyRowStyle(wsContoh, 2, STYLE.title);
  applyRowStyle(wsContoh, 3, STYLE.title);
  applyRowStyle(wsContoh, 5, STYLE.sectionTitle);
  for (let i = 7; i <= 10; i += 1) applyRowStyle(wsContoh, i, STYLE.text);
  for (let i = 12; i <= 18; i += 1) applyRowStyle(wsContoh, i, STYLE.text);
  applyRowStyle(wsContoh, 20, STYLE.code);
  applyRowStyle(wsContoh, 21, STYLE.code);
  applyRowStyle(wsContoh, 23, STYLE.title);
  applyRowStyle(wsContoh, 24, STYLE.title);
  applyRowStyle(wsContoh, 26, STYLE.sectionTitle);
  for (let i = 28; i <= 32; i += 1) applyRowStyle(wsContoh, i, STYLE.text);
  applyRowStyle(wsContoh, 34, STYLE.code);
  applyRowStyle(wsContoh, 35, STYLE.code);
  applyRowStyle(wsContoh, 37, STYLE.title);
  applyRowStyle(wsContoh, 38, STYLE.title);
  applyRowStyle(wsContoh, 40, STYLE.sectionTitle);
  applyRowStyle(wsContoh, 42, STYLE.text);
  for (let i = 44; i <= 49; i += 1) applyRowStyle(wsContoh, i, STYLE.text);
  applyRowStyle(wsContoh, 51, STYLE.code);
  applyRowStyle(wsContoh, 52, STYLE.code);
  applyRowStyle(wsContoh, 54, STYLE.title);
  applyRowStyle(wsContoh, 55, STYLE.title);
  applyRowStyle(wsContoh, 57, STYLE.sectionTitle);
  for (let i = 59; i <= 66; i += 1) applyRowStyle(wsContoh, i, STYLE.warning);

  // ==========================================================
  // Export
  // ==========================================================
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const filename = `template-ujian-${type}.xlsx`;

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}