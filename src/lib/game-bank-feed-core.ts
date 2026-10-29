/**
 * Bentuk netral soal untuk game mandiri + pemetaan murni dari baris
 * basis data Bank Soal LMS. Berkas ini tidak mengimpor apa pun dari
 * server, supaya bisa diuji unit secara langsung.
 */

export type LmsBankSummary = {
  id: string;
  name: string;
  questionCount: number;
};

export type LmsQuestion = {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  isArabic: boolean;
};

type QuestionRow = {
  id: string;
  question_text: string | null;
  correct_option_key: string | null;
};

type OptionRow = {
  question_id: string;
  option_key: string;
  option_text: string;
};

const ARABIC_RE = /[\u0600-\u06FF]/;
const OPTION_KEYS = ["A", "B", "C", "D"] as const;

/** Pemetaan murni baris DB ke soal netral; bisa diuji tanpa basis data. */
export function mapBankQuestions(
  questions: QuestionRow[],
  options: OptionRow[],
): LmsQuestion[] {
  const byQuestion = new Map<string, OptionRow[]>();
  for (const opt of options) {
    const list = byQuestion.get(opt.question_id) ?? [];
    list.push(opt);
    byQuestion.set(opt.question_id, list);
  }

  const out: LmsQuestion[] = [];
  for (const q of questions) {
    const prompt = (q.question_text ?? "").trim();
    const key = (q.correct_option_key ?? "").trim().toUpperCase();
    if (!prompt || !OPTION_KEYS.includes(key as (typeof OPTION_KEYS)[number])) {
      continue;
    }
    const opts = (byQuestion.get(q.id) ?? [])
      .slice()
      .sort((a, b) => a.option_key.localeCompare(b.option_key));
    if (opts.length !== 4) continue;
    const texts = opts.map((o) => (o.option_text ?? "").trim());
    if (texts.some((t) => t.length === 0)) continue;
    const correctIndex = OPTION_KEYS.indexOf(
      key as (typeof OPTION_KEYS)[number],
    );
    if (opts[correctIndex]?.option_key !== key) continue;
    out.push({
      id: q.id,
      prompt,
      options: texts,
      correctIndex,
      isArabic: ARABIC_RE.test(prompt),
    });
  }
  return out;
}

