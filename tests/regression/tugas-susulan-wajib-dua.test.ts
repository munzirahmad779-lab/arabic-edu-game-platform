/**
 * Regression: aturan FINAL Tugas Susulan (keputusan pemilik, 17 Nov 2026).
 *
 * Langkah wajib tinggal 2: (1) Baca Materi dan (2) Latihan soal dars
 * itu sendiri. Kosakata dan Qawaid semula tidak wajib. Latihan untuk
 * semua dars, termasuk Dars 1 s.d. 5, memakai Latihan Siswa darsnya
 * sendiri; pemetaan lama ke "Campuran Dars 1-5" dihapus.
 *
 * Catatan lanjutan (perintah pemilik, 18 Nov 2026): langkah Game
 * yang semula tidak wajib kini DIHAPUS seluruhnya dari kartu tugas
 * dan bukti game dicabut dari RPC lewat migrasi 0128; keadaan baru
 * itu dikunci test tugas-susulan-tanpa-langkah-game. Test di berkas
 * ini tetap membaca migrasi 0118 untuk aturan wajib dua langkahnya,
 * tanpa lagi menegaskan bagian game yang sudah berlalu.
 *
 * Catatan lanjutan (perintah pemilik, 19 Nov 2026): langkah
 * Kosakata lalu Qawaid yang semula tidak wajib kini DIHAPUS
 * seluruhnya dari kartu tugas; kartu hanya menyisakan dua langkah
 * wajib itu. Test di berkas ini tetap membaca migrasi 0118 untuk
 * aturan wajib dua langkahnya, tanpa lagi menegaskan bagian
 * kosakata dan qawaid yang sudah berlalu.
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
const page = readFileSync(
  path.join(root, "src/app/student/tugas-susulan/page.tsx"),
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

describe("kartu tugas siswa: rantai kunci dua langkah wajib", () => {
  test("latihan terbuka sesudah baca", () => {
    assert.ok(card.includes("const langkah2Buka = task.bacaDone;"));
    assert.equal(
      card.includes("task.kosakataDone && task.qawaidDone"),
      false,
    );
  });

  test("kosakata dan qawaid sudah dihapus seluruhnya dari kartu", () => {
    assert.equal(card.includes("KOSAKATA_STEP"), false);
    assert.equal(card.includes("QAWAID_STEP"), false);
    assert.equal(card.includes("Kosakata"), false);
    assert.equal(card.includes("Qawaid"), false);
    assert.equal(card.includes("qawaid"), false);
  });
});

describe("kartu tugas siswa: penegasan label wajib", () => {
  test("chip langkah wajib memuat teks persis WAJIB · KERJAKAN SEGERA", () => {
    const mulai = card.indexOf("function WajibChip()");
    assert.notEqual(mulai, -1, "komponen WajibChip harus ada");
    const chip = card.slice(mulai, mulai + 320);
    assert.ok(chip.includes("WAJIB · KERJAKAN SEGERA"));
  });

  test("chip wajib tampil tepat dua kali, pada judul Langkah 1 dan Langkah 2", () => {
    assert.equal(card.split("<WajibChip />").length - 1, 2);
    const langkah1 = card.slice(
      card.indexOf("Langkah 1 · Baca materi"),
      card.indexOf("Langkah 1 · Baca materi") + 160,
    );
    assert.ok(langkah1.includes("<WajibChip />"));
    const langkah2 = card.slice(
      card.indexOf("Langkah 2 · Kerjakan Latihan Mandiri"),
      card.indexOf("Langkah 2 · Kerjakan Latihan Mandiri") + 160,
    );
    assert.ok(langkah2.includes("<WajibChip />"));
  });

  test("tidak ada lagi langkah ketiga atau keempat di kartu", () => {
    assert.equal(card.includes("Langkah 3"), false);
    // Langkah 4 (Game solo) sudah dihapus seluruhnya dari kartu
    // atas perintah pemilik 18 Nov 2026; rincian keadaan barunya
    // di test tugas-susulan-tanpa-langkah-game.
    assert.equal(card.includes("Langkah 4"), false);
    assert.equal(card.includes("Pahami qawaid"), false);
  });

  test("tidak ada lagi chip atau label tidak wajib di kartu", () => {
    assert.equal(card.includes("TidakWajibChip"), false);
    assert.equal(card.includes("TIDAK WAJIB"), false);
  });

  test("pengantar halaman dan kartu menegaskan wajib segera, tanpa label tidak wajib", () => {
    assert.ok(page.includes("WAJIB dan harus dikerjakan segera"));
    assert.equal(page.includes("TIDAK WAJIB"), false);
    assert.ok(card.includes("WAJIB dan harus dikerjakan segera"));
    assert.equal(card.includes("TIDAK WAJIB"), false);
  });
});
