/**
 * Regresi: URL embed web game tidak divalidasi di titik mana pun
 * (audit armada 6 Nov 2026, klon K34). URL rusak atau http tersimpan
 * diam-diam, lalu tampil sebagai bingkai kosong di proyektor; jalur
 * pembuatan embed bahkan tidak tercapai dari formulir.
 *
 * Perbaikan yang ditegaskan tes ini:
 * - validateEmbedUrl (src/lib/game-engine/embed-url.ts) hanya menerima
 *   URL https yang sah dan menolak kurung siku/spasi (pelindung token
 *   [EMBED:<url>] pada nama permainan);
 * - createGame memakai validasi itu dan menolak dengan
 *   error=invalid_embed_url;
 * - pemain embed memakai validasi yang sama dan menangani gagal muat
 *   dengan panel jujur, bukan bingkai kosong;
 * - formulir (GameModeSelector) menyediakan kolom URL embed.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { validateEmbedUrl } from "../../src/lib/game-engine/embed-url";

describe("validateEmbedUrl hanya menerima URL https yang sah", () => {
  test("URL https penyedia umum diterima apa adanya", () => {
    const r = validateEmbedUrl("https://wordwall.net/embed/abc123");
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.url, "https://wordwall.net/embed/abc123");
  });

  test("URL dengan query string dipertahankan", () => {
    const r = validateEmbedUrl("https://quizizz.com/embed/quiz/1?source=share");
    assert.equal(r.ok, true);
    if (r.ok)
      assert.equal(r.url, "https://quizizz.com/embed/quiz/1?source=share");
  });

  test("http ditolak sebagai not_https", () => {
    const r = validateEmbedUrl("http://wordwall.net/embed/abc123");
    assert.deepEqual(r, { ok: false, reason: "not_https" });
  });

  test("skema berbahaya ditolak sebagai not_https", () => {
    assert.deepEqual(validateEmbedUrl("javascript:alert(1)"), {
      ok: false,
      reason: "not_https",
    });
    assert.deepEqual(validateEmbedUrl("data:text/html;base64,AAAA"), {
      ok: false,
      reason: "not_https",
    });
  });

  test("teks bukan URL ditolak sebagai malformed", () => {
    assert.deepEqual(validateEmbedUrl("wordwall"), {
      ok: false,
      reason: "malformed",
    });
    // Spasi membuat string ditolak lebih dulu sebagai unsafe_chars.
    assert.deepEqual(validateEmbedUrl("wordwall saja"), {
      ok: false,
      reason: "unsafe_chars",
    });
  });

  test("kosong ditolak sebagai empty", () => {
    assert.deepEqual(validateEmbedUrl(""), { ok: false, reason: "empty" });
    assert.deepEqual(validateEmbedUrl("   "), {
      ok: false,
      reason: "empty",
    });
    assert.deepEqual(validateEmbedUrl(null), { ok: false, reason: "empty" });
  });

  test("kurung siku dan spasi ditolak demi token EMBED", () => {
    assert.deepEqual(validateEmbedUrl("https://example.com/a]b"), {
      ok: false,
      reason: "unsafe_chars",
    });
    assert.deepEqual(validateEmbedUrl("https://example.com/a b"), {
      ok: false,
      reason: "unsafe_chars",
    });
  });

  test("host tanpa titik ditolak sebagai invalid_host", () => {
    assert.deepEqual(validateEmbedUrl("https://localhost/embed"), {
      ok: false,
      reason: "invalid_host",
    });
  });
});

const actionsSource = readFileSync(
  path.join(process.cwd(), "src/app/dashboard/games/actions.ts"),
  "utf8",
);
const playerSource = readFileSync(
  path.join(process.cwd(), "src/components/game-players/web-embed-player.tsx"),
  "utf8",
);
const selectorSource = readFileSync(
  path.join(process.cwd(), "src/app/dashboard/games/game-mode-selector.tsx"),
  "utf8",
);

describe("Validasi embed terpasang di aksi, pemain, dan formulir", () => {
  test("createGame memvalidasi URL embed dan menolak yang tidak sah", () => {
    assert.match(actionsSource, /validateEmbedUrl\(embedRaw\)/);
    assert.match(actionsSource, /error=invalid_embed_url/);
  });

  test("pemain memvalidasi URL sebelum merender iframe", () => {
    assert.match(playerSource, /validateEmbedUrl\(formattedUrl\)/);
  });

  test("pemain menangani gagal muat dan batas waktu, bukan bingkai kosong", () => {
    assert.match(playerSource, /onError=\{\(\) => setLoadState\("failed"\)\}/);
    assert.match(playerSource, /LOAD_TIMEOUT_MS/);
    assert.match(playerSource, /Web Game Gagal Dimuat/);
  });

  test("label fullscreen mengikuti fullscreenchange, bukan state lokal", () => {
    assert.match(playerSource, /addEventListener\("fullscreenchange"/);
    assert.match(playerSource, /document\.fullscreenElement/);
  });

  test("formulir menyediakan kolom URL embed untuk mode embed", () => {
    assert.match(selectorSource, /EMBED_ENGINE_ID = "web-embed"/);
    assert.match(selectorSource, /id="embed-url"/);
    assert.match(selectorSource, /embed:\$\{embedUrl\.trim\(\)\}/);
  });
});
