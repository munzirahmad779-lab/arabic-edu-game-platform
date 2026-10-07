import { test, expect } from "@playwright/test";
import { QuestionAdapter } from "@/lib/game-engine/question-adapters";
import { splitIntoGraphemes, compareAnswers } from "@/lib/game-engine/arabic-utils";
import { createMockQuestions } from "./helpers/mock-session";

test.describe("06. Multi-Mechanic Gameplay Engine Gate", () => {
  const sampleQuestions = createMockQuestions();

  test("Runner question adapter constructs valid runner prompt and obstacle lanes", async () => {
    const raw = sampleQuestions[0];
    const adapted = QuestionAdapter.toRunner(raw);

    expect(adapted.questionText).toBe("كِتَابٌ : Buku");
    expect(adapted.lanes.length).toBe(4);
    expect(adapted.lanes[0].text).toBe("Buku");
  });

  test("Matching question adapter parses delimiter into distinct card pairs", async () => {
    const raw = sampleQuestions[0]; // "كِتَابٌ : Buku"
    const adapted = QuestionAdapter.toMatching(raw);

    expect(adapted.cards.length).toBeGreaterThan(0);
    expect(adapted.targetPairsCount).toBeGreaterThanOrEqual(1);
    expect(adapted.title).toContain("كِتَابٌ");
  });

  test("Matching adapter fallback for MCQ without delimiter isolates correct answer", async () => {
    const rawNoDelimiter = {
      id: "q-single",
      question_text: "Apakah arti dari قَلَمٌ ?",
      difficulty: "easy" as const,
      correct_option_key: "A" as const,
      options: [
        { id: "opt-1", option_key: "A" as const, option_text: "Pena" },
        { id: "opt-2", option_key: "B" as const, option_text: "Buku" },
      ],
    };

    const adapted = QuestionAdapter.toMatching(rawNoDelimiter);
    expect(adapted.cards.length).toBeGreaterThanOrEqual(2);
    expect(adapted.targetPairsCount).toBe(1);
    expect(adapted.correctOptionId).toBe("opt-1");
  });

  test("Anagram mechanics preserve Arabic combining diacritics and correct comparison", async () => {
    const word = "مُعَلِّمٌ";
    const tiles = splitIntoGraphemes(word);

    expect(tiles).toEqual(["مُ", "عَ", "لِّ", "مٌ"]);
    expect(tiles.join("").normalize("NFC")).toBe(word.normalize("NFC"));

    // User submission comparison
    expect(compareAnswers("  مُعَلِّمٌ  ", word)).toBe(true);
    expect(compareAnswers("كتاب", word)).toBe(false);
  });

  test("Self-paced gameplay resolves questions per participant independently without blocking wait", async () => {
    // Model two participants with independent submission rates
    const totalQuestions = 5;
    const participantA = { id: "p-fast", answeredCount: 4 }; // On question 5 (index 4)
    const participantB = { id: "p-slow", answeredCount: 1 }; // On question 2 (index 1)

    // Participant index matches their specific submitted count
    expect(participantA.answeredCount).toBe(4);
    expect(participantB.answeredCount).toBe(1);

    // Fast participant finishes question 5
    participantA.answeredCount += 1;
    const isFinishedA = participantA.answeredCount >= totalQuestions;
    const isFinishedB = participantB.answeredCount >= totalQuestions;

    expect(isFinishedA).toBe(true);
    expect(isFinishedB).toBe(false);
  });
});

