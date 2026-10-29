/** Verifikasi v5: timer center, 2 vs 4 panel, garis tengah, dan tim kalah terseret. */
const { chromium } = require("@playwright/test");

const BASE = process.argv[2] || "http://127.0.0.1:3200";
const OUT = "docs/papaninteraktif-audit";

const clickCorrect = async (page, side) => {
  // tombol benar ditandai data-correct oleh skrip ini: cari teks jawaban dari DOM panel
  const panel = page.locator("[data-panel]").nth(side === "p1" ? 0 : 1);
  const ok = panel.locator("[data-correct='1']").first();
  const n = await ok.count();
  if (!n) return false;
  await ok.click({ timeout: 5000 }).catch(() => {});
  return true;
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 820 } });

  const audit = async (sel) => {
    const b = page.locator(sel);
    const n = await b.count();
    let vis = 0;
    for (let i = 0; i < n; i++) {
      const box = await b.nth(i).boundingBox();
      if (box && (await b.nth(i).isVisible())) vis++;
    }
    return { n, vis };
  };

  // ---------- DUEL ----------
  await page.goto(`${BASE}/game/adu-tarik-dino/play`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /MULAI BERMAIN/i }).click();
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: /DUEL/ }).first().click();
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: /Bahasa Arab/ }).first().click();
  await page.waitForTimeout(4200);

  const slots = await page.locator("[data-slots]").first().getAttribute("data-slots");
  const p1ops = await audit("button.bg-gradient-to-br");
  const timerBox = await page.locator("[data-timer]").boundingBox();
  const vw = await page.evaluate(() => window.innerWidth);
  const timerCenter = timerBox ? Math.round(timerBox.x + timerBox.width / 2) : -1;
  const timerOff = Math.abs(timerCenter - Math.round(vw / 2));

  await page.screenshot({ path: `${OUT}/arena-v5-duel.png` });
  await page.locator("canvas").screenshot({ path: `${OUT}/arena-v5-duel-canvas.png` });
  console.log(`DUEL slots=${slots} tombol_opsi=${p1ops.n} timer_center_x=${timerCenter} viewport_center=${Math.round(vw / 2)} offset=${timerOff}px`);

  // ---------- menang: 4 jawaban benar di panel kiri ----------
  for (let i = 0; i < 5; i++) {
    const won = await page.getByRole("button", { name: /TANDING LAGI/i }).isVisible().catch(() => false);
    if (won) break;
    const ok = await clickCorrect(page, "p1");
    if (!ok) {
      // fallback: klik opsi pertama panel kiri
      const first = page.locator("[data-panel]").first().locator("button").first();
      await first.click({ timeout: 4000 }).catch(() => {});
    }
    await page.waitForTimeout(700);
  }
  const wonAfter = await page.getByRole("button", { name: /TANDING LAGI/i }).isVisible().catch(() => false);
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${OUT}/arena-v5-win.png` });
  await page.locator("canvas").screenshot({ path: `${OUT}/arena-v5-win-canvas.png` });
  console.log(`WIN overlay=${wonAfter}`);

  // ---------- SQUAD ----------
  await page.goto(`${BASE}/game/adu-tarik-dino/play`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /MULAI BERMAIN/i }).click();
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: /SQUAD/ }).first().click();
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: /Biologi/ }).first().click();
  await page.waitForTimeout(4200);
  const slots2 = await page.locator("[data-slots]").first().getAttribute("data-slots");
  const panels = await page.locator("[data-panel]").count();
  let perPanel = [];
  for (let i = 0; i < panels; i++) {
    const btns = await page.locator("[data-panel]").nth(i).locator("button").count();
    perPanel.push(btns);
  }
  await page.screenshot({ path: `${OUT}/arena-v5-squad.png` });
  await page.locator("canvas").screenshot({ path: `${OUT}/arena-v5-squad-canvas.png` });
  console.log(`SQUAD slots=${slots2} panel=${panels} opsi_per_panel=${JSON.stringify(perPanel)}`);

  await browser.close();
})().catch((e) => {
  console.error("ERR:", e.message);
  process.exit(2);
});
