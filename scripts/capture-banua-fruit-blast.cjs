/**
 * capture-banua-fruit-blast.cjs
 *
 * Mengambil screenshot kondisi akhir ke docs/papaninteraktif-audit/:
 *  - landing page
 *  - home, mode, playing (per mode), result, bank, skor
 *  - 5 viewport untuk halaman bermain
 *
 * Pakai: node scripts/capture-banua-fruit-blast.cjs http://localhost:3000
 */
const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const BASE = process.argv[2] || "http://localhost:3000";
const OUT = path.join("docs", "papaninteraktif-audit");
const SLUG = "banua-fruit-blast";
const URL_PLAY = `${BASE}/game/${SLUG}/play`;
const URL_LANDING = `${BASE}/game/${SLUG}`;

const VIEWPORTS = [
  { name: "desktop", width: 1366, height: 820 },
  { name: "laptop", width: 1280, height: 720 },
  { name: "tablet-lanskap", width: 1024, height: 768 },
  { name: "tablet-potret", width: 820, height: 1180 },
  { name: "hp", width: 390, height: 844 },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();

  // landing (desktop)
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(URL_LANDING, { waitUntil: "networkidle" });
    await page.screenshot({
      path: path.join(OUT, `${SLUG}-landing.png`),
      fullPage: true,
    });
    await ctx.close();
  }

  // layar internal (desktop)
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 820 } });
    const page = await ctx.newPage();
    await page.goto(URL_PLAY, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-mode="SOLO"]');
    await page.screenshot({ path: path.join(OUT, `${SLUG}-home.png`) });

    await page.click('[data-mode="SQUAD"]');
    await page.waitForSelector("[data-gass]");
    await page.screenshot({ path: path.join(OUT, `${SLUG}-mode.png`) });

    await page.click("[data-gass]");
    await page.waitForSelector('[data-arena="1"]', { timeout: 15000 });
    await page.waitForTimeout(2200);
    await page.screenshot({ path: path.join(OUT, `${SLUG}-squad-playing.png`) });

    // dialog keluar
    await page.click("[data-exit]");
    await page.waitForSelector("[data-exit-dialog]");
    await page.screenshot({ path: path.join(OUT, `${SLUG}-exit-dialog.png`) });
    await page.click("[data-exit-confirm]");
    await page.waitForSelector("[data-winner]");
    await page.screenshot({ path: path.join(OUT, `${SLUG}-result.png`) });

    // bank soal
    await page.goto(URL_PLAY, { waitUntil: "networkidle" });
    await page.click('button:has-text("Bank Soal")');
    await page.waitForSelector("[data-bank-form]");
    await page.screenshot({ path: path.join(OUT, `${SLUG}-bank.png`), fullPage: true });

    // skor
    await page.goto(URL_PLAY, { waitUntil: "networkidle" });
    await page.click('button:has-text("Skor")');
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, `${SLUG}-score.png`) });

    await ctx.close();
  }

  // matriks viewport arena
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    await page.goto(URL_PLAY, { waitUntil: "networkidle" });
    await page.click('[data-mode="DUEL"]');
    await page.waitForSelector("[data-gass]");
    await page.click("[data-gass]");
    await page.waitForSelector('[data-arena="1"]', { timeout: 15000 });
    await page.waitForTimeout(1800);
    await page.screenshot({
      path: path.join(OUT, `${SLUG}-${vp.name}-${vp.width}x${vp.height}.png`),
    });
    await ctx.close();
    console.log(`captured ${vp.name} ${vp.width}x${vp.height}`);
  }

  await browser.close();
  console.log(`\nScreenshot tersimpan di ${OUT}`);
})().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
