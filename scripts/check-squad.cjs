/** Screenshot arena mode SQUAD (2 karakter per sisi). */
const { chromium } = require("@playwright/test");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 820 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 160)}`);
  });

  await page.goto("http://127.0.0.1:3200/game/adu-tarik-dino/play", { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: /MULAI BERMAIN/i }).click();
  await page.waitForTimeout(250);
  await page.getByRole("button", { name: /SQUAD/ }).first().click();
  await page.waitForTimeout(250);
  await page.getByRole("button", { name: /Biologi/ }).first().click();
  await page.waitForTimeout(3400);

  const canvas = page.locator("canvas").first();
  await canvas.waitFor({ state: "visible", timeout: 30000 });
  const box = await canvas.boundingBox();
  console.log(`squad_canvas=${box ? `${Math.round(box.width)}x${Math.round(box.height)}` : "none"}`);

  // jawab satu benar lalu ambil screenshot saat hentakan
  await page.getByRole("button", { name: /Ribosom/ }).first().click();
  await page.waitForTimeout(120);
  await page.screenshot({ path: "docs/papaninteraktif-audit/game-adu-tarik-squad.png" });
  console.log(`errors=${errors.length}`);
  errors.slice(0, 4).forEach((e) => console.log("  ", e));
  await browser.close();
  process.exit(errors.length === 0 ? 0 : 1);
})().catch((e) => {
  console.error("ERR:", e.message);
  process.exit(2);
});
