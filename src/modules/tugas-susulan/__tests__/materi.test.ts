import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cocokMateri, darsDariJudulMateri } from "../materi";

describe("darsDariJudulMateri: judul materi nyata kelas Mangkoso", () => {
  it("'Pertemuan Pertama dan Kedua' adalah Dars 1", () => {
    assert.equal(darsDariJudulMateri("Pertemuan Pertama dan Kedua"), 1);
  });

  it("'Pertemuan 3 dan 4' adalah Dars 2", () => {
    assert.equal(darsDariJudulMateri("Pertemuan 3 dan 4"), 2);
  });

  it("'Dars 3' s.d. 'Dars 9' memetakan ke darsnya masing-masing", () => {
    for (let d = 3; d <= 9; d++) {
      assert.equal(darsDariJudulMateri(`Dars ${d}`), d);
    }
  });

  it("pola lama 'Pertemuan 1-2' tetap Dars 1", () => {
    assert.equal(darsDariJudulMateri("Pertemuan 1-2"), 1);
  });

  it("judul tanpa pola yang dikenal menghasilkan null", () => {
    assert.equal(darsDariJudulMateri("Pengumuman Libur Semester"), null);
  });

  it("pasangan pertemuan yang bukan pasangan dars menghasilkan null", () => {
    assert.equal(darsDariJudulMateri("Pertemuan 2 dan 3"), null);
  });
});

describe("cocokMateri", () => {
  it("cocok hanya untuk dars yang benar", () => {
    assert.equal(cocokMateri("Pertemuan Pertama dan Kedua", 1), true);
    assert.equal(cocokMateri("Pertemuan Pertama dan Kedua", 2), false);
    assert.equal(cocokMateri("Pertemuan 3 dan 4", 2), true);
    assert.equal(cocokMateri("Pertemuan 3 dan 4", 1), false);
    assert.equal(cocokMateri("Dars 7", 7), true);
    assert.equal(cocokMateri("Dars 7", 6), false);
  });
});
