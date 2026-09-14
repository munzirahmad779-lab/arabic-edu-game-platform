import { unzipSync } from "fflate";

export const STUDENT_HEADERS = ["No", "Nama", "PIN"] as const;

export type StudentImportRow = {
  no: number;
  name: string;
  pin: string;
};

export type StudentImportError = {
  row: number;
  field: string;
  message: string;
};

export type StudentImportPreview = {
  rows: StudentImportRow[];
  errors: StudentImportError[];
};

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 100;
const MAX_TOTAL_UNCOMPRESSED_BYTES = 20 * 1024 * 1024;
const MAX_ROWS = 200;
const MAX_NAME_LENGTH = 100;

function fail(errors: StudentImportError[], row: number, field: string, message: string) {
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

export async function parseStudentWorkbook(file: File): Promise<StudentImportPreview> {
  const errors: StudentImportError[] = [];
  let matrix: unknown[][];

  try {
    matrix = await readXlsxRows(file);
  } catch (error) {
    fail(errors, 1, "file", error instanceof Error ? error.message : "File Excel tidak valid.");
    return { rows: [], errors };
  }

  const headerWidth = STUDENT_HEADERS.length;
  const header = matrix[0] ?? [];
  if (header.length !== headerWidth || header.some((value, index) => normalizeCell(value) !== STUDENT_HEADERS[index])) {
    fail(errors, 1, "header", "Header harus sama persis: No, Nama, PIN (tepat 3 kolom).");
    return { rows: [], errors };
  }

  const lastDataIndex = matrix.length - 1;
  if (lastDataIndex < 1) {
    fail(errors, 1, "rows", "Workbook harus memiliki minimal satu baris siswa.");
    return { rows: [], errors };
  }

  if (lastDataIndex > MAX_ROWS) {
    fail(errors, 2, "rows", `Maksimal ${MAX_ROWS} siswa dalam satu import.`);
    return { rows: [], errors };
  }

  const rows: StudentImportRow[] = [];
  const seenNos = new Set<number>();
  const seenNames = new Set<string>();

  for (let r = 1; r <= lastDataIndex; r += 1) {
    const excelRow = r + 1;
    const values = Array.from({ length: headerWidth }, (_, c) => matrix[r]?.[c]);
    const hasAnyValue = values.some((v) => normalizeCell(v) !== "");
    if (!hasAnyValue) continue;

    const no = parseInteger(values[0]);
    const name = normalizeCell(values[1]);
    const pin = normalizeCell(values[2]);

    if (no === null || no < 1) fail(errors, excelRow, "No", "Harus bilangan bulat positif.");
    else if (seenNos.has(no)) fail(errors, excelRow, "No", "Nomor harus unik.");
    else seenNos.add(no);

    if (!name) fail(errors, excelRow, "Nama", "Tidak boleh kosong.");
    else if (name.length > MAX_NAME_LENGTH) fail(errors, excelRow, "Nama", `Maksimal ${MAX_NAME_LENGTH} karakter.`);
    else {
      const key = name.toLowerCase();
      if (seenNames.has(key)) fail(errors, excelRow, "Nama", "Nama duplikat di dalam file.");
      else seenNames.add(key);
    }

    if (!/^\d{4,6}$/.test(pin)) fail(errors, excelRow, "PIN", "Harus 4-6 digit angka.");

    if (
      no !== null && no >= 1 &&
      name && name.length <= MAX_NAME_LENGTH &&
      /^\d{4,6}$/.test(pin)
    ) {
      rows.push({ no, name, pin });
    }
  }

  rows.sort((a, b) => a.no - b.no);
  return { rows, errors };
}