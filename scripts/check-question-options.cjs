/** Pastikan soal + 4 opsi benar-benar terlihat di arena. */
const { chromium } = require("@playwright/test");

const BASE = process.argv[2] || "http://127.0.0.1:3200";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 820 } });
  await page.goto(`${BASE}/game/adu-tarik-dino/play`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: /MULAI BERMAIN/i }).click();
  await page.waitForTimeout(250);
  await page.getByRole("button", { name: /DUEL/ }).first().click();
  await page.waitForTimeout(250);
  await page.getByRole("button", { name: /Bahasa Arab/ }).first().click();
  await page.waitForTimeout(3500);

  const vh = await page.evaluate(() => window.innerHeight);
  const check = async (sel, label) => {
    const btns = page.locator(sel);
    const n = await btns.count();
    let visible = 0;
    const ys = [];
    for (let i = 0; i < n; i++) {
      const b = btns.nth(i);
      const box = await b.boundingBox();
      const shown = await b.isVisible();
      if (box && shown && box.y + box.height <= vh + 1) visible++;
      if (box) ys.push(Math.round(box.y));
    }
    console.log(`${label}: total=${n} terlihat_di_layar=${visible} y=${JSON.stringify(ys)}`);
    return { n, visible };
  };

  const p1 = await check("button.bg-cyan-600", "P1 (Tarsius)");
  const p2 = await check("button.bg-orange-600", "P2 (Maleo)");

  const qText = (await page.locator("span.text-center.font-bold").allInnerTexts()).map((t) => t.slice(0, 42));
  console.log(`soal=${JSON.stringify(qText)}`);

  await page.screenshot({ path: "docs/papaninteraktif-audit/game-adu-tarik-soal.png" });

  // uji mapel lain: matematika (teks panjang numerik)
  await page.getByRole("button", { name: /BERANDA/i }).first().click().catch(() => {});
  await page.waitForTimeout(400);

  const ok = p1.n === 4 && p2.n === 4 && p1.visible === 4 && p2.visible === 4 && qText.filter(Boolean).length >= 2;
  console.log(`RESULT=${ok ? "PASS" : "FAIL"}`);
  await browser.close();
  process.exit(ok ? 0 : 1);
})().catch((e) => {
  console.error("ERR:", e.message);
  process.exit(2);
});
