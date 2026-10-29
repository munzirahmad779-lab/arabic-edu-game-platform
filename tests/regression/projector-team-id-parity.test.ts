/**
 * Regression: pola tukar Hijau/Kuning pada tampilan antara proyektor
 * (temuan uji live sesudah deploy 0078, 30 Okt 2026, kendala B.3).
 *
 * Akar masalah: definisi id tim berlawanan antara dua berkas klien.
 * Halaman stik (controller/page.tsx, TEAMS) memakai team-3 = Hijau dan
 * team-4 = Kuning mengikuti lencana fisik "Stik 3/Stik 4", sedangkan
 * INITIAL_TEAMS di layar proyektor sempat memakai team-3 = Kuning dan
 * team-4 = Hijau. Seluruh jalur pencatatan berindeks teamId, jadi press
 * stik Hijau (team-3) menyalakan kartu Kuning di proyektor secara
 * deterministik, dan sebaliknya.
 *
 * Perbaikan: blok konfigurasi team-3/team-4 di INITIAL_TEAMS ditukar
 * agar id mengikuti warna stik. Tes ini menegaskan secara statis bahwa
 * pemetaan id -> warna (nama + keluarga warna Tailwind) di kedua berkas
 * identik, supaya pertukaran itu tidak kembali lagi.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const controllerSource = readFileSync(
  path.join(root, "src/app/controller/page.tsx"),
  "utf8",
);
const projectorSource = readFileSync(
  path.join(
    root,
    "src/app/dashboard/games/[gameId]/projector/projector-screen.tsx",
  ),
  "utf8",
);

type TeamColorMapping = Record<string, { colorName: string; family: string }>;

function parseControllerTeams(source: string): TeamColorMapping {
  const mapping: TeamColorMapping = {};
  const entryPattern =
    /\{\s*id: "(team-\d+)", name: "Tim (\w+)[^"]*", color: "text-\w+-\d+", bgGradient: "from-(\w+)-\d+/g;
  for (const match of source.matchAll(entryPattern)) {
    mapping[match[1]] = { colorName: match[2], family: match[3] };
  }
  return mapping;
}

function parseProjectorTeams(source: string): TeamColorMapping {
  const mapping: TeamColorMapping = {};
  const blockPattern =
    /id: "(team-\d+)",\s*\n\s*name: "Tim (\w+)",\s*\n\s*colorName: "\w+",\s*\n\s*themeGradient: "from-(\w+)-\d+/g;
  for (const match of source.matchAll(blockPattern)) {
    mapping[match[1]] = { colorName: match[2], family: match[3] };
  }
  return mapping;
}

describe("Pemetaan id tim stik dan proyektor identik", () => {
  const fromController = parseControllerTeams(controllerSource);
  const fromProjector = parseProjectorTeams(projectorSource);

  test("Kedua berkas mendefinisikan tepat empat tim", () => {
    assert.deepEqual(Object.keys(fromController).sort(), [
      "team-1",
      "team-2",
      "team-3",
      "team-4",
    ]);
    assert.deepEqual(Object.keys(fromProjector).sort(), [
      "team-1",
      "team-2",
      "team-3",
      "team-4",
    ]);
  });

  test("Id yang sama berarti warna yang sama di stik dan di proyektor", () => {
    assert.deepEqual(fromProjector, fromController);
  });

  test("team-3 adalah Hijau (Stik 3) dan team-4 adalah Kuning (Stik 4)", () => {
    assert.equal(fromController["team-3"].colorName, "Hijau");
    assert.equal(fromController["team-4"].colorName, "Kuning");
    assert.equal(fromProjector["team-3"].colorName, "Hijau");
    assert.equal(fromProjector["team-4"].colorName, "Kuning");
    assert.equal(fromProjector["team-3"].family, "emerald");
    assert.equal(fromProjector["team-4"].family, "amber");
  });

  test("Lencana fisik stik di halaman kontroler mengikuti nomor id tim", () => {
    const badgePattern = /id: "(team-(\d+))"[^\n]*badge: "\S+ Stik (\d+)"/g;
    const seen: Array<[string, string]> = [];
    for (const match of controllerSource.matchAll(badgePattern)) {
      seen.push([match[2], match[3]]);
    }
    assert.equal(seen.length, 4);
    for (const [idNumber, badgeNumber] of seen) {
      assert.equal(badgeNumber, idNumber);
    }
  });
});
