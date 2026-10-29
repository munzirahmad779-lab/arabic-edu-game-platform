/**
 * Pass khusus untuk game yang tidak maju di deep-flow: biasanya tombol
 * mulainya membuka TAB BARU (window.open) atau hotspot di dalam canvas.
 * Script ini menangkap popup lalu merekam layar game sebenarnya.
 *
 *   node scripts/audit-popup-pass.cjs ruang-io tatap-hap si-pemanah ...
 */
const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const OUT = path.resolve(process.cwd(), "docs", "papaninteraktif-audit");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slugs = process.argv.slice(2);

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "id-ID" });
  const results = [];

  for (const slug of slugs) {
    const dir = path.join(OUT, `game-${slug}`);
    fs.mkdirSync(dir, { recursive: true });
    console.log(`\n=== ${slug} ===`);
    const page = await ctx.newPage();
    const popups = [];
    page.on("popup", (p) => popups.push(p));

    try {
      await page.goto(`https://papaninteraktif.com/game/${slug}`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await sleep(2000);

      // Masuk ke aplikasi game dulu
      const mainLink = page.locator("a[href]").filter({ hasText: /main sekarang/i }).first();
      if ((await mainLink.count()) > 0) {
        const href = await mainLink.getAttribute("href");
        await page.goto(new URL(href, page.url()).toString(), { waitUntil: "domcontentloaded", timeout: 60000 });
        await sleep(3000);
      }

      // Klik pemicu mulai: teks apa pun yang masuk akal, paksa klik.
      const triggers = [/mulai aplikasi/i, /main sekarang/i, /mulai main/i, /mulai/i, /main yuk/i, /ayo main/i, /start/i, /gas/i, /siap/i];
      for (const re of triggers) {
        const loc = page.getByText(re).first();
        if ((await loc.count().catch(() => 0)) === 0) continue;
        try {
          await loc.click({ force: true, timeout: 2500 });
          await sleep(3000);
          if (popups.length) break;
        } catch {
          /* coba trigger lain */
        }
      }

      // Tangkap popup bila ada
      let target = page;
      if (popups.length) {
        target = popups[popups.length - 1];
        await target.waitForLoadState("domcontentloaded").catch(() => {});
        await sleep(4000);
        console.log(`  popup: ${target.url()}`);
      } else {
        console.log(`  tanpa popup: ${page.url()}`);
      }

      await target.screenshot({ path: path.join(dir, "popup-01.png") }).catch(() => {});
      const info = await target
        .evaluate(() => ({
          url: location.href,
          title: document.title,
          canvas: [...document.querySelectorAll("canvas")].map((c) => ({ w: c.width, h: c.height })),
          text: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 900),
          headings: [...document.querySelectorAll("h1,h2,h3")].map((h) => `${h.tagName}: ${h.textContent.trim().slice(0, 80)}`),
        }))
        .catch(() => ({}));

      const frames = ["popup-01.png"];
      for (let i = 2; i <= 3; i++) {
        await sleep(900);
        const name = `popup-0${i}.png`;
        await target.screenshot({ path: path.join(dir, name) }).catch(() => {});
        frames.push(name);
      }

      fs.writeFileSync(
        path.join(dir, "popup.json"),
        JSON.stringify({ slug, frames, ...info }, null, 2),
        "utf8",
      );
      results.push({ slug, url: info.url, canvas: info.canvas?.length || 0 });
    } catch (e) {
      console.log(`  ERROR ${e.message.split("\n")[0]}`);
      results.push({ slug, error: e.message.split("\n")[0] });
    } finally {
      await page.close().catch(() => {});
      for (const p of popups) await p.close().catch(() => {});
    }
  }

  fs.writeFileSync(path.join(OUT, "popup-summary.json"), JSON.stringify(results, null, 2), "utf8");
  await browser.close();
  console.log("\nSelesai.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
