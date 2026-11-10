// Regresi zona waktu tampilan (perbaikan 10 Nov 2026 malam):
// dasbor sebelumnya memformat semua jam dengan offset UTC+7 (WIB)
// sehingga jam sesi di laporan tampil satu jam lebih awal dari
// waktu setempat pengguna (Makassar, WITA UTC+8). Modul kini
// format-wita dengan offset +8; uji ini mengunci perilaku itu dan
// memastikan tidak ada lagi rujukan ke modul lama.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

test("toWitaTime menggeser UTC ke UTC+8", async () => {
  const mod = await import("../../src/lib/format-wita");
  // 14:13 UTC = 22:13 WITA (bukan 21:13 WIB seperti perilaku lama).
  assert.equal(mod.toWitaTime("2026-11-10T14:13:00.000Z"), "22:13");
  assert.equal(mod.toWitaTime(null), "—");
});

test("toWitaDateTime dan toWitaDate memakai tanggal WITA", async () => {
  const mod = await import("../../src/lib/format-wita");
  // 23:30 UTC = 07:30 WITA keesokan hari.
  assert.equal(mod.toWitaDate("2026-11-10T23:30:00.000Z"), "2026-11-11");
  assert.equal(
    mod.toWitaDateTime("2026-11-10T14:13:00.000Z"),
    "2026-11-10 22:13",
  );
});

test("modul lama format-wib sudah tidak ada dan tidak dirujuk", () => {
  assert.equal(existsSync(join(root, "src/lib/format-wib.ts")), false);
  const importers = [
    "src/app/dashboard/reports/report-view.tsx",
    "src/app/dashboard/reports/page.tsx",
    "src/app/dashboard/admin/student-sessions.tsx",
    "src/app/dashboard/games/[gameId]/room/session-history.tsx",
    "src/app/dashboard/students/class-history-tab.tsx",
  ];
  for (const rel of importers) {
    const src = readFileSync(join(root, rel), "utf8");
    assert.ok(src.includes("format-wita"), `${rel} harus memakai format-wita`);
    assert.ok(!src.includes("format-wib"), `${rel} tidak boleh merujuk format-wib`);
    assert.ok(!/Wib/.test(src), `${rel} tidak boleh memakai nama Wib`);
  }
});
