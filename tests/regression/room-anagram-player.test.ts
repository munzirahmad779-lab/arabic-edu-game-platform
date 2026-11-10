/**
 * Regresi: room tipe anagram di HP siswa merender QuizPlayer untuk
 * semua tipe (W4-M4 gelombang 3a, audit gabungan 10 Nov 2026).
 *
 * Akar masalah: /join/room selalu merender QuizPlayer, padahal soal
 * anagram tidak wajib memiliki empat pilihan (pengecualian eksplisit
 * di actions.ts pembuatan room) dan dinilai server lewat teks
 * (answerText diteruskan ke RPC p_answer_text). Siswa pada room
 * anagram hanya melihat peringatan soal tidak lengkap.
 *
 * Perilaku yang ditegaskan tes statis ini (pola suite yang ada):
 * 1. AnagramPlayer mengimplementasikan kontrak GamePlayerProps dan
 *    mengirim jawaban sebagai answerText dengan selectedOptionId
 *    null; vonis hanya dari AnswerResult.isCorrect.
 * 2. Berkas pemain tidak merujuk kunci jawaban soal sama sekali dan
 *    tidak memakai string "wrong" dari kamus anagram, karena string
 *    itu memuat penampung jawaban benar yang tidak tersedia (dan
 *    tidak boleh ditampilkan) di klien room.
 * 3. Kunci masukan pola K28: terkunci sesudah accepted, dibebaskan
 *    pada accepted: false atau promise yang melempar; tidak ada
 *    pemanggilan selesai lokal dan tidak ada timer lokal, karena
 *    perpindahan soal dan tenggat adalah urusan induk/server.
 * 4. join/room/page.tsx merender AnagramPlayer hanya untuk
 *    gameType === "anagram" dengan remount per soal dan
 *    onSubmitAnswer yang sama; cabang whack_mole dan QuizPlayer
 *    untuk tipe lain tetap utuh.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const anagramSource = readFileSync(
  path.join(process.cwd(), "src/components/game-players/anagram-player.tsx"),
  "utf8",
);

const joinSource = readFileSync(
  path.join(process.cwd(), "src/app/join/room/page.tsx"),
  "utf8",
);

describe("AnagramPlayer: kontrak pemain room (W4-M4 gelombang 3a)", () => {
  test("mengimplementasikan GamePlayerProps<RawQuestion> dari kontrak mesin", () => {
    assert.match(
      anagramSource,
      /import type \{[^}]*GamePlayerProps[^}]*RawQuestion[^}]*\} from "@\/lib\/game-engine\/types";/,
      "tipe kontrak harus diimpor dari lib/game-engine/types",
    );
    assert.match(
      anagramSource,
      /\}: GamePlayerProps<RawQuestion>\) \{/,
      "props komponen harus bertipe GamePlayerProps<RawQuestion>",
    );
  });

  test("pengiriman memakai answerText dan selectedOptionId null", () => {
    assert.match(
      anagramSource,
      /selectedOptionId: null,/,
      "jawaban anagram tidak memilih opsi: selectedOptionId harus null",
    );
    assert.match(
      anagramSource,
      /answerText: cleaned,/,
      "jawaban anagram dikirim sebagai answerText hasil susunan siswa",
    );
    assert.match(
      anagramSource,
      /result = await onSubmitAnswer\(\{/,
      "pengiriman harus lewat onSubmitAnswer dari induk",
    );
    assert.match(
      anagramSource,
      /responseTimeMs = Math\.max\(0, Date\.now\(\) - questionShownAtRef\.current\);/,
      "responseTimeMs harus diukur nyata dari tampilnya soal (pola K28)",
    );
  });

  test("vonis hanya dari AnswerResult.isCorrect hasil server", () => {
    assert.match(
      anagramSource,
      /setFeedback\(\{ isCorrect: result\.isCorrect, awarded \}\);/,
      "umpan balik harus diturunkan dari result.isCorrect",
    );
    assert.match(
      anagramSource,
      /if \(!result\.accepted\) \{\s*setSubmitting\(false\);\s*return;\s*\}/,
      "accepted: false harus membebaskan kunci tanpa memasang umpan balik",
    );
  });

  test("tidak ada rujukan kunci jawaban soal di berkas pemain", () => {
    assert.equal(
      anagramSource.includes("correct_option_key"),
      false,
      "pemain room tidak boleh membaca correct_option_key (route sesi tidak mengirimnya)",
    );
    assert.equal(
      anagramSource.includes("correctOptionKey"),
      false,
      "pemain room tidak boleh membaca correctOptionKey dalam bentuk apa pun",
    );
  });

  test("string wrong berkunci jawaban dari kamus tidak dipakai", () => {
    assert.equal(
      anagramSource.includes("{answer}"),
      false,
      "penampung jawaban benar dari kamus tidak boleh muncul di berkas pemain",
    );
    assert.equal(
      /pickString\(anagramDict, "wrong"/.test(anagramSource),
      false,
      "string wrong kamus anagram tidak boleh dibaca di mode room",
    );
    assert.match(
      anagramSource,
      /message: "Jawaban Kurang Tepat! ✗",/,
      "umpan balik salah harus memakai kalimat netral yang sama dengan QuizPlayer",
    );
  });

  test("kunci masukan pola K28 dan tanpa selesai/timer lokal", () => {
    assert.match(
      anagramSource,
      /const locked = submitting \|\| hasAnswered;/,
      "masukan harus terkunci selama mengirim dan sesudah diterima",
    );
    assert.match(
      anagramSource,
      /\} catch \{\s*setSubmitting\(false\);\s*return;\s*\}/,
      "promise yang melempar harus membebaskan kunci pengiriman",
    );
    assert.equal(
      anagramSource.includes("onFinish"),
      false,
      "pemain room tidak boleh memanggil onFinish; perpindahan soal urusan induk",
    );
    assert.equal(
      /setInterval|setTimeout/.test(anagramSource),
      false,
      "tidak boleh ada timer lokal; tenggat soal dijaga induk lewat server",
    );
  });

  test("bank ubin memakai ambang terdokumentasi dan urutan server", () => {
    assert.match(
      anagramSource,
      /const TILE_MAX_GRAPHEMES = 24;/,
      "ambang grafem bank ubin harus eksplisit",
    );
    assert.match(
      anagramSource,
      /const TILE_MAX_WORDS = 4;/,
      "ambang kata bank ubin harus eksplisit",
    );
    assert.match(
      anagramSource,
      /const letters = splitIntoGraphemes\(trimmed\);/,
      "ubin harus dibangun per grafem aman-Arab dari teks soal",
    );
  });
});

describe("join/room: saklar pemain anagram (W4-M4 gelombang 3a)", () => {
  test("cabang anagram merender AnagramPlayer satu soal per remount", () => {
    assert.match(
      joinSource,
      /import \{ AnagramPlayer \} from "@\/components\/game-players\/anagram-player";/,
      "halaman join harus mengimpor AnagramPlayer",
    );
    const branchStart = joinSource.indexOf('gameType === "anagram"');
    assert.notEqual(branchStart, -1, 'cabang gameType === "anagram" harus ada');
    const branch = joinSource.slice(branchStart, branchStart + 1200);
    assert.match(
      branch,
      /<AnagramPlayer\s+key=\{session\.question\.id\}/,
      "AnagramPlayer harus di-remount per soal lewat key id soal",
    );
    assert.match(
      branch,
      /answerText: payload\.answerText,/,
      "onSubmitAnswer cabang anagram harus meneruskan answerText ke submitAnswer halaman",
    );
    assert.match(
      branch,
      /singleQuestionMode/,
      "cabang anagram harus menandai mode satu soal",
    );
  });

  test("cabang whack_mole dan QuizPlayer untuk tipe lain tetap utuh", () => {
    assert.match(
      joinSource,
      /gameType === "whack_mole" \? \(/,
      "cabang whack_mole dari gelombang 1 harus tetap ada",
    );
    assert.match(joinSource, /<WhackPlayer/, "WhackPlayer harus tetap dirender");
    assert.match(joinSource, /<QuizPlayer/, "QuizPlayer harus tetap dirender untuk tipe lain");
    const whackAt = joinSource.indexOf('gameType === "whack_mole"');
    const anagramAt = joinSource.indexOf('gameType === "anagram"');
    const quizAt = joinSource.indexOf("<QuizPlayer");
    assert.ok(
      whackAt !== -1 && anagramAt > whackAt && quizAt > anagramAt,
      "urutan cabang harus whack_mole, lalu anagram, lalu QuizPlayer",
    );
  });
});
