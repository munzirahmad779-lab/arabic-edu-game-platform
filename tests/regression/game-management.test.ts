/**
 * Regresi: pengelolaan permainan (audit armada 6 Nov 2026, klon K36).
 * Pratinjau GameCardActions tidak terjangkau dari halaman mana pun,
 * edit game tidak ada sama sekali, formulir bisa dikirim tanpa soal
 * dan spanduk galat hanya menampilkan kode mentah "invalid", dan
 * tombol kloning tidak punya state nonaktif.
 *
 * Perbaikan yang ditegaskan tes ini:
 * - halaman daftar memakai GameCardActions (pratinjau terhubung,
 *   kloning berstate nonaktif dari komponen yang sama) dan pesan
 *   galat spesifik lewat getGameErrorMessage;
 * - updateGame ada dan berbagi pengurai validasi dengan createGame;
 * - halaman ubah [gameId] ada dan mengirim ke updateGame;
 * - QuestionsPicker menandai wajib dan melaporkan jumlah terpilih,
 *   GameFormShell menonaktifkan tombol simpan saat soal kosong.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getGameErrorMessage } from "../../src/app/dashboard/games/error-messages";

describe("getGameErrorMessage menerjemahkan kode menjadi kalimat spesifik", () => {
  test("kode invalid tidak lagi tampil mentah", () => {
    const msg = getGameErrorMessage("invalid");
    assert.ok(msg && msg !== "invalid");
    assert.match(msg!, /Periksa kembali/);
  });

  test("penyebab soal kosong disebut dengan jelas", () => {
    assert.match(getGameErrorMessage("no_questions")!, /minimal 1 soal/);
  });

  test("URL embed yang tidak sah disebut dengan jelas", () => {
    assert.match(getGameErrorMessage("invalid_embed_url")!, /https:\/\//);
  });

  test("kode tak dikenal memakai msg bila ada, dan null tanpa kode", () => {
    assert.equal(getGameErrorMessage("aneh", "pesan cadangan"), "pesan cadangan");
    assert.equal(getGameErrorMessage(undefined), null);
  });
});

const actionsSource = readFileSync(
  path.join(process.cwd(), "src/app/dashboard/games/actions.ts"),
  "utf8",
);
const listPageSource = readFileSync(
  path.join(process.cwd(), "src/app/dashboard/games/page.tsx"),
  "utf8",
);
const pickerSource = readFileSync(
  path.join(process.cwd(), "src/app/dashboard/games/questions-picker.tsx"),
  "utf8",
);
const shellSource = readFileSync(
  path.join(process.cwd(), "src/app/dashboard/games/game-form-shell.tsx"),
  "utf8",
);

describe("Aksi ubah permainan berbagi validasi dengan aksi buat", () => {
  test("updateGame diekspor dari actions.ts", () => {
    assert.match(actionsSource, /export async function updateGame\(formData: FormData\)/);
  });

  test("createGame dan updateGame sama-sama memakai parseGameFormFields", () => {
    const uses = actionsSource.match(/parseGameFormFields\(formData, /g) ?? [];
    assert.equal(uses.length, 2);
  });

  test("daftar soal kosong ditolak dengan kode spesifik, bukan invalid umum", () => {
    assert.match(actionsSource, /error=no_questions/);
    assert.match(actionsSource, /error=too_many_questions/);
    assert.match(actionsSource, /error=invalid_name/);
    assert.match(actionsSource, /error=invalid_duration/);
  });

  test("updateGame memulihkan daftar soal lama bila penulisan baru gagal", () => {
    const updateIdx = actionsSource.indexOf("export async function updateGame");
    const rollbackIdx = actionsSource.indexOf("oldQuestionRows", updateIdx);
    assert.ok(updateIdx !== -1 && rollbackIdx > updateIdx);
  });
});

describe("Permukaan pengelolaan permainan terhubung", () => {
  test("halaman daftar memakai GameCardActions dan pesan galat spesifik", () => {
    assert.match(listPageSource, /<GameCardActions/);
    assert.match(listPageSource, /getGameErrorMessage\(searchParams\.error/);
    assert.doesNotMatch(listPageSource, /\{searchParams\.error\}\s*\n/);
  });

  test("halaman ubah ada dan mengirim ke updateGame lewat GameFormShell", () => {
    const editPagePath = path.join(
      process.cwd(),
      "src/app/dashboard/games/[gameId]/page.tsx",
    );
    assert.ok(existsSync(editPagePath), "halaman [gameId]/page.tsx harus ada");
    const editSource = readFileSync(editPagePath, "utf8");
    assert.match(editSource, /action=\{updateGame\}/);
    assert.match(editSource, /initialSelectedIds/);
    assert.match(editSource, /name="game_id"/);
  });

  test("pemilih soal menandai wajib dan melaporkan jumlah terpilih", () => {
    assert.match(pickerSource, /initialSelectedIds/);
    assert.match(pickerSource, /reportSelectedCount\(selected\.size\)/);
    assert.match(pickerSource, /Wajib: pilih minimal 1 soal/);
  });

  test("cangkang formulir menonaktifkan tombol simpan saat soal kosong", () => {
    assert.match(shellSource, /disabled=\{noQuestions\}/);
    assert.match(shellSource, /Pilih minimal 1 soal/);
  });
});
