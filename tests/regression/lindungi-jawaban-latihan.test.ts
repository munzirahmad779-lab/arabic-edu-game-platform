/**
 * Regression: lindungi jawaban latihan siswa dari penghapusan
 * entri permainan (perintah pemilik, 18 Nov 2026).
 *
 * Kejadian 17 Nov 2026: kunci asing student_practice_answers.game_id
 * dari migrasi 0039 memakai ON DELETE CASCADE, sehingga menghapus
 * entri "Campuran Dars 1-5 — Latihan Siswa" menghapus seluruh
 * jawaban latihan siswa untuk permainan itu.
 *
 * Perbaikan dua lapis yang dikunci test ini:
 * 1. Migrasi 0127 mengubah kunci asing itu menjadi
 *    ON DELETE RESTRICT, menjatuhkan constraint lama lewat katalog
 *    sistem (apa pun namanya), tanpa menyentuh tabel/kolom lain.
 * 2. deleteGame di actions.ts menghitung jawaban latihan lebih dulu
 *    dan membatalkan penghapusan dengan kode galat
 *    has_practice_answers sebelum rantai hapus apa pun berjalan;
 *    kode itu diterjemahkan menjadi pesan Bahasa Indonesia yang
 *    jelas di error-messages.ts.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const migration = readFileSync(
  path.join(root, "supabase/migrations/0127_lindungi_jawaban_latihan.sql"),
  "utf8",
);
const actions = readFileSync(
  path.join(root, "src/app/dashboard/games/actions.ts"),
  "utf8",
);
const errorMessages = readFileSync(
  path.join(root, "src/app/dashboard/games/error-messages.ts"),
  "utf8",
);

// Badan SQL tanpa komentar, supaya aturan lama yang hanya disebut
// di catatan kepala berkas tidak ikut terhitung sebagai logika.
const sqlBody = migration
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n")
  .toLowerCase();

function badanDeleteGame(): string {
  const mulai = actions.indexOf("export async function deleteGame");
  assert.notEqual(mulai, -1, "fungsi deleteGame harus ada di actions.ts");
  const akhir = actions.indexOf("export async function cloneGame", mulai);
  assert.notEqual(akhir, -1, "fungsi cloneGame harus ada sesudah deleteGame");
  return actions.slice(mulai, akhir);
}

describe("migrasi 0127: kunci asing jawaban latihan menjadi RESTRICT", () => {
  test("constraint lama dijatuhkan lewat katalog sistem, bukan nama tebakan", () => {
    assert.ok(sqlBody.includes("pg_constraint"));
    assert.ok(sqlBody.includes("con.contype = 'f'"));
    assert.ok(sqlBody.includes("att.attname = 'game_id'"));
    assert.ok(sqlBody.includes("drop constraint"));
  });

  test("constraint baru bernama jelas dan memakai on delete restrict", () => {
    assert.ok(
      sqlBody.includes(
        "add constraint student_practice_answers_game_id_fkey",
      ),
    );
    assert.ok(sqlBody.includes("references public.games (id)"));
    assert.ok(sqlBody.includes("on delete restrict"));
  });

  test("tidak ada lagi on delete cascade di badan migrasi", () => {
    assert.equal(sqlBody.includes("on delete cascade"), false);
  });

  test("hanya tabel student_practice_answers yang diubah", () => {
    const alterTargets = [
      ...sqlBody.matchAll(/alter table public\.(\w+)/g),
    ].map((m) => m[1]);
    assert.ok(alterTargets.length >= 1);
    for (const target of alterTargets) {
      assert.equal(target, "student_practice_answers");
    }
    // Format dinamis di dalam blok DO juga menunjuk tabel yang sama.
    assert.ok(
      sqlBody.includes(
        "alter table public.student_practice_answers drop constraint",
      ),
    );
  });
});

describe("deleteGame: penjaga jawaban latihan", () => {
  test("menghitung jawaban latihan untuk game sebelum menghapus", () => {
    const body = badanDeleteGame();
    assert.ok(body.includes('.from("student_practice_answers")'));
    assert.ok(body.includes('count: "exact"'));
    assert.ok(body.includes('.eq("game_id", gameId)'));
  });

  test("membatalkan dengan kode galat has_practice_answers bila ada jawaban", () => {
    const body = badanDeleteGame();
    assert.ok(body.includes("error=has_practice_answers"));
    assert.ok(body.includes("(practiceAnswerCount ?? 0) > 0"));
  });

  test("penjaga berjalan sebelum rantai hapus room dan game_questions", () => {
    const body = badanDeleteGame();
    const idxGuard = body.indexOf("has_practice_answers");
    const idxRoomChain = body.indexOf('.from("submissions")');
    const idxQuestions = body.indexOf('.from("game_questions")');
    assert.ok(idxGuard > -1 && idxRoomChain > -1 && idxQuestions > -1);
    assert.ok(idxGuard < idxRoomChain);
    assert.ok(idxGuard < idxQuestions);
  });

  test("kegagalan membaca hitungan menghentikan penghapusan, bukan melanjutkannya", () => {
    const body = badanDeleteGame();
    assert.ok(body.includes("practiceCountError"));
    const idxCountError = body.indexOf("practiceCountError");
    const idxGuard = body.indexOf("has_practice_answers");
    assert.ok(idxCountError > -1 && idxCountError < idxGuard);
  });
});

describe("pesan galat untuk guru", () => {
  test("kode has_practice_answers diterjemahkan jelas di error-messages", () => {
    assert.ok(errorMessages.includes("has_practice_answers"));
    assert.ok(
      errorMessages.includes(
        "tidak bisa dihapus karena sudah ada jawaban latihan siswa",
      ),
    );
  });

  test("pesan baru tidak memakai em dash", () => {
    const mulai = errorMessages.indexOf("has_practice_answers");
    const potongan = errorMessages.slice(mulai, mulai + 400);
    assert.equal(potongan.includes("—"), false);
    const body = badanDeleteGame();
    const idxGuard = body.indexOf("has_practice_answers");
    assert.equal(body.slice(idxGuard - 200, idxGuard + 400).includes("—"), false);
  });
});
