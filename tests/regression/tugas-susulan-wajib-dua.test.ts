/**
 * Regression: aturan FINAL Tugas Susulan (keputusan pemilik, 17 Nov 2026).
 *
 * Langkah wajib tinggal 2: (1) Baca Materi dan (2) Latihan soal dars
 * itu sendiri. Kosakata, Qawaid, dan Game tidak wajib. Latihan untuk
 * semua dars, termasuk Dars 1 s.d. 5, memakai Latihan Siswa darsnya
 * sendiri; pemetaan lama ke "Campuran Dars 1-5" dihapus.
 *
 * Aturan itu ditegakkan migrasi 0118 (yang menggantikan 0117, tidak
 * pernah diterapkan) pada dua RPC: student_get_catchup_tasks dan
 * teacher_catchup_overview. Test ini membaca berkas migrasi dan
 * komponen kartu tugas, lalu memastikan cabang Campuran hilang,
 * syarat lulus hanya baca + latihan, dan rantai kunci UI sejalan.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const migration = readFileSync(
  path.join(
    root,
    "supabase/migrations/0118_tugas_susulan_wajib_dua_langkah.sql",
  ),
  "utf8",
);
const card = readFileSync(
  path.join(root, "src/app/student/tugas-susulan/tugas-card.tsx"),
  "utf8",
);

// Badan SQL tanpa komentar, supaya kata "Campuran" yang hanya disebut
// di catatan kepala berkas tidak ikut terhitung sebagai logika.
const sqlBody = migration
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");

function fungsiSql(nama: string): string {
  const mulai = sqlBody.indexOf(`create or replace function public.${nama}`);
  assert.notEqual(mulai, -1, `fungsi ${nama} harus ada di migrasi 0118`);
  const akhir = sqlBody.indexOf("grant execute", mulai);
  assert.notEqual(akhir, -1, `grant untuk ${nama} harus ada`);
  return sqlBody.slice(mulai, akhir);
}

describe("migrasi 0118: pemetaan latihan per dars untuk semua dars", () => {
  test("tidak ada cabang Campuran di badan SQL kedua RPC", () => {
    assert.equal(sqlBody.includes("Campuran"), false);
    assert.equal(sqlBody.includes("between 1 and 5"), false);
  });

  test("kedua RPC memakai pola nama per dars yang sama seperti Dars 6-8 di 0116", () => {
    const pola = "g.name ilike ('Dars ' || m.d || ' %')";
    assert.equal(sqlBody.split(pola).length - 1, 2);
    assert.ok(sqlBody.includes("g.mode in ('endless', 'practice')"));
  });

  test("cakupan tetap 8 dars dan pertemuan 1 s.d. 16", () => {
    assert.equal(sqlBody.split("generate_series(1, 8)").length - 1, 1);
    assert.equal(sqlBody.split("meeting_no between 1 and 16").length - 1, 2);
  });
});

describe("migrasi 0118: syarat lulus hanya baca + latihan", () => {
  test("status lulus siswa tidak mensyaratkan kosakata, qawaid, atau game", () => {
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
    const siswa = fungsiSql("student_get_catchup_tasks");
    assert.ok(siswa.includes("as kosakata_ok"));
    assert.ok(siswa.includes("as qawaid_ok"));
    assert.ok(siswa.includes("as game_ok"));
    const cabangProses = siswa.slice(
      siswa.indexOf("then 'proses'") - 260,
      siswa.indexOf("then 'proses'"),
    );
    assert.ok(cabangProses.includes("c.kosakata_ok"));
    assert.ok(cabangProses.includes("c.qawaid_ok"));
    assert.ok(cabangProses.includes("c.game_ok"));
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

describe("kartu tugas siswa: rantai kunci dan label tidak wajib", () => {
  test("latihan terbuka sesudah baca, bukan sesudah kosakata dan qawaid", () => {
    assert.ok(card.includes("const langkah3Buka = task.bacaDone;"));
    assert.equal(
      card.includes("task.kosakataDone && task.qawaidDone"),
      false,
    );
  });

  test("kosakata dan qawaid memakai konfigurasi langkah opsional", () => {
    assert.ok(card.includes("KOSAKATA_STEP"));
    assert.ok(card.includes("QAWAID_STEP"));
    assert.ok(card.includes("opsional={!KOSAKATA_STEP.required}"));
    assert.ok(card.includes("opsional={!QAWAID_STEP.required}"));
  });
});
