/** Cek soal + 4 opsi pada beberapa ukuran layar. */
const { chromium } = require("@playwright/test");

const BASE = process.argv[2] || "http://127.0.0.1:3200";
const VIEWPORTS = [
  { w: 1366, h: 820, label: "desktop" },
  { w: 1280, h: 720, label: "laptop-720" },
  { w: 1024, h: 768, label: "tablet-landscape" },
  { w: 820, h: 1180, label: "tablet-portrait" },
  { w: 390, h: 844, label: "hp" },
];

(async () => {
  const browser = await chromium.launch();
  let allOk = true;
  for (const v of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: v.w, height: v.h } });
    await page.goto(`${BASE}/game/adu-tarik-dino/play`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(600);
    await page.getByRole("button", { name: /MULAI BERMAIN/i }).click();
    await page.waitForTimeout(200);
    await page.getByRole("button", { name: /DUEL/ }).first().click();
    await page.waitForTimeout(200);
    await page.getByRole("button", { name: /Bahasa Arab/ }).first().click();
    await page.waitForTimeout(3400);

    const vh = await page.evaluate(() => window.innerHeight);
    const audit = async (sel) => {
      const b = page.locator(sel);
      const n = await b.count();
      let vis = 0;
      for (let i = 0; i < n; i++) {
        const box = await b.nth(i).boundingBox();
        if (box && (await b.nth(i).isVisible()) && box.y >= 0 && box.y + box.height <= vh + 1) vis++;
      }
      return { n, vis };
    };
    const p1 = await audit("button.bg-cyan-600");
    const p2 = await audit("button.bg-orange-600");
    const ok = p1.n === 4 && p2.n === 4 && p1.vis === 4 && p2.vis === 4;
    if (!ok) allOk = false;
    console.log(`${v.label} ${v.w}x${v.h}: P1 ${p1.vis}/${p1.n} · P2 ${p2.vis}/${p2.n} → ${ok ? "OK" : "GAGAL"}`);
    if (v.label === "hp") await page.screenshot({ path: "docs/papaninteraktif-audit/game-adu-tarik-hp.png" });
    if (v.label === "desktop") await page.screenshot({ path: "docs/papaninteraktif-audit/game-adu-tarik-soal.png" });
    await page.close();
  }
  await browser.close();
  console.log(`ALL=${allOk ? "PASS" : "FAIL"}`);
  process.exit(allOk ? 0 : 1);
})().catch((e) => {
  console.error("ERR:", e.message);
  process.exit(2);
});
