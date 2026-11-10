/**
 * Regresi: room tipe whack_mole di HP siswa merender QuizPlayer untuk
 * semua tipe (W4-M4 gelombang 1, audit gabungan 10 Nov 2026).
 *
 * Akar masalah: /join/room selalu merender QuizPlayer, jadi siswa pada
 * room whack_mole tidak pernah memainkan mekanik pukul tikus. Adapter
 * ini menambahkan mode room ke WhackPlayer dengan kontrak yang sama
 * seperti pemain room lain (GamePlayerProps): vonis datang dari server
 * lewat onSubmitAnswer, karena route sesi memang menghapus
 * correct_option_key dari soal room. Menilai lokal dari kunci di mode
 * room akan selalu salah (kunci tidak ada, jatuh ke "A").
 *
 * Perilaku yang ditegaskan tes statis ini (pola suite yang ada):
 * 1. whack-player memuat prop onSubmitAnswer dan singleQuestionMode;
 *    cabang mode room di handleWhack berhenti sebelum perbandingan
 *    kunci lokal dan memakai result.isCorrect untuk umpan balik.
 * 2. Timer lokal, bonus waktu, dan onFinish digerbang oleh mode room:
 *    hitung mundur tidak berjalan, finishGame tidak memanggil
 *    onFinish, dan cabang lokal (skor/nyawa/bonus) berada sesudah
 *    pengembalian cabang room.
 * 3. Kunci masukan mode room: tetap terpasang sesudah accepted, dan
 *    dibebaskan pada accepted: false atau promise yang melempar
 *    (pola K28 di QuizPlayer).
 * 4. join/room/page.tsx merender WhackPlayer hanya untuk
 *    gameType === "whack_mole", satu soal per remount, dengan
 *    onSubmitAnswer yang sama; tipe lain tetap QuizPlayer.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const whackSource = readFileSync(
  path.join(process.cwd(), "src/components/game-players/whack-player.tsx"),
  "utf8",
);

const joinSource = readFileSync(
  path.join(process.cwd(), "src/app/join/room/page.tsx"),
  "utf8",
);

describe("WhackPlayer: kontrak mode room (W4-M4 gelombang 1)", () => {
  test("prop onSubmitAnswer dan singleQuestionMode tersedia dengan tipe kontrak server", () => {
    assert.match(
      whackSource,
      /onSubmitAnswer\?: \(submission: AnswerSubmission\) => Promise<AnswerResult>;/,
      "prop onSubmitAnswer harus bertipe kontrak AnswerSubmission/AnswerResult",
    );
    assert.match(
      whackSource,
      /singleQuestionMode\?: boolean;/,
      "prop singleQuestionMode harus tersedia",
    );
    assert.match(
      whackSource,
      /const isRoomMode = onSubmitAnswer !== undefined;/,
      "mode room harus aktif bila onSubmitAnswer diberikan",
    );
  });

  test("cabang room di handleWhack berhenti sebelum perbandingan kunci lokal", () => {
    const branchIdx = whackSource.indexOf("if (isRoomMode) {");
    const localKeyIdx = whackSource.indexOf(
      "const isCorrect = opt.option_key.toUpperCase().trim() === correctKey;",
    );
    assert.notEqual(branchIdx, -1, "cabang isRoomMode di handleWhack harus ada");
    assert.notEqual(localKeyIdx, -1, "perbandingan kunci lokal jalur mandiri harus tetap ada");
    assert.ok(
      branchIdx < localKeyIdx,
      "cabang room harus mendahului perbandingan kunci lokal agar tidak tereksekusi di mode room",
    );
    const branchSlice = whackSource.slice(branchIdx, localKeyIdx);
    assert.match(
      branchSlice,
      /void submitRoomAnswer\(opt\);\s*\n\s*return;/,
      "cabang room harus mengirim jawaban lalu kembali tanpa menyentuh jalur lokal",
    );
  });

  test("vonis mode room hanya dari result.isCorrect hasil onSubmitAnswer", () => {
    const submitIdx = whackSource.indexOf("const submitRoomAnswer = async");
    assert.notEqual(submitIdx, -1, "helper submitRoomAnswer harus ada");
    const submitSlice = whackSource.slice(submitIdx, whackSource.indexOf("// Handle Bonk"));
    assert.match(
      submitSlice,
      /result = await onSubmitAnswer\(\{\s*\n\s*questionId: activeQuestion\.id,\s*\n\s*selectedOptionId: opt\.id,\s*\n\s*answerText: null,\s*\n\s*responseTimeMs,\s*\n\s*\}\);/,
      "pengiriman harus membawa questionId, selectedOptionId, answerText null, dan responseTimeMs",
    );
    assert.match(
      submitSlice,
      /playSfx\(result\.isCorrect \? "correct" : "wrong"\);/,
      "umpan balik bunyi harus mengikuti result.isCorrect dari server",
    );
    assert.match(
      submitSlice,
      /setRoomFeedback\(\{ optionId: opt\.id, isCorrect: result\.isCorrect \}\);/,
      "umpan balik visual harus mengikuti result.isCorrect dari server",
    );
    assert.ok(
      !submitSlice.includes("correctKey"),
      "jalur room tidak boleh menyentuh kunci lokal sama sekali",
    );
  });

  test("kunci masukan: tetap terpasang sesudah accepted, bebas pada penolakan", () => {
    const submitIdx = whackSource.indexOf("const submitRoomAnswer = async");
    const submitSlice = whackSource.slice(submitIdx, whackSource.indexOf("// Handle Bonk"));
    const acceptedFalseIdx = submitSlice.indexOf("if (!result.accepted) {");
    const feedbackIdx = submitSlice.indexOf("setRoomFeedback(");
    assert.notEqual(acceptedFalseIdx, -1, "cabang accepted: false harus ada");
    assert.ok(
      acceptedFalseIdx < feedbackIdx,
      "pemeriksaan accepted harus mendahului umpan balik (kunci hanya terkunci untuk jawaban yang diterima)",
    );
    assert.match(
      submitSlice,
      /if \(!result\.accepted\) \{\s*\n\s*isProcessingBonkRef\.current = false;\s*\n\s*return;\s*\n\s*\}/,
      "accepted: false harus membebaskan kunci masukan",
    );
    assert.match(
      submitSlice,
      /catch \{\s*\n\s*isProcessingBonkRef\.current = false;\s*\n\s*return;\s*\n\s*\}/,
      "promise yang melempar harus membebaskan kunci masukan",
    );
    const afterFeedback = submitSlice.slice(feedbackIdx);
    assert.ok(
      !afterFeedback.includes("isProcessingBonkRef.current = false;"),
      "sesudah accepted dan umpan balik, kunci tidak boleh dibebaskan (menunggu remount induk)",
    );
  });
});

describe("WhackPlayer: mekanik lokal digerbang mode room", () => {
  test("hitung mundur lokal tidak berjalan di mode room", () => {
    const timerIdx = whackSource.indexOf("// Countdown timer per question");
    assert.notEqual(timerIdx, -1, "blok timer hitung mundur harus ada");
    const timerSlice = whackSource.slice(timerIdx, timerIdx + 600);
    assert.match(
      timerSlice,
      /useEffect\(\(\) => \{\s*\n\s*\/\/ Mode room: tidak ada timer lokal;[\s\S]*?if \(isRoomMode\) return;\s*\n\s*if \(isGameOver\) return;/,
      "efek hitung mundur harus kembali lebih dulu pada mode room",
    );
  });

  test("finishGame tidak memanggil onFinish di mode room", () => {
    const finishIdx = whackSource.indexOf("const finishGame = useCallback(");
    assert.notEqual(finishIdx, -1, "finishGame harus ada");
    const finishSlice = whackSource.slice(finishIdx, finishIdx + 600);
    assert.match(
      finishSlice,
      /if \(finishedRef\.current\) return;\s*\n\s*if \(isRoomMode\) return;/,
      "gerbang mode room harus berada di dalam finishGame sesudah penjaga finishedRef",
    );
    const onFinishCalls = whackSource.match(/onFinish\?\.\(/g) ?? [];
    assert.equal(
      onFinishCalls.length,
      1,
      "onFinish tetap hanya boleh dipanggil dari dalam finishGame",
    );
  });

  test("bonus waktu dan skor lokal hanya hidup di jalur mandiri", () => {
    const branchIdx = whackSource.indexOf("if (isRoomMode) {");
    const bonusIdx = whackSource.indexOf(
      "pendingBonusRef.current = Math.min(5, pendingBonusRef.current + 5);",
    );
    const scoreIdx = whackSource.indexOf("setScore((s) => s + 100 + streak * 25);");
    assert.notEqual(bonusIdx, -1, "baris bonus jalur mandiri harus tetap ada");
    assert.notEqual(scoreIdx, -1, "baris skor jalur mandiri harus tetap ada");
    assert.ok(
      branchIdx !== -1 && branchIdx < bonusIdx && branchIdx < scoreIdx,
      "cabang room harus kembali sebelum bonus waktu dan skor lokal jalur mandiri",
    );
  });

  test("cip HUD lokal disembunyikan di mode room", () => {
    assert.match(
      whackSource,
      /\{!isRoomMode && \(/,
      "blok cip nyawa/timer/skor lokal harus bersyarat bukan mode room",
    );
  });
});

describe("Halaman join room: cabang whack_mole", () => {
  test("WhackPlayer diimpor dari pemuat arkade tangguh", () => {
    assert.match(
      joinSource,
      /import \{ WhackPlayer \} from "@\/components\/game-players\/arcade-dynamic";/,
      "impor harus lewat arcade-dynamic (pola muat tangguh)",
    );
  });

  test("cabang gameType whack_mole merender WhackPlayer satu soal dengan kontrak room", () => {
    const branchIdx = joinSource.indexOf('gameType === "whack_mole"');
    assert.notEqual(branchIdx, -1, "cabang gameType whack_mole harus ada");
    const branchSlice = joinSource.slice(branchIdx, branchIdx + 1200);
    assert.match(branchSlice, /<WhackPlayer/, "cabang harus merender WhackPlayer");
    assert.match(
      branchSlice,
      /key=\{session\.question\.id\}/,
      "remount per soal harus memakai key id soal",
    );
    assert.match(
      branchSlice,
      /questions=\{\[session\.question\]\}/,
      "questions harus tepat satu soal berjalan",
    );
    assert.match(branchSlice, /singleQuestionMode/, "singleQuestionMode harus diberikan");
    assert.match(
      branchSlice,
      /onSubmitAnswer=\{async \(payload\) => \{\s*\n\s*return await submitAnswer\(\{/,
      "onSubmitAnswer harus meneruskan ke submitAnswer halaman seperti QuizPlayer",
    );
  });

  test("cabang whack mendahului QuizPlayer dan QuizPlayer tetap utuh untuk tipe lain", () => {
    const branchIdx = joinSource.indexOf('gameType === "whack_mole"');
    const quizIdx = joinSource.indexOf("<QuizPlayer");
    assert.notEqual(quizIdx, -1, "QuizPlayer harus tetap dirender untuk tipe lain");
    assert.ok(
      branchIdx !== -1 && branchIdx < quizIdx,
      "cabang whack_mole harus menjadi cabang pertama pada titik render soal",
    );
    assert.match(
      joinSource,
      /<QuizPlayer\s*\n\s*key=\{session\.question\.id\}/,
      "QuizPlayer harus mempertahankan pola remount dan prop lamanya",
    );
  });
});
