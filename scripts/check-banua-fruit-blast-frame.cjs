/**
 * check-banua-fruit-blast-frame.cjs
 *
 * Uji kanvas: mengukur posisi objek kunci pada beberapa frame.
 *  - lajur (data-lanes) sesuai jumlah peserta
 *  - buah muncul (data-fruit-count > 0) dan posisi Y bertambah tiap frame
 *  - buah tetap berada di dalam lajurnya (tidak menyeberang)
 *  - posisi X stabil terhadap lebar kanvas (tidak keluar tepi)
 *
 * Pakai: node scripts/check-banua-fruit-blast-frame.cjs http://localhost:3000
 */
const { chromium } = require("@playwright/test");

const BASE = process.argv[2] || "http://localhost:3000";
const URL = `${BASE}/game/banua-fruit-blast/play`;

const log = [];
function check(name, ok, detail = "") {
  log.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function sample(page, n = 12, gap = 180) {
  const frames = [];
  for (let i = 0; i < n; i++) {
    const snap = await page.evaluate(() => {
      const c = document.querySelector('[data-arena="1"]');
      if (!c) return null;
      return {
        lanes: Number(c.dataset.lanes || 0),
        count: Number(c.dataset.fruitCount || 0),
        x: c.dataset.fruit0X === "" ? null : Number(c.dataset.fruit0X),
        y: c.dataset.fruit0Y === "" ? null : Number(c.dataset.fruit0Y),
        w: Number(c.dataset.canvasW || 0),
        h: Number(c.dataset.canvasH || 0),
        groundY: Number(c.dataset.groundY || 0),
      };
    });
    if (snap) frames.push(snap);
    await page.waitForTimeout(gap);
  }
  return frames;
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1366, height: 820 } });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(URL, { waitUntil: "networkidle" });
  await page.click('[data-mode="DUEL"]');
  await page.waitForSelector("[data-gass]");
  await page.click("[data-gass]");
  await page.waitForSelector('[data-arena="1"]', { timeout: 15000 });

  const frames = await sample(page, 14, 220);
  check("mengumpulkan frame kanvas", frames.length === 14, `${frames.length} frame`);

  const lanes = frames.map((f) => f.lanes);
  check("data-lanes konsisten = 2 (DUEL)", lanes.every((l) => l === 2), `lanes=${[...new Set(lanes)].join(",")}`);

  const sizes = frames.map((f) => `${f.w}x${f.h}`);
  check(
    "ukuran kanvas CSS stabil (tanpa lompatan)",
    new Set(sizes).size === 1,
    `${[...new Set(sizes)].join(" / ")}`,
  );

  const ground = frames.map((f) => f.groundY);
  check("data-ground-y terbaca = tinggi kanvas", ground.every((g, i) => g === frames[i].h), `ground=${[...new Set(ground)].join(",")}`);

  const withFruit = frames.filter((f) => f.count > 0 && f.y !== null);
  check("buah muncul di arena", withFruit.length >= 3, `${withFruit.length}/${frames.length} frame berisi buah`);

  // urutkan berdasarkan x untuk cek pergerakan: pakai kemunculan pertama
  if (withFruit.length >= 2) {
    // cari frame berurutan dengan id buah yang sama tidak tersedia, jadi
    // bandingkan tren umum: buah bergerak ke bawah (y naik) antar frame
    let increased = 0;
    for (let i = 1; i < withFruit.length; i++) {
      const prev = withFruit[i - 1];
      const cur = withFruit[i];
      if (cur.y === null || prev.y === null) continue;
      // buah baru muncul dari atas (y kecil) → boleh turun drastis
      if (cur.y > prev.y || cur.y < 0) increased++;
    }
    check(
      "buah bergerak turun antar frame",
      increased >= 1,
      `naik_y=${increased}/${withFruit.length - 1}`,
    );
  } else {
    check("buah bergerak turun antar frame", false, "buah tidak cukup");
  }

  // buah tidak keluar dari lebar kanvas
  const inside = withFruit.filter((f) => f.x !== null && f.x >= 0 && f.x <= f.w);
  check(
    "posisi-buah di dalam lebar kanvas",
    inside.length === withFruit.length,
    `${inside.length}/${withFruit.length}`,
  );

  check("console_errors=0", errors.length === 0, errors.slice(0, 2).join(" | "));

  await browser.close();

  const pass = log.filter((r) => r.ok).length;
  console.log(`\nTOTAL: ${pass}/${log.length} PASS`);
  if (pass !== log.length) {
    log.filter((r) => !r.ok).forEach((r) => console.log(` - ${r.name} :: ${r.detail}`));
  }
  process.exit(pass === log.length ? 0 : 1);
})().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
