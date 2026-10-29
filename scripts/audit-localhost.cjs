/** Audit error konsol + request gagal pada halaman game. */
const { chromium } = require("@playwright/test");
const BASE = process.argv[2] || "http://localhost:3000";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 820 } });
  const errors = [];
  const failed = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text().slice(0, 160));
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 160)}`));
  page.on("requestfailed", (r) => failed.push(`${r.url()} → ${r.failure()?.errorText}`));
  page.on("response", (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  });

  for (const path of ["/game/adu-tarik-dino", "/game/adu-tarik-dino/play"]) {
    await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 180000 });
    await page.waitForTimeout(2500);
    console.log(`${path} → title="${(await page.title()).slice(0, 60)}" h1=${await page.locator("h1").count()}`);
  }

  await page.getByRole("button", { name: /MULAI BERMAIN/i }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /SQUAD/ }).first().click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /Bahasa Arab/ }).first().click();
  await page.waitForTimeout(6000);
  const t = await page.locator("[data-timer]").innerText();
  console.log(`timer=${t} panel=${await page.locator("[data-panel]").count()}`);

  const uniqueFailed = [...new Set(failed)];
  console.log(`console_errors=${errors.length}`);
  errors.slice(0, 6).forEach((e) => console.log("  ERR:", e));
  console.log(`request_gagal=${uniqueFailed.length}`);
  uniqueFailed.slice(0, 8).forEach((f) => console.log("  FAIL:", f));

  await page.screenshot({ path: "docs/papaninteraktif-audit/adu-tarik-localhost.png" });
  await browser.close();
})().catch((e) => {
  console.error("ERR:", e.message);
  process.exit(2);
});
