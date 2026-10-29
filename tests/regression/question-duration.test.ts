/**
 * Regression: durasi per soal minimum 30 detik + override guru
 * (keputusan user 29 Okt 2026; migrasi 0074).
 *
 * Akar masalah: durasi per soal mengikuti difficulty (easy 20 dtk,
 * medium 30 dtk, hard 45 dtk, migrasi 0029) tanpa lantai minimum, dan
 * tidak ada cara bagi guru mengubahnya dari ruang guru. Di produksi
 * multi-instance, soal easy tiba di siswa dalam keadaan hampir/sudah
 * kedaluwarsa.
 *
 * Perbaikan yang dijaga tes ini (cermin TypeScript dari fungsi DB
 * public.game_effective_time_limit_seconds di migrasi 0074):
 * - Pemetaan difficulty TIDAK berubah: easy 20, medium 30, hard 45.
 * - Durasi efektif = max(override room ?? limit difficulty, 30).
 * - Override room menang atas difficulty, tetapi tetap dilantai 30.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  MIN_QUESTION_DURATION_SECONDS,
  QUESTION_DURATION_OPTIONS,
  resolveEffectiveQuestionDurationSeconds,
  timeLimitForDifficulty,
} from "../../src/lib/game-engine/question-duration";

describe("timeLimitForDifficulty (cermin migrasi 0029)", () => {
  test("easy = 20, medium = 30, hard = 45", () => {
    assert.equal(timeLimitForDifficulty("easy"), 20);
    assert.equal(timeLimitForDifficulty("medium"), 30);
    assert.equal(timeLimitForDifficulty("hard"), 45);
  });

  test("difficulty tak dikenal / kosong jatuh ke easy (20)", () => {
    assert.equal(timeLimitForDifficulty("extreme"), 20);
    assert.equal(timeLimitForDifficulty(""), 20);
    assert.equal(timeLimitForDifficulty(null), 20);
    assert.equal(timeLimitForDifficulty(undefined), 20);
  });

  test("tidak peka huruf besar/kecil", () => {
    assert.equal(timeLimitForDifficulty("HARD"), 45);
    assert.equal(timeLimitForDifficulty("Medium"), 30);
  });
});

describe("resolveEffectiveQuestionDurationSeconds (cermin migrasi 0074)", () => {
  test("lantai minimum adalah 30 detik", () => {
    assert.equal(MIN_QUESTION_DURATION_SECONDS, 30);
  });

  test("tanpa override: easy terangkat dari 20 ke lantai 30", () => {
    assert.equal(resolveEffectiveQuestionDurationSeconds("easy", null), 30);
    assert.equal(resolveEffectiveQuestionDurationSeconds("easy", undefined), 30);
  });

  test("tanpa override: medium tetap 30 dan hard tetap 45", () => {
    assert.equal(resolveEffectiveQuestionDurationSeconds("medium", null), 30);
    assert.equal(resolveEffectiveQuestionDurationSeconds("hard", null), 45);
  });

  test("override room menang atas difficulty", () => {
    assert.equal(resolveEffectiveQuestionDurationSeconds("easy", 60), 60);
    assert.equal(resolveEffectiveQuestionDurationSeconds("hard", 90), 90);
    assert.equal(resolveEffectiveQuestionDurationSeconds("medium", 120), 120);
  });

  test("override di bawah lantai tetap terangkat ke 30", () => {
    assert.equal(resolveEffectiveQuestionDurationSeconds("easy", 10), 30);
    assert.equal(resolveEffectiveQuestionDurationSeconds("hard", 30), 30);
  });

  test("override 0 / negatif dianggap tidak ada, ikut difficulty + lantai", () => {
    assert.equal(resolveEffectiveQuestionDurationSeconds("easy", 0), 30);
    assert.equal(resolveEffectiveQuestionDurationSeconds("hard", -5), 45);
  });

  test("semua pilihan durasi guru berada pada/di atas lantai", () => {
    for (const seconds of QUESTION_DURATION_OPTIONS) {
      assert.ok(seconds >= MIN_QUESTION_DURATION_SECONDS);
      assert.equal(
        resolveEffectiveQuestionDurationSeconds("easy", seconds),
        seconds,
      );
    }
  });
});
