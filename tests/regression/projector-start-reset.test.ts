/**
 * Regression: permainan yang baru dimulai melompat lurus ke podium
 * 0 poin (laporan user 6 Nov 2026 pukul 07:01, tangkapan layar podium
 * "JUARA PERTAMA Tim Merah 0 Poin" tanpa bar status laporan, stik
 * ikut menampilkan selesai).
 *
 * Akar masalah (dua sendi di projector-screen.tsx):
 * 1. handleArcadeFinish memanggil setPhase("finished") SEBELUM
 *    memeriksa gameStarted. Pemain arkade dapat berakhir sendiri oleh
 *    timernya tanpa dimainkan siapa pun, jadi pratinjau arkade dari
 *    lobi mencemari fase pertandingan menjadi "finished" secara
 *    senyap. arcadeFinishedRef yang ikut terpasang juga menghalangi
 *    efek simpan laporan Kahoot, sehingga podium hasil jebakan ini
 *    tampil tanpa bar status laporan sama sekali.
 * 2. Ketiga tombol mulai (MULAI KUIS KELAS dan dua tombol modal
 *    kekurangan murid) hanya memanggil setGameStarted(true) tanpa
 *    mereset state pertandingan, sehingga fase tercemar itu langsung
 *    ter-render sebagai podium pada permainan yang baru dimulai, dan
 *    sync berikutnya menyiarkan fase "finished" ke stik.
 *
 * Perbaikan: akhir pratinjau arkade kembali lebih dulu sebelum
 * menyentuh state apa pun, dan semua jalur mulai lewat startGame()
 * yang menjalankan reset penuh yang sama seperti Ulangi Kuis
 * (handleRestartGame) sebelum gameStarted dinyalakan. Ditambah
 * penjaga daftar soal kosong: tombol MULAI nonaktif dan berlabel
 * "BELUM ADA SOAL" selama permainan belum memiliki soal, karena
 * totalQuestions memakai fallback `questions.length || 1` yang
 * menutupi daftar kosong sebagai "1 SOAL".
 *
 * Tes statis ini menegaskan pemasangannya, sejalan pola suite ini.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectorSource = readFileSync(
  path.join(
    process.cwd(),
    "src/app/dashboard/games/[gameId]/projector/projector-screen.tsx",
  ),
  "utf8",
);

function handleArcadeFinishBody(source: string): string {
  const start = source.indexOf("const handleArcadeFinish =");
  assert.notEqual(start, -1, "handleArcadeFinish harus ada");
  const rest = source.slice(start);
  const end = rest.indexOf("\n  const reportStatusBar");
  assert.notEqual(end, -1, "akhir handleArcadeFinish harus ditemukan");
  return rest.slice(0, end);
}

describe("Mulai permainan selalu dari state bersih (jebakan podium pratinjau arkade)", () => {
  test("Akhir pratinjau arkade kembali sebelum menyentuh state pertandingan", () => {
    const body = handleArcadeFinishBody(projectorSource);
    const guardIdx = body.indexOf("if (!gameStarted) return;");
    const phaseIdx = body.indexOf('setPhase("finished")');
    const refIdx = body.indexOf("arcadeFinishedRef.current = true;");
    assert.notEqual(guardIdx, -1, "penjaga !gameStarted harus ada");
    assert.notEqual(phaseIdx, -1, "setPhase finished harus ada untuk alur mulai sungguhan");
    assert.ok(
      guardIdx < phaseIdx,
      "penjaga !gameStarted harus mendahului setPhase(\"finished\")",
    );
    assert.ok(
      guardIdx < refIdx,
      "penjaga !gameStarted harus mendahului pemasangan arcadeFinishedRef",
    );
  });

  test("startGame mereset penuh lewat handleRestartGame sebelum menyalakan gameStarted", () => {
    assert.match(
      projectorSource,
      /const startGame = \(\) => \{\s*\n\s*handleRestartGame\(\);\s*\n\s*setGameStarted\(true\);\s*\n\s*\};/,
    );
  });

  test("Tidak ada tombol mulai yang menyalakan gameStarted secara langsung", () => {
    const occurrences =
      projectorSource.match(/setGameStarted\(true\)/g) ?? [];
    assert.equal(
      occurrences.length,
      1,
      "setGameStarted(true) hanya boleh muncul di dalam startGame",
    );
    const startCalls = projectorSource.match(/startGame\(\);/g) ?? [];
    assert.ok(
      startCalls.length >= 3,
      "ketiga tombol mulai (MULAI + dua tombol modal) harus memanggil startGame()",
    );
  });

  test("Permainan tanpa soal tidak bisa dimulai dari lobi", () => {
    assert.match(
      projectorSource,
      /disabled=\{questions\.length === 0\}/,
    );
    assert.match(projectorSource, /"BELUM ADA SOAL"/);
    assert.match(
      projectorSource,
      /if \(questions\.length === 0\) return;/,
    );
  });
});
