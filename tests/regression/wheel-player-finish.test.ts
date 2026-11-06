/**
 * Regresi: WheelPlayer yatim dan cacat internal (audit armada 6 Nov
 * 2026, klon K31). Timer otomatis 1,8 detik dan tombol manual "Soal
 * Selanjutnya" sama-sama memajukan soal tanpa penjaga (kemajuan
 * ganda), timer tidak pernah dibersihkan saat unmount, onFinish
 * hanya membawa satu argumen (tidak sejajar pemain arkade lain),
 * dan kanvas 380px tanpa max-w-full berisiko terpotong di lebar 390.
 *
 * Perbaikan yang ditegaskan tes statis ini: penjaga kemajuan satu
 * kali (advanceDoneRef), timer disimpan di ref dan dibersihkan
 * (clearAdvanceTimeout, termasuk saat unmount), tanda tangan
 * onFinish (finalScore, correctCount) dengan nilai dari ref, dan
 * kanvas max-w-full.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const wheelSource = readFileSync(
  path.join(process.cwd(), "src/components/game-players/wheel-player.tsx"),
  "utf8",
);

describe("WheelPlayer: kemajuan satu kali dan onFinish sejajar (K31)", () => {
  test("tanda tangan onFinish membawa skor akhir dan jumlah benar", () => {
    assert.match(
      wheelSource,
      /onFinish\?: \(finalScore: number, correctCount: number\) => void/,
    );
    assert.match(
      wheelSource,
      /onFinish\?\.\(scoreRef\.current, correctRef\.current\)/,
    );
  });

  test("onFinish hanya terpanggil lewat penjaga finishedRef", () => {
    assert.match(wheelSource, /if \(finishedRef\.current\) return;/);
    assert.equal(
      wheelSource.match(/onFinish\?\./g)?.length,
      1,
      "onFinish hanya boleh dipanggil di satu tempat (finishGame)",
    );
  });

  test("timer kemajuan dan tombol manual berbagi penjaga advanceDoneRef", () => {
    assert.match(wheelSource, /if \(advanceDoneRef\.current\) return;/);
    assert.match(wheelSource, /advanceTimeoutRef\.current = window\.setTimeout/);
    assert.match(wheelSource, /onClick=\{\(\) => advanceToNext\(\)\}/);
  });

  test("timer kemajuan dibersihkan saat unmount dan saat acak ulang", () => {
    assert.match(
      wheelSource,
      /return \(\) => clearAdvanceTimeout\(\);\s*\n\s*\}, \[\]\);/,
    );
    assert.match(wheelSource, /const handleReshuffle = \(\) => \{\s*\n\s*clearAdvanceTimeout\(\);/);
  });

  test("hasil putaran hanya diproses sekali per putaran", () => {
    assert.match(wheelSource, /if \(!spinResolvedRef\.current\)/);
    assert.match(wheelSource, /spinResolvedRef\.current = false;/);
  });

  test("kanvas menyusut mengikuti lebar layar sempit", () => {
    assert.match(wheelSource, /max-w-full h-auto/);
  });

  test("acak ulang mereset ref skor dan jumlah benar", () => {
    assert.match(wheelSource, /scoreRef\.current = 0;/);
    assert.match(wheelSource, /correctRef\.current = 0;/);
  });
});
