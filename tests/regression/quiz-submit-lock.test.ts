/**
 * Regresi: siswa terkunci permanen pada satu soal bila pengiriman
 * jawabannya ditolak server (audit armada 6 Nov 2026, klon K28).
 *
 * Akar masalah di quiz-player.tsx: hasAnswered dipasang true SEBELUM
 * await onSubmitAnswer. AnswerResult membawa accepted: boolean dan
 * jalur pemanggil (halaman join) mengembalikan accepted: false untuk
 * kegagalan jaringan dan penolakan server. Akibatnya siswa yang
 * jawabannya tidak pernah diterima tetap terkunci untuk soal itu dan
 * menerima umpan balik "Jawaban Kurang Tepat" yang tidak benar.
 *
 * Perbaikan yang ditegaskan tes statis ini (pola suite yang ada):
 * hasAnswered hanya dipasang SESUDAH hasil accepted diterima; pada
 * accepted: false atau promise yang melempar, kunci dibebaskan
 * (selectedId dikosongkan, submitting dimatikan) tanpa peristiwa
 * umpan balik, sehingga siswa dapat mencoba lagi.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const quizSource = readFileSync(
  path.join(
    process.cwd(),
    "src/components/game-players/quiz-player.tsx",
  ),
  "utf8",
);

describe("Kunci jawaban kuis hanya terpasang sesudah diterima server (K28)", () => {
  test("hasAnswered(true) dipasang sesudah await onSubmitAnswer, bukan sebelumnya", () => {
    const awaitIdx = quizSource.indexOf("await onSubmitAnswer");
    const lockIdx = quizSource.indexOf("setHasAnswered(true)");
    assert.notEqual(awaitIdx, -1, "await onSubmitAnswer harus ada");
    assert.notEqual(lockIdx, -1, "setHasAnswered(true) harus ada");
    assert.ok(
      awaitIdx < lockIdx,
      "setHasAnswered(true) tidak boleh mendahului await onSubmitAnswer",
    );
  });

  test("accepted:false membebaskan kunci tanpa umpan balik salah", () => {
    assert.match(
      quizSource,
      /if \(!result\.accepted\) \{\s*\n\s*setSelectedId\(null\);/,
      "cabang accepted:false harus mengosongkan pilihan dan membebaskan siswa",
    );
    const acceptedIdx = quizSource.indexOf("if (!result.accepted)");
    const lockIdx = quizSource.indexOf("setHasAnswered(true)");
    assert.ok(
      acceptedIdx !== -1 && acceptedIdx < lockIdx,
      "pemeriksaan accepted harus mendahului pemasangan hasAnswered",
    );
  });

  test("penolakan promise (jaringan gagal) ikut membebaskan kunci", () => {
    assert.match(
      quizSource,
      /try \{\s*\n\s*result = await onSubmitAnswer/,
      "await onSubmitAnswer harus dibungkus try",
    );
    assert.match(
      quizSource,
      /catch \{\s*\n\s*setSelectedId\(null\);/,
      "cabang catch harus membebaskan pilihan siswa",
    );
  });
});
