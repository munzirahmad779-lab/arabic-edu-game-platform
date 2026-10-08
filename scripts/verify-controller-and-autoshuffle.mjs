import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const SCREENSHOT_DIR = path.resolve(process.cwd(), "test-screenshots");
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function main() {
  console.log("🚀 Testing Wireless Controller Access & Auto-Shuffle Updates...");
  const browser = await chromium.launch({ headless: true });

  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await desktopContext.newPage();

  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
      console.error("🔴 [Browser F12 Error]:", msg.text());
    }
  });

  page.on("pageerror", (err) => {
    consoleErrors.push(err.message);
    console.error("💥 [Browser Page Crash]:", err.message);
  });

  // 1. Visit Projector Screen Setup
  console.log("\n📡 1. Navigating to http://localhost:3000/test-projector ...");
  await page.goto("http://localhost:3000/test-projector", {
    waitUntil: "domcontentloaded",
    timeout: 15000,
  });

  // Verify Auto-Shuffle badge exists
  await page.waitForSelector("text=Pengacakan & Perputaran Soal Otomatis Aktif", { timeout: 10000 });
  console.log("✅ Auto-Shuffle badge confirmed!");

  // Verify Target Putaran Permainan exists
  await page.waitForSelector("text=Target Putaran Permainan", { timeout: 10000 });
  console.log("✅ Target Putaran Permainan confirmed!");

  // Verify Wireless Controller Card exists
  await page.waitForSelector("text=Hubungkan HP Siswa Sebagai Stik Nirkabel", { timeout: 10000 });
  console.log("✅ Wireless Controller Setup Card confirmed!");

  // Take screenshot of setup screen top
  console.log("📸 Capturing: 14-projector-setup-controller-and-autoshuffle.png");
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, "14-projector-setup-controller-and-autoshuffle.png"),
  });

  // 2. Connect a Phone Controller on Mobile Viewport
  console.log("\n📱 2. Connecting Phone Controller (Stik 1)...");
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto("http://localhost:3000/controller?room=HOTSEAT&team=team-1", {
    waitUntil: "domcontentloaded",
    timeout: 15000,
  });

  console.log("📸 Capturing: 15-phone-stik1.png");
  await mobilePage.screenshot({
    path: path.join(SCREENSHOT_DIR, "15-phone-stik1.png"),
  });

  // Wait 1 second for heartbeat to sync to projector setup screen
  await page.waitForTimeout(1000);

  // Scroll to Controller Card to capture it showing ONLINE status
  const controllerCard = page.locator("text=Hubungkan HP Siswa Sebagai Stik Nirkabel");
  await controllerCard.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  console.log("📸 Capturing: 14b-projector-setup-controller-card.png");
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, "14b-projector-setup-controller-card.png"),
  });

  // 3. Launch Big Screen Projector
  console.log("\n🚀 3. Clicking 'Mulai di Proyektor Sekarang'...");
  const launchBtn = page.locator("button:has-text('Mulai di Proyektor Sekarang')");
  await launchBtn.click();
  await page.waitForTimeout(1500);

  // Verify permanent top banner for student controller
  await page.waitForSelector("text=HP SISWA:", { timeout: 10000 });
  console.log("✅ Permanent Top Controller Banner confirmed on live big screen!");

  console.log("📸 Capturing: 16-live-projector-top-banner.png");
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, "16-live-projector-top-banner.png"),
  });

  // 4. Send button input from mobile phone controller
  console.log("\n🎮 4. Pressing Button A on mobile controller...");
  const btnA = mobilePage.locator("section button").first();
  await btnA.click();
  await mobilePage.waitForTimeout(1500);

  // Check projector screen after input
  await page.waitForTimeout(1000);
  console.log("📸 Capturing: 17-projector-after-stik1-answered.png");
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, "17-projector-after-stik1-answered.png"),
  });

  await browser.close();

  if (consoleErrors.length > 0) {
    console.error(`⚠️ Finished with ${consoleErrors.length} browser errors.`);
  } else {
    console.log("\n🎉 ALL TESTS PASSED WITH 0 BROWSER ERRORS!");
  }
}

main().catch(console.error);
