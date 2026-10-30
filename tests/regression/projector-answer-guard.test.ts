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
 * dibersihkan saat permainan selesai dan saat dimulai ulang.
 *
 * Lanjutan: anomali soal 19 putaran 3 (30 Okt 2026). Jawaban soal 18
 * milik tim penekan terakhir tercatat dua kali: putaran ulangnya baru
 * diproses sesudah indeks naik ke soal 19 oleh closure basi, dan lolos
 * karena set penjaga dibersihkan seluruhnya tepat saat indeks berganti
 * (effect lama di projector-screen), tidak ada jalur masuk yang
 * membandingkan indeks soal peristiwa dengan indeks berjalan, dan
 * poller memutar ulang event tanpa cap generasi. Tiga lapis perbaikan:
 * (1) set penjaga TIDAK lagi dibersihkan saat indeks berubah, karena
 * kunci sudah berdimensi indeks; (2) handleRecordAnswer menolak
 * peristiwa yang indeks soalnya tidak sama dengan indeks berjalan
 * (dibaca dari ref), dan kedua listener broadcast meneruskan
 * questionIndex yang dikirim stik; (3) poller membuang respons yang
 * diterbitkan sebelum pergantian soal terakhir (cap generasi) dan
 * melewati event yang tidak lebih baru dari watermark pemrosesan.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  isAnswerEventStale,
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

  test("Sesudah set dibersihkan (mulai ulang / permainan selesai), tim yang sama lolos lagi", () => {
    const marked = new Set<string>();
    assert.equal(tryMarkRecordedAnswer(marked, 0, "team-1"), true);
    marked.clear();
    assert.equal(tryMarkRecordedAnswer(marked, 0, "team-1"), true);
  });

  test("SKENARIO SOAL 19: tanda soal lama bertahan melewati pergantian soal dan menahan kedatangan basi", () => {
    const marked = new Set<string>();
    // Pencatatan sah penekan terakhir soal 18 (indeks 17, team-4):
    // tertandai di bawah indeks soal lahirnya.
    assert.equal(tryMarkRecordedAnswer(marked, 17, "team-4"), true);
    // Indeks naik ke 18 TANPA membersihkan set. Inilah perilaku sesudah
    // perbaikan; effect lama membersihkan seluruh set tepat di titik
    // ini dan membuka pintu bagi pencatatan hantu.
    // Kedatangan basi: closure soal 18 memutar ulang press yang sama dan
    // menandai di bawah indeks lamanya. Harus ditolak, tanpa efek apa
    // pun ke soal berjalan.
    assert.equal(tryMarkRecordedAnswer(marked, 17, "team-4"), false);
    assert.equal(tryMarkRecordedAnswer(marked, 17, "team-4"), false);
    // Jawaban sah soal baru (indeks 18) dari tim yang sama tetap lolos:
    // kunci berdimensi indeks, tanda lama tidak menghalangi soal baru.
    assert.equal(tryMarkRecordedAnswer(marked, 18, "team-4"), true);
    assert.equal(marked.size, 2);
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

  test("Set penjaga dipertahankan saat indeks soal berubah; dibersihkan hanya saat mulai ulang dan selesai", () => {
    // Harapan lama di tes ini (set dibersihkan pada perubahan indeks)
    // adalah lubangnya sendiri: tanda 17:team-4 terhapus tepat sebelum
    // kelanjutan basi soal 18 berjalan, sehingga press yang sama bisa
    // dinilai ulang dan ditulis ke state soal 19. Kini effect pembersih
    // itu tidak boleh ada lagi.
    assert.doesNotMatch(
      projectorSource,
      /recordedAnswerKeysRef\.current\.clear\(\);\s*\n\s*\}, \[currentQuestionIndex\]\);/,
    );
    // Pembersihan yang tersisa tepat dua tempat: cabang selesai
    // permainan dan mulai ulang.
    const clearCount =
      projectorSource.match(/recordedAnswerKeysRef\.current\.clear\(\);/g)
        ?.length ?? 0;
    assert.equal(clearCount, 2);
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

describe("Penolakan indeks peristiwa basi di pintu masuk pencatatan", () => {
  test("Peristiwa berindeks 17 yang tiba saat indeks berjalan 18 ditolak; berindeks 18 diterima", () => {
    assert.equal(isAnswerEventStale(17, 18), true);
    assert.equal(isAnswerEventStale(0, 18), true);
    // Indeks dari masa depan juga bukan peristiwa soal berjalan.
    assert.equal(isAnswerEventStale(19, 18), true);
    assert.equal(isAnswerEventStale(18, 18), false);
  });

  test("Peristiwa tanpa indeks (jalur manual guru, poller, klien lama) diterima", () => {
    assert.equal(isAnswerEventStale(undefined, 18), false);
    assert.equal(isAnswerEventStale(null, 18), false);
    assert.equal(isAnswerEventStale(Number.NaN, 18), false);
  });

  test("handleRecordAnswer memeriksa indeks peristiwa terhadap ref berjalan sebelum penjaga", () => {
    const fnStart = projectorSource.indexOf(
      "const handleRecordAnswer = useCallback(",
    );
    assert.ok(fnStart >= 0);
    assert.match(
      projectorSource.slice(fnStart, fnStart + 220),
      /\(teamId: string, optionKey: string, eventQuestionIndex\?: number\)/,
    );
    const stalePos = projectorSource.indexOf("isAnswerEventStale(", fnStart);
    const guardPos = projectorSource.indexOf("tryMarkRecordedAnswer(", fnStart);
    assert.ok(stalePos > fnStart);
    assert.ok(guardPos > stalePos);
    // Perbandingannya terhadap ref cermin indeks berjalan, bukan closure.
    assert.match(
      projectorSource,
      /const currentQuestionIndexRef = useRef\(currentQuestionIndex\);/,
    );
    assert.match(
      projectorSource,
      /currentQuestionIndexRef\.current = currentQuestionIndex;/,
    );
    assert.match(
      projectorSource,
      /isAnswerEventStale\(eventQuestionIndex, currentQuestionIndexRef\.current\)/,
    );
  });

  test("Kedua listener broadcast meneruskan questionIndex yang dikirim stik", () => {
    const passCount =
      projectorSource.match(/handleRecordAnswer\(teamId, optionKey, questionIndex\)/g)
        ?.length ?? 0;
    assert.equal(passCount, 2);
    const destructureCount =
      projectorSource.match(/const \{ teamId, optionKey, questionIndex \} = /g)
        ?.length ?? 0;
    assert.equal(destructureCount, 2);
  });
});
