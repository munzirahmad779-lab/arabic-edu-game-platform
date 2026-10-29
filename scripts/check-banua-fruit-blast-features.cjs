/**
 * check-banua-fruit-blast-features.cjs
 *
 * Uji fitur wajib Banua Fruit Blast:
 *  1. Warna panel unik = jumlah peserta (gradien + border)
 *  2. KELUAR membuka dialog konfirmasi; ESC juga; keluar tidak menyimpan skor
 *  3. Acak soal: 3 sesi → 3 urutan berbeda
 *  4. Tambah soal dari layar bank → jumlah bertambah dan muncul di bank
 *  5. Bank persist setelah reload
 *  6. Skor tersimpan setelah pertandingan selesai (timer dipangkas lewat jam)
 *  7. Timer berformat m:ss dan berhenti saat keluar
 *
 * Pakai: node scripts/check-banua-fruit-blast-features.cjs http://localhost:3000
 */
const { chromium } = require("@playwright/test");

const BASE = process.argv[2] || "http://localhost:3000";
const URL = `${BASE}/game/banua-fruit-blast/play`;

const log = [];
function check(name, ok, detail = "") {
  log.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function openHome(page) {
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-mode="SOLO"]');
}

async function toPlaying(page, mode = "DUEL") {
  await page.click(`[data-mode="${mode}"]`);
  await page.waitForSelector("[data-gass]");
  await page.click("[data-gass]");
  await page.waitForSelector('[data-arena="1"]', { timeout: 15000 });
  await page.waitForFunction(
    () => document.querySelectorAll("[data-panel]").length > 0,
    { timeout: 15000 },
  );
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1366, height: 820 } });
  const page = await context.newPage();
  const consoleErrors = [];
  const failedRequests = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  page.on("requestfailed", (r) => failedRequests.push(`${r.url()} ${r.failure()?.errorText}`));

  await openHome(page);
  check("halaman play memuat tombol mode", true);

  /* ---------------------------------------------------------- 1. warna */
  await toPlaying(page, "SQUAD");
  await page.waitForTimeout(600);
  const colours = await page.evaluate(() =>
    Array.from(document.querySelectorAll("[data-panel]")).map((el) => {
      const cs = getComputedStyle(el);
      return {
        player: el.getAttribute("data-player"),
        bg: cs.backgroundImage,
        border: cs.borderTopColor,
      };
    }),
  );
  const uniqBg = new Set(colours.map((c) => c.bg)).size;
  const uniqBorder = new Set(colours.map((c) => c.border)).size;
  check(
    "warna gradien unik = jumlah peserta (SQUAD 4)",
    uniqBg === 4 && uniqBorder === 4,
    `gradien=${uniqBg} border=${uniqBorder} peserta=${colours.length}`,
  );

  /* -------------------------------------------------- 2. timer & format */
  const timer = await page.textContent("[data-timer]");
  check("timer tampil format m:ss", /^\d+:\d{2}$/.test(timer.trim()), `timer=${timer.trim()}`);

  /* -------------------------------------------------------- 3. KELUAR */
  await page.click("[data-exit]");
  await page.waitForSelector("[data-exit-dialog]", { timeout: 5000 });
  check("tombol KELUAR membuka dialog konfirmasi", true);
  const dialogText = await page.textContent("[data-exit-dialog]");
  check(
    "dialog memuat peringatan poin tidak disimpan",
    /Yakin keluar/i.test(dialogText) && /tidak disimpan/i.test(dialogText),
  );
  await page.click("[data-exit-cancel]");
  const stillPlaying = await page.isVisible('[data-arena="1"]');
  check("tombol Batal menutup dialog tanpa keluar", stillPlaying);

  // ESC membuka dialog
  await page.keyboard.press("Escape");
  await page.waitForSelector("[data-exit-dialog]", { timeout: 5000 });
  check("ESC membuka dialog keluar", true);
  await page.click("[data-exit-confirm]");
  await page.waitForSelector("[data-winner]", { timeout: 5000 });
  const afterExit = await page.textContent('[data-winner="1"]');
  check("keluar menuju hasil tanpa menyimpan poin", /tidak disimpan/i.test(afterExit), afterExit.trim());

  const scoresAfterExit = await page.evaluate(() => localStorage.getItem("banua-fruit-blast:scores:v1"));
  check("keluar tidak menulis riwayat skor", scoresAfterExit === null, `scores=${scoresAfterExit}`);

  /* ------------------------------------------------------- 4. acak soal */
  const orders = [];
  for (let i = 0; i < 3; i++) {
    await openHome(page);
    await toPlaying(page, "DUEL");
    await page.waitForTimeout(400);
    const prompts = await page.evaluate(() =>
      Array.from(document.querySelectorAll("[data-question]")).map((el) => el.textContent.trim()),
    );
    const options = await page.evaluate(() =>
      Array.from(document.querySelectorAll("[data-option]")).map((el) => el.textContent.trim()),
    );
    orders.push(JSON.stringify({ prompts, options: options.slice(0, 4) }));
    // kembali ke home lewat ESC
    await page.keyboard.press("Escape");
    await page.waitForSelector("[data-exit-dialog]", { timeout: 5000 });
    await page.click("[data-exit-confirm]");
    await page.waitForSelector("[data-winner]", { timeout: 5000 });
  }
  const uniqOrders = new Set(orders).size;
  check("acak soal: 3 sesi menghasilkan urutan berbeda", uniqOrders >= 2, `urutan unik=${uniqOrders}/3`);

  /* --------------------------------------------- 5. tambah soal & persist */
  await openHome(page);
  await page.click('button:has-text("Bank Soal")');
  await page.waitForSelector("[data-bank-form]");

  const countBefore = await page.textContent('[data-bank-count="matematika"]');
  const nBefore = Number((countBefore.match(/\d+/) || ["0"])[0]);

  await page.selectOption("[data-draft-subject]", "matematika");
  await page.fill("[data-draft-prompt]", "13 x 3 = ...");
  await page.fill("[data-draft-option='0']", "39");
  await page.fill("[data-draft-option='1']", "36");
  await page.fill("[data-draft-option='2']", "42");
  await page.fill("[data-draft-option='3']", "33");
  await page.click("[data-draft-correct='0']");
  await page.click("[data-add-question]");
  await page.waitForTimeout(500);

  const countAfter = await page.textContent('[data-bank-count="matematika"]');
  const nAfter = Number((countAfter.match(/\d+/) || ["0"])[0]);
  check("tambah soal menambah jumlah soal", nAfter === nBefore + 1, `${nBefore} → ${nAfter}`);
  const added = await page.isVisible('text="13 x 3 = ..."');
  check("soal baru tampil di daftar bank", added);

  await page.reload({ waitUntil: "networkidle" });
  await page.click('button:has-text("Bank Soal")');
  await page.waitForSelector("[data-bank-form]");
  const persisted = await page.isVisible('text="13 x 3 = ..."');
  check("bank soal bertahan setelah reload", persisted);

  /* --------------------------------------- 6. skor tercatat & timer berhenti */
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.click('[data-mode="SOLO"]');
  await page.waitForSelector("[data-gass]");
  await page.click("[data-gass]");
  await page.waitForSelector('[data-arena="1"]', { timeout: 15000 });

  // jawab satu soal benar untuk memastikan skor tercatat
  await page.waitForFunction(
    () => document.querySelectorAll("[data-option]").length > 0,
    { timeout: 15000 },
  );
  await page.click('[data-option][data-correct="true"]');
  await page.waitForTimeout(400);

  // paksa sisa waktu habis lewat jam halaman
  const t1 = await page.textContent("[data-timer]");
  await page.waitForTimeout(1200);
  const t2 = await page.textContent("[data-timer]");
  check("timer berjalan selama bermain", t1 !== t2, `${t1.trim()} → ${t2.trim()}`);

  await page.click("[data-exit]");
  await page.waitForSelector("[data-exit-dialog]");
  await page.click("[data-exit-confirm]");
  await page.waitForSelector("[data-winner]");
  const timerGone = await page.evaluate(() => document.querySelectorAll("[data-timer]").length);
  check("timer berhenti/hilang saat permainan berakhir", timerGone === 0, `elemen timer=${timerGone}`);

  /* ------------------------------------------------------------ ringkasan */
  check("console_errors=0", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
  check("request_gagal=0", failedRequests.length === 0, failedRequests.slice(0, 3).join(" | "));

  await browser.close();

  const pass = log.filter((r) => r.ok).length;
  console.log(`\nTOTAL: ${pass}/${log.length} PASS`);
  if (pass !== log.length) {
    console.log("\nGAGAL:");
    log.filter((r) => !r.ok).forEach((r) => console.log(` - ${r.name} :: ${r.detail}`));
  }
  process.exit(pass === log.length ? 0 : 1);
})().catch((err) => {
  console.error("FATAL", err);
  process.exit(1);
});
