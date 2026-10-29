import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  hasCompleteMultipleChoiceOptions,
} from "../../src/lib/game-engine/room-store";
import { parseMarkdownToImportRows } from "../../src/lib/question-bank/md-parser";

describe("Room question option integrity", () => {
  test("accepts four non-empty A/B/C/D choices", () => {
    assert.equal(
      hasCompleteMultipleChoiceOptions([
        { option_key: "A", option_text: "Satu" },
        { option_key: "B", option_text: "Dua" },
        { option_key: "C", option_text: "Tiga" },
        { option_key: "D", option_text: "Empat" },
      ]),
      true,
    );
  });

  test("rejects missing, empty, or duplicate choices", () => {
    assert.equal(
      hasCompleteMultipleChoiceOptions([
        { option_key: "A", option_text: "Satu" },
        { option_key: "B", option_text: "Dua" },
        { option_key: "C", option_text: "Tiga" },
        { option_key: "C", option_text: "Tiga lagi" },
      ]),
      false,
    );

    assert.equal(
      hasCompleteMultipleChoiceOptions([
        { option_key: "A", option_text: "Satu" },
        { option_key: "B", option_text: "Dua" },
        { option_key: "C", option_text: "" },
        { option_key: "D", option_text: "Empat" },
      ]),
      false,
    );

    assert.equal(
      hasCompleteMultipleChoiceOptions([
        { option_key: "A", option_text: "Pilihan A" },
        { option_key: "B", option_text: "Jawaban nyata" },
        { option_key: "C", option_text: "Jawaban nyata" },
        { option_key: "D", option_text: "Jawaban nyata" },
      ]),
      false,
    );
  });

  test("does not turn missing Markdown choices into fake placeholders", () => {
    const result = parseMarkdownToImportRows(`
      # Soal 1: Apa arti kata كتاب؟
      - A. Buku [x]
      - B. Pena
    `);

    assert.equal(result.rows.length, 0);
    assert.ok(result.errors.some((error) => error.includes("C, D")));
  });
});
