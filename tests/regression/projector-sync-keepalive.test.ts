/**
 * Regression: stik jatuh ke layar tunggu saat proyektor dijeda lama
 * (temuan uji live sesudah deploy 0078, 30 Okt 2026, kendala B.1).
 *
 * Akar masalah: effect sync proyektor hanya menembak saat salah satu
 * dependensinya berubah. Selama timer berjalan, timerSeconds berubah
 * tiap detik sehingga sync mengalir dan expires_at baris room terus
 * diperbarui; saat guru menjeda, timerSeconds membeku, sync berhenti
 * total, dan sesudah 60 detik baris room kedaluwarsa. GET stik lalu
 * menerima state bawaan berfase "lobby" dan stik merender layar tunggu.
 *
 * Perbaikan: badan sync diekstrak menjadi callback sendProjectorSync
 * (dipanggil effect berbasis perubahan state seperti sebelumnya) plus
 * effect keepalive yang mengirim ulang sync yang sama tiap 15 detik
 * selama permainan berjalan dan belum selesai, memakai closure terbaru
 * lewat ref cermin sehingga nilai yang terkirim adalah nilai saat itu
 * juga. Tes statis ini menegaskan pemasangannya.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectorSource = readFileSync(
  path.join(
    process.cwd(),
    "src/app/dashboard/games/[gameId]/projector/projector-screen.tsx",
  ),
  "utf8",
);

describe("Keepalive sync proyektor menjaga room tidak kedaluwarsa", () => {
  test("Badan sync adalah callback bernama sendProjectorSync yang dipanggil effect perubahan state", () => {
    assert.match(projectorSource, /const sendProjectorSync = useCallback\(\(\) => \{/);
    assert.match(
      projectorSource,
      /useEffect\(\(\) => \{\s*\n\s*sendProjectorSync\(\);\s*\n\s*\}, \[sendProjectorSync\]\);/,
    );
  });

  test("Keepalive menembak tiap 15 detik lewat ref cermin ke closure terbaru", () => {
    assert.match(
      projectorSource,
      /const sendProjectorSyncRef = useRef\(sendProjectorSync\);/,
    );
    assert.match(
      projectorSource,
      /sendProjectorSyncRef\.current\(\);\s*\n\s*\}, 15000\);/,
    );
    assert.match(projectorSource, /clearInterval\(keepaliveInterval\)/);
  });

  test("Keepalive hanya berjalan selama permainan berjalan dan belum selesai", () => {
    assert.match(
      projectorSource,
      /if \(!gameStarted \|\| phase === "finished"\) return;\s*\n\s*const keepaliveInterval = window\.setInterval/,
    );
  });
});
