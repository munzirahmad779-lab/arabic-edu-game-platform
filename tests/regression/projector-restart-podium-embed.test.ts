/**
 * Regresi: tiga cacat inti proyektor dari audit armada 6 Nov 2026
 * (klon K27, K31, K34) pada projector-screen.tsx dan arcade-dynamic.tsx.
 *
 * 1. Ulangi Kuis tidak menyetel ulang reportSavedRef dan
 *    arcadeFinishedRef. Persenjataan ulang penyimpanan laporan hanya
 *    terjadi pada effect yang bergantung pada perubahan gameStarted,
 *    sedangkan Ulangi Kuis mempertahankan gameStarted tetap true.
 *    Akibatnya efek simpan otomatis Kahoot pada permainan ulangan
 *    terhalang ref lama dan laporan ulangan tidak pernah terkirim.
 *    Perbaikan: handleRestartGame menyetel ulang kedua ref dan
 *    mengembalikan reportStatus ke "idle" sebagai bagian dari reset.
 *
 * 2. Cabang render arkade didahulukan dari cabang podium. Akhir
 *    permainan arkade memasang fase "finished", tetapi cabang pemain
 *    yang sedang aktif tetap menang render, jadi podium tertunda satu
 *    langkah dan guru harus menekan Kembali ke Kahoot Arena dulu.
 *    Perbaikan: semua cabang arkade berpenjaga phase !== "finished",
 *    sehingga render jatuh langsung ke cabang podium.
 *
 * 3. Tema wheel dibelokkan ke mesin space dan cabang embed mati
 *    jangkauan. Perbaikan: tema wheel masuk ke WheelPlayer yang kini
 *    terdaftar di pemuat bersama arcade-dynamic (termasuk pramuat
 *    lobi), dan activeEmbedUrl diisi dari data permainan mode embed
 *    (token [EMBED:...] pada nama yang diterima atau nama tersimpan
 *    di basis data).
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

const arcadeDynamicSource = readFileSync(
  path.join(process.cwd(), "src/components/game-players/arcade-dynamic.tsx"),
  "utf8",
);

function handleRestartGameBody(source: string): string {
  const start = source.indexOf("const handleRestartGame = () => {");
  assert.notEqual(start, -1, "handleRestartGame harus ada");
  const rest = source.slice(start);
  const end = rest.indexOf("const startGame");
  assert.notEqual(end, -1, "akhir handleRestartGame harus ditemukan");
  return rest.slice(0, end);
}

describe("Ulangi Kuis mempersenjatai ulang penyimpanan laporan", () => {
  test("handleRestartGame menyetel ulang reportSavedRef dan arcadeFinishedRef", () => {
    const body = handleRestartGameBody(projectorSource);
    assert.match(body, /reportSavedRef\.current = false;/);
    assert.match(body, /arcadeFinishedRef\.current = false;/);
    assert.match(body, /setReportStatus\("idle"\);/);
  });

  test("Reset ref laporan menjadi bagian dari reset mulai ulang, sesudah pembersihan kunci jawaban", () => {
    const body = handleRestartGameBody(projectorSource);
    const clearIdx = body.indexOf("recordedAnswerKeysRef.current.clear();");
    const reportIdx = body.indexOf("reportSavedRef.current = false;");
    const arcadeIdx = body.indexOf("arcadeFinishedRef.current = false;");
    assert.notEqual(clearIdx, -1);
    assert.ok(clearIdx < reportIdx, "reset reportSavedRef sesudah clear kunci jawaban");
    assert.ok(clearIdx < arcadeIdx, "reset arcadeFinishedRef sesudah clear kunci jawaban");
  });

  test("Tombol Ulangi Kuis di podium tetap memanggil handleRestartGame", () => {
    assert.match(projectorSource, /onClick=\{handleRestartGame\}/);
  });

  test("Effect persenjataan saat gameStarted berubah tetap ada untuk permainan pertama", () => {
    assert.match(
      projectorSource,
      /if \(gameStarted\) \{\s*\n\s*reportSavedRef\.current = false;\s*\n\s*arcadeFinishedRef\.current = false;/,
    );
  });
});

describe("Podium tampil langsung sesudah fase finished untuk mode arkade", () => {
  const engines = ["airplane", "whack", "space", "memory", "balloon", "wheel"];

  for (const engine of engines) {
    test(`Cabang ${engine} berpenjaga phase !== "finished"`, () => {
      const pattern = new RegExp(
        `\\(gameStarted \\|\\| engineLaunched\\) && phase !== "finished" && activeEngine === "${engine}"`,
      );
      assert.match(projectorSource, pattern);
    });
  }

  test("Tidak ada cabang arkade tanpa penjaga fase finished yang tersisa", () => {
    assert.doesNotMatch(
      projectorSource,
      /\(gameStarted \|\| engineLaunched\) && activeEngine ===/,
    );
  });

  test("Cabang podium berada sesudah cabang arkade terakhir", () => {
    const wheelIdx = projectorSource.indexOf(
      '(gameStarted || engineLaunched) && phase !== "finished" && activeEngine === "wheel"',
    );
    const podiumIdx = projectorSource.indexOf("FINISHED PHASE (Winner Podium)");
    assert.notEqual(wheelIdx, -1);
    assert.notEqual(podiumIdx, -1);
    assert.ok(wheelIdx < podiumIdx, "cabang podium harus sesudah cabang roda");
  });
});

describe("Tema roda masuk ke WheelPlayer lewat pemuat bersama", () => {
  test("Tema wheel tidak lagi dibelokkan ke mesin space", () => {
    assert.doesNotMatch(
      projectorSource,
      /initialGameTheme === "wheel"\) return "space"/,
    );
    assert.match(
      projectorSource,
      /if \(initialGameTheme === "wheel" \|\| initialGameTheme === "wheel_fortune"\) return "wheel";/,
    );
  });

  test("WheelPlayer diimpor dari arcade-dynamic dan dirender dengan handleArcadeFinish Roda Putar", () => {
    assert.match(
      projectorSource,
      /WheelPlayer,\s*\n\s*prefetchPemainArkade,\s*\n\} from "@\/components\/game-players\/arcade-dynamic";/,
    );
    assert.match(projectorSource, /handleArcadeFinish\("Roda Putar"\)/);
    assert.match(
      projectorSource,
      /setActiveEngine\("wheel"\); setEngineLaunched\(true\);/,
    );
  });

  test("arcade-dynamic mendaftarkan WheelPlayer dan memasukkannya ke pramuat lobi", () => {
    assert.match(
      arcadeDynamicSource,
      /import\("@\/components\/game-players\/wheel-player"\)\.then\(\(mod\) => mod\.WheelPlayer\)/,
    );
    assert.match(
      arcadeDynamicSource,
      /export const WheelPlayer = dynamic\(\(\) => imporTangguh\(muatWheel, "wheel"\)/,
    );
    assert.match(
      arcadeDynamicSource,
      /\[muatAirplane, muatWhack, muatSpace, muatMemory, muatBalloon, muatWheel\]/,
    );
  });
});

describe("Cabang embed terisi dari data permainan mode embed", () => {
  test("State awal activeEmbedUrl membaca token dari nama atau tema yang diterima", () => {
    assert.match(
      projectorSource,
      /gameName\.match\(\/\\\[EMBED:\(\.\*\?\)\\\]\/\)/,
    );
    assert.match(projectorSource, /initialGameTheme\.startsWith\("embed:"\)/);
  });

  test("Effect mengisi activeEmbedUrl dari nama tersimpan permainan di basis data", () => {
    assert.match(projectorSource, /\.from\("games"\)/);
    assert.match(
      projectorSource,
      /setActiveEmbedUrl\(cocok\[1\]\.trim\(\)\)/,
    );
  });

  test("Cabang render embed tetap memakai WebGameEmbedPlayer dengan URL terisi", () => {
    assert.match(projectorSource, /if \(activeEmbedUrl\) \{/);
    assert.match(
      projectorSource,
      /<WebGameEmbedPlayer embedUrl=\{activeEmbedUrl\} title=\{gameName\} \/>/,
    );
  });
});
