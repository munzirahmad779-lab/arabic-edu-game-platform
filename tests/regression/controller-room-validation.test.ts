/**
 * Regresi: halaman /controller tidak memvalidasi kode room dan
 * indikator koneksinya berbohong (audit armada 6 Nov 2026, klon K35).
 * Room hantu tampil sebagai layar tunggu selamanya, dan indikator
 * "TERHUBUNG KE PROYEKTOR" menyala sejak awal karena isConnected
 * bernilai awal true.
 *
 * Perbaikan yang ditegaskan tes statis ini:
 * - GET /api/projector/controller menyertakan roomActive dari
 *   isProjectorRoomActiveShared (sinyal yang sama dengan /join);
 * - halaman controller memvalidasi kode room sebelum dan sesudah
 *   tim dipilih, menampilkan pesan jujur "Tidak Ditemukan", dan
 *   menyembunyikan tombol jawaban selama room tidak ditemukan;
 * - isConnected mulai dari false dan hanya menyala sesudah ada
 *   kontak nyata (subscribe realtime, poll sukses, atau sync),
 *   dan padam sesudah kegagalan beruntun / galat saluran.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const controllerSource = readFileSync(
  path.join(process.cwd(), "src/app/controller/page.tsx"),
  "utf8",
);
const routeSource = readFileSync(
  path.join(process.cwd(), "src/app/api/projector/controller/route.ts"),
  "utf8",
);

describe("Kontroler memvalidasi room dan indikator koneksi jujur (K35)", () => {
  test("route GET menyertakan roomActive dari store bersama", () => {
    assert.match(routeSource, /isProjectorRoomActiveShared/);
    assert.match(routeSource, /roomActive,/);
  });

  test("isConnected bernilai awal false, bukan true", () => {
    assert.match(controllerSource, /useState\(false\);\n\s*\/\/ Keberadaan room/);
    assert.doesNotMatch(controllerSource, /\[isConnected, setIsConnected\] = useState\(true\)/);
  });

  test("halaman memeriksa keberadaan room sebelum tim dipilih", () => {
    assert.match(controllerSource, /VALIDASI KODE ROOM/);
    assert.match(controllerSource, /data\.roomActive/);
    assert.match(controllerSource, /Ruangan dengan kode ini belum ditemukan/);
  });

  test("room tidak ditemukan tampil sebagai panel jujur dan tombol disembunyikan", () => {
    assert.match(controllerSource, /Tidak Ditemukan/);
    assert.match(controllerSource, /roomStatus === "not_found" \? null : \(/);
  });

  test("kegagalan poll beruntun mematikan indikator koneksi", () => {
    assert.match(controllerSource, /pollFailuresRef\.current >= 3/);
    assert.match(controllerSource, /status === "CHANNEL_ERROR"/);
  });

  test("label belum terhubung tidak mengklaim terhubung", () => {
    assert.match(controllerSource, /BELUM TERHUBUNG KE PROYEKTOR/);
    assert.doesNotMatch(controllerSource, /KONEKSI TERPUTUS/);
  });
});
