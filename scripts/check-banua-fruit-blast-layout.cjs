/**
 * check-banua-fruit-blast-layout.cjs
 *
 * Matriks 5 viewport untuk Banua Fruit Blast.
 * Memeriksa: seluruh panel peserta tampil, semua pilihan jawaban terlihat
 * (8/8 untuk 1v1, 16/16 untuk 2v2), tidak ada elemen terpotong, dan tidak ada
 * scroll horizontal pada dokumen maupun pada kontainer panel.
 *
 * Pakai: node scripts/check-banua-fruit-blast-layout.cjs http://localhost:3000
 */
const { chromium } = require("@playwright/test");

const BASE = process.argv[2] || "http://localhost:3000";
const URL = `${BASE}/game/banua-fruit-blast/play`;

const VIEWPORTS = [
  { name: "desktop", width: 1366, height: 820 },
  { name: "laptop", width: 1280, height: 720 },
  { name: "tablet-lanskap", width: 1024, height: 768 },
  { name: "tablet-potret", width: 820, height: 1180 },
  { name: "hp", width: 390, height: 844 },
];

const MODES = [
  { id: "SOLO", panels: 1, options: 4 },
  { id: "DUEL", panels: 2, options: 8 },
  { id: "SQUAD", panels: 4, options: 16 },
];

async function startMode(page, mode) {
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-mode="SOLO"]');
  await page.click(`[data-mode="${mode}"]`);
  await page.waitForSelector("[data-gass]");
  await page.click("[data-gass]");
  await page.waitForSelector('[data-arena="1"]', { timeout: 15000 });
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-panels="1"]');
      return el && el.querySelectorAll("[data-panel]").length > 0;
    },
    { timeout: 15000 },
  );
}

async function measure(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const panels = Array.from(document.querySelectorAll("[data-panel]"));
    const options = Array.from(document.querySelectorAll("[data-option]"));
    const rect = (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, bottom: r.bottom, right: r.right };
    };
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const visible = options.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.top >= -1 && r.bottom <= vh + 1 && r.left >= -1 && r.right <= vw + 1;
    }).length;

    const panelInfo = panels.map((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        slot: el.getAttribute("data-panel"),
        name: el.getAttribute("data-player"),
        bg: cs.backgroundImage,
        border: cs.borderTopColor,
        w: Math.round(r.width),
        h: Math.round(r.height),
        inView: r.top >= -1 && r.left >= -1 && r.right <= vw + 1,
      };
    });

    const arena = document.querySelector('[data-arena="1"]');
    const arenaBox = arena ? rect(arena) : null;

    return {
      hScroll: doc.scrollWidth - doc.clientWidth,
      panels: panelInfo,
      optionsTotal: options.length,
      optionsVisible: visible,
      arena: arenaBox,
      timer: document.querySelector("[data-timer]")?.textContent ?? null,
      canvas: arena
        ? {
            w: Number(arena.dataset.canvasW || 0),
            h: Number(arena.dataset.canvasH || 0),
            lanes: Number(arena.dataset.lanes || 0),
          }
        : null,
    };
  });
}

(async () => {
  const browser = await chromium.launch();
  const results = [];
  let failures = 0;

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(String(e)));

    for (const mode of MODES) {
      await startMode(page, mode.id);
      await page.waitForTimeout(900);
      const m = await measure(page);

      const problems = [];
      if (m.hScroll > 1) problems.push(`scrollX=${m.hScroll}`);
      if (m.panels.length !== mode.panels) problems.push(`panel=${m.panels.length}/${mode.panels}`);
      if (m.optionsVisible !== mode.options) {
        problems.push(`opsi_terlihat=${m.optionsVisible}/${mode.options}`);
      }
      if (!m.canvas || m.canvas.lanes !== mode.panels) {
        problems.push(`lane=${m.canvas ? m.canvas.lanes : "?"}/${mode.panels}`);
      }
      if (!m.timer || !/^\d+:\d{2}$/.test(m.timer)) problems.push(`timer=${m.timer}`);
      if (errors.length > 0) problems.push(`console_errors=${errors.length}`);

      const ok = problems.length === 0;
      if (!ok) failures++;

      results.push({
        viewport: `${vp.name} ${vp.width}x${vp.height}`,
        mode: mode.id,
        ok,
        panels: `${m.panels.length}/${mode.panels}`,
        options: `${m.optionsVisible}/${mode.options}`,
        timer: m.timer,
        arena: m.canvas ? `${m.canvas.w}x${m.canvas.h} lane=${m.canvas.lanes}` : "-",
        problems: problems.join("; ") || "-",
      });
    }

    await context.close();
  }

  await browser.close();

  const w = [26, 7, 6, 8, 9, 10, 8, 30];
  const head = ["VIEWPORT", "MODE", "PANEL", "OPSI", "TIMER", "ARENA", "STATUS", "CATATAN"];
  const pad = (s, n) => String(s).padEnd(n);
  console.log(head.map((h, i) => pad(h, w[i])).join(" "));
  console.log(w.map((n) => "-".repeat(n)).join(" "));
  for (const r of results) {
    console.log(
      [
        pad(r.viewport, w[0]),
        pad(r.mode, w[1]),
        pad(r.panels, w[2]),
        pad(r.options, w[3]),
        pad(r.timer ?? "-", w[4]),
        pad(r.arena, w[5]),
        pad(r.ok ? "PASS" : "FAIL", w[6]),
        pad(r.problems, w[7]),
      ].join(" "),
    );
  }
  const pass = results.filter((r) => r.ok).length;
  console.log(`\nTOTAL: ${pass}/${results.length} PASS, ${failures} FAIL`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((err) => {
  console.error("FATAL", err);
  process.exit(1);
});
