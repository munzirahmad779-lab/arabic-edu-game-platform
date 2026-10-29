/**
 * check-banua-fruit-blast-score.cjs
 *
 * Menjalankan satu pertandingan SOLO sampai waktu benar-benar habis (03:00)
 * untuk membuktikan pencatatan skor otomatis, lalu memeriksa:
 *  - layar hasil muncul otomatis dengan alasan "Waktu Habis"
 *  - localStorage `banua-fruit-blast:scores:v1` berisi 1 catatan
 *  - layar Skor menampilkan catatan tersebut
 *  - tombol Ekspor CSV aktif
 *  - batas 50 catatan dihormati (RULES.maxScoreRecords)
 *
 * Pakai: node scripts/check-banua-fruit-blast-score.cjs http://localhost:3000
 */
const { chromium } = require("@playwright/test");

const BASE = process.argv[2] || "http://localhost:3000";
const URL = `${BASE}/game/banua-fruit-blast/play`;
const KEY = "banua-fruit-blast:scores:v1";

const log = [];
function check(name, ok, detail = "") {
  log.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 820 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(URL, { waitUntil: "networkidle" });
  await page.evaluate((k) => localStorage.removeItem(k), KEY);

  await page.click('[data-mode="SOLO"]');
  await page.waitForSelector("[data-gass]");
  await page.click("[data-gass]");
  await page.waitForSelector('[data-arena="1"]', { timeout: 15000 });

  // main: jawab benar beberapa kali supaya skor > 0
  let answered = 0;
  const deadline = Date.now() + 178000;
  while (Date.now() < deadline) {
    const alive = await page.evaluate(() => document.querySelectorAll("[data-arena]").length > 0);
    if (!alive) break;
    try {
      const btn = await page.$('[data-option][data-correct="true"]');
      if (btn) {
        await btn.click({ timeout: 1500 });
        answered++;
      }
    } catch {
      /* tombol berganti saat soal berubah */
    }
    await page.waitForTimeout(700);
  }

  await page.waitForSelector("[data-winner]", { timeout: 20000 });
  const winnerText = await page.textContent('[data-winner="1"]');
  check("pertandingan berakhir otomatis saat waktu habis", /Pemenang/i.test(winnerText), winnerText.trim());
  check("soal berhasil dijawab selama uji", answered >= 3, `${answered} jawaban`);

  const stored = await page.evaluate((k) => {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : null;
  }, KEY);

  check("skor otomatis tersimpan setelah waktu habis", Array.isArray(stored) && stored.length === 1,
    `records=${Array.isArray(stored) ? stored.length : "null"}`);
  if (Array.isArray(stored) && stored[0]) {
    const r = stored[0];
    check("catatan memuat mode/subjek/pemenang/peserta", Boolean(r.mode && r.subject && r.winner && r.players?.length),
      `${r.mode}/${r.subject}/${r.winner}/${r.players?.length}p`);
    check("skor pemenang > 0 karena menjawab benar", Number(r.players?.[0]?.score) > 0,
      `score=${r.players?.[0]?.score}`);
  }

  // layar skor menampilkan catatan
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.click('button:has-text("Skor")');
  await page.waitForSelector("[data-score-list]", { timeout: 5000 });
  const rows = await page.evaluate(() => document.querySelectorAll("[data-score-row]").length);
  check("layar Skor menampilkan 1 catatan", rows === 1, `baris=${rows}`);

  const csvEnabled = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) =>
      /Ekspor CSV/i.test(b.textContent || ""),
    );
    return btn ? !btn.disabled : null;
  });
  check("tombol Ekspor CSV aktif", csvEnabled === true, `aktif=${csvEnabled}`);

  // batas 50 catatan
  const capped = await page.evaluate((k) => {
    const now = Date.now();
    const many = Array.from({ length: 60 }, (_, i) => ({
      id: `seed-${i}`,
      timestamp: now - i * 1000,
      mode: "SOLO",
      subject: "matematika",
      reason: "timeup",
      winner: "Anoa",
      players: [{ name: "Anoa", sprite: "anoa", score: i, correct: 0, wrong: 0 }],
    }));
    localStorage.setItem(k, JSON.stringify(many));
    return many.length;
  }, KEY);
  check("menyiapkan 60 catatan untuk uji batas", capped === 60);

  // muat ulang: aplikasi harus memangkas ke 50
  await page.reload({ waitUntil: "networkidle" });
  const trimmed = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "[]").length, KEY);
  check("batas maksimum 50 catatan dihormati", trimmed <= 50, `tersimpan=${trimmed}`);

  check("console_errors=0", errors.length === 0, errors.slice(0, 3).join(" | "));

  await browser.close();
  const pass = log.filter((r) => r.ok).length;
  console.log(`\nTOTAL: ${pass}/${log.length} PASS`);
  if (pass !== log.length) log.filter((r) => !r.ok).forEach((r) => console.log(` - ${r.name} :: ${r.detail}`));
  process.exit(pass === log.length ? 0 : 1);
})().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
