/**
 * Regression: perluasan cakupan Tugas Susulan menjadi 15 dars
 * (perintah pemilik, 17 Nov 2026).
 *
 * Migrasi 0125 memperluas migrasi 0118 tanpa mengubah aturan
 * lulusnya: kedua RPC dibuat ulang dengan cakupan
 * generate_series(1, 15) dan rentang pertemuan 1 s.d. 30. Test ini
 * membaca berkas migrasi 0125, modul judul dars, dan
 * dua halaman terkait, lalu memastikan cakupan barunya terpasang,
 * aturan wajib dua langkah tetap sama seperti 0118, dan data
 * Dars 11 s.d. 15 tersedia.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { JUDUL_DARS, judulDars } from "../../src/modules/tugas-susulan/judul";

const root = process.cwd();
const migration = readFileSync(
  path.join(root, "supabase/migrations/0125_tugas_susulan_15_dars.sql"),
  "utf8",
);
const bacaPage = readFileSync(
  path.join(root, "src/app/student/tugas-susulan/baca/[dars]/page.tsx"),
  "utf8",
);
const dashboardPage = readFileSync(
  path.join(root, "src/app/dashboard/tugas-susulan/page.tsx"),
  "utf8",
);

// Badan SQL tanpa komentar, supaya angka cakupan yang hanya disebut
// di catatan kepala berkas tidak ikut terhitung sebagai logika.
const sqlBody = migration
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");

function fungsiSql(nama: string): string {
  const mulai = sqlBody.indexOf(`create or replace function public.${nama}`);
  assert.notEqual(mulai, -1, `fungsi ${nama} harus ada di migrasi 0125`);
  const akhir = sqlBody.indexOf("grant execute", mulai);
  assert.notEqual(akhir, -1, `grant untuk ${nama} harus ada`);
  return sqlBody.slice(mulai, akhir);
}

describe("migrasi 0125: cakupan 15 dars dan pertemuan 1 s.d. 30", () => {
  test("RPC siswa menghasilkan baris Dars 1 s.d. 15", () => {
    assert.equal(sqlBody.split("generate_series(1, 15)").length - 1, 1);
    assert.equal(sqlBody.includes("generate_series(1, 8)"), false);
  });

  test("kedua RPC membaca kehadiran pertemuan 1 s.d. 30", () => {
    assert.equal(sqlBody.split("meeting_no between 1 and 30").length - 1, 2);
    assert.equal(sqlBody.includes("meeting_no between 1 and 16"), false);
  });

  test("pemetaan latihan per dars sama seperti 0118, tanpa cabang Campuran", () => {
    assert.equal(sqlBody.includes("Campuran"), false);
    const pola = "g.name ilike ('Dars ' || m.d || ' %')";
    assert.equal(sqlBody.split(pola).length - 1, 2);
    assert.ok(sqlBody.includes("g.mode in ('endless', 'practice')"));
  });
});

describe("migrasi 0125: aturan lulus tidak berubah dari 0118", () => {
  test("status lulus siswa hanya mensyaratkan baca + latihan", () => {
    const siswa = fungsiSql("student_get_catchup_tasks");
    const cabangLulus = siswa.slice(
      siswa.indexOf("then 'lulus'") - 220,
      siswa.indexOf("then 'lulus'"),
    );
    assert.ok(cabangLulus.includes("c.baca_ok"));
    assert.equal(cabangLulus.includes("kosakata_ok"), false);
    assert.equal(cabangLulus.includes("qawaid_ok"), false);
    assert.equal(cabangLulus.includes("game_ok"), false);
    assert.ok(cabangLulus.includes("c.total_q >= 25"));
    assert.ok(cabangLulus.includes("c.correct_q >= c.total_q - 5"));
  });

  test("bukti opsional tetap dihitung dan tetap memicu status proses", () => {
    // Bukti game (game_ok) tidak lagi ditegaskan di sini: langkah
    // Game dihapus dari Tugas Susulan oleh migrasi 0128 (perintah
    // pemilik, 18 Nov 2026). Keadaan sesudah 0128 dikunci test
    // tugas-susulan-tanpa-langkah-game.
    const siswa = fungsiSql("student_get_catchup_tasks");
    assert.ok(siswa.includes("as kosakata_ok"));
    assert.ok(siswa.includes("as qawaid_ok"));
    const cabangProses = siswa.slice(
      siswa.indexOf("then 'proses'") - 260,
      siswa.indexOf("then 'proses'"),
    );
    assert.ok(cabangProses.includes("c.kosakata_ok"));
    assert.ok(cabangProses.includes("c.qawaid_ok"));
  });

  test("overview guru menghitung selesai dari baca + latihan saja", () => {
    const guru = fungsiSql("teacher_catchup_overview");
    assert.ok(guru.includes("p.step = 'baca'"));
    assert.ok(guru.includes("as baca_ok"));
    assert.equal(guru.includes("steps_done"), false);
    assert.equal(guru.includes("game_ok"), false);
    assert.ok(guru.includes("and c.baca_ok"));
    assert.ok(guru.includes("c.correct_q >= c.total_q - 5"));
  });
});

describe("data judul Dars 1 s.d. 15", () => {
  test("daftar judul memuat tepat 15 dars berurutan", () => {
    const nomor = Object.keys(JUDUL_DARS).map(Number).sort((a, b) => a - b);
    assert.equal(nomor.length, 15);
    nomor.forEach((d, i) => {
      assert.equal(d, i + 1);
      assert.ok(JUDUL_DARS[d].length > 0, `judul Dars ${d} tidak kosong`);
    });
  });

  test("entri Dars 11 s.d. 15 dapat dicari per dars", () => {
    for (let d = 11; d <= 15; d++) {
      assert.ok(judulDars(d), `judul Dars ${d} harus ada`);
    }
  });
});

describe("halaman terkait memakai cakupan 15 dars", () => {
  test("penjaga halaman baca menerima Dars 1 s.d. 15", () => {
    assert.ok(bacaPage.includes("darsNo > 15"));
    assert.equal(bacaPage.includes("darsNo > 8"), false);
  });

  test("teks ringkasan guru menyebut pertemuan 1 s.d. 30", () => {
    assert.ok(dashboardPage.includes("pertemuan 1 s.d. 30"));
    assert.equal(dashboardPage.includes("pertemuan 1 s.d. 16"), false);
  });
});
