const { chromium } = require("@playwright/test");
const BASE = process.argv[2] || "http://localhost:3000";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  await page.goto(`${BASE}/game/adu-tarik-dino/play`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: /MULAI BERMAIN/i }).click();
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: /SQUAD/ }).first().click();
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: /Bahasa Arab/ }).first().click();
  await page.waitForTimeout(5000);
  const info = await page.$$eval("[data-panel]", (els) =>
    els.map((el) => ({
      char: el.getAttribute("data-char"),
      cls: el.className,
      bgImage: getComputedStyle(el).backgroundImage.slice(0, 90),
      bgColor: getComputedStyle(el).backgroundColor,
    })),
  );
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})().catch((e) => {
  console.error("ERR:", e.message);
  process.exit(2);
});
