/** DUEL & SQUAD: semua panel + 4 opsi harus terlihat di berbagai ukuran layar. */
const { chromium } = require("@playwright/test");
const BASE = process.argv[2] || "http://127.0.0.1:3200";

const VIEWPORTS = [
  { w: 1366, h: 820, label: "desktop" },
  { w: 1280, h: 720, label: "laptop" },
  { w: 1024, h: 768, label: "tablet-L" },
  { w: 820, h: 1180, label: "tablet-P" },
  { w: 390, h: 844, label: "hp" },
];

(async () => {
  const browser = await chromium.launch();
  let all = true;
  for (const v of VIEWPORTS) {
    for (const mode of ["DUEL", "SQUAD"]) {
      const page = await browser.newPage({ viewport: { width: v.w, height: v.h } });
      await page.goto(`${BASE}/game/adu-tarik-dino/play`, { waitUntil: "domcontentloaded", timeout: 120000 });
      await page.waitForTimeout(500);
      await page.getByRole("button", { name: /MULAI BERMAIN/i }).click();
      await page.waitForTimeout(180);
      await page.getByRole("button", { name: new RegExp(mode) }).first().click();
      await page.waitForTimeout(180);
      await page.getByRole("button", { name: /Bahasa Arab/ }).first().click();
      await page.waitForTimeout(4000);

      const vh = await page.evaluate(() => window.innerHeight);
      const panels = await page.locator("[data-panel]").count();
      let totalOpts = 0;
      let visibleOpts = 0;
      let panelOk = 0;
      for (let i = 0; i < panels; i++) {
        const btns = page.locator(`[data-panel="${await page.locator("[data-panel]").nth(i).getAttribute("data-panel")}"] button`);
        const n = await btns.count();
        let vis = 0;
        for (let j = 0; j < n; j++) {
          const b = await btns.nth(j).boundingBox();
          if (b && (await btns.nth(j).isVisible()) && b.y >= 0 && b.y + b.height <= vh + 1) vis++;
        }
        totalOpts += n;
        visibleOpts += vis;
        if (n === 4 && vis === 4) panelOk++;
      }
      const canvasBox = await page.locator("canvas").boundingBox();
      const ok = panelOk === panels && panels === (mode === "SQUAD" ? 4 : 2);
      if (!ok) all = false;
      console.log(
        `${v.label} ${v.w}x${v.h} ${mode}: panel=${panels} panel_lengkap=${panelOk} opsi_terlihat=${visibleOpts}/${totalOpts} canvas=${Math.round(canvasBox.width)}x${Math.round(canvasBox.height)} → ${ok ? "OK" : "GAGAL"}`,
      );
      await page.close();
    }
  }
  await browser.close();
  console.log(`ALL=${all ? "PASS" : "FAIL"}`);
  process.exit(all ? 0 : 1);
})().catch((e) => {
  console.error("ERR:", e.message);
  process.exit(2);
});
