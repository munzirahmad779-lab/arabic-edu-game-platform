const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const OUT = path.resolve(process.cwd(), "docs", "papaninteraktif-audit");
fs.mkdirSync(OUT, { recursive: true });

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    locale: "id-ID",
    userAgent: UA,
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();

  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200));
  });

  try {
    await page.goto("https://papaninteraktif.com", { waitUntil: "domcontentloaded", timeout: 60000 });
  } catch (e) {
    console.log("goto warning:", e.message.split("\n")[0]);
  }

  // Wait for the SPA to hydrate / load game list.
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(1000);
    const count = await page.locator("a[href]").count().catch(() => 0);
    const hasLoading = await page.locator("text=Memuat Game").count().catch(() => 0);
    if (count > 5 && hasLoading === 0) break;
  }

  await page.screenshot({ path: path.join(OUT, "00-home.png"), fullPage: true }).catch(() => {});

  const collect = async () =>
    page.evaluate(() => {
      const anchors = [...document.querySelectorAll("a[href]")].map((a) => ({
        href: a.getAttribute("href"),
        text: (a.textContent || "").replace(/\s+/g, " ").trim().slice(0, 90),
      }));
      const headings = [...document.querySelectorAll("h1,h2,h3")].map(
        (h) => `${h.tagName}: ${(h.textContent || "").replace(/\s+/g, " ").trim().slice(0, 100)}`,
      );
      return {
        anchors,
        headings,
        canvas: document.querySelectorAll("canvas").length,
        iframes: [...document.querySelectorAll("iframe")].map((f) => f.src),
        bodyText: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 3000),
      };
    });

  const data = await collect();
  const payload = {
    url: page.url(),
    title: await page.title(),
    ...data,
    consoleErrors: consoleErrors.slice(0, 10),
  };
  fs.writeFileSync(path.join(OUT, "00-home.json"), JSON.stringify(payload, null, 2), "utf8");

  console.log("title:", payload.title);
  console.log("anchors:", data.anchors.length, "| canvas:", data.canvas, "| iframes:", data.iframes.length);
  console.log("\n--- anchors ---");
  data.anchors.slice(0, 100).forEach((a) => console.log(`${String(a.href).padEnd(50)} ${a.text}`));
  console.log("\n--- headings ---");
  data.headings.slice(0, 25).forEach((h) => console.log(h));
  console.log("\n--- body text head ---");
  console.log(data.bodyText.slice(0, 1200));

  await browser.close();
})().catch((e) => {
  console.error("DISCOVER ERROR:", e.message);
  process.exit(1);
});
