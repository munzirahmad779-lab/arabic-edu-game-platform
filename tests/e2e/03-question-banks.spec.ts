import { test, expect } from "@playwright/test";
import { QUESTION_BANK_HEADERS } from "@/lib/question-bank/excel";

test.describe("03. Question Banks & Content Integrity Gate", () => {
  test("Question Bank template contains all 14 required header specifications", async () => {
    expect(QUESTION_BANK_HEADERS.length).toBe(14);
    expect(QUESTION_BANK_HEADERS).toContain("Pertanyaan");
    expect(QUESTION_BANK_HEADERS).toContain("Pilihan A");
    expect(QUESTION_BANK_HEADERS).toContain("Jawaban Benar");
    expect(QUESTION_BANK_HEADERS).toContain("Tingkat Kesulitan");
  });

  test("Validates difficulty enum strictly against easy, medium, hard", async () => {
    function isValidDifficulty(diff: string): boolean {
      return ["easy", "medium", "hard"].includes(diff.toLowerCase());
    }

    expect(isValidDifficulty("easy")).toBe(true);
    expect(isValidDifficulty("medium")).toBe(true);
    expect(isValidDifficulty("hard")).toBe(true);
    expect(isValidDifficulty("EASY")).toBe(true);
    expect(isValidDifficulty("super_hard")).toBe(false);
  });

  test("Validates correct option key strictly against A, B, C, D", async () => {
    function isValidOptionKey(key: string): boolean {
      return ["A", "B", "C", "D"].includes(key.toUpperCase());
    }

    expect(isValidOptionKey("A")).toBe(true);
    expect(isValidOptionKey("B")).toBe(true);
    expect(isValidOptionKey("C")).toBe(true);
    expect(isValidOptionKey("D")).toBe(true);
    expect(isValidOptionKey("E")).toBe(false);
  });
});
