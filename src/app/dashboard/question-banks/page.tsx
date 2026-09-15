import { unzipSync } from "fflate";

export const QUESTION_BANK_HEADERS = [
  "No",
  "Pertanyaan",
  "Pilihan A",
  "Pilihan B",
  "Pilihan C",
  "Pilihan D",
  "Jawaban Benar",
  "Topik",
  "Tingkat Kesulitan",
  "Ada Media?",
  "Jenis Media",
  "Nama Media",
  "Maks. Pemutaran",
  "Alasan",
] as const;

export type QuestionImportRow = {
  no: number;
  question: string;
  options: { A: string; B: string; C: string; D: string };
  correctOptionKey: "A" | "B" | "C" | "D";
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  hasMedia: boolean;
  mediaType: "audio" | "image" | "video" | null;
  mediaFilename: string | null;
  maxPlayCount: number | null;
  explanation: string | null;
};

export type QuestionImportError = {
  row: number;
  field: string;
  message: string;
};

export type QuestionImportPreview = {
  rows: QuestionImportRow[];
  errors: QuestionImportError[];
};

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 100;
const MAX_TOTAL_UNCOMPRESSED_BYTES = 20 * 1024 * 1024;
const MAX_ROWS = 140;
const MAX_TEXT_LENGTH = 5000;
const MAX_OPTION_LENGTH = 2000;
const MAX_TOPIC_LENGTH = 200;
const MAX_FILENAME_LENGTH = 255;
const MAX_EXPLANATION_LENGTH = 5000;

function fail(errors: QuestionImportError[], row: number, field: string, message: string) {
  errors.push({ row, field, message });
}

function normalizeCell(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();
  return "";
}

function parseInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return Number(value.trim());
  return null;
}

/** Normalisasi tingkat kesulitan: Mudah/easy/e → easy, dst. */
function normalizeDifficulty(raw: string): "easy" | "medium" | "hard" | null {
  const v = raw.toLowerCase().trim();
  if (v === "mudah" || v === "easy" || v === "e") return "easy";
  if (v === "sedang" || v === "medium" || v === "m") return "medium";
  if (v === "sulit" || v === "hard" || v === "h") return "hard";
  return null;
}

/** Normalisasi ada media: Ya/YA/yes/y → true, Tidak/TIDAK/no/n → false. */
function normalizeYesNo(raw: string): boolean | null {
  const v = raw.toLowerCase().trim();
  if (v === "ya" || v === "yes" || v === "y" || v === "true") return true;
  if (v === "tidak" || v === "no" || v === "n" || v === "false") return false;
  return null;
}

/** Normalisasi jenis media: Audio/audio → audio, Gambar/gambar/image → image, Video → video. */
function normalizeMediaType(raw: string): "audio" | "image" | "video" | null {
  const v = raw.toLowerCase().trim();
  if (v === "audio" || v === "suara") return "audio";
  if (v === "gambar" || v === "image" || v === "img" || v === "foto") return "image";
  if (v === "video" || v === "vidio") return "video";
  return null;
}

function localElements(parent: ParentNode, name: string): Element[] {
  return Array.from(parent.querySelectorAll("*")).filter(
    (element) => element.localName === name
  );
}

function firstLocal(parent: ParentNode, name: string): Element | null {
  return localElements(parent, name)[0] ?? null;
}

function xmlDocument(bytes: Uint8Array, label: string): Document {
  const xml = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.getElementsByTagName("parsererror").length > 0) {
    throw new Error(`Invalid XML in ${label}`);
  }
  return document;
}

function readSharedStrings(zip: Record<string, Uint8Array>): string[] {
  const bytes = zip["xl/sharedStrings.xml"];
  if (!bytes) return [];
  const document = xmlDocument(bytes, "sharedStrings.xml");
  return localElements(document, "si").map((item) =>
    localElements(item, "t").map((text) => text.textContent ?? "").join("")
  );
}

function resolveWorksheetPath(zip: Record<string, Uint8Array>): string {
  const workbookBytes = zip["xl/workbook.xml"];
  const relBytes = zip["xl/_rels/workbook.xml.rels"];
  if (!workbookBytes || !relBytes) throw new Error("Workbook structure is incomplete.");

  const workbook = xmlDocument(workbookBytes, "workbook.xml");
  const rels = xmlDocument(relBytes, "workbook.xml.rels");
  const sheets = localElements(workbook, "sheet");
  if (sheets.length !== 1) throw new Error("Workbook must contain exactly one worksheet.");

  const sheet = sheets[0];
  if (!sheet) throw new Error("Worksheet is missing.");

  if (sheet.getAttribute("state") && sheet.getAttribute("state") !== "visible") {
    throw new Error("The worksheet must be visible.");
  }

  const relationshipId =
    sheet.getAttribute("r:id") ??
    sheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
  if (!relationshipId) throw new Error("Worksheet relationship is missing.");

  const relationship = localElements(rels, "Relationship").find(
    (item) => item.getAttribute("Id") === relationshipId
  );
  const target = relationship?.getAttribute("Target");
  if (!target) throw new Error("Worksheet target is missing.");

  const path = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
  if (!path.startsWith("xl/") || path.includes("..")) throw new Error("Invalid worksheet target.");
  if (!zip[path]) throw new Error("Worksheet XML is missing.");
  return path;
}

function columnIndex(ref: string): number {
  const letters = ref.match(/^[A-Z]+/i)?.[0]?.toUpperCase();
  if (!letters) throw new Error("Invalid Excel cell reference.");
  let result = 0;
  for (const char of letters) result = result * 26 + char.charCodeAt(0) - 64;
  return result - 1;
}

function cellValue(cell: Element, sharedStrings: string[]): unknown {
  if (firstLocal(cell, "f")) throw new Error("Formula cells are not allowed.");
  const type = cell.getAttribute("t") ?? "n";

  if (type === "inlineStr") {
    const inline = firstLocal(cell, "is");
    return inline ? localElements(inline, "t").map((t) => t.textContent ?? "").join("") : "";
  }

  const value = firstLocal(cell, "v")?.textContent ?? "";
  if (type === "s") {
    const index = Number(value);
    if (!Number.isInteger(index) || index < 0 || index >= sharedStrings.length) throw new Error("Invalid shared string reference.");
    return sharedStrings[index];
  }
  if (type === "b") return value === "1";
  if (type === "str") return value;
  if (type === "e") throw new Error("Excel error cells are not allowed.");
  if (value === "") return "";
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : value;
}

function readWorksheet(zip: Record<string, Uint8Array>, worksheetPath: string, sharedStrings: string[]): unknown[][] {
  const worksheetBytes = zip[worksheetPath];
  if (!worksheetBytes) throw new Error("Worksheet XML is missing.");

  const document = xmlDocument(worksheetBytes, worksheetPath);
  const sheetData = firstLocal(document, "sheetData");
  if (!sheetData) throw new Error("Worksheet data is missing.");

  const rows = localElements(sheetData, "row");
  const output: unknown[][] = [];
  for (const row of rows) {
    const rowNumber = Number(row.getAttribute("r"));
    if (!Number.isInteger(rowNumber) || rowNumber < 1) throw new Error("Invalid worksheet row reference.");
    const values: unknown[] = [];
    for (const cell of localElements(row, "c")) {
      const ref = cell.getAttribute("r");
      if (!ref) throw new Error("Worksheet cell reference is missing.");
      const index = columnIndex(ref);
      values[index] = cellValue(cell, sharedStrings);
    }
    output[rowNumber - 1] = values;
  }
  return output;
}

async function readXlsxRows(file: File): Promise<unknown[][]> {
  if (!/\.xlsx$/i.test(file.name)) throw new Error("File harus berformat .xlsx.");
  if (file.size === 0) throw new Error("File Excel kosong.");
  if (file.size > MAX_FILE_BYTES) throw new Error("Ukuran file Excel melebihi batas 5 MB.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const zip = unzipSync(bytes, { filter: (fileEntry) => fileEntry.name.startsWith("xl/") || fileEntry.name.startsWith("[Content_Types].xml") });
  const names = Object.keys(zip);
  if (names.length > MAX_ZIP_ENTRIES) throw new Error("Workbook memiliki terlalu banyak entri ZIP.");
  const totalSize = Object.values(zip).reduce(
    (sum, entry) => sum + entry.byteLength,
    0
  );
  if (totalSize > MAX_TOTAL_UNCOMPRESSED_BYTES) throw new Error("Workbook terlalu besar setelah dekompresi.");

  if (!zip["[Content_Types].xml"] || !zip["xl/workbook.xml"] || !zip["xl/_rels/workbook.xml.rels"]) {
    throw new Error("File bukan workbook XLSX yang lengkap.");
  }

  const worksheetPath = resolveWorksheetPath(zip);
  return readWorksheet(zip, worksheetPath, readSharedStrings(zip));
}

export async function parseQuestionBankWorkbook(file: File): Promise<QuestionImportPreview> {
  const errors: QuestionImportError[] = [];
  let matrix: unknown[][];

  try {
    matrix = await readXlsxRows(file);
  } catch (error) {
    fail(errors, 1, "file", error instanceof Error ? error.message : "File Excel tidak valid.");
    return { rows: [], errors };
  }

  const headerWidth = QUESTION_BANK_HEADERS.length;
  const header = matrix[0] ?? [];
  if (header.length !== headerWidth || header.some((value, index) => normalizeCell(value) !== QUESTION_BANK_HEADERS[index])) {
    fail(errors, 1, "header", `Header harus sama persis dengan template resmi dan memiliki tepat ${headerWidth} kolom (termasuk kolom "Alasan" di paling akhir).`);
    return { rows: [], errors };
  }

  const lastDataIndex = matrix.length - 1;
  if (lastDataIndex < 1) {
    fail(errors, 1, "rows", "Workbook harus memiliki minimal satu baris soal.");
    return { rows: [], errors };
  }

  if (lastDataIndex > MAX_ROWS) {
    fail(errors, 2, "rows", `Maksimal ${MAX_ROWS} soal dalam satu import.`);
    return { rows: [], errors };
  }

  const rows: QuestionImportRow[] = [];
  const seenNos = new Set<number>();

  for (let r = 1; r <= lastDataIndex; r += 1) {
    const excelRow = r + 1;
    const values = Array.from({ length: headerWidth }, (_, c) => matrix[r]?.[c]);
    const hasAnyValue = values.slice(1).some((value, index) => {
      const normalized = normalizeCell(value);
      return normalized !== "" && !(index === 9 && normalizeYesNo(normalized) === false);
    });
    if (!hasAnyValue) continue;

    const no = parseInteger(values[0]);
    const question = normalizeCell(values[1]);
    const optionA = normalizeCell(values[2]);
    const optionB = normalizeCell(values[3]);
    const optionC = normalizeCell(values[4]);
    const optionD = normalizeCell(values[5]);
    const correct = normalizeCell(values[6]).toUpperCase();
    const topic = normalizeCell(values[7]);
    const difficultyRaw = normalizeCell(values[8]);
    const hasMediaRaw = normalizeCell(values[9]);
    const mediaTypeRaw = normalizeCell(values[10]);
    const mediaFilename = normalizeCell(values[11]);
    const maxPlayCount = parseInteger(values[12]);
    const explanation = normalizeCell(values[13]);

    if (no === null || no < 1) fail(errors, excelRow, "No", "Harus berupa bilangan bulat positif.");
    else if (seenNos.has(no)) fail(errors, excelRow, "No", "Nomor soal harus unik.");
    else seenNos.add(no);

    if (!question) fail(errors, excelRow, "Pertanyaan", "Tidak boleh kosong.");
    else if (question.length > MAX_TEXT_LENGTH) fail(errors, excelRow, "Pertanyaan", `Maksimal ${MAX_TEXT_LENGTH} karakter.`);

    for (const [label, value] of [["Pilihan A", optionA], ["Pilihan B", optionB], ["Pilihan C", optionC], ["Pilihan D", optionD]] as const) {
      if (!value) fail(errors, excelRow, label, "Tidak boleh kosong.");
      else if (value.length > MAX_OPTION_LENGTH) fail(errors, excelRow, label, `Maksimal ${MAX_OPTION_LENGTH} karakter.`);
    }

    if (!("ABCD" as string).includes(correct) || correct.length !== 1) {
      fail(errors, excelRow, "Jawaban Benar", "Harus tepat A, B, C, atau D.");
    }

    if (topic.length > MAX_TOPIC_LENGTH) fail(errors, excelRow, "Topik", `Maksimal ${MAX_TOPIC_LENGTH} karakter.`);

    // Normalisasi difficulty
    const difficulty = normalizeDifficulty(difficultyRaw);
    if (!difficulty) {
      fail(errors, excelRow, "Tingkat Kesulitan", 'Harus salah satu: Mudah/Sedang/Sulit (atau easy/medium/hard).');
    }

    if (explanation.length > MAX_EXPLANATION_LENGTH) {
      fail(errors, excelRow, "Alasan", `Maksimal ${MAX_EXPLANATION_LENGTH} karakter.`);
    }

    // Normalisasi Ya/Tidak
    const hasMedia = normalizeYesNo(hasMediaRaw);
    if (hasMedia === null) {
      fail(errors, excelRow, "Ada Media?", "Harus Ya atau Tidak.");
    }

    const realHasMedia = hasMedia === true;

    if (realHasMedia) {
      const mediaType = normalizeMediaType(mediaTypeRaw);
      if (!mediaType) {
        fail(errors, excelRow, "Jenis Media", "Harus Audio, Gambar, atau Video.");
      }
      if (!mediaFilename) fail(errors, excelRow, "Nama Media", "Wajib diisi jika Ada Media? = Ya.");
      else if (mediaFilename.length > MAX_FILENAME_LENGTH) fail(errors, excelRow, "Nama Media", `Maksimal ${MAX_FILENAME_LENGTH} karakter.`);
      else if (mediaFilename.includes("/") || mediaFilename.includes("\\")) fail(errors, excelRow, "Nama Media", "Harus nama file saja, tanpa folder atau path.");

      if (mediaType === "image") {
        if (maxPlayCount !== null) fail(errors, excelRow, "Maks. Pemutaran", "Untuk gambar harus kosong.");
      } else if (mediaType === "audio" || mediaType === "video") {
        if (maxPlayCount === null || maxPlayCount < 1 || maxPlayCount > 20) {
          fail(errors, excelRow, "Maks. Pemutaran", "Untuk audio/video harus bilangan bulat 1–20.");
        }
      }
    } else if (hasMedia === false) {
      // Media tidak aktif — kolom L dan M harus kosong
      if (mediaFilename && mediaFilename !== "-") {
        fail(errors, excelRow, "Nama Media", "Kosongkan jika Ada Media? = Tidak.");
      }
      if (maxPlayCount !== null) {
        fail(errors, excelRow, "Maks. Pemutaran", "Kosongkan jika Ada Media? = Tidak.");
      }
    }

    if (
      no !== null &&
      no >= 1 &&
      question &&
      optionA &&
      optionB &&
      optionC &&
      optionD &&
      ["A", "B", "C", "D"].includes(correct) &&
      difficulty &&
      hasMedia !== null
    ) {
      const mediaType = realHasMedia ? normalizeMediaType(mediaTypeRaw) : null;

      rows.push({
        no,
        question,
        options: { A: optionA, B: optionB, C: optionC, D: optionD },
        correctOptionKey: correct as QuestionImportRow["correctOptionKey"],
        topic,
        difficulty,
        hasMedia: realHasMedia,
        mediaType,
        mediaFilename: realHasMedia ? mediaFilename : null,
        maxPlayCount: realHasMedia && (mediaType === "audio" || mediaType === "video") ? maxPlayCount : null,
        explanation: explanation || null,
      });
    }
  }

  rows.sort((a, b) => a.no - b.no);
  return { rows, errors };
}