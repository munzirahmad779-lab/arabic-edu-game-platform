/**
 * Regression: langkah Game DIHAPUS dari Tugas Susulan dan Game
 * Solo pindah ke paling depan halaman (perintah pemilik,
 * 18 Nov 2026).
 *
 * Tiga perubahan yang dikunci test ini:
 * 1. Kartu tugas hanya punya Langkah 1 Baca (WAJIB), Langkah 2
 *    Kosakata+Qawaid (TIDAK WAJIB), dan Langkah 3 Latihan (WAJIB).
 *    Blok "Langkah 4 · Game solo", chip tidak wajibnya, dan bukti
 *    mainnya hilang seluruhnya dari tugas-card.tsx.
 * 2. Halaman Tugas Susulan memuat bagian "Game Solo" di atas
 *    daftar kartu tugas, memakai kunci yang sama seperti halaman
 *    Latihan Mandiri (statusKunciGameSolo dari solo-lock-server,
 *    syarat 7 dars dari solo-lock, daftar STUDENT_GAMES). Bagian
 *    ini jalan masuk bermain tersendiri dan tidak terhubung ke
 *    status tugas.
 * 3. Migrasi 0128 membuat ulang dua RPC dari 0125 tanpa bukti
 *    game: kolom keluaran game_done hilang, subquery game_ok atas
 *    student_game_results hilang, dan cabang status 'proses'
 *    tidak lagi dipicu bukti game. Syarat lulus (baca + latihan)
 *    dan badan teacher_catchup_overview identik dengan 0125.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const card = readFileSync(
  path.join(root, "src/app/student/tugas-susulan/tugas-card.tsx"),
  "utf8",
);
const page = readFileSync(
  path.join(root, "src/app/student/tugas-susulan/page.tsx"),
  "utf8",
);
const databaseTypes = readFileSync(
  path.join(root, "src/types/database.ts"),
  "utf8",
);
const migration0128 = readFileSync(
  path.join(root, "supabase/migrations/0128_susulan_tanpa_langkah_game.sql"),
  "utf8",
);
const migration0125 = readFileSync(
  path.join(root, "supabase/migrations/0125_tugas_susulan_15_dars.sql"),
  "utf8",
);

// Badan SQL tanpa komentar, supaya penjelasan di kepala berkas
// (yang menyebut kata game sebagai latar) tidak ikut terhitung
// sebagai logika.
function badanSql(teks: string): string {
  return teks
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
}

function fungsiSql(teks: string, nama: string): string {
  const body = badanSql(teks);
  const mulai = body.indexOf(`create or replace function public.${nama}`);
  assert.notEqual(mulai, -1, `fungsi ${nama} harus ada`);
  const akhir = body.indexOf("grant execute", mulai);
  assert.notEqual(akhir, -1, `grant untuk ${nama} harus ada`);
  return body.slice(mulai, akhir);
}

const sql0128 = badanSql(migration0128);

describe("kartu tugas: langkah game hilang seluruhnya", () => {
  test("tidak ada Langkah 4 dan tidak ada komponen langkah game", () => {
    assert.equal(card.includes("Langkah 4"), false);
    assert.equal(card.includes("Game solo"), false);
    assert.equal(card.includes("GameStep"), false);
    assert.equal(card.includes("GAME_STEP"), false);
    assert.equal(card.includes("game-step"), false);
  });

  test("data kartu tidak lagi membawa bukti game", () => {
    assert.equal(card.includes("gameDone"), false);
  });

  test("tiga langkah yang tersisa tetap ada dan berurutan", () => {
    const i1 = card.indexOf("Langkah 1 · Baca materi");
    const i2 = card.indexOf("Langkah 2 · Pahami qawaid");
    const i3 = card.indexOf("Langkah 3 · Kerjakan Latihan Mandiri");
    assert.ok(i1 > -1 && i2 > i1 && i3 > i2);
  });

  test("pengantar kartu menyebut tidak wajib hanya untuk qawaid, tanpa kosakata", () => {
    assert.ok(card.includes("Qawaid TIDAK WAJIB."));
    assert.equal(card.includes("Kosakata"), false);
    assert.equal(card.includes("dan game TIDAK WAJIB"), false);
    assert.equal(card.includes("game TIDAK WAJIB"), false);
  });
});

describe("halaman tugas susulan: bagian Game Solo di paling depan", () => {
  test("memakai kunci solo yang sudah ada, bukan logika kunci baru", () => {
    assert.ok(page.includes("statusKunciGameSolo"));
    assert.ok(page.includes("await statusKunciGameSolo()"));
    assert.ok(page.includes("solo-lock-server"));
    assert.ok(page.includes("solo-lock"));
    assert.ok(page.includes("SYARAT_JUMLAH_DARS_TUNTAS"));
    assert.ok(page.includes("STUDENT_GAMES"));
    assert.ok(page.includes("student-games"));
  });

  test("bagian Game Solo tampil di atas daftar kartu tugas", () => {
    const idxBagian = page.indexOf("<h2 className=\"text-lg font-black text-neutral-900\">\n              Game Solo");
    const idxDaftar = page.indexOf("tasks.map((task)");
    assert.ok(idxBagian > -1, "judul bagian Game Solo harus ada");
    assert.ok(idxDaftar > -1, "daftar kartu tugas harus ada");
    assert.ok(idxBagian < idxDaftar);
  });

  test("keadaan terkunci menampilkan chip dan kalimat kemajuan 7 dars", () => {
    assert.ok(page.includes("🔒 Terkunci"));
    assert.ok(page.includes("Kemajuanmu sekarang: {jumlahDarsTuntas}"));
    assert.ok(
      page.includes("Terkunci, selesaikan latihan untuk"),
    );
    assert.ok(page.includes('aria-disabled="true"'));
  });

  test("keadaan terbuka menautkan ke rute main siswa per slug", () => {
    assert.ok(page.includes("/student/play/${g.slug}"));
  });

  test("pengantar halaman tidak lagi menyebut game sebagai tidak wajib", () => {
    assert.ok(page.includes("Qawaid TIDAK WAJIB, tetapi"));
    assert.equal(page.includes("Kosakata"), false);
    assert.equal(page.includes("game solo TIDAK WAJIB"), false);
  });

  test("halaman tidak lagi membaca kolom game_done dari RPC", () => {
    assert.equal(page.includes("gameDone"), false);
    assert.equal(page.includes("t.game_done"), false);
  });
});

describe("migrasi 0128: bukti game dicabut dari RPC", () => {
  test("tidak ada game_ok, game_done, dan student_game_results di badan SQL", () => {
    assert.equal(sql0128.includes("game_ok"), false);
    assert.equal(sql0128.includes("game_done"), false);
    assert.equal(sql0128.includes("student_game_results"), false);
  });

  test("fungsi siswa dijatuhkan dulu karena tipe kembali berubah", () => {
    assert.ok(
      sql0128.includes(
        "drop function if exists public.student_get_catchup_tasks(text);",
      ),
    );
  });

  test("cabang proses tidak lagi dipicu bukti game", () => {
    const siswa = fungsiSql(migration0128, "student_get_catchup_tasks");
    const cabangProses = siswa.slice(
      siswa.indexOf("then 'proses'") - 300,
      siswa.indexOf("then 'proses'"),
    );
    assert.equal(cabangProses.includes("game"), false);
    assert.ok(cabangProses.includes("c.baca_ok"));
    assert.ok(cabangProses.includes("c.kosakata_ok"));
    assert.ok(cabangProses.includes("c.qawaid_ok"));
    assert.ok(cabangProses.includes("c.answered_q > 0"));
  });

  test("syarat lulus tidak berubah dari 0125: baca + latihan per dars", () => {
    const siswaBaru = fungsiSql(migration0128, "student_get_catchup_tasks");
    const siswaLama = fungsiSql(migration0125, "student_get_catchup_tasks");
    const cabang = (s: string) =>
      s.slice(s.indexOf("then 'lulus'") - 220, s.indexOf("then 'lulus'"));
    assert.equal(cabang(siswaBaru), cabang(siswaLama));
    assert.ok(cabang(siswaBaru).includes("c.baca_ok"));
    assert.ok(cabang(siswaBaru).includes("c.correct_q >= c.total_q - 5"));
  });

  test("cakupan tetap 15 dars dan pertemuan 1 s.d. 30 seperti 0125", () => {
    assert.equal(sql0128.split("generate_series(1, 15)").length - 1, 1);
    assert.equal(sql0128.split("meeting_no between 1 and 30").length - 1, 2);
    const pola = "g.name ilike ('Dars ' || m.d || ' %')";
    assert.equal(sql0128.split(pola).length - 1, 2);
  });

  test("badan teacher_catchup_overview identik dengan 0125", () => {
    const guruBaru = fungsiSql(migration0128, "teacher_catchup_overview");
    const guruLama = fungsiSql(migration0125, "teacher_catchup_overview");
    assert.equal(guruBaru, guruLama);
  });
});

describe("tipe basis data mengikuti migrasi 0128", () => {
  test("tipe student_get_catchup_tasks tidak lagi memuat game_done", () => {
    const mulai = databaseTypes.indexOf("student_get_catchup_tasks:");
    assert.notEqual(mulai, -1);
    const potongan = databaseTypes.slice(mulai, mulai + 700);
    assert.equal(potongan.includes("game_done"), false);
    assert.ok(potongan.includes("latihan_lulus: boolean"));
  });
});
