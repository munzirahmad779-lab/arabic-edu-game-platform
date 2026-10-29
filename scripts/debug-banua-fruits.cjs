/**
 * debug-banua-fruits.cjs
 * 
 * Debug distribusi buah jatuh - cek apakah semua jawaban benar muncul berulang.
 * Tangkap screenshot setiap deteksi masalah.
 */
const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const BASE = process.argv[2] || "http://localhost:3000";
const URL = `${BASE}/game/banua-fruit-blast/play`;
const OUT = path.join("docs", "debug-banua");

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  
  const browser = await chromium.launch({ headless: false }); // visible untuk debug
  const context = await browser.newContext({
    viewport: { width: 1366, height: 820 },
  });
  const page = await context.newPage();

  const consoleLog = [];
  page.on("console", (m) => consoleLog.push(`[${m.type()}] ${m.text()}`));

  console.log("🔍 Navigating to game...");
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-mode="SOLO"]', { timeout: 10000 });

  console.log("🎮 Starting SQUAD mode...");
  await page.click('[data-mode="SQUAD"]');
  await page.waitForSelector("[data-gass]");
  await page.click("[data-gass]");
  await page.waitForSelector('[data-arena="1"]', { timeout: 15000 });

  console.log("⏳ Waiting for fruits to spawn...");
  await page.waitForTimeout(2000);

  // Sample options di panel setiap detik selama 10 detik
  for (let sec = 1; sec <= 10; sec++) {
    await page.waitForTimeout(1000);
    
    const snapshot = await page.evaluate(() => {
      const panels = Array.from(document.querySelectorAll('[data-panel]'));
      return panels.map(p => {
        const player = p.getAttribute('data-player') || '?';
        const question = p.querySelector('[data-question]')?.textContent.trim() || 'No Q';
        const options = Array.from(p.querySelectorAll('[data-option]')).map(o => ({
          text: o.textContent.trim(),
          correct: o.getAttribute('data-correct') === 'true',
        }));
        
        const correctOpts = options.filter(o => o.correct);
        const allTexts = options.map(o => o.text);
        const unique = [...new Set(allTexts)];
        
        return {
          player,
          question: question.substring(0, 30),
          options: allTexts,
          correctCount: correctOpts.length,
          uniqueCount: unique.length,
          allSame: unique.length === 1,
          multipleCorrect: correctOpts.length > 1,
        };
      });
    });

    console.log(`\n[T+${sec}s] Panel Options:`);
    snapshot.forEach((s, i) => {
      const flag = s.allSame ? '❌ ALL SAME' : s.multipleCorrect ? '⚠️  MULTI CORRECT' : '✅';
      console.log(`  ${i+1}. ${s.player}: ${flag}`);
      console.log(`     Q: ${s.question}`);
      console.log(`     Options: ${s.options.join(' | ')}`);
      console.log(`     Unique: ${s.uniqueCount}/4, Correct: ${s.correctCount}`);
    });

    // Tangkap screenshot kalau ada masalah
    const hasIssue = snapshot.some(s => s.allSame || s.multipleCorrect || s.uniqueCount < 2);
    if (hasIssue) {
      const screenshotPath = path.join(OUT, `issue-t${sec}s.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`     📸 Screenshot saved: ${screenshotPath}`);
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("Console log from page:");
  consoleLog.slice(-20).forEach(log => console.log(`  ${log}`));

  console.log("\n✅ Debug complete. Check docs/debug-banua/ for screenshots.");
  
  await browser.close();
})().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
