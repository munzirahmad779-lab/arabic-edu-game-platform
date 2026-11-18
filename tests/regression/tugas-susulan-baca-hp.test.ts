/**
 * Regression: bug Langkah Baca Materi Tugas Susulan di HP siswa
 * (kasus Arika, Dars 3, dilaporkan 18 Nov 2026).
 *
 * Gejala: penampil PDF kosong di HP Android, bilah kemajuan berhenti
 * di 83 persen dan tidak pernah mencapai akhir, Langkah 1 tidak
 * pernah tercatat selesai sehingga Langkah 2 dan 3 terkunci terus.
 *
 * Akar masalah di implementasi lama (baca-tracker.tsx sebelum
 * perbaikan): penyelesaian langkah HANYA bisa terpicu dari pendengar
 * gulir pada rasio >= 0.98, tanpa tombol manual sama sekali, dan PDF
 * disematkan sebagai iframe (material-pdf.tsx) yang di layar sentuh
 * menelan gestur gulir halaman induk. Perbaikan: hitungan kemajuan
 * dipindah ke modul murni baca-progress (ambang otomatis 95, tombol
 * aktif 90/dasar halaman), ada tombol "Selesai Membaca", dan iframe
 * PDF dibuat tidak menangkap sentuhan di halaman baca.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const tracker = readFileSync(
  path.join(
    root,
    "src/app/student/tugas-susulan/baca/[dars]/baca-tracker.tsx",
  ),
  "utf8",
);
const page = readFileSync(
  path.join(root, "src/app/student/tugas-susulan/baca/[dars]/page.tsx"),
  "utf8",
);

describe("pelacak baca: hitungan kemajuan dari modul murni", () => {
  test("tracker memakai hitungPersenBaca dan ambang dari baca-progress", () => {
    assert.ok(tracker.includes("hitungPersenBaca"));
    assert.ok(tracker.includes("bacaDianggapSelesai"));
    assert.ok(tracker.includes("tombolSelesaiAktif"));
    assert.ok(tracker.includes("@/modules/tugas-susulan/baca-progress"));
  });

  test("ambang lama 0.98 sudah tidak ada di tracker", () => {
    assert.equal(tracker.includes("0.98"), false);
  });

  test("penyelesaian tetap lewat RPC yang sama (completeCatchupStep langkah baca)", () => {
    assert.ok(tracker.includes('completeCatchupStep(darsNo, "baca")'));
  });
});

describe("tombol Selesai Membaca", () => {
  test("tombol Selesai Membaca ada di tracker", () => {
    assert.ok(tracker.includes("Selesai Membaca"));
    assert.ok(tracker.includes('type="button"'));
  });

  test("tombol nonaktif sampai kemajuan cukup atau sampai di bawah", () => {
    assert.ok(tracker.includes("disabled={!bisaSelesai || mengirim}"));
    assert.ok(tracker.includes("setBisaSelesai(tombolSelesaiAktif(u))"));
  });

  test("sesudah tombol berhasil, siswa diarahkan ke halaman Tugas Susulan", () => {
    assert.ok(tracker.includes('router.push("/student/tugas-susulan")'));
  });

  test("blok tombol tampil di bagian bawah halaman bacaan, bukan hanya bilah tetap", () => {
    assert.ok(tracker.includes("Sudah sampai di akhir bacaan?"));
  });
});

describe("halaman baca: PDF yang gagal tampil di HP", () => {
  test("iframe PDF tidak menangkap sentuhan pada layar sentuh di halaman baca", () => {
    assert.ok(page.includes("@media (pointer: coarse)"));
    assert.ok(page.includes(".baca-pdf iframe { pointer-events: none; }"));
    assert.ok(page.includes('className="baca-pdf space-y-2"'));
  });

  test("ada penjelasan dan jalan keluar Download PDF untuk siswa", () => {
    assert.ok(page.includes("Bila PDF tidak tampil di layar HP-mu"));
    assert.ok(page.includes("Download PDF"));
  });

  test("penampil PDF dan berkas materi tidak diubah jalurnya", () => {
    assert.ok(page.includes("<MaterialPdf url={pdfUrl} title={material.title} />"));
  });
});
