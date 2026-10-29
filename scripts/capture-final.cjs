const { chromium } = require("@playwright/test");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 820 } });
  const open = async (mode) => {
    await page.goto("http://localhost:3000/game/adu-tarik-dino/play", { waitUntil: "domcontentloaded", timeout: 180000 });
    await page.waitForTimeout(700);
    await page.getByRole("button", { name: /MULAI BERMAIN/i }).click();
    await page.waitForTimeout(220);
    await page.getByRole("button", { name: new RegExp(mode) }).first().click();
    await page.waitForTimeout(220);
    await page.getByRole("button", { name: /Bahasa Arab/ }).first().click();
    await page.waitForTimeout(5200);
  };

  await open("DUEL");
  await page.screenshot({ path: "docs/papaninteraktif-audit/adu-tarik-final-duel.png" });

  await open("SQUAD");
  await page.screenshot({ path: "docs/papaninteraktif-audit/adu-tarik-final-squad.png" });

  for (let i = 0; i < 6; i++) {
    const done = await page.getByRole("button", { name: /TANDING LAGI/i }).isVisible().catch(() => false);
    if (done) break;
    await page
      .locator("[data-panel]")
      .first()
      .locator("[data-correct='1']")
      .first()
      .click({ timeout: 5000 })
      .catch(() => {});
    await page.waitForTimeout(600);
  }
  await page.waitForTimeout(1800);
  await page.screenshot({ path: "docs/papaninteraktif-audit/adu-tarik-final-menang.png" });
  console.log("shots ok");
  await browser.close();
})().catch((e) => {
  console.error("ERR:", e.message);
  process.exit(2);
});
