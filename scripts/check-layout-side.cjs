/** Uji layout "panel di samping": arena & panel dua-duanya besar. */
const { chromium } = require("@playwright/test");
const BASE = process.argv[2] || "http://localhost:3000";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const rows = [];
  const push = (t) => rows.push(t);

  const open = async (mode) => {
    await page.goto(`${BASE}/game/adu-tarik-dino/play`, { waitUntil: "domcontentloaded", timeout: 180000 });
    await page.waitForTimeout(700);
    await page.getByRole("button", { name: /MULAI BERMAIN/i }).click();
    await page.waitForTimeout(250);
    await page.getByRole("button", { name: new RegExp(mode) }).first().click();
    await page.waitForTimeout(250);
    await page.getByRole("button", { name: /Bahasa Arab/ }).first().click();
    await page.waitForTimeout(5200);
  };

  await open("SQUAD");

  const canvas = await page.locator("canvas").boundingBox();
  const panelHost = page.locator("[data-slots]");
  const host = await panelHost.boundingBox();
  const layoutAttr = await panelHost.getAttribute("data-layout");
  const panels = await page.locator("[data-panel]").count();

  let minBtn = 9999;
  let allVisible = true;
  for (let i = 0; i < panels; i++) {
    const btns = page.locator("[data-panel]").nth(i).locator("button");
    const n = await btns.count();
    if (n !== 4) allVisible = false;
    for (let j = 0; j < n; j++) {
      const b = await btns.nth(j).boundingBox();
      if (!b) {
        allVisible = false;
        continue;
      }
      minBtn = Math.min(minBtn, Math.round(b.height));
    }
  }
  const qFont = await page.locator("[data-panel] span[dir]").first().evaluate((el) => getComputedStyle(el).fontSize);
  const chipFont = await page.locator("[data-panel] span").first().evaluate((el) => getComputedStyle(el).fontSize);

  const rope = await page.locator("canvas").getAttribute("data-rope");
  const [x0, x1] = rope.split(",").map(Number);
  const mid = (x0 + x1) / 2;

  push(`layout=${layoutAttr} panel_host=${Math.round(host.width)}x${Math.round(host.height)}`);
  push(`canvas=${Math.round(canvas.width)}x${Math.round(canvas.height)} (sebelumnya 1366x574 saat panel di bawah)`);
  push(`panel=${panels} · 4 opsi terlihat=${allVisible} · tinggi tombol minimum=${minBtn}px (sebelumnya 44px)`);
  push(`font soal=${qFont} · font label=${chipFont}`);
  push(`tali tengah=${mid.toFixed(1)} vs canvas/2=${(canvas.width / 2).toFixed(1)} selisih=${(mid - canvas.width / 2).toFixed(1)}px`);

  await page.screenshot({ path: "docs/papaninteraktif-audit/adu-tarik-layout-samping-squad.png" });

  // DUEL
  await open("DUEL");
  const c2 = await page.locator("canvas").boundingBox();
  push(`DUEL canvas=${Math.round(c2.width)}x${Math.round(c2.height)}`);
  await page.screenshot({ path: "docs/papaninteraktif-audit/adu-tarik-layout-samping-duel.png" });

  // tukar ke bawah
  const toggle = page.getByRole("button", { name: /BAWAH/ }).first();
  if (await toggle.isVisible().catch(() => false)) {
    await toggle.click();
    await page.waitForTimeout(900);
    const c3 = await page.locator("canvas").boundingBox();
    const lay2 = await page.locator("[data-slots]").getAttribute("data-layout");
    push(`setelah tukar: layout=${lay2} canvas=${Math.round(c3.width)}x${Math.round(c3.height)}`);
    await page.screenshot({ path: "docs/papaninteraktif-audit/adu-tarik-layout-bawah.png" });
  } else {
    push("tombol tukar layout tidak terlihat (layar < 1024px)");
  }

  console.log(rows.join("\n"));
  await browser.close();
})().catch((e) => {
  console.error("ERR:", e.message);
  process.exit(2);
});
