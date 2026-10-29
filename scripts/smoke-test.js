/**
 * Real HTTP smoke test for all 32 game routes.
 *
 * Starts the production server (next start) on a free port, requests
 * /games/<slug> for every canonical slug, and asserts HTTP 200.
 * Also asserts an unknown slug returns 404.
 *
 * Usage: node scripts/smoke-test.js   (run `npx next build` first)
 */
const { spawn, execSync } = require("child_process");
const path = require("path");

const SLUGS = [
  "porogapit-arena", "math-domino-arena", "jejak-angka", "helirescue", "sciencelink",
  "banua-fruit-blast", "si-pemanah", "rimba-pedia", "celestial-weaver", "tanzib",
  "puzzle", "martabak-pecahan", "doodle", "si-taktik", "traditional", "space-war",
  "ai-basketball", "mancing-kata", "kancil", "nusaboard", "jagoan-kata", "geo-squad",
  "ruang-io", "gabung-ceria", "color-link-junior", "adu-tarik-dino", "tatap-hap",
  "cocok-logi", "mesin-koleksi", "pendekar-balon", "detektif-cilik", "mewarnai",
];

const PORT = Number(process.env.SMOKE_PORT || 3199);
const BASE = `http://127.0.0.1:${PORT}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer(timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/health`, { redirect: "manual" });
      if (res.status > 0) return true;
    } catch {
      /* not up yet */
    }
    await sleep(400);
  }
  return false;
}

function killTree(proc) {
  if (!proc || proc.killed) return;
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /pid ${proc.pid} /T /F`, { stdio: "ignore" });
    } else {
      process.kill(-proc.pid, "SIGKILL");
    }
  } catch {
    try {
      proc.kill("SIGKILL");
    } catch {
      /* ignore */
    }
  }
}

(async () => {
  const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
  if (!require("fs").existsSync(nextBin)) {
    console.error("next binary not found; run npm install");
    process.exit(1);
  }

  console.log(`Starting next start on port ${PORT} ...`);
  const server = spawn(process.execPath, [nextBin, "start", "-p", String(PORT)], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: "production" },
    stdio: "ignore",
  });
  server.on("error", (e) => {
    console.error("spawn error:", e.message);
  });

  try {
    const up = await waitForServer();
    if (!up) {
      console.error("Server did not become ready in time.");
      process.exit(1);
    }

    let ok = 0;
    const bad = [];
    for (const slug of SLUGS) {
      const url = `${BASE}/games/${slug}`;
      try {
        const res = await fetch(url, { redirect: "manual" });
        if (res.status === 200) {
          ok += 1;
          console.log(`  ${String(ok).padStart(2, "0")}. 200  ${slug}`);
        } else {
          bad.push({ slug, status: res.status });
          console.log(`  FAIL ${res.status}  ${slug}`);
        }
      } catch (e) {
        bad.push({ slug, status: e.message });
        console.log(`  ERR  ${slug}: ${e.message}`);
      }
    }

    let unknownOk = false;
    try {
      const res = await fetch(`${BASE}/games/__not_a_real_game__`, { redirect: "manual" });
      unknownOk = res.status === 404;
      console.log(`\nUnknown slug -> ${res.status} (expected 404)`);
    } catch (e) {
      console.log(`\nUnknown slug request failed: ${e.message}`);
    }

    console.log(`\nResult: ${ok}/32 routes returned 200`);
    if (ok !== 32 || bad.length > 0 || !unknownOk) {
      if (bad.length) console.log("Failures:", JSON.stringify(bad, null, 2));
      console.log("SMOKE TEST FAILED");
      process.exit(1);
    }
    console.log("32/32 PASS — all game routes return 200.");
  } finally {
    killTree(server);
  }
})();
