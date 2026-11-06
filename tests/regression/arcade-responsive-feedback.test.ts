/**
 * Regresi gelombang 3 (audit armada 6 Nov 2026, klon K28, K30, K31,
 * K32, K33): tata letak pemain arkade pada lebar 390 dan nilai nyata
 * pada peristiwa umpan balik kuis.
 *
 * Cacat yang ditutup tes statis berpola suite ini:
 * 1. Kartu Memori: kisi 508 px + HUD melewati wadah tetap 580 px
 *    overflow-hidden (baris bawah terpotong), aturan global
 *    globals.css memaksa font-size clamp pada .memory-card span
 *    sehingga kelas ukuran per panjang teks kalah dan teks terpotong
 *    tanpa penanda, kelas perspective-[1000px] tidak dikenal
 *    Tailwind 3.4, dan questions kosong menampilkan kisi kosong
 *    tanpa pesan. Pecahkan Balon: jarak antar balon 78 px pada lebar 390 lebih
 *    kecil dari diameter minimum 96 px sehingga balon tumpang
 *    tindih dan zona tumpang selalu dimenangkan balon awal array. Pukul Tikus: gundukan w-32 (128 px) dan papan min-w-[130px]
 *    lebih lebar dari kolom sekitar 108 px pada lebar 390; bonus
 *    timer +5 detik tertimpa setTimerLeft(25) saat soal berganti
 *    sehingga tidak pernah berdampak. Penjaga Antariksa: label panduan menyebut W-S padahal handler
 *    keyboard hanya panah dan A/D. QuizPlayer: responseTimeMs mengeras 1500 dan scoreAwarded
 *    peristiwa umpan balik mengeras; media audio/video tanpa
 *    onPause sehingga audio latar tidak pulih saat media dijeda.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

const memory = read("src/components/game-players/memory-player.tsx");
const balloon = read("src/components/game-players/balloon-player.tsx");
const whack = read("src/components/game-players/whack-player.tsx");
const space = read("src/components/game-players/space-defender-player.tsx");
const quiz = read("src/components/game-players/quiz-player.tsx");
const globals = read("src/app/globals.css");

describe("Kartu Memori: tata letak 390 dan keadaan kosong (K32)", () => {
  test("wadah memakai min-h, bukan tinggi tetap yang memotong baris bawah", () => {
    assert.match(memory, /w-full min-h-\[580px\]/);
    assert.doesNotMatch(memory, /w-full h-\[580px\]/);
  });

  test("perspektif memakai utilitas perspective-1000 yang dikenal", () => {
    assert.match(memory, /perspective-1000/);
    assert.ok(!memory.includes("perspective-[1000px]"));
  });

  test("globals.css tidak lagi memaksa clamp font pada span kartu memori", () => {
    assert.ok(
      !globals.includes(".memory-card span"),
      ".memory-card span harus keluar dari aturan font-size clamp !important",
    );
  });

  test("teks kartu tanpa max-h keras dan punya jenjang font teks sangat panjang", () => {
    assert.ok(!memory.includes("max-h-[64px]"));
    assert.match(memory, /textLen > 40/);
    // Jenjang memakai awalan important supaya menang dari aturan
    // dasar span[dir="auto"] 16pt di globals.css.
    assert.match(memory, /!text-\[10px\] sm:!text-\[11px\]/);
    assert.match(memory, /!text-\[11px\] sm:!text-xs/);
  });

  test("kartu lebih pendek di layar kecil dan kisi berjarak rapat", () => {
    assert.match(memory, /h-24 sm:h-32/);
    assert.match(memory, /gap-2 sm:gap-3/);
  });

  test("questions kosong menampilkan keadaan kosong yang jujur", () => {
    assert.match(memory, /if \(questions\.length === 0\)/);
    assert.match(memory, /Belum Ada Soal untuk Kartu Memori/);
  });
});

describe("Pecahkan Balon: jarak dan diameter responsif (K33)", () => {
  test("layar sempit memakai dua kolom dan sway lebih kecil", () => {
    assert.match(balloon, /const narrow = width < 640;/);
    assert.match(balloon, /const columns = narrow \? 2 : opts\.length;/);
    assert.match(balloon, /const swayAmp = narrow \? 10 : 18;/);
  });

  test("diameter dibatasi jarak antar kolom dikurangi ruang sway", () => {
    assert.match(balloon, /const fitCap = Math\.max\(34, spacing \/ 2 - swayAmp - 4\);/);
    assert.match(balloon, /const radiusX = Math\.min\(textRadius, fitCap\);/);
  });

  test("kolom kedua distagger vertikal dan render memakai swayAmp per balon", () => {
    assert.match(balloon, /row \* 150/);
    assert.equal(balloon.match(/Math\.sin\(b\.swayOffset\) \* b\.swayAmp/g)?.length, 2);
  });

  test("uji klik memilih balon terdekat, bukan balon pertama dalam array", () => {
    assert.match(balloon, /const ratio = dist \/ \(b\.radiusX \* 1\.15\);/);
    assert.match(balloon, /if \(ratio < bestRatio\)/);
    assert.match(balloon, /if \(best && bestRatio <= 1\)/);
  });
});

describe("Pukul Tikus: tata letak 390 dan bonus timer nyata (K30)", () => {
  test("gundukan dan papan muat di kolom sempit", () => {
    assert.match(whack, /w-24 sm:w-44/);
    assert.match(whack, /min-w-0 w-full sm:w-auto sm:min-w-\[130px\] sm:max-w-\[240px\]/);
    assert.match(whack, /grid-cols-3 gap-2 sm:gap-6/);
    assert.equal(
      whack.match(/min-w-\[130px\]/g)?.length,
      whack.match(/sm:min-w-\[130px\]/g)?.length,
      "min-w-[130px] hanya boleh muncul dengan awalan sm:",
    );
  });

  test("bonus +5 detik dicatat ke pendingBonusRef, bukan ditimpa reset 25", () => {
    assert.match(whack, /const pendingBonusRef = useRef\(0\);/);
    assert.match(whack, /pendingBonusRef\.current = Math\.min\(5, pendingBonusRef\.current \+ 5\);/);
    assert.ok(!whack.includes("Math.min(30, t + 5)"));
  });

  test("soal berikutnya mulai dari 25 + bonus dan bonus dikonsumsi", () => {
    assert.match(whack, /const bonus = pendingBonusRef\.current;/);
    assert.match(whack, /setTimerLeft\(25 \+ bonus\);/);
    assert.equal(
      whack.match(/pendingBonusRef\.current = 0;/g)?.length,
      2,
      "bonus direset saat dikonsumsi dan saat main lagi",
    );
  });
});

describe("Penjaga Antariksa: label panduan sesuai handler (K31)", () => {
  test("label menyebut A-D dan tidak lagi menyebut W-S", () => {
    assert.match(space, /A-D untuk manuver/);
    assert.ok(!space.includes("W-S untuk manuver"));
  });
});

describe("QuizPlayer: nilai nyata pada kiriman dan umpan balik (K28)", () => {
  test("responseTimeMs diukur dari tampilnya soal, bukan angka keras 1500", () => {
    assert.ok(!quiz.includes("responseTimeMs: 1500"));
    assert.match(quiz, /const questionShownAtRef = useRef<number>\(Date\.now\(\)\);/);
    assert.match(quiz, /questionShownAtRef\.current = Date\.now\(\);/);
    assert.match(quiz, /Date\.now\(\) - questionShownAtRef\.current/);
    assert.match(quiz, /responseTimeMs,\s*\}\);/);
  });

  test("scoreAwarded peristiwa berasal dari hasil server pada kedua cabang", () => {
    assert.match(quiz, /const awarded = result\.scoreAwarded \?\? \(result\.isCorrect \? 100 : 0\);/);
    assert.equal(quiz.match(/scoreAwarded: awarded,/g)?.length, 2);
    assert.ok(!quiz.includes("scoreAwarded: 0,"));
  });

  test("audio dan video memulihkan audio latar saat dijeda", () => {
    assert.equal(
      quiz.match(/onPause=\{\(\) => resumeBackgroundAudio\(\)\}/g)?.length,
      2,
      "onPause harus ada pada elemen audio dan video",
    );
  });
});
