/**
 * audit-banua-comprehensive.cjs
 * 
 * Penyisiran menyeluruh banua-fruit-blast:
 * - Visual overlap / tertimpa
 * - Buah berulang jawaban sama
 * - Flicker / jumping layout
 * - Console errors
 * - Semua mode & viewport
 * 
 * Pakai: node scripts/audit-banua-comprehensive.cjs http://localhost:3000
 */
const { chromium } = require("@playwright/test");

const BASE = process.argv[2] || "http://localhost:3000";
const URL = `${BASE}/game/banua-fruit-blast/play`;

const VIEWPORTS = [
  { name: "desktop", width: 1366, height: 820 },
  { name: "tablet-potret", width: 820, height: 1180 },
  { name: "hp", width: 390, height: 844 },
];

const MODES = ["SOLO", "DUEL", "SQUAD"];

async function auditMode(page, mode, vpName) {
  const issues = [];
  const consoleErrors = [];
  const pageErrors = [];

  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => pageErrors.push(String(e)));

  // Navigate & start
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-mode="SOLO"]', { timeout: 10000 });
  await page.click(`[data-mode="${mode}"]`);
  await page.waitForSelector("[data-gass]", { timeout: 5000 });
  await page.click("[data-gass]");
  await page.waitForSelector('[data-arena="1"]', { timeout: 15000 });
  
  // Wait for game to populate
  await page.waitForTimeout(3000);

  // --- 1. Check visual overlaps ---
  const overlaps = await page.evaluate(() => {
    const problems = [];
    
    // Check if panels overlap with canvas
    const canvas = document.querySelector('[data-arena="1"]');
    const panels = document.querySelector('[data-panels="1"]');
    
    if (canvas && panels) {
      const cRect = canvas.getBoundingClientRect();
      const pRect = panels.getBoundingClientRect();
      
      // Check if they overlap
      const overlap = !(
        cRect.right < pRect.left ||
        cRect.left > pRect.right ||
        cRect.bottom < pRect.top ||
        cRect.top > pRect.bottom
      );
      
      if (overlap) {
        problems.push(`Canvas & Panels OVERLAP: canvas(${Math.round(cRect.x)},${Math.round(cRect.y)}) panels(${Math.round(pRect.x)},${Math.round(pRect.y)})`);
      }
    }
    
    // Check horizontal scroll
    const hScroll = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    if (hScroll > 2) {
      problems.push(`Horizontal scroll detected: ${hScroll}px`);
    }
    
    // Check if any panels clipped
    const allPanels = Array.from(document.querySelectorAll('[data-panel]'));
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    
    allPanels.forEach((p) => {
      const r = p.getBoundingClientRect();
      if (r.right > vw + 5 || r.bottom > vh + 5 || r.left < -5 || r.top < -5) {
        const player = p.getAttribute('data-player');
        problems.push(`Panel ${player} CLIPPED/OUT-OF-VIEW: right=${Math.round(r.right)} bottom=${Math.round(r.bottom)} vw=${vw} vh=${vh}`);
      }
    });
    
    // Check timer visibility
    const timer = document.querySelector('[data-timer]');
    if (timer) {
      const tRect = timer.getBoundingClientRect();
      if (tRect.width === 0 || tRect.height === 0) {
        problems.push('Timer invisible (0 size)');
      }
    } else {
      problems.push('Timer element NOT FOUND');
    }
    
    return problems;
  });

  issues.push(...overlaps);

  // --- 2. Check fruit distribution (jawaban berulang) ---
  await page.waitForTimeout(2000); // Let fruits spawn
  
  const fruitCheck = await page.evaluate(() => {
    const problems = [];
    const arena = document.querySelector('[data-arena="1"]');
    if (!arena) return ['Arena canvas not found'];
    
    const lanes = parseInt(arena.dataset.lanes || '0', 10);
    const panels = Array.from(document.querySelectorAll('[data-panel]'));
    
    panels.forEach((panel, idx) => {
      const player = panel.getAttribute('data-player');
      const question = panel.querySelector('[data-question]');
      const options = Array.from(panel.querySelectorAll('[data-option]'));
      
      if (!question || options.length === 0) {
        problems.push(`${player}: No question or options`);
        return;
      }
      
      const correctOpt = options.find(o => o.getAttribute('data-correct') === 'true');
      if (!correctOpt) {
        problems.push(`${player}: No correct option marked`);
      }
      
      // Check if all options are the same (visual bug)
      const texts = options.map(o => o.textContent.trim());
      const unique = [...new Set(texts)];
      if (unique.length === 1) {
        problems.push(`${player}: All 4 options IDENTICAL: "${texts[0]}"`);
      }
      
      // Check if correct answer appears multiple times
      if (correctOpt) {
        const correctText = correctOpt.textContent.trim();
        const correctCount = texts.filter(t => t === correctText).length;
        if (correctCount > 1) {
          problems.push(`${player}: Correct answer "${correctText}" appears ${correctCount} times`);
        }
      }
    });
    
    return problems;
  });

  issues.push(...fruitCheck);

  // --- 3. Sample fruits from canvas over time ---
  const fruitSamples = [];
  for (let i = 0; i < 5; i++) {
    await page.waitForTimeout(800);
    const sample = await page.evaluate(() => {
      const panels = Array.from(document.querySelectorAll('[data-panel]'));
      return panels.map(p => {
        const player = p.getAttribute('data-player');
        const correctOpt = p.querySelector('[data-option][data-correct="true"]');
        const correctText = correctOpt ? correctOpt.textContent.trim() : '?';
        return { player, correctText };
      });
    });
    fruitSamples.push(sample);
  }

  // Analyze if fruits in arena match expected variety
  // (We can't directly read canvas pixels, but we checked options above)

  // --- 4. Check layout stability (no flickering) ---
  const sizes = [];
  for (let i = 0; i < 3; i++) {
    await page.waitForTimeout(500);
    const size = await page.evaluate(() => {
      const canvas = document.querySelector('[data-arena="1"]');
      if (!canvas) return null;
      const r = canvas.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    });
    sizes.push(size);
  }

  const stableSizes = sizes.every((s, i) => i === 0 || (s.w === sizes[0].w && s.h === sizes[0].h));
  if (!stableSizes) {
    issues.push(`Canvas size FLICKERING: ${sizes.map(s => `${s.w}x${s.h}`).join(' → ')}`);
  }

  // --- 5. Console errors ---
  if (consoleErrors.length > 0) {
    issues.push(`Console errors: ${consoleErrors.length} — ${consoleErrors.slice(0, 3).join('; ')}`);
  }
  if (pageErrors.length > 0) {
    issues.push(`Page errors: ${pageErrors.length} — ${pageErrors.slice(0, 3).join('; ')}`);
  }

  return {
    mode,
    viewport: vpName,
    issues,
    consoleErrors: consoleErrors.length,
    pageErrors: pageErrors.length,
  };
}

(async () => {
  const browser = await chromium.launch();
  const results = [];

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    for (const mode of MODES) {
      console.log(`\n🔍 Auditing ${mode} @ ${vp.name} ${vp.width}x${vp.height}...`);
      const result = await auditMode(page, mode, vp.name);
      results.push(result);
      
      if (result.issues.length > 0) {
        console.log(`   ❌ ${result.issues.length} issues found:`);
        result.issues.forEach(iss => console.log(`      - ${iss}`));
      } else {
        console.log(`   ✅ No issues`);
      }
    }

    await context.close();
  }

  await browser.close();

  console.log("\n" + "=".repeat(80));
  console.log("RINGKASAN AUDIT MENYELURUH");
  console.log("=".repeat(80));

  let totalIssues = 0;
  results.forEach(r => {
    const status = r.issues.length === 0 ? "✅ PASS" : `❌ ${r.issues.length} ISSUE`;
    console.log(`${r.viewport.padEnd(16)} ${r.mode.padEnd(6)} ${status}`);
    totalIssues += r.issues.length;
  });

  console.log("=".repeat(80));
  console.log(`TOTAL: ${totalIssues} issues across ${results.length} tests`);

  if (totalIssues > 0) {
    console.log("\n⚠️  DETAIL MASALAH:\n");
    results.forEach(r => {
      if (r.issues.length > 0) {
        console.log(`\n[${r.viewport} / ${r.mode}]`);
        r.issues.forEach(iss => console.log(`  • ${iss}`));
      }
    });
  }

  process.exit(totalIssues === 0 ? 0 : 1);
})().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
