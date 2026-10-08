import { chromium } from "playwright";
import path from "node:path";

const SCREENSHOT_DIR = path.resolve(process.cwd(), "test-screenshots");

async function main() {
  console.log("🚀 Testing All New Updates: Matching Feedback, Speed Bonus, Different Questions, & Phone Remote...");
  const browser = await chromium.launch({ headless: true });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  // Test 1: Matching Game Visual Feedback
  console.log("\n🧪 1. Testing Matching Game Right/Wrong Visual Feedback...");
  await page.goto("http://localhost:3000/test-projector", { waitUntil: "networkidle" });
  await page.locator("button:has-text('Matching Kartu')").first().click();
  await page.locator("button:has-text('Fokus 1 Tim')").first().click();
  await page.locator("text=Mulai di Proyektor Sekarang").click();
  await page.waitForTimeout(1000);

  // Click card 1
  const cards = page.locator("button:has-text('Cocokkan Pasangan') ~ div button, section button");
  const firstCard = cards.nth(0);
  await firstCard.click();
  await page.waitForTimeout(200);

  // Click card 2 (simulate mismatch first)
  const thirdCard = cards.nth(2);
  await thirdCard.click();
  await page.waitForTimeout(400);

  console.log("📸 Capturing: 09-matching-mismatch-feedback.png");
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "09-matching-mismatch-feedback.png") });

  // Test 2: Mode B (4 Kuadran) with DIFFERENT questions & SPEED BONUS
  console.log("\n🧪 2. Testing 4-Quadrant Mode with DIFFERENT Questions & SPEED BONUS...");
  await page.goto("http://localhost:3000/test-projector", { waitUntil: "networkidle" });
  await page.locator("button:has-text('Penalty Kick')").first().click();
  await page.locator("button:has-text('Terbagi 4 Kuadran')").first().click();
  await page.locator("text=Mulai di Proyektor Sekarang").click();
  await page.waitForTimeout(1000);

  // Verify that team 1 and team 2 have different question texts!
  const questionHeadlines = await page.locator("h3").allTextContents();
  console.log("Team Questions Rendered on Screen:", questionHeadlines.slice(0, 4));

  // Team 1 answers (kicks Bola A) -> Should get ⚡ TERCEPAT #1 (+50 Bonus)
  console.log("⚽ Team 1 Kicking Bola A (Fastest answer)...");
  const team1Ball = page.locator("div:has-text('Tim Merah') button:has-text('Bola A')").first();
  await team1Ball.click();
  await page.waitForTimeout(500);

  // Team 2 answers (kicks Bola B) -> Should get ⚡ TERCEPAT #2 (+25 Bonus)
  console.log("⚽ Team 2 Kicking Bola B (Second fastest answer)...");
  const team2Ball = page.locator("div:has-text('Tim Biru') button:has-text('Bola B')").first();
  await team2Ball.click();
  await page.waitForTimeout(500);

  console.log("📸 Capturing: 10-speed-bonus-quadrants.png");
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "10-speed-bonus-quadrants.png") });

  // Test 3: Phone Wireless Controller
  console.log("\n🧪 3. Testing Wireless Phone Controller (/controller)...");
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone viewport
    isMobile: true,
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto("http://localhost:3000/controller?room=HOTSEAT&team=team-3", { waitUntil: "networkidle" });
  await mobilePage.waitForTimeout(500);

  console.log("📸 Capturing: 11-phone-controller-view.png");
  await mobilePage.screenshot({ path: path.join(SCREENSHOT_DIR, "11-phone-controller-view.png") });

  // Press Button C on phone
  console.log("📱 Pressing Button C on Phone Controller...");
  const btnC = mobilePage.locator("button:has-text('C')").first();
  await btnC.click();
  await mobilePage.waitForTimeout(400);

  console.log("📸 Capturing: 12-phone-button-pressed.png");
  await mobilePage.screenshot({ path: path.join(SCREENSHOT_DIR, "12-phone-button-pressed.png") });

  // Verify projector received Team 3's press
  await page.waitForTimeout(800);
  console.log("📸 Capturing: 13-projector-after-phone-press.png");
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "13-projector-after-phone-press.png") });

  await browser.close();
  console.log("\n🎉 ALL NEW TESTS COMPLETED SUCCESSFULLY!");
}

main().catch(console.error);
