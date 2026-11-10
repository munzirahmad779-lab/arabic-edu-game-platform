// Regresi nama anggota pada kartu podium proyektor (perbaikan
// 10 Nov 2026 malam): podium sebelumnya menampilkan anggota dari
// penunjuk giliran yang SUDAH maju sesudah jawaban dicatat, sehingga
// nama yang tampil adalah anggota berikutnya, bukan anggota yang
// gilirannya menjawab. Record jawaban kini menyimpan indeks anggota
// saat pencatatan dan podium menampilkannya.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const screen = readFileSync(
  join(
    root,
    "src/app/dashboard/games/[gameId]/projector/projector-screen.tsx",
  ),
  "utf8",
);

test("TeamAnswerRecord menyimpan memberIndex penangkap giliran", () => {
  assert.ok(/type TeamAnswerRecord = \{[^}]*memberIndex: number;/s.test(screen));
});

test("record dibentuk dengan indeks dari cermin ref tim sebelum penunjuk maju", () => {
  assert.ok(screen.includes("const teamsRef = useRef(teams);"));
  assert.ok(
    /memberIndex:\s*\n?\s*teamsRef\.current\.find\(\(t\) => t\.id === teamId\)\?\.currentMemberIndex/.test(
      screen,
    ),
  );
});

test("podium menampilkan anggota dari record untuk tim yang sudah menjawab", () => {
  assert.ok(screen.includes("const displayStudent = ansRecord"));
  assert.ok(/ansRecord\.memberIndex % \(team\.members\.length \|\| 1\)/.test(screen));
  assert.ok(screen.includes("👤 {displayStudent}"));
});
