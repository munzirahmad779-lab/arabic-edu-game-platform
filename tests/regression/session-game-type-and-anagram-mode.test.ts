/**
 * Regresi: tipe game room tidak pernah sampai ke HP siswa untuk dua
 * keluarga game (uji live 11 Nov 2026).
 *
 * 1. Whack: game "Pukul Tikus" buatan dasbor menyimpan tema sebagai
 *    token [THEME:whack] di nama game dan game_type-nya tetap "quiz",
 *    jadi route sesi siswa tidak pernah mengirim "whack_mole" dan
 *    saklar WhackPlayer di /join/room tidak menyala.
 * 2. Anagram: mode "anagram" sah di games.mode dan dinilai server
 *    lewat teks jawaban (migrasi 0059), tetapi select mode di
 *    formulir game tidak pernah merender opsinya dan kamus game_mode
 *    tidak punya labelnya, jadi guru tidak bisa memilih mode itu.
 *
 * Perilaku yang ditegaskan tes statis ini (pola suite yang ada):
 * 1. Route sesi memuat SATU helper resolveSessionGameType dengan
 *    ketiga cabang (mode anagram, token THEME whack, cadangan
 *    game_type tersimpan) dan keempat titik perhitungan lama memakai
 *    helper itu; ekspresi inline anagram tidak ada lagi di luar
 *    helper.
 * 2. game-mode-selector merender opsi value "anagram" berlabel
 *    gm.anagram, dirender dari ketersediaan label kamus (bukan dari
 *    gating supportedModes), dan mode anagram ikut isTimed agar
 *    kolom durasi tampil.
 * 3. Ketiga berkas kamus (id/en/ar) memuat game_mode.anagram yang
 *    bukan string kosong.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const sessionRouteSource = readFileSync(
  path.join(process.cwd(), "src/app/api/rooms/session/route.ts"),
  "utf8",
);

const selectorSource = readFileSync(
  path.join(process.cwd(), "src/app/dashboard/games/game-mode-selector.tsx"),
  "utf8",
);

describe("route sesi: helper resolveSessionGameType", () => {
  test("helper didefinisikan satu kali", () => {
    const defs = sessionRouteSource.match(/function resolveSessionGameType\(/g);
    assert.equal(defs?.length, 1);
  });

  test("cabang mode anagram mengembalikan \"anagram\" lebih dulu", () => {
    assert.match(
      sessionRouteSource,
      /if \(snapGame\?\.mode === "anagram"\) return "anagram";/,
    );
  });

  test("cabang token [THEME:whack] pada nama mengembalikan \"whack_mole\"", () => {
    assert.ok(sessionRouteSource.includes("name.match(/\\[THEME:(.*?)\\]/)"));
    assert.ok(sessionRouteSource.includes('return "whack_mole";'));
  });

  test("cabang cadangan memakai game_type tersimpan atau \"quiz\"", () => {
    assert.match(
      sessionRouteSource,
      /return typeof stored === "string" && stored \? stored : "quiz";/,
    );
  });

  test("keempat titik perhitungan game_type memakai helper", () => {
    const calls = sessionRouteSource.match(/game_type: resolveSessionGameType\(/g);
    assert.equal(calls?.length, 4);
  });

  test("tidak ada lagi ekspresi inline anagram di luar helper", () => {
    assert.ok(
      !sessionRouteSource.includes('mode === "anagram" ? "anagram" : "quiz"'),
    );
  });
});

describe("formulir game: mode anagram bisa dipilih", () => {
  test("GameModeDict memuat field opsional anagram", () => {
    assert.ok(selectorSource.includes("anagram?: string;"));
  });

  test("opsi anagram dirender berlabel gm.anagram tanpa gating supportedModes", () => {
    assert.ok(selectorSource.includes('<option value="anagram">{gm.anagram}</option>'));
    assert.ok(selectorSource.includes("{gm.anagram ? ("));
    assert.ok(!selectorSource.includes('supportedModes.includes("anagram")'));
  });

  test("mode anagram termasuk isTimed agar kolom durasi tampil", () => {
    assert.match(selectorSource, /mode === "learning" \|\|\s*\n?\s*mode === "anagram"/);
  });
});

describe("kamus game_mode memuat label anagram", () => {
  for (const locale of ["id", "en", "ar"] as const) {
    test(`game_mode.anagram terisi di ${locale}.json`, () => {
      const dict = JSON.parse(
        readFileSync(
          path.join(process.cwd(), `src/lib/i18n/${locale}.json`),
          "utf8",
        ),
      ) as { game_mode?: Record<string, unknown> };
      const label = dict.game_mode?.anagram;
      assert.equal(typeof label, "string");
      assert.ok((label as string).trim().length > 0);
    });
  }
});
