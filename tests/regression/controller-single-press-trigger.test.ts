/**
 * Regression: satu ketukan fisik pada tombol jawaban stik harus tepat
 * satu eksekusi press (pengerasan dari investigasi anomali soal 19
 * putaran 3, 30 Okt 2026, perubahan 4 pada laporan itu).
 *
 * Akar masalah: tombol jawaban memasang onPointerDown DAN onClick yang
 * sama sama memanggil handlePressButton. Penjaga satu satunya adalah
 * debounce ref 250 ms, sedangkan pemeriksaan hasLocallyAnswered membaca
 * state React dari closure render yang belum ter-commit di antara
 * pointerdown dan click pada ketukan yang sama. Bila click tiba lebih
 * dari 250 ms sesudah pointerdown (utas utama sibuk), satu ketukan
 * menghasilkan dua eksekusi press penuh: salinan POST kedua ditolak
 * server sebagai ALREADY_ANSWERED dan salinan broadcast ganda menambah
 * salinan yang beredar di proyektor.
 *
 * Perbaikan: hanya onClick yang dipertahankan sebagai pemicu.
 * handlePressButton dan seluruh perilaku hilirnya tidak berubah.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const controllerSource = readFileSync(
  path.join(process.cwd(), "src/app/controller/page.tsx"),
  "utf8",
);

describe("Tombol jawaban stik: satu ketukan satu press", () => {
  test("Tidak ada penangan onPointerDown yang terpasang pada tombol", () => {
    assert.doesNotMatch(controllerSource, /onPointerDown=\{/);
  });

  test("onClick tetap menjadi pemicu press tombol jawaban", () => {
    assert.match(
      controllerSource,
      /onClick=\{\(\) => void handlePressButton\(btn\.key\)\}/,
    );
  });

  test("Debounce 250 ms di handlePressButton tetap ada sebagai sisa perlindungan", () => {
    assert.match(
      controllerSource,
      /if \(now - lastTapTimeRef\.current < 250\) return;/,
    );
  });
});
