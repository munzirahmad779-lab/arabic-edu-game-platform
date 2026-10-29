const { chromium } = require("@playwright/test");

const BASE = process.argv[2] || "http://127.0.0.1:3000";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 160)}`);
  });

  await page.goto(`${BASE}/lab/motion`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(2500);

  const canvases = await page.locator("canvas").count();
  console.log(`canvases=${canvases}`);

  const boxes = [];
  for (let i = 0; i < canvases; i++) {
    const b = await page.locator("canvas").nth(i).boundingBox();
    boxes.push(b);
  }
  console.log(`boxes=${JSON.stringify(boxes.map((b) => (b ? [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)] : null)))}`);

  // 1) mancing: klik untuk lempar kail
  if (boxes[0]) {
    const b = boxes[0];
    await page.mouse.click(b.x + b.width * 0.5, b.y + b.height * 0.7);
    await page.waitForTimeout(900);
    await page.screenshot({ path: "docs/papaninteraktif-audit/lab-1-mancing.png", clip: b });
  }

  // 2) domino: klik untuk push
  if (boxes[1]) {
    const b = boxes[1];
    await page.mouse.click(b.x + b.width * 0.2, b.y + b.height * 0.6);
    await page.waitForTimeout(1600);
    await page.screenshot({ path: "docs/papaninteraktif-audit/lab-2-domino.png", clip: b });
  }

  // 3) spotlight: gerak + klik
  if (boxes[2]) {
    const b = boxes[2];
    await page.mouse.move(b.x + b.width * 0.4, b.y + b.height * 0.5);
    await page.waitForTimeout(400);
    await page.mouse.click(b.x + b.width * 0.4, b.y + b.height * 0.5);
    await page.waitForTimeout(700);
    await page.screenshot({ path: "docs/papaninteraktif-audit/lab-3-spotlight.png", clip: b });
  }

  console.log(`errors=${errors.length}`);
  errors.slice(0, 5).forEach((e) => console.log("  ", e));
  await browser.close();
  process.exit(errors.length === 0 && canvases === 3 ? 0 : 1);
})().catch((e) => {
  console.error("CHECK ERROR:", e.message);
  process.exit(2);
});
