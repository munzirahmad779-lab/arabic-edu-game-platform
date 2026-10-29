/** Bandingkan tampilan di beberapa ukuran layar + cek cache CSS/JS di 3000 vs 3200. */
const { chromium } = require("@playwright/test");

const SIZES = [
  { w: 1920, h: 1080 },
  { w: 1536, h: 864 },
  { w: 1440, h: 900 },
  { w: 1366, h: 768 },
  { w: 1280, h: 800 },
];

(async () => {
  const browser = await chromium.launch();

  // 1. cek aset CSS sama atau tidak antara dev & prod
  for (const base of ["http://localhost:3000", "http://localhost:3200"]) {
    const page = await browser.newPage({ viewport: { width: 1366, height: 820 } });
    const cssUrls = [];
    page.on("response", (r) => {
      if (r.url().includes(".css")) cssUrls.push(r.url().split("/").pop());
    });
    await page.goto(`${base}/game/adu-tarik-dino/play`, { waitUntil: "domcontentloaded", timeout: 180000 });
    await page.waitForTimeout(2500);
    console.log(`${base} css=${cssUrls.slice(0, 3).join(",") || "(inline)"}`);
    await page.close();
  }

  // 2. tangkap di berbagai ukuran + catat mode layout yang aktif
  for (const s of SIZES) {
    const page = await browser.newPage({ viewport: { width: s.w, height: s.h } });
    await page.goto("http://localhost:3000/game/adu-tarik-dino/play", { waitUntil: "domcontentloaded", timeout: 180000 });
    await page.waitForTimeout(700);
    await page.getByRole("button", { name: /MULAI BERMAIN/i }).click();
    await page.waitForTimeout(220);
    await page.getByRole("button", { name: /SQUAD/ }).first().click();
    await page.waitForTimeout(220);
    await page.getByRole("button", { name: /Bahasa Arab/ }).first().click();
    await page.waitForTimeout(5200);
    const lay = await page.locator("[data-slots]").getAttribute("data-layout");
    const box = await page.locator("canvas").boundingBox();
    const host = await page.locator("[data-slots]").boundingBox();
    const btns = await page.locator("[data-panel]").first().locator("button").nth(0).boundingBox();
    console.log(
      `${s.w}x${s.h} → layout=${lay} canvas=${Math.round(box.width)}x${Math.round(box.height)} panel=${Math.round(host.width)}x${Math.round(host.height)} tombol=${Math.round(btns?.height ?? 0)}px`,
    );
    await page.screenshot({ path: `docs/papaninteraktif-audit/cek-${s.w}x${s.h}.png` });
    await page.close();
  }

  await browser.close();
})().catch((e) => {
  console.error("ERR:", e.message);
  process.exit(2);
});
