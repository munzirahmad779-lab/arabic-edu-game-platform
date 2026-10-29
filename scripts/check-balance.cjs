/** Ukur kesejajaran tali dari data canvas (bukan dari warna piksel). */
const { chromium } = require("@playwright/test");
const BASE = process.argv[2] || "http://127.0.0.1:3200";

const rope = async (page) => {
  const v = await page.locator("canvas").getAttribute("data-rope");
  if (!v) return null;
  const [x0, x1, y0, y1] = v.split(",").map(Number);
  return { x0, x1, y0, y1, mid: (x0 + x1) / 2, gap: x1 - x0 };
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 820 } });
  const go = async (modeLabel, subjectLabel) => {
    await page.goto(`${BASE}/game/adu-tarik-dino/play`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(600);
    await page.getByRole("button", { name: /MULAI BERMAIN/i }).click();
    await page.waitForTimeout(200);
    await page.getByRole("button", { name: new RegExp(modeLabel) }).first().click();
    await page.waitForTimeout(200);
    await page.getByRole("button", { name: new RegExp(subjectLabel) }).first().click();
    await page.waitForTimeout(4200);
  };

  await go("DUEL", "Bahasa Arab");
  const w = Number(await page.locator("canvas").getAttribute("data-width"));
  const d1 = await rope(page);
  console.log(`DUEL  canvas_w=${w} ujung_kiri=${d1.x0} ujung_kanan=${d1.x1} tengah=${d1.mid.toFixed(1)} (ideal ${w / 2}) selisih=${(d1.mid - w / 2).toFixed(1)}px`);

  await go("SQUAD", "Biologi");
  const s1 = await rope(page);
  console.log(`SQUAD tengah=${s1.mid.toFixed(1)} (ideal ${w / 2}) selisih=${(s1.mid - w / 2).toFixed(1)}px`);

  // menang cepat: klik 4 jawaban benar pada panel kiri
  await page.goto(`${BASE}/game/adu-tarik-dino/play`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /MULAI BERMAIN/i }).click();
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: /DUEL/ }).first().click();
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: /Bahasa Arab/ }).first().click();
  await page.waitForTimeout(4200);
  const before = await rope(page);
  for (let i = 0; i < 6; i++) {
    const done = await page.getByRole("button", { name: /TANDING LAGI/i }).isVisible().catch(() => false);
    if (done) break;
    await page.locator("[data-panel]").first().locator("[data-correct='1']").first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(600);
  }
  await page.waitForTimeout(1600);
  const after = await rope(page);
  const res = await page.locator("canvas").getAttribute("data-result");
  console.log(
    `SETELAH MENANG result=${res} ujung_kiri=${after.x0} ujung_kanan=${after.x1} tengah=${after.mid.toFixed(1)} | geser_tengah=${(after.mid - before.mid).toFixed(1)}px (${(((after.mid - before.mid) / w) * 100).toFixed(1)}% lebar)`,
  );

  await browser.close();
})().catch((e) => {
  console.error("ERR:", e.message);
  process.exit(2);
});
