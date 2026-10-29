/**
 * Verifikasi game adu-tarik-dino end-to-end di browser.
 *   node scripts/check-adu-tarik.cjs http://127.0.0.1:3200
 */
const { chromium } = require("@playwright/test");

const BASE = process.argv[2] || "http://127.0.0.1:3200";
const OUT = "docs/papaninteraktif-audit";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 820 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 200)}`);
  });

  const spriteStatus = {};
  page.on("response", (r) => {
    const u = r.url();
    if (u.includes("/sprites/characters/")) spriteStatus[u.split("/").pop()] = r.status();
  });

  // 1. landing
  const res = await page.goto(`${BASE}/game/adu-tarik-dino`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(600);
  const h1 = await page.locator("h1").first().innerText();
  const h2 = await page.locator("h2").allInnerTexts();
  console.log(`landing status=${res && res.status()} h1="${h1.slice(0, 40)}" h2_count=${h2.length}`);
  console.log(`h2=${JSON.stringify(h2)}`);
  await page.screenshot({ path: `${OUT}/game-adu-tarik-landing.png`, fullPage: false });

  const cta = page.getByRole("link", { name: "MAIN SEKARANG" }).first();
  await cta.click();
  await page.waitForURL("**/play", { timeout: 60000 });
  await page.waitForTimeout(800);

  // 2. home -> mode -> topic
  await page.getByRole("button", { name: /MULAI BERMAIN/i }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: /DUEL/ }).first().click();
  await page.waitForTimeout(300);
  console.log(`canvases_before_play=${await page.locator("canvas").count()}`);
  await page.getByRole("button", { name: /Bahasa Arab/ }).first().click();

  // 3. countdown -> arena
  await page.waitForTimeout(3400);
  const canvas = page.locator("canvas").first();
  await canvas.waitFor({ state: "visible", timeout: 30000 });
  const box = await canvas.boundingBox();
  console.log(`arena canvas=${box ? `${Math.round(box.width)}x${Math.round(box.height)}` : "none"}`);

  const timer0 = await page.getByText(/^\d:\d\d$/).first().innerText();
  await page.waitForTimeout(1500);
  const timer1 = await page.getByText(/^\d:\d\d$/).first().innerText();
  console.log(`timer ${timer0} -> ${timer1}`);

  // 4. jawab benar (q1 Bahasa Arab = "Mubtada'")
  const scoreText = async () => (await page.locator("header").innerText()).replace(/\s+/g, " ");
  console.log(`score_before="${await scoreText()}"`);
  await page.getByRole("button", { name: /Mubtada/ }).first().click();
  await page.waitForTimeout(700);
  console.log(`score_after_correct="${await scoreText()}"`);
  await page.screenshot({ path: `${OUT}/game-adu-tarik-arena.png` });

  // 5. jawab salah
  await page.getByRole("button", { name: /Fa'il/ }).first().click();
  await page.waitForTimeout(500);
  console.log(`score_after_wrong="${await scoreText()}"`);

  // 6. menang: jawab benar sesuai urutan bank soal Bahasa Arab (25 px x 4 >= 85)
  const CORRECT_ARAB = ["Mubtada'", "صَغِيْرٌ", "طُلَّابٌ", "Dhammah"];
  for (let i = 0; i < 8; i++) {
    const target = CORRECT_ARAB[i % CORRECT_ARAB.length];
    const isArabic = /[\u0600-\u06FF]/.test(target);
    const btn = isArabic
      ? page.getByRole("button").filter({ hasText: target.slice(0, 2) }).first()
      : page.getByRole("button", { name: target }).first();
    if (!(await btn.isVisible().catch(() => false))) {
      console.log(`  [loop ${i}] tombol "${target}" tidak terlihat`);
      break;
    }
    await btn.click().catch(() => {});
    await page.waitForTimeout(340);
    const won = await page.getByRole("button", { name: /TANDING LAGI/i }).isVisible().catch(() => false);
    console.log(`  benar ${i + 1} (${target}) won=${won}`);
    if (won) break;
  }
  await page.waitForTimeout(600);
  const resultVisible = await page.getByRole("button", { name: /TANDING LAGI/i }).isVisible().catch(() => false);
  console.log(`result_overlay=${resultVisible}`);
  await page.screenshot({ path: `${OUT}/game-adu-tarik-result.png` });

  const sprite404 = errors.filter((e) => e.includes("404"));
  const realErrors = errors.filter((e) => !e.includes("404"));
  console.log(`sprites=${JSON.stringify(spriteStatus)}`);
  console.log(`missing_sprites=${sprite404.length} real_errors=${realErrors.length}`);
  realErrors.slice(0, 6).forEach((e) => console.log("  ", e));

  await browser.close();
  const ok = realErrors.length === 0 && h2.length >= 6 && resultVisible && timer0 !== timer1;
  process.exit(ok ? 0 : 1);
})().catch((e) => {
  console.error("CHECK ERROR:", e.message);
  process.exit(2);
});
