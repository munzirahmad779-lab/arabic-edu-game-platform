const { chromium } = require("@playwright/test");

const BASE = process.argv[2] || "http://127.0.0.1:3000";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });

  const targets = ["/", "/login", "/games/porogapit-arena", "/games/mewarnai"];
  let supabaseFailures = 0;

  for (const path of targets) {
    errors.length = 0;
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 120000 });
    const supa = errors.filter((e) => /NEXT_PUBLIC_SUPABASE/i.test(e));
    supabaseFailures += supa.length;
    console.log(
      `${path.padEnd(26)} title="${await page.title()}" errors=${errors.length} supabase=${supa.length}`,
    );
    errors.slice(0, 2).forEach((e) => console.log("    ", e.slice(0, 140)));
  }

  await page.goto(`${BASE}/games/porogapit-arena`, { waitUntil: "networkidle", timeout: 120000 });
  await page.locator("button", { hasText: /^4$/ }).first().click();
  await page.waitForTimeout(400);
  const feedback = await page.locator("text=/Jawaban benar|Belum tepat/").count();
  const score = await page.locator("text=/Skor \\d+/").first().textContent();
  console.log(`\ninteraction: feedback=${feedback} ${score}`);

  await browser.close();
  console.log(
    supabaseFailures === 0
      ? "\nBROWSER CHECK PASSED — no Supabase errors on any target"
      : `\nBROWSER CHECK FAILED — ${supabaseFailures} Supabase errors`,
  );
  process.exit(supabaseFailures === 0 ? 0 : 1);
})().catch((e) => {
  console.error("BROWSER CHECK ERROR:", e.message);
  process.exit(2);
});
