/**
 * Regression: kunci Game Solo siswa berdasarkan latihan tuntas
 * untuk 7 dars yang berbeda (perintah pemilik, 17 Nov 2026,
 * ditegaskan ulang malam yang sama: "eh 7 dars").
 *
 * Aturan: dari daftar latihan RPC student_list_practice_games,
 * hitung dars berbeda yang latihannya sudah dijawab tuntas
 * (answered_count mencapai question_count). Nama "Dars N ..." dan
 * "Review Dars N ..." memetakan ke dars N; nama tanpa nomor dars
 * (misalnya Campuran) tidak dihitung. Game Solo terbuka bila
 * hitungannya 7 atau lebih. Penegakan ada di server pada kelima
 * rute /student/play/<slug> dan kartu terkunci di /student/practice.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  SYARAT_JUMLAH_DARS_TUNTAS,
  daftarDarsTuntas,
  gameSoloTerbuka,
  hitungDarsTuntas,
  latihanTuntas,
  nomorDarsDariNamaLatihan,
  type LatihanRingkasan,
} from "../../src/modules/game-results/solo-lock";

const root = process.cwd();

function latihan(
  name: string,
  answered: number,
  total = 30,
): LatihanRingkasan {
  return { name, question_count: total, answered_count: answered };
}

function tuntas(name: string, total = 30): LatihanRingkasan {
  return latihan(name, total, total);
}

const tujuhDarsTuntas: LatihanRingkasan[] = [
  tuntas("Dars 1 Salam dan Perkenalan - Latihan Siswa"),
  tuntas("Dars 2 Keluarga - Latihan Siswa"),
  tuntas("Dars 3 Sekolah - Latihan Siswa"),
  tuntas("Dars 4 Teman - Latihan Siswa"),
  tuntas("Dars 5 Kehidupan Sehari-hari - Latihan Siswa"),
  tuntas("Dars 6 Hobi - Latihan Siswa"),
  tuntas("Dars 7 Rumah - Latihan Siswa"),
];

describe("kunci Game Solo: pemetaan nama latihan ke nomor dars", () => {
  test("pola Dars N memetakan ke dars N", () => {
    assert.equal(nomorDarsDariNamaLatihan("Dars 7 Rumah - Latihan Siswa"), 7);
    assert.equal(
      nomorDarsDariNamaLatihan("Dars 10 Olahraga - Latihan Siswa"),
      10,
    );
    assert.equal(
      nomorDarsDariNamaLatihan("Dars 15 Teknologi - Latihan Siswa"),
      15,
    );
  });

  test("pola Review Dars N memetakan ke dars N yang sama", () => {
    assert.equal(nomorDarsDariNamaLatihan("Review Dars 2 - Latihan Siswa"), 2);
    assert.equal(nomorDarsDariNamaLatihan("Review Dars 5 - Latihan Siswa"), 5);
  });

  test("nama tanpa nomor dars tidak memetakan", () => {
    assert.equal(nomorDarsDariNamaLatihan("Pretest - Latihan Siswa"), null);
    assert.equal(nomorDarsDariNamaLatihan("Latihan Bebas"), null);
  });

  test("rentang Campuran Dars 1-5 tidak memetakan ke satu dars", () => {
    assert.equal(
      nomorDarsDariNamaLatihan("Campuran Dars 1-5 - Latihan Siswa"),
      null,
    );
  });
});

describe("kunci Game Solo: ketuntasan latihan", () => {
  test("terjawab tuntas berarti answered_count mencapai total soal", () => {
    assert.equal(latihanTuntas(latihan("Dars 1 - Latihan Siswa", 30)), true);
    assert.equal(latihanTuntas(latihan("Dars 1 - Latihan Siswa", 31)), true);
  });

  test("terjawab sebagian belum tuntas", () => {
    assert.equal(latihanTuntas(latihan("Dars 1 - Latihan Siswa", 29)), false);
    assert.equal(latihanTuntas(latihan("Dars 1 - Latihan Siswa", 0)), false);
  });

  test("latihan tanpa soal tidak pernah tuntas", () => {
    assert.equal(
      latihanTuntas({ name: "Dars 1 - Latihan Siswa", question_count: 0, answered_count: 0 }),
      false,
    );
  });

  test("answered_count kosong dianggap belum menjawab", () => {
    assert.equal(
      latihanTuntas({ name: "Dars 1 - Latihan Siswa", question_count: 30 }),
      false,
    );
  });
});

describe("kunci Game Solo: hitungan 7 dars berbeda", () => {
  test("syaratnya tepat 7 dars", () => {
    assert.equal(SYARAT_JUMLAH_DARS_TUNTAS, 7);
  });

  test("7 dars berbeda tuntas membuka kunci", () => {
    assert.equal(hitungDarsTuntas(tujuhDarsTuntas), 7);
    assert.equal(gameSoloTerbuka(tujuhDarsTuntas), true);
  });

  test("lebih dari 7 dars juga terbuka", () => {
    const delapan = [
      ...tujuhDarsTuntas,
      tuntas("Dars 8 Makanan dan Minuman - Latihan Siswa"),
    ];
    assert.equal(gameSoloTerbuka(delapan), true);
  });

  test("6 dars tuntas masih terkunci", () => {
    const enam = tujuhDarsTuntas.slice(0, 6);
    assert.equal(hitungDarsTuntas(enam), 6);
    assert.equal(gameSoloTerbuka(enam), false);
  });

  test("hanya Dars 7 yang tuntas tidak membuka kunci", () => {
    const hanyaDars7 = [tuntas("Dars 7 Rumah - Latihan Siswa")];
    assert.equal(hitungDarsTuntas(hanyaDars7), 1);
    assert.equal(gameSoloTerbuka(hanyaDars7), false);
  });

  test("satu dars yang sama dari dua permainan tetap dihitung satu", () => {
    const games: LatihanRingkasan[] = [
      tuntas("Dars 2 Keluarga - Latihan Siswa"),
      tuntas("Review Dars 2 - Latihan Siswa", 20),
      tuntas("Dars 1 Salam dan Perkenalan - Latihan Siswa"),
      tuntas("Dars 3 Sekolah - Latihan Siswa"),
      tuntas("Dars 4 Teman - Latihan Siswa"),
      tuntas("Dars 5 Kehidupan Sehari-hari - Latihan Siswa"),
      tuntas("Dars 6 Hobi - Latihan Siswa"),
    ];
    assert.deepEqual(daftarDarsTuntas(games), [1, 2, 3, 4, 5, 6]);
    assert.equal(gameSoloTerbuka(games), false);
  });

  test("permainan tanpa nomor dars tidak menambah hitungan", () => {
    const games: LatihanRingkasan[] = [
      ...tujuhDarsTuntas.slice(0, 6),
      tuntas("Campuran Dars 1-5 - Latihan Siswa"),
    ];
    assert.equal(hitungDarsTuntas(games), 6);
    assert.equal(gameSoloTerbuka(games), false);
  });

  test("latihan yang baru sebagian terjawab tidak menambah hitungan", () => {
    const games: LatihanRingkasan[] = [
      ...tujuhDarsTuntas.slice(0, 6),
      latihan("Dars 7 Rumah - Latihan Siswa", 29),
    ];
    assert.equal(hitungDarsTuntas(games), 6);
    assert.equal(gameSoloTerbuka(games), false);
  });

  test("belum menjawab sama sekali berarti terkunci", () => {
    const games: LatihanRingkasan[] = [
      latihan("Dars 1 Salam dan Perkenalan - Latihan Siswa", 0),
      latihan("Dars 2 Keluarga - Latihan Siswa", 0),
    ];
    assert.equal(hitungDarsTuntas(games), 0);
    assert.equal(gameSoloTerbuka(games), false);
  });

  test("daftar kosong berarti terkunci (gagal aman)", () => {
    assert.equal(hitungDarsTuntas([]), 0);
    assert.equal(gameSoloTerbuka([]), false);
  });
});

describe("kunci Game Solo: penegakan terpasang di rute siswa", () => {
  const slugs = [
    "space-war",
    "jejak-angka",
    "ludo-angka",
    "ketapel-buah",
    "ketapel-burung",
  ];

  for (const slug of slugs) {
    test(`/student/play/${slug} memeriksa kunci di server`, () => {
      const page = readFileSync(
        path.join(root, `src/app/student/play/${slug}/page.tsx`),
        "utf8",
      );
      assert.equal(page.includes("statusKunciGameSolo()"), true);
      assert.equal(page.includes("SoloLockNotice"), true);
    });
  }

  test("/student/practice menghitung kunci dari data latihan yang sama", () => {
    const page = readFileSync(
      path.join(root, "src/app/student/practice/page.tsx"),
      "utf8",
    );
    assert.equal(page.includes("gameSoloTerbuka(games)"), true);
    assert.equal(page.includes("hitungDarsTuntas(games)"), true);
  });
});
