import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const SCREENSHOT_DIR = path.resolve(process.cwd(), "test-screenshots");
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runVisualVerification() {
  console.log("🚀 Launching Headless Chromium to verify Projector Visuals & F12 Console...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();

  const consoleLogs = [];
  const consoleErrors = [];

  page.on("console", (msg) => {
    const text = msg.text();
    const type = msg.type();
    consoleLogs.push({ type, text });
    if (type === "error") {
      consoleErrors.push(text);
      console.error("🔴 [Browser F12 Error]:", text);
    }
  });

  page.on("pageerror", (err) => {
    consoleErrors.push(err.message);
    console.error("💥 [Browser Page Crash/Uncaught Error]:", err.message);
  });

  try {
    console.log("📡 Navigating to http://localhost:3000/test-projector ...");
    const response = await page.goto("http://localhost:3000/test-projector", {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    console.log(`HTTP Status: ${response.status()}`);

    // Wait for main container
    await page.waitForSelector("text=Mode Proyektor & Smartboard Kelas", { timeout: 10000 });

    // 1. Take Screenshot of Setup Stage
    console.log("📸 Capturing: 01-setup-screen.png");
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "01-setup-screen.png"),
      fullPage: false,
    });

    // 2. Click "🎲 Bagi Rata Otomatis" to distribute the 30 Mangkoso students
    console.log("🔘 Clicking '🎲 Bagi Rata Otomatis'...");
    const autoDistBtn = page.locator("text=Bagi Rata Otomatis").first();
    await autoDistBtn.click();
    await page.waitForTimeout(800);

    // 3. Launch game in Focus Mode with Penalty Shootout
    console.log("🔘 Clicking '🚀 Mulai di Proyektor Sekarang'...");
    const startBtn = page.locator("text=Mulai di Proyektor Sekarang");
    await startBtn.scrollIntoViewIfNeeded();
    await startBtn.click();
    await page.waitForTimeout(1000);

    // 4. Capture Penalty Focus Screen
    console.log("📸 Capturing: 02-penalty-turn.png");
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "02-penalty-turn.png"),
      fullPage: false,
    });

    // 5. Test kicking Ball 1 (Correct Answer)
    console.log("⚽ Kicking Ball 1 (Option A)...");
    const ball1 = page.locator("button:has-text('Bola #1')").first();
    await ball1.click();

    // Wait 600ms for trajectory flight and goal celebration banner
    await page.waitForTimeout(800);

    console.log("📸 Capturing: 03-penalty-goal-celebration.png");
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "03-penalty-goal-celebration.png"),
      fullPage: false,
    });

    // 6. Test advancing to next team on same question (Fair Turn)
    console.log("🔘 Clicking '👉 Lanjut Giliran Tim Berikutnya'...");
    const nextTeamBtn = page.locator("text=Lanjut Giliran Tim Berikutnya").first();
    await nextTeamBtn.click();
    await page.waitForTimeout(500);

    console.log("📸 Capturing: 04-second-team-turn.png");
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "04-second-team-turn.png"),
      fullPage: false,
    });

    // 7. Toggle to Mode B: ⊞ Layar Terbagi 4 Kuadran
    console.log("🔘 Clicking '⊞ Terbagi 4 Kuadran'...");
    const splitModeBtn = page.locator("button:has-text('Terbagi 4 Kuadran')").first();
    await splitModeBtn.click();
    await page.waitForTimeout(800);

    console.log("📸 Capturing: 05-split-screen-4-quadrants.png");
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "05-split-screen-4-quadrants.png"),
      fullPage: false,
    });

    // 8. Open Team Studio modal (⚙️ Kelola Tim)
    console.log("🔘 Opening Team Studio Modal...");
    const studioBtn = page.locator("button:has-text('Kelola Tim')").first();
    await studioBtn.click();
    await page.waitForTimeout(500);

    console.log("📸 Capturing: 06-team-studio-modal.png");
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "06-team-studio-modal.png"),
      fullPage: false,
    });

    // Close modal
    const closeBtn = page.locator("text=Selesai & Lanjutkan Permainan").first();
    await closeBtn.click();
    await page.waitForTimeout(500);

    // 9. Now test Fruit Slicer Screen: reload page and pick Fruit Slicer
    console.log("🔄 Reloading to test Fruit Slicer...");
    await page.goto("http://localhost:3000/test-projector", { waitUntil: "networkidle" });
    await page.waitForSelector("text=Mode Proyektor & Smartboard Kelas");

    // Click Fruit Slicer mechanic button
    console.log("🍉 Selecting Fruit Slicer mechanic...");
    const slicerBtn = page.locator("button:has-text('Fruit Slicer')").first();
    await slicerBtn.click();
    await page.waitForTimeout(300);

    const startSlicerBtn = page.locator("text=Mulai di Proyektor Sekarang");
    await startSlicerBtn.click();
    await page.waitForTimeout(1000);

    console.log("📸 Capturing: 07-fruit-slicer-game.png");
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "07-fruit-slicer-game.png"),
      fullPage: false,
    });

    console.log("\n=======================================================");
    console.log("🎉 ALL SCREENSHOTS & ACTIONS COMPLETED SUCCESSFULLY!");
    console.log(`Total F12 Console Errors: ${consoleErrors.length}`);
    console.log("=======================================================");

    if (consoleErrors.length > 0) {
      console.log("Console Errors found:", consoleErrors);
    }

  } catch (err) {
    console.error("❌ Visual verification failed:", err);
  } finally {
    await browser.close();
  }
}

runVisualVerification();
