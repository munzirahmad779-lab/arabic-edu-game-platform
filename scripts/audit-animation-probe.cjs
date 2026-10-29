/**
 * Probe animasi: buka tiap game (langsung ke subdomain game hasil audit),
 * rekam 3 frame berurutan + info canvas, agar "ada animasi atau tidak"
 * bisa diukur numerik (bukan dikira-kira).
 *
 * Pakai setelah papaninteraktif-audit.cjs selesai:
 *   node scripts/audit-animation-probe.cjs
 */
const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const OUT = path.resolve(process.cwd(), "docs", "papaninteraktif-audit");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const dirs = fs
    .readdirSync(OUT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => fs.existsSync(path.join(OUT, name, "audit.json")));

  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "id-ID",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });
  const page = await ctx.newPage();

  const summary = [];

  for (const slug of dirs) {
    const dir = path.join(OUT, slug);
    const audit = JSON.parse(fs.readFileSync(path.join(dir, "audit.json"), "utf8"));
    const steps = audit.steps || [];
    // URL aplikasi game = step pertama yang beda host dari landing.
    const landingHost = (() => {
      try {
        return new URL(steps[0]?.url || audit.url).host;
      } catch {
        return "";
      }
    })();
    const gameStep = steps.find((s) => {
      try {
        return new URL(s.url).host !== landingHost;
      } catch {
        return false;
      }
    });
    const target = gameStep?.url || steps[0]?.url;
    if (!target) {
      summary.push({ slug, error: "tidak ada URL" });
      continue;
    }

    try {
      await page.goto(target, { waitUntil: "domcontentloaded", timeout: 60000 });
      await sleep(2500);

      // Klik pemicu mulai yang umum, supaya animasi benar-benar berjalan.
      for (const re of [/main sendiri/i, /solo/i, /mulai/i, /start/i, /main/i]) {
        try {
          const btn = page.locator("button, [role=button], a[href]").filter({ hasText: re }).first();
          if ((await btn.count()) > 0 && (await btn.isVisible())) {
            await btn.click({ timeout: 2500 });
            await sleep(1500);
            break;
          }
        } catch {
          /* lanjut */
        }
      }

      const canvasInfo = await page
        .evaluate(() =>
          [...document.querySelectorAll("canvas")].map((c) => ({
            width: c.width,
            height: c.height,
            clientWidth: c.clientWidth,
            clientHeight: c.clientHeight,
          })),
        )
        .catch(() => []);

      const frames = [];
      for (let i = 0; i < 3; i++) {
        const f = path.join(dir, `anim-${i + 1}.png`);
        await page.screenshot({ path: f, fullPage: false }).catch(() => {});
        frames.push(path.basename(f));
        await sleep(700);
      }

      fs.writeFileSync(
        path.join(dir, "anim.json"),
        JSON.stringify({ slug, target, canvasInfo, frames }, null, 2),
        "utf8",
      );
      summary.push({ slug, canvas: canvasInfo.length, size: canvasInfo[0] || null });
      console.log(`  ${slug}: canvas=${canvasInfo.length}`);
    } catch (e) {
      summary.push({ slug, error: e.message.split("\n")[0] });
      console.log(`  ${slug}: ERROR ${e.message.split("\n")[0]}`);
    }
  }

  fs.writeFileSync(path.join(OUT, "anim-summary.json"), JSON.stringify(summary, null, 2), "utf8");
  await browser.close();
  console.log(`\nSelesai ${summary.length} game.`);
})().catch((e) => {
  console.error("PROBE ERROR:", e.message);
  process.exit(1);
});
