/** Ukur 3 mode tata letak pada 2 ukuran layar. */
const { chromium } = require("@playwright/test");
const BASE = process.argv[2] || "http://localhost:3000";

(async () => {
  const browser = await chromium.launch();
  const out = [];
  for (const vp of [
    { w: 1600, h: 900, tag: "1600x900" },
    { w: 1366, h: 820, tag: "1366x820" },
  ]) {
    const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
    await page.goto(`${BASE}/game/adu-tarik-dino/play`, { waitUntil: "domcontentloaded", timeout: 180000 });
    await page.waitForTimeout(700);
    await page.getByRole("button", { name: /MULAI BERMAIN/i }).click();
    await page.waitForTimeout(220);
    await page.getByRole("button", { name: /SQUAD/ }).first().click();
    await page.waitForTimeout(220);
    await page.getByRole("button", { name: /Bahasa Arab/ }).first().click();
    await page.waitForTimeout(5200);

    const measure = async (label) => {
      const box = await page.locator("canvas").boundingBox();
      const cell = Number(await page.locator("canvas").getAttribute("data-cell"));
      const rope = await page.locator("canvas").getAttribute("data-rope");
      const [x0, x1] = rope.split(",").map(Number);
      const host = await page.locator("[data-slots]").boundingBox();
      const panels = await page.locator("[data-panel]").count();
      let opts = 0;
      let vis = 0;
      for (let i = 0; i < panels; i++) {
        const b = page.locator("[data-panel]").nth(i).locator("button");
        const n = await b.count();
        opts += n;
        for (let j = 0; j < n; j++) {
          const bb = await b.nth(j).boundingBox();
          if (bb && bb.height >= 40) vis++;
        }
      }
      const btnH = await page.locator("[data-panel] button").first().evaluate((el) => Math.round(el.getBoundingClientRect().height));
      out.push(
        `${vp.tag} ${String(label).padEnd(9)} canvas=${Math.round(box.width)}x${Math.round(box.height)} sel=${cell}px ` +
          `panel=${Math.round(host.width)}px opsi=${vis}/${opts} tombol=${btnH}px tali=${Math.round(x1 - x0)}px ` +
          `tengah_selisih=${((x0 + x1) / 2 - box.width / 2).toFixed(1)}px`,
      );
      await page.screenshot({ path: `docs/papaninteraktif-audit/adu-tarik-mode-${label}-${vp.tag}.png` });
    };

    const toggle = page.locator('button[title^="Ganti tata letak"]');
    for (let i = 0; i < 3; i++) {
      const lay = await page.locator("[data-slots]").getAttribute("data-layout");
      await measure(lay ?? "mode" + i);
      await toggle.first().click();
      await page.waitForTimeout(900);
    }
    await page.close();
  }
  console.log(out.join("\n"));
  await browser.close();
})().catch((e) => {
  console.error("ERR:", e.message);
  process.exit(2);
});
