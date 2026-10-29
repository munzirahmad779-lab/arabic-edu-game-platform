/**
 * Regression: anomali skor proyektor karena penskoran tereksekusi
 * berulang untuk satu press (temuan uji live sesudah deploy 0078,
 * 30 Okt 2026, kendala B.5).
 *
 * Akar masalah: satu press stik tiba di proyektor lewat tiga kanal
 * (broadcast Supabase Realtime, BroadcastChannel, putaran ulang poller
 * HTTP), sedangkan handleRecordAnswer hanya dijaga guard closure
 * answers[teamId] yang bisa basi di antara kedatangan kanal-kanal itu.
 * Satu jawaban benar bisa diskor berulang (teramati 7 kali eksekusi
 * pada satu soal), menggembungkan skor, correctCount, streak, dan
 * rotasi perwakilan.
 *
 * Perbaikan: penjaga ref sinkron berkunci `${questionIndex}:${teamId}`
 * (helper murni projector-answer-guard) yang dicentang dan ditandai di
 * pintu masuk handleRecordAnswer sebelum state apa pun diubah, dan
 * dibersihkan saat indeks soal berubah, saat permainan selesai, dan
 * saat dimulai ulang.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  recordedAnswerKey,
  tryMarkRecordedAnswer,
} from "../../src/lib/game-engine/projector-answer-guard";

describe("Penjaga anti duplikat pencatatan jawaban proyektor", () => {
  test("Kunci berbentuk indeksSoal:teamId", () => {
    assert.equal(recordedAnswerKey(3, "team-2"), "3:team-2");
    assert.equal(recordedAnswerKey(0, "team-4"), "0:team-4");
  });

  test("Kedatangan pertama lolos, duplikat soal+tim yang sama ditolak", () => {
    const marked = new Set<string>();
    assert.equal(tryMarkRecordedAnswer(marked, 5, "team-3"), true);
    assert.equal(tryMarkRecordedAnswer(marked, 5, "team-3"), false);
    assert.equal(tryMarkRecordedAnswer(marked, 5, "team-3"), false);
    assert.equal(marked.size, 1);
  });

  test("Tim lain pada soal yang sama dan tim yang sama pada soal lain tetap lolos", () => {
    const marked = new Set<string>();
    assert.equal(tryMarkRecordedAnswer(marked, 5, "team-3"), true);
    assert.equal(tryMarkRecordedAnswer(marked, 5, "team-4"), true);
    assert.equal(tryMarkRecordedAnswer(marked, 6, "team-3"), true);
    assert.equal(marked.size, 3);
  });

  test("Sesudah set dibersihkan (pindah soal / mulai ulang), tim yang sama lolos lagi", () => {
    const marked = new Set<string>();
    assert.equal(tryMarkRecordedAnswer(marked, 0, "team-1"), true);
    marked.clear();
    assert.equal(tryMarkRecordedAnswer(marked, 0, "team-1"), true);
  });
});

const projectorSource = readFileSync(
  path.join(
    process.cwd(),
    "src/app/dashboard/games/[gameId]/projector/projector-screen.tsx",
  ),
  "utf8",
);

describe("Penjaga terpasang di handleRecordAnswer layar proyektor", () => {
  test("Penjaga dipanggil sebelum guard answers[teamId] di dalam handleRecordAnswer", () => {
    const fnStart = projectorSource.indexOf("const handleRecordAnswer = useCallback(");
    assert.ok(fnStart >= 0);
    const guardPos = projectorSource.indexOf(
      "tryMarkRecordedAnswer(",
      fnStart,
    );
    const answersGuardPos = projectorSource.indexOf(
      "if (answers[teamId]) return;",
      fnStart,
    );
    assert.ok(guardPos > fnStart);
    assert.ok(answersGuardPos > guardPos);
  });

  test("Set penjaga dibersihkan saat indeks soal berubah dan saat mulai ulang", () => {
    assert.match(
      projectorSource,
      /recordedAnswerKeysRef\.current\.clear\(\);\s*\n\s*\}, \[currentQuestionIndex\]\);/,
    );
    const restartStart = projectorSource.indexOf("const handleRestartGame = () => {");
    assert.ok(restartStart >= 0);
    const restartClearPos = projectorSource.indexOf(
      "recordedAnswerKeysRef.current.clear();",
      restartStart,
    );
    const restartBodyEnd = projectorSource.indexOf("setTeams(", restartStart);
    assert.ok(restartClearPos > restartStart && restartClearPos < restartBodyEnd);
  });
});
