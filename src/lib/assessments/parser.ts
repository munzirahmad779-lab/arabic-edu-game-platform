import * as XLSX from "xlsx";
import type { AnswerKey, SectionType } from "./types";

export type ParsedSection = {
  section_type: SectionType;
  title: string;
  duration_minutes: number;
  audio_play_once: boolean;
  allow_review: boolean;
  instructions: string | null;
};

export type ParsedPassage = {
  ref_id: string;
  section_type: SectionType;
  passage_order: number;
  title: string | null;
  content: string;
};

export type ParsedAudioGroup = {
  ref_id: string;
  section_type: SectionType;
  group_order: number;
  title: string | null;
};

export type ParsedQuestion = {
  section_type: SectionType;
  question_number: number;
  passage_ref: string | null;
  audio_ref: string | null;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: AnswerKey;
  difficulty: "easy" | "medium" | "hard" | null;
};

export type ParsedWorkbook = {
  sections: ParsedSection[];
  passages: ParsedPassage[];
  audioGroups: ParsedAudioGroup[];
  questions: ParsedQuestion[];
  errors: string[];
};

function toStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function toInt(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function toBool(v: unknown): boolean {
  const s = toStr(v).toUpperCase();
  return s === "YES" || s === "TRUE" || s === "1" || s === "Y";
}

function isSectionType(v: string): v is SectionType {
  return v === "listening" || v === "structure" || v === "reading";
}

function isAnswerKey(v: string): v is AnswerKey {
  return v === "A" || v === "B" || v === "C" || v === "D";
}

export function parseAssessmentWorkbook(buffer: ArrayBuffer): ParsedWorkbook {
  const errors: string[] = [];
  const wb = XLSX.read(buffer, { type: "array" });

  // ============ SECTIONS ============
  const sections: ParsedSection[] = [];
  const sectionSheet = wb.Sheets["SECTIONS"];
  if (!sectionSheet) {
    errors.push("Sheet 'SECTIONS' tidak ditemukan.");
  } else {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sectionSheet, {
      defval: "",
    });
    for (let i = 0; i < rows.length; i += 1) {
      const r = rows[i];
      const st = toStr(r["Section_Type"]).toLowerCase();
      if (!st) continue;
      if (!isSectionType(st)) {
        errors.push(`SECTIONS baris ${i + 2}: Section_Type harus listening/structure/reading.`);
        continue;
      }
      const title = toStr(r["Title"]) || st;
      const duration = toInt(r["Duration_Minutes"]);
      if (duration <= 0) {
        errors.push(`SECTIONS baris ${i + 2}: Duration_Minutes harus > 0.`);
        continue;
      }
      sections.push({
        section_type: st,
        title,
        duration_minutes: duration,
        audio_play_once: toBool(r["Audio_Play_Once"]),
        allow_review: toBool(r["Allow_Review"]),
        instructions: toStr(r["Instructions"]) || null,
      });
    }
    if (sections.length === 0) {
      errors.push("SECTIONS: minimal 1 baris section wajib diisi.");
    }
  }

  // ============ PASSAGES ============
  const passages: ParsedPassage[] = [];
  const passageSheet = wb.Sheets["PASSAGES"];
  if (passageSheet) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(passageSheet, {
      defval: "",
    });
    for (let i = 0; i < rows.length; i += 1) {
      const r = rows[i];
      const ref = toStr(r["Passage_ID"]);
      if (!ref) continue;
      const st = toStr(r["Section"]).toLowerCase();
      if (!isSectionType(st)) {
        errors.push(`PASSAGES baris ${i + 2}: Section tidak valid.`);
        continue;
      }
      const content = toStr(r["Content"]);
      if (!content) {
        errors.push(`PASSAGES baris ${i + 2}: Content tidak boleh kosong.`);
        continue;
      }
      passages.push({
        ref_id: ref,
        section_type: st,
        passage_order: toInt(r["Order"]) || i + 1,
        title: toStr(r["Title"]) || null,
        content,
      });
    }
  }

  // ============ AUDIO GROUPS ============
  const audioGroups: ParsedAudioGroup[] = [];
  const audioSheet = wb.Sheets["AUDIO_GROUPS"];
  if (audioSheet) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(audioSheet, {
      defval: "",
    });
    for (let i = 0; i < rows.length; i += 1) {
      const r = rows[i];
      const ref = toStr(r["Audio_ID"]);
      if (!ref) continue;
      const st = toStr(r["Section"]).toLowerCase();
      if (!isSectionType(st)) {
        errors.push(`AUDIO_GROUPS baris ${i + 2}: Section tidak valid.`);
        continue;
      }
      audioGroups.push({
        ref_id: ref,
        section_type: st,
        group_order: toInt(r["Order"]) || i + 1,
        title: toStr(r["Title"]) || null,
      });
    }
  }

  // ============ QUESTIONS ============
  const questions: ParsedQuestion[] = [];
  const qSheet = wb.Sheets["QUESTIONS"];
  if (!qSheet) {
    errors.push("Sheet 'QUESTIONS' tidak ditemukan.");
  } else {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(qSheet, {
      defval: "",
    });
    for (let i = 0; i < rows.length; i += 1) {
      const r = rows[i];
      const st = toStr(r["Section"]).toLowerCase();
      if (!st) continue;
      if (!isSectionType(st)) {
        errors.push(`QUESTIONS baris ${i + 2}: Section tidak valid.`);
        continue;
      }
      const qn = toInt(r["Question_Number"]);
      if (qn <= 0) {
        errors.push(`QUESTIONS baris ${i + 2}: Question_Number harus > 0.`);
        continue;
      }
      const qText = toStr(r["Soal"]);
      if (!qText) {
        errors.push(`QUESTIONS baris ${i + 2}: Soal wajib diisi.`);
        continue;
      }
      const a = toStr(r["A"]);
      const b = toStr(r["B"]);
      const c = toStr(r["C"]);
      const d = toStr(r["D"]);
      if (!a || !b || !c || !d) {
        errors.push(`QUESTIONS baris ${i + 2}: Semua opsi A/B/C/D wajib diisi.`);
        continue;
      }
      const ans = toStr(r["Jawaban"]).toUpperCase();
      if (!isAnswerKey(ans)) {
        errors.push(`QUESTIONS baris ${i + 2}: Jawaban harus A/B/C/D.`);
        continue;
      }
      const passageRef = toStr(r["Passage_ID"]) || null;
      const audioRef = toStr(r["Audio_ID"]) || null;
      const diffRaw = toStr(r["Difficulty"]).toLowerCase();
      const difficulty =
        diffRaw === "easy" || diffRaw === "medium" || diffRaw === "hard"
          ? (diffRaw as "easy" | "medium" | "hard")
          : null;

      questions.push({
        section_type: st,
        question_number: qn,
        passage_ref: passageRef,
        audio_ref: audioRef,
        question_text: qText,
        option_a: a,
        option_b: b,
        option_c: c,
        option_d: d,
        correct_answer: ans,
        difficulty,
      });
    }
    if (questions.length === 0) {
      errors.push("QUESTIONS: minimal 1 soal wajib ada.");
    }
  }

  // Validasi referensi passage & audio
  const passageRefs = new Set(passages.map((p) => p.ref_id));
  const audioRefs = new Set(audioGroups.map((a) => a.ref_id));
  for (const q of questions) {
    if (q.passage_ref && !passageRefs.has(q.passage_ref)) {
      errors.push(`Soal #${q.question_number} (${q.section_type}): Passage_ID "${q.passage_ref}" tidak ditemukan di sheet PASSAGES.`);
    }
    if (q.audio_ref && !audioRefs.has(q.audio_ref)) {
      errors.push(`Soal #${q.question_number} (${q.section_type}): Audio_ID "${q.audio_ref}" tidak ditemukan di sheet AUDIO_GROUPS.`);
    }
  }

  // Duplikat nomor soal per section
  const seen = new Set<string>();
  for (const q of questions) {
    const key = `${q.section_type}#${q.question_number}`;
    if (seen.has(key)) {
      errors.push(`Soal duplikat: ${q.section_type} nomor ${q.question_number}.`);
    }
    seen.add(key);
  }

  // Pastikan setiap section punya minimal 1 soal
  for (const s of sections) {
    const count = questions.filter((q) => q.section_type === s.section_type).length;
    if (count === 0) {
      errors.push(`Section "${s.section_type}" tidak punya soal.`);
    }
  }

  return { sections, passages, audioGroups, questions, errors };
}