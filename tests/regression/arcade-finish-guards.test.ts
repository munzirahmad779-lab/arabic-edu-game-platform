/**
 * Regresi: keluarga cacat akhir permainan pemain arkade proyektor
 * (audit armada 6 Nov 2026, klon K29/K30/K31/K32/K33).
 *
 * Cacat yang dikunci:
 * 1. airplane-player: jawaban salah pada soal terakhir dengan nyawa
 *    tersisa hanya memasang setIsGameOver di dalam setTimeout 1200 ms,
 *    tanpa onFinish. Layar selesai lokal tampil tetapi induk tidak
 *    pernah menerima akhir permainan, fase tidak menjadi finished,
 *    dan laporan arkade tidak tersimpan.
 * 2. whack-player: pola yang sama pada timeout soal terakhir dengan
 *    nyawa tersisa (cabang else di efek hitung mundur hanya
 *    setIsGameOver, tanpa onFinish).
 * 3. space-defender-player: onFinish GANDA pada nyawa habis di soal
 *    terakhir: setTimeout 600 ms di dalam updater setHealth dan timer
 *    transisi 1200 ms sama sama memanggil onFinish.
 * 4. balloon-player: tiga setTimeout akhir permainan (700/600/1000 ms)
 *    tanpa pembersihan saat unmount; callback terlambat dapat
 *    memanggil onFinish dan mengubah fase sesudah guru meninggalkan
 *    pemain.
 * 5. Kelima pemain arkade: correctRef tidak direset saat Main Lagi,
 *    sehingga jumlah benar sesi kedua kumulatif (reproduksi memory:
 *    sesi kedua onFinish [600, 12] padahal seharusnya [600, 6]).
 *
 * Perbaikan yang ditegaskan tes statis ini (pola suite yang ada):
 * setiap pemain punya finishGame berpenjaga finishedRef sehingga
 * onFinish hanya terpanggil lewat satu pintu dan tepat satu kali per
 * sesi; semua setTimeout akhir terdaftar di timersRef dan dibersihkan
 * saat unmount serta saat Main Lagi; correctRef.current = 0 dipasang
 * pada jalur Main Lagi.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

function readPlayer(name: string): string {
  return readFileSync(
    path.join(process.cwd(), "src/components/game-players", name),
    "utf8",
  );
}

const airplane = readPlayer("airplane-player.tsx");
const whack = readPlayer("whack-player.tsx");
const space = readPlayer("space-defender-player.tsx");
const balloon = readPlayer("balloon-player.tsx");
const memory = readPlayer("memory-player.tsx");

function assertFinishGuard(source: string, label: string) {
  assert.match(
    source,
    /const finishGame = useCallback\(/,
    `${label}: finishGame harus ada`,
  );
  assert.match(
    source,
    /if \(finishedRef\.current\) return;/,
    `${label}: finishGame harus berpenjaga finishedRef`,
  );
  const onFinishCalls = source.match(/onFinish\?\.\(/g) ?? [];
  assert.equal(
    onFinishCalls.length,
    1,
    `${label}: onFinish hanya boleh dipanggil dari dalam finishGame (ditemukan ${onFinishCalls.length} panggilan)`,
  );
}

function assertTimerCleanup(source: string, label: string) {
  assert.match(
    source,
    /timersRef\.current\.forEach\(\(id\) => clearTimeout\(id\)\)/,
    `${label}: timersRef harus dibersihkan dengan clearTimeout`,
  );
  assert.match(
    source,
    /clearPendingTimers\(\)/,
    `${label}: Main Lagi harus membersihkan timer yang masih tertunda`,
  );
  assert.match(
    source,
    /correctRef\.current = 0;/,
    `${label}: Main Lagi harus mereset correctRef`,
  );
  assert.match(
    source,
    /finishedRef\.current = false;/,
    `${label}: Main Lagi harus mempersenjatai ulang finishedRef`,
  );
}

describe("Penjaga akhir permainan pemain arkade (K29/K30/K31/K33)", () => {
  test("airplane: semua jalur akhir lewat finishGame berpenjaga", () => {
    assertFinishGuard(airplane, "airplane");
    const finishCalls = airplane.match(/finishGame\(/g) ?? [];
    assert.ok(
      finishCalls.length >= 3,
      `airplane: finishGame harus dipanggil dari jalur benar soal terakhir, nyawa habis, dan salah soal terakhir (ditemukan ${finishCalls.length})`,
    );
  });

  test("airplane: timer akhir terdaftar dan dibersihkan", () => {
    assertTimerCleanup(airplane, "airplane");
  });

  test("whack: timeout soal terakhir dan semua jalur akhir lewat finishGame", () => {
    assertFinishGuard(whack, "whack");
    const finishCalls = whack.match(/finishGame\(/g) ?? [];
    assert.ok(
      finishCalls.length >= 4,
      `whack: finishGame harus dipanggil dari timeout nyawa habis, timeout soal terakhir, benar soal terakhir, dan pukulan salah nyawa habis (ditemukan ${finishCalls.length})`,
    );
  });

  test("whack: timer pukulan dan transisi terdaftar dan dibersihkan", () => {
    assertTimerCleanup(whack, "whack");
  });

  test("space-defender: onFinish tidak bisa ganda, kedua timer lewat finishGame", () => {
    assertFinishGuard(space, "space-defender");
    const finishCalls = space.match(/finishGame\(\)/g) ?? [];
    assert.ok(
      finishCalls.length >= 2,
      `space-defender: timer 600 ms dan timer transisi 1200 ms harus sama sama memanggil finishGame berpenjaga (ditemukan ${finishCalls.length})`,
    );
    assert.match(
      space,
      /if \(finishedRef\.current\) return;\s*\n\s*if \(currentIdx \+ 1 < questionList\.length\)/,
      "space-defender: timer transisi tidak boleh memajukan soal sesudah permainan selesai",
    );
  });

  test("space-defender: timer akhir terdaftar dan dibersihkan", () => {
    assertTimerCleanup(space, "space-defender");
  });

  test("balloon: tiga setTimeout akhir terdaftar, dibersihkan saat unmount", () => {
    assertFinishGuard(balloon, "balloon");
    const finishCalls = balloon.match(/finishGame\(/g) ?? [];
    assert.ok(
      finishCalls.length >= 2,
      `balloon: jalur benar soal terakhir dan nyawa habis harus memanggil finishGame (ditemukan ${finishCalls.length})`,
    );
    assertTimerCleanup(balloon, "balloon");
  });
});

describe("Kartu Memori: correctRef direset saat Main Lagi (K32)", () => {
  test("memory: onFinish berpenjaga finishedRef di dalam updater pasangan", () => {
    assert.match(
      memory,
      /if \(!finishedRef\.current\) \{\s*\n\s*finishedRef\.current = true;/,
      "memory: onFinish harus dipasang satu kali lewat penjaga finishedRef",
    );
  });

  test("memory: Main Lagi mereset correctRef dan membersihkan timer mismatch", () => {
    assert.match(
      memory,
      /correctRef\.current = 0;/,
      "memory: Main Lagi harus mereset correctRef (sesi kedua wajib mulai dari 0, bukan kumulatif)",
    );
    assert.match(
      memory,
      /finishedRef\.current = false;/,
      "memory: Main Lagi harus mempersenjatai ulang finishedRef",
    );
    assert.match(
      memory,
      /timersRef\.current\.forEach\(\(id\) => clearTimeout\(id\)\)/,
      "memory: timer mismatch 900 ms harus dibersihkan saat unmount",
    );
  });
});
