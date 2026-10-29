/**
 * Regression: penghitung lobi proyektor "0HP" dan room kedaluwarsa saat
 * jeda (temuan uji live sesudah deploy 0078, 30 Okt 2026, B.1 dan B.4).
 *
 * Akar masalah: field heartbeats di store bersama hanya ditulis saat
 * press. RPC touch_projector_controller dan cabang POST action
 * "heartbeat" di route sudah ada, tetapi tidak ada halaman yang pernah
 * mengirim aksi itu: heartbeat stik hanya broadcast (tidak menulis basis
 * data) dan siklus HTTP stik adalah GET murni. Akibatnya penghitung
 * "STIK TERHUBUNG" membaca 0 HP di lobi, dan baris room bisa kedaluwarsa
 * (60 detik) selama proyektor dijeda.
 *
 * Perbaikan: halaman kontroler mengirim POST action "heartbeat" sekali
 * saat terhubung lalu tiap 10 detik selama tim dipilih. Tes statis ini
 * menegaskan kontrak kedua ujungnya tetap ada: pengirim di halaman stik
 * dan penerima di route.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const controllerSource = readFileSync(
  path.join(root, "src/app/controller/page.tsx"),
  "utf8",
);
const routeSource = readFileSync(
  path.join(root, "src/app/api/projector/controller/route.ts"),
  "utf8",
);

describe("Heartbeat HTTP stik ke store bersama", () => {
  test("Halaman kontroler mengirim POST action heartbeat ke route kontroler", () => {
    assert.match(controllerSource, /action: "heartbeat"/);
    assert.match(
      controllerSource,
      /fetch\("\/api\/projector\/controller", \{\s*\n\s*method: "POST"/,
    );
  });

  test("Interval heartbeat HTTP adalah 10 detik dan dibersihkan saat berhenti", () => {
    assert.match(controllerSource, /setInterval\(sendHeartbeat, 10000\)/);
    assert.match(controllerSource, /clearInterval\(hbHttpInterval\)/);
  });

  test("Route meneruskan aksi heartbeat ke touchProjectorController", () => {
    assert.match(routeSource, /touchProjectorController\(roomCode, teamId\)/);
    assert.match(routeSource, /action: "heartbeat", timestamp/);
  });
});
