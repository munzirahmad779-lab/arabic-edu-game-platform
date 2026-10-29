/** Uji fitur baru: warna per karakter, tombol keluar, acak soal, tambah soal. */
const { chromium } = require("@playwright/test");
const BASE = process.argv[2] || "http://localhost:3000";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const results = [];
  const ok = (name, cond, detail = "") => {
    results.push(`${cond ? "PASS" : "GAGAL"}  ${name}${detail ? " — " + detail : ""}`);
    return cond;
  };

  // ---------- 1. warna per karakter ----------
  await page.goto(`${BASE}/game/adu-tarik-dino/play`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: /MULAI BERMAIN/i }).click();
  await page.waitForTimeout(250);
  await page.getByRole("button", { name: /SQUAD/ }).first().click();
  await page.waitForTimeout(250);
  await page.getByRole("button", { name: /Bahasa Arab/ }).first().click();
  await page.waitForTimeout(5000);

  const panels = page.locator("[data-panel]");
  const n = await panels.count();
  const styles = [];
  const chips = [];
  for (let i = 0; i < n; i++) {
    const ch = await panels.nth(i).getAttribute("data-char");
    const bg = await panels.nth(i).evaluate((el) => getComputedStyle(el).backgroundImage);
    const chipText = await panels.nth(i).locator("span").first().innerText();
    styles.push({ ch, bg });
    chips.push(chipText.replace(/\n/g, " "));
  }
  const uniq = new Set(styles.map((s) => s.bg));
  ok("4 panel punya warna latar berbeda", uniq.size === 4, `warna unik=${uniq.size} dari ${styles.length}`);
  console.log("   panel:", styles.map((s) => s.ch).join(", "));
  console.log("   label:", chips.join(" | "));

  // ---------- 2. tombol keluar ----------
  const quitVisible = await page.getByRole("button", { name: /KELUAR/i }).first().isVisible().catch(() => false);
  ok("tombol KELUAR ada di header", quitVisible);
  if (quitVisible) {
    await page.getByRole("button", { name: /KELUAR/i }).first().click();
    await page.waitForTimeout(400);
    const modal = await page.getByText(/Akhiri pertandingan\?/i).isVisible().catch(() => false);
    ok("dialog konfirmasi muncul", modal);
    await page.screenshot({ path: "docs/papaninteraktif-audit/adu-tarik-quit-dialog.png" });
    await page.getByRole("button", { name: /Ya, akhiri/i }).click();
    await page.waitForTimeout(900);
    const ended = await page.getByText(/PERMAINAN DIAKHIRI/i).isVisible().catch(() => false);
    ok("permainan diakhiri tanpa mencatat skor", ended);
  }

  // ---------- 3. acak soal ----------
  const firstPrompts = [];
  for (let round = 0; round < 3; round++) {
    await page.goto(`${BASE}/game/adu-tarik-dino/play`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(600);
    await page.getByRole("button", { name: /MULAI BERMAIN/i }).click();
    await page.waitForTimeout(200);
    await page.getByRole("button", { name: /DUEL/ }).first().click();
    await page.waitForTimeout(200);
    await page.getByRole("button", { name: /Matematika/ }).first().click();
    await page.waitForTimeout(4600);
    const p = await page.locator("[data-panel]").first().locator("span[dir]").first().innerText().catch(() => "");
    firstPrompts.push(p.slice(0, 40));
    await page.screenshot({ path: `docs/papaninteraktif-audit/adu-tarik-shuffle-${round + 1}.png` });
  }
  const distinct = new Set(firstPrompts).size;
  ok("acak soal menghasilkan urutan berbeda", distinct > 1, `${distinct} urutan berbeda dari 3 sesi`);
  console.log("   soal pertama:", firstPrompts.map((p) => p.slice(0, 30)).join(" || "));

  // ---------- 4. tambah soal ----------
  await page.goto(`${BASE}/game/adu-tarik-dino/play`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /BANK SOAL/i }).first().click();
  await page.waitForTimeout(500);
  const before = await page.evaluate(() => document.querySelectorAll("[data-panel]").length);
  const listBefore = await page.locator("div.space-y-2 > div").count();
  await page.locator("textarea").first().fill("Soal uji otomatis: ibu kota Indonesia adalah?");
  const inputs = page.locator("input[placeholder^='Pilihan']");
  await inputs.nth(0).fill("Jakarta");
  await inputs.nth(1).fill("Bandung");
  await inputs.nth(2).fill("Surabaya");
  await inputs.nth(3).fill("Medan");
  await page.locator("select").first().selectOption({ label: "Jakarta" });
  await page.getByRole("button", { name: /\+\s*Tambah soal/i }).click();
  await page.waitForTimeout(600);
  const listAfter = await page.locator("div.space-y-2 > div").count();
  ok("soal baru masuk daftar", listAfter === listBefore + 1, `${listBefore} → ${listAfter}`);
  const stored = await page.evaluate(() => localStorage.getItem("adu-tarik-dino:bank:v1"));
  ok("bank tersimpan di localStorage", !!stored && stored.includes("ibu kota Indonesia"), `bytes=${stored ? stored.length : 0}`);
  await page.screenshot({ path: "docs/papaninteraktif-audit/adu-tarik-bank-soal.png" });

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: /BANK SOAL/i }).first().click();
  await page.waitForTimeout(500);
  const persist = await page.getByText(/ibu kota Indonesia/i).first().isVisible().catch(() => false);
  ok("soal tetap ada setelah reload", persist);

  console.log("\n=== RINGKASAN ===");
  results.forEach((r) => console.log(r));
  const failed = results.filter((r) => r.startsWith("GAGAL")).length;
  console.log(`TOTAL=${results.length} GAGAL=${failed}`);
  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error("ERR:", e.message);
  process.exit(2);
});
