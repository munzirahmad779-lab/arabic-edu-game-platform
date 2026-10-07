/**
 * Arabic-safe text manipulation utilities for Magguru Game Platform.
 * Guarantees grapheme-cluster integrity, diacritic preservation, and safe normalization.
 * NO raw split("") or destructive character stripping.
 */

export function isArabicDiacritic(code: number): boolean {
  return (
    (code >= 0x064b && code <= 0x065f) || // Fathatan to Sukun
    code === 0x0670 ||                     // Superscript Alef
    (code >= 0x06d6 && code <= 0x06dc) || // Quranic marks
    (code >= 0x06df && code <= 0x06e4) ||
    (code >= 0x06e7 && code <= 0x06e8) ||
    (code >= 0x06ea && code <= 0x06ed)
  );
}

/**
 * Splits text into user-perceived character units (grapheme clusters).
 * For Arabic text, combining diacritics (harakat/shaddah) stay attached to base letter.
 */
export function splitIntoGraphemes(value: string): string[] {
  if (!value) return [];
  const normalized = value.normalize("NFC");

  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter("ar", { granularity: "grapheme" });
    const segments: string[] = [];
    for (const seg of segmenter.segment(normalized)) {
      if (seg.segment.trim().length > 0) {
        segments.push(seg.segment);
      }
    }
    return segments;
  }

  const result: string[] = [];
  for (const char of Array.from(normalized)) {
    if (char.trim().length === 0) continue;
    const code = char.codePointAt(0) ?? 0;

    if (isArabicDiacritic(code) && result.length > 0) {
      result[result.length - 1] += char;
    } else {
      result.push(char);
    }
  }

  return result;
}

export function hasArabic(value: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(value);
}

export function normalizeAnswer(value: string): string {
  return value.normalize("NFC").replace(/\s+/g, " ").trim();
}

/**
 * Case-insensitive & normalized comparison for answers.
 */
export function compareAnswers(userAnswer: string, correctAnswer: string): boolean {
  const normUser = normalizeAnswer(userAnswer).toLowerCase();
  const normCorrect = normalizeAnswer(correctAnswer).toLowerCase();
  return normUser === normCorrect;
}
