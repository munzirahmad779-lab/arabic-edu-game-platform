import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  AMBANG_SELESAI_OTOMATIS,
  AMBANG_TOMBOL_SELESAI,
  bacaDianggapSelesai,
  hitungPersenBaca,
  sudahSampaiBawah,
  tombolSelesaiAktif,
} from "../baca-progress";

// Ukuran acuan: dokumen 2000px, layar 700px, rentang gulir 1300px.
const DASAR = { scrollHeight: 2000, clientHeight: 700 };

describe("hitungPersenBaca", () => {
  it("0 persen di posisi paling atas", () => {
    assert.equal(hitungPersenBaca({ ...DASAR, scrollTop: 0 }), 0);
  });

  it("50 persen di tengah rentang gulir", () => {
    assert.equal(hitungPersenBaca({ ...DASAR, scrollTop: 650 }), 50);
  });

  it("100 persen tepat di dasar halaman", () => {
    assert.equal(hitungPersenBaca({ ...DASAR, scrollTop: 1300 }), 100);
  });

  it("penyebut memakai tinggi gulir dikurangi tinggi layar, bukan tinggi dokumen penuh", () => {
    // Bila penyebutnya scrollHeight penuh (2000), posisi 650 terbaca 33%.
    // Dengan penyebut yang benar (2000-700=1300) terbaca 50%.
    assert.equal(hitungPersenBaca({ ...DASAR, scrollTop: 650 }), 50);
  });

  it("halaman yang muat satu layar langsung 100 persen", () => {
    assert.equal(
      hitungPersenBaca({ scrollTop: 0, scrollHeight: 700, clientHeight: 700 }),
      100,
    );
    assert.equal(
      hitungPersenBaca({ scrollTop: 0, scrollHeight: 500, clientHeight: 700 }),
      100,
    );
  });

  it("nilai dijepit: gulir memantul negatif menjadi 0 dan kelebihan menjadi 100", () => {
    assert.equal(hitungPersenBaca({ ...DASAR, scrollTop: -40 }), 0);
    assert.equal(hitungPersenBaca({ ...DASAR, scrollTop: 9999 }), 100);
  });
});

describe("kasus mentok implementasi lama (ambang 98 persen rasio mentah)", () => {
  // Implementasi lama hanya menyelesaikan langkah pada rasio >= 0.98 dan
  // tidak menyediakan tombol manual, jadi posisi gulir yang berhenti
  // sedikit di bawah ujung (mis. 83% seperti laporan siswa, atau 96%)
  // membuat langkah tidak pernah tercatat selesai.
  it("posisi 96 persen kini dianggap selesai (di atas ambang otomatis 95)", () => {
    const u = { ...DASAR, scrollTop: 1248 }; // 1248/1300 = 96%
    assert.equal(hitungPersenBaca(u), 96);
    assert.equal(bacaDianggapSelesai(u), true);
  });

  it("posisi 83 persen belum selesai dan tombol belum aktif, siswa harus lanjut menggulir", () => {
    const u = { ...DASAR, scrollTop: 1079 }; // 1079/1300 = 83%
    assert.equal(hitungPersenBaca(u), 83);
    assert.equal(bacaDianggapSelesai(u), false);
    assert.equal(tombolSelesaiAktif(u), false);
  });

  it("ambang yang dipakai sesuai rancangan: otomatis 95, tombol 90", () => {
    assert.equal(AMBANG_SELESAI_OTOMATIS, 95);
    assert.equal(AMBANG_TOMBOL_SELESAI, 90);
  });
});

describe("tombolSelesaiAktif dan sudahSampaiBawah", () => {
  it("tombol aktif pada 90 persen walau belum di dasar", () => {
    const u = { ...DASAR, scrollTop: 1170 }; // 90%
    assert.equal(hitungPersenBaca(u), 90);
    assert.equal(sudahSampaiBawah(u), false);
    assert.equal(tombolSelesaiAktif(u), true);
    assert.equal(bacaDianggapSelesai(u), false);
  });

  it("dasar halaman terdeteksi dengan toleransi 2px", () => {
    assert.equal(sudahSampaiBawah({ ...DASAR, scrollTop: 1300 }), true);
    assert.equal(sudahSampaiBawah({ ...DASAR, scrollTop: 1298 }), true);
    assert.equal(sudahSampaiBawah({ ...DASAR, scrollTop: 1290 }), false);
  });

  it("di dasar halaman tombol selalu aktif dan baca dianggap selesai", () => {
    const u = { ...DASAR, scrollTop: 1300 };
    assert.equal(tombolSelesaiAktif(u), true);
    assert.equal(bacaDianggapSelesai(u), true);
  });
});
