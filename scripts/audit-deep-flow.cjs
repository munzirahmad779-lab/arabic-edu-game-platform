/**
 * Deep flow: klik elemen apa pun yang "bisa diklik" (cursor: pointer),
 * bukan hanya <button>/<a>, supaya bisa menembus layar pemilihan mode
 * sampai ke gameplay (mis. Mancing Kata: pilih mapel -> level -> mode).
 *
 * Juga merekam 3 frame berurutan di keadaan terakhir untuk mengukur animasi.
 *
 * Pakai:
 *   node scripts/audit-deep-flow.cjs mancing-kata
 *   node scripts/audit-deep-flow.cjs --all
 */
const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const OUT = path.resolve(process.cwd(), "docs", "papaninteraktif-audit");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const args = process.argv.slice(2);
const ALL = args.includes("--all");
const steps = Number((args.includes("--steps") ? args[args.indexOf("--steps") + 1] : 0) || 12);
const slugs = ALL ? [] : args.filter((a) => !a.startsWith("--") && !/^\d+$/.test(a));

const KEY = /main|mulai|petualang|cerita|duel|team|mode|pilih|level|tingkat|mudah|sedang|sulit|map|lanjut|siap|gas|start|play|masuk|selanjutnya|lanjutkan|oke|ok\b|ya\b|mulai sekarang/i;

async function domSnap(page) {
  return page
    .evaluate(() => {
      const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
      return {
        url: location.href,
        title: document.title,
        headings: [...document.querySelectorAll("h1,h2,h3")].map((h) => `${h.tagName}: ${clean(h.textContent).slice(0, 100)}`),
        canvases: [...document.querySelectorAll("canvas")].map((c) => ({ w: c.width, h: c.height })),
        text: clean(document.body.innerText).slice(0, 2200),
        inputs: [...document.querySelectorAll("input,select")].map((i) => `${i.type}:${i.name || i.placeholder || ""}`),
      };
    })
    .catch(() => ({ url: page.url(), headings: [], canvases: [], text: "", inputs: [] }));
}

/** Kandidat klik: semua elemen dengan cursor pointer & teks pendek. */
async function clickCandidates(page) {
  return page
    .evaluate(() => {
      const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
      const out = [];
      for (const el of document.querySelectorAll("body *")) {
        const cs = getComputedStyle(el);
        if (cs.cursor !== "pointer") continue;
        const r = el.getBoundingClientRect();
        if (r.width < 18 || r.height < 14) continue;
        if (r.top > innerHeight || r.left > innerWidth || r.bottom < 0) continue;
        const txt = clean(el.textContent);
        if (!txt || txt.length > 60) continue;
        // hanya elemen terdalam yang memuat teks ini
        if (el.querySelector("*") && clean(el.querySelector("*").textContent) === txt && el.children.length === 1) continue;
        out.push({ text: txt, x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height });
      }
      // dedupe berdasarkan teks+posisi kasar
      const seen = new Set();
      return out.filter((c) => {
        const k = `${c.text}|${Math.round(c.x / 20)}|${Math.round(c.y / 20)}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      }).slice(0, 40);
    })
    .catch(() => []);
}

(async () => {
  let targets = slugs;
  if (ALL) {
    targets = fs
      .readdirSync(OUT, { withFileTypes: true })
      .filter((d) => d.isDirectory() && fs.existsSync(path.join(OUT, d.name, "audit.json")))
      .map((d) => d.name.replace(/^game-/, ""));
  }
  if (!targets.length) {
    console.error("Sebutkan slug, atau pakai --all");
    process.exit(1);
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: "id-ID" });

  for (const slug of targets) {
    const dir = path.join(OUT, `game-${slug}`);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const landing = `https://papaninteraktif.com/game/${slug}`;
    const log = [];
    console.log(`\n=== ${slug} ===`);

    try {
      await page.goto(landing, { waitUntil: "domcontentloaded", timeout: 60000 });
      await sleep(2000);

      const mainLink = page.locator("a[href]").filter({ hasText: /main sekarang/i }).first();
      if ((await mainLink.count()) > 0) {
        const href = await mainLink.getAttribute("href");
        await page.goto(new URL(href, page.url()).toString(), { waitUntil: "domcontentloaded", timeout: 60000 });
        await sleep(3000);
      }

      const tried = new Set();
      for (let i = 1; i <= steps; i++) {
        const dom = await domSnap(page);
        const file = `deep-${String(i).padStart(2, "0")}.png`;
        await page.screenshot({ path: path.join(dir, file) }).catch(() => {});
        log.push({ step: i, screenshot: file, ...dom });
        console.log(`  ${i}: canvas=${dom.canvases.length} h=${dom.headings[0] || "-"} | ${dom.text.slice(0, 70)}`);

        const cands = await clickCandidates(page);
        const pick = cands.find((c) => KEY.test(c.text) && !tried.has(`${c.text}|${Math.round(c.x)}`));
        if (!pick) {
          console.log(`  (tidak ada kandidat klik baru)`);
          break;
        }
        tried.add(`${pick.text}|${Math.round(pick.x)}`);
        console.log(`     klik "${pick.text.slice(0, 40)}"`);
        try {
          await page.mouse.click(pick.x, pick.y);
        } catch (e) {
          console.log(`     klik gagal: ${e.message.split("\n")[0]}`);
        }
        await sleep(2400);
      }

      // frame animasi di keadaan akhir
      const frames = [];
      for (let f = 1; f <= 3; f++) {
        const name = `deep-anim-${f}.png`;
        await page.screenshot({ path: path.join(dir, name) }).catch(() => {});
        frames.push(name);
        await sleep(800);
      }
      const dom = await domSnap(page);
      fs.writeFileSync(
        path.join(dir, "deep-flow.json"),
        JSON.stringify({ slug, steps: log, frames, final: dom }, null, 2),
        "utf8",
      );
    } catch (e) {
      console.log(`  ERROR: ${e.message.split("\n")[0]}`);
    }
  }

  await browser.close();
  console.log("\nSelesai.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
