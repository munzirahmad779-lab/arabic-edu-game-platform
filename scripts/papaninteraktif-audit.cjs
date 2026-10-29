/**
 * AUDIT OTOMATIS papaninteraktif.com
 * ==================================
 * Menghasilkan screenshot + data terstruktur untuk SETIAP game, termasuk
 * alur halaman (landing -> mode -> room -> bermain), sehingga fitur tiap
 * game bisa didokumentasikan detail.
 *
 * CARA PAKAI (di PC Anda yang ada internet):
 *   1) npm i -D @playwright/test        (kalau belum ada)
 *   2) npx playwright install chromium  (kalau browser belum terpasang)
 *   3) node scripts/papaninteraktif-audit.cjs
 *
 * Opsi:
 *   node scripts/papaninteraktif-audit.cjs --headful        (lihat browsernya)
 *   node scripts/papaninteraktif-audit.cjs --max-games 5    (uji cepat)
 *   node scripts/papaninteraktif-audit.cjs --base https://fishing.papaninteraktif.com
 *
 * Output: docs/papaninteraktif-audit/
 *   - 00-home.png / 00-home.json
 *   - <slug>/01-landing.png, 02-step.png, ... + <slug>/audit.json
 *   - LAPORAN.md  (ringkasan semua game: jumlah halaman, canvas, tombol, heading)
 */

const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const BASE = opt("base", "https://papaninteraktif.com");
const MAX_GAMES = Number(opt("max-games", "0")) || Infinity;
const HEADFUL = flag("headful");
const MAX_STEPS = Number(opt("max-steps", "7"));

const OUT = path.resolve(process.cwd(), "docs", "papaninteraktif-audit");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slugify = (s) =>
  String(s)
    .toLowerCase()
    .replace(/https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "game";

const STATIC_HINTS = /privacy|kebijakan|terms|about|tentang|contact|kontak|faq|login|masuk-dashboard|blog/i;

async function waitHydrated(page, ms = 15000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const anchors = await page.locator("a[href]").count().catch(() => 0);
    const loading = await page.locator("text=/Memuat Game/i").count().catch(() => 0);
    if (anchors > 4 && loading === 0) return;
    await page.waitForTimeout(500);
  }
}

async function snapshot(page, file) {
  await page.screenshot({ path: file, fullPage: true }).catch(() => {});
}

async function domSnapshot(page) {
  return page
    .evaluate(() => {
      const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
      return {
        url: location.href,
        title: document.title,
        headings: [...document.querySelectorAll("h1,h2,h3")].map(
          (h) => `${h.tagName}: ${clean(h.textContent).slice(0, 120)}`,
        ),
        buttons: [...new Set([...document.querySelectorAll("button,[role=button]")].map(
          (b) => clean(b.textContent).slice(0, 60),
        ))].filter(Boolean),
        links: [...document.querySelectorAll("a[href]")].map((a) => ({
          href: a.getAttribute("href"),
          text: clean(a.textContent).slice(0, 60),
        })),
        canvasCount: document.querySelectorAll("canvas").length,
        iframes: [...document.querySelectorAll("iframe")].map((f) => f.src),
        inputs: [...document.querySelectorAll("input,select")].map((i) => ({
          type: i.getAttribute("type"),
          name: i.getAttribute("name"),
          placeholder: i.getAttribute("placeholder"),
        })),
        textSample: clean(document.body.innerText).slice(0, 2500),
        hasSections: {
          target_audiens: /TARGET AUDIENS/i.test(document.body.innerText),
          konteks_edukasi: /KONTEKS EDUKASI/i.test(document.body.innerText),
          fokus_belajar: /FOKUS BELAJAR/i.test(document.body.innerText),
          cara_bermain: /CARA BERMAIN/i.test(document.body.innerText),
          manfaat: /MANFAAT PEMBELAJARAN/i.test(document.body.innerText),
          main_sekarang: /MAIN SEKARANG/i.test(document.body.innerText),
        },
      };
    })
    .catch(() => ({ url: page.url(), title: "", headings: [], buttons: [], links: [], canvasCount: 0, iframes: [], inputs: [], textSample: "", hasSections: {} }));
}

const CLICKABLE = /main|mulai|start|bermain|play|masuk|join|lanjut|next|next|mulai|mode|umum|junior|pilih|room|buat|acak|mulai sekarang/i;

async function exploreFlow(page, slugDir) {
  const steps = [];
  const visitedClicks = new Set();

  // Step 1: landing page (H1 + bagian edukasi + tombol MAIN SEKARANG)
  await snapshot(page, path.join(slugDir, "01-landing.png"));
  steps.push({ step: 1, screenshot: "01-landing.png", ...(await domSnapshot(page)) });

  // Ikuti "MAIN SEKARANG" -> biasanya membuka subdomain game (canvas/animation).
  let navigated = false;
  try {
    const mainLink = page.locator("a[href]").filter({ hasText: /main sekarang/i }).first();
    if ((await mainLink.count()) > 0) {
      const href = await mainLink.getAttribute("href");
      if (href) {
        await page.goto(new URL(href, page.url()).toString(), {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        });
        await sleep(3500);
        navigated = true;
      }
    }
  } catch {
    /* fallback klik biasa di bawah */
  }
  if (!navigated) {
    try {
      await page.locator("a[href]").filter({ hasText: /main sekarang/i }).first().click({ timeout: 5000 });
      await sleep(3500);
      navigated = true;
    } catch {
      /* lanjut ke eksplorasi tombol */
    }
  }

  const CLICK_TEXT =
    /mulai|start|main|bermain|pilih|mode|umum|junior|level|tingkat|mudah|sedang|sulit|lanjut|next|oke|siap|coba|jawab|acak/i;

  for (let i = 0; i < MAX_STEPS; i++) {
    const n = i + 2;
    const dom = await domSnapshot(page);
    const file = path.join(slugDir, `${String(n).padStart(2, "0")}-step.png`);
    await snapshot(page, file);
    steps.push({ step: n, screenshot: path.basename(file), ...dom });

    const candidates = page.locator("button, [role=button], a[href]").filter({ hasText: CLICK_TEXT });
    const count = await candidates.count().catch(() => 0);
    let clicked = false;
    for (let k = 0; k < Math.min(count, 10); k++) {
      const el = candidates.nth(k);
      const label = ((await el.textContent().catch(() => "")) || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 40);
      const key = `${label}#${k}`;
      if (!label || visitedClicks.has(key)) continue;
      visitedClicks.add(key);
      try {
        if (!(await el.isVisible().catch(() => false))) continue;
        await el.click({ timeout: 3000 });
        clicked = true;
        await sleep(2200);
        break;
      } catch {
        /* coba kandidat berikutnya */
      }
    }
    if (!clicked) break;
  }

  return steps;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({ headless: !HEADFUL });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "id-ID",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });
  const page = await ctx.newPage();

  console.log(`Membuka ${BASE} ...`);
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
  await waitHydrated(page);

  await snapshot(page, path.join(OUT, "00-home.png"));
  const homeDom = await domSnapshot(page);
  fs.writeFileSync(path.join(OUT, "00-home.json"), JSON.stringify(homeDom, null, 2), "utf8");

  // kumpulkan kandidat game
  const gameLinks = [];
  const seen = new Set();
  for (const l of homeDom.links) {
    if (!l.href) continue;
    let url;
    try {
      url = new URL(l.href, BASE).toString();
    } catch {
      continue;
    }
    if (!url.startsWith("http")) continue;
    if (STATIC_HINTS.test(url)) continue;
    if (!/\/game\/[a-z0-9-]+\/?$/i.test(new URL(url).pathname)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    gameLinks.push({ url, text: l.text });
  }

  // utamakan tautan yang tampak seperti game
  gameLinks.sort((a, b) => {
    const score = (x) => (/game|games|main|play/i.test(x.url) ? 0 : 1);
    return score(a) - score(b);
  });

  // Panen tambahan dari halaman kategori (sebagian game hanya muncul di sini).
  for (const cat of ["/game-edukasi-anak", "/game-logika", "/game-edukasi-ifp"]) {
    try {
      await page.goto(new URL(cat, BASE).toString(), { waitUntil: "domcontentloaded", timeout: 60000 });
      await waitHydrated(page, 8000);
      const dom = await domSnapshot(page);
      const tag = `cat-${slugify(cat)}`;
      fs.writeFileSync(path.join(OUT, `${tag}.json`), JSON.stringify(dom, null, 2), "utf8");
      await snapshot(page, path.join(OUT, `${tag}.png`));
      for (const l of dom.links) {
        if (!l.href) continue;
        let url;
        try {
          url = new URL(l.href, BASE).toString();
        } catch {
          continue;
        }
        if (!/\/game\/[a-z0-9-]+\/?$/i.test(new URL(url).pathname)) continue;
        if (seen.has(url)) continue;
        seen.add(url);
        gameLinks.push({ url, text: l.text });
        console.log(`  + dari kategori: ${url}`);
      }
    } catch (e) {
      console.log(`  kategori ${cat} gagal: ${e.message.split("\n")[0]}`);
    }
  }

  console.log(`Kandidat halaman: ${gameLinks.length}`);

  const summary = [];
  let n = 0;
  for (const g of gameLinks) {
    if (n >= MAX_GAMES) break;
    n += 1;
    const slug = slugify(g.url.replace(BASE, "") || g.text || `game-${n}`);
    const dir = path.join(OUT, slug);
    fs.mkdirSync(dir, { recursive: true });

    console.log(`  [${n}] ${g.url}`);
    try {
      await page.goto(g.url, { waitUntil: "domcontentloaded", timeout: 60000 });
      await waitHydrated(page, 10000);
      const steps = await exploreFlow(page, dir);
      fs.writeFileSync(
        path.join(dir, "audit.json"),
        JSON.stringify({ url: g.url, label: g.text, slug, steps }, null, 2),
        "utf8",
      );

      const anyCanvas = steps.some((s) => s.canvasCount > 0);
      const last = steps[steps.length - 1] || {};
      summary.push({
        slug,
        url: g.url,
        label: g.text,
        pages: steps.length,
        canvas: anyCanvas,
        sections: last.hasSections || {},
        buttons: (last.buttons || []).slice(0, 12),
        headings: (last.headings || []).slice(0, 8),
      });
    } catch (e) {
      summary.push({ slug, url: g.url, label: g.text, error: e.message.split("\n")[0] });
    }
    await sleep(800);
  }

  const md = [];
  md.push("# Audit papaninteraktif.com\n");
  md.push(`Dibuat: ${new Date().toISOString()}\n`);
  md.push(`Base: ${BASE}\n`);
  md.push("| # | Slug | Halaman | Canvas | MAIN SEKARANG | Judul H1 |");
  md.push("|---|------|---------|--------|----------------|----------|");
  summary.forEach((s, i) => {
    const h1 = (s.headings || []).find((h) => h.startsWith("H1:")) || "";
    md.push(
      `| ${i + 1} | ${s.slug} | ${s.pages ?? "-"} | ${s.canvas ? "ya" : "tidak"} | ${
        s.sections?.main_sekarang ? "ya" : "tidak"
      } | ${h1.replace(/\|/g, "\\|")} |`,
    );
  });
  md.push("\n## Detail per game\n");
  summary.forEach((s) => {
    md.push(`### ${s.label || s.slug} — \`${s.url}\``);
    if (s.error) {
      md.push(`- ERROR: ${s.error}\n`);
      return;
    }
    md.push(`- Halaman terekam: ${s.pages}`);
    md.push(`- Canvas: ${s.canvas ? "ADA" : "tidak ada"}`);
    md.push(`- Tombol: ${(s.buttons || []).join(" · ") || "-"}`);
    (s.headings || []).forEach((h) => md.push(`- ${h}`));
    md.push("");
  });

  fs.writeFileSync(path.join(OUT, "LAPORAN.md"), md.join("\n"), "utf8");

  await browser.close();
  console.log(`\nSelesai. ${summary.length} halaman game. Buka: ${path.join(OUT, "LAPORAN.md")}`);
})().catch((e) => {
  console.error("AUDIT ERROR:", e.message);
  process.exit(1);
});
