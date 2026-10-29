/** Uji: soal sangat panjang → wadah panel bisa scroll dan kembali ke atas tanpa bug. */
const { chromium } = require("@playwright/test");
const BASE = process.argv[2] || "http://localhost:3000";

const LONG =
  ("Perhatikan dengan saksama penggalan ayat berikut: إِنَّ اللَّهَ مَعَ الَّذِينَ اتَّقَوا وَّالَّذِينَ هُمْ مُحْسِنُونَ. " +
    "Kemudian jelaskan secara rinci mengapa potongan ayat tersebut sering dipakai para guru sebagai pengantar materi tentang keimanan, ketakwaan, dan ihsan. ").repeat(4) +
  "Sebutkan dua contoh perilaku ihsan yang bisa dilakukan siswa di sekolah, di rumah, dan di lingkungan masyarakat.";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 820 } });
  const rows = [];

  await page.goto(`${BASE}/game/adu-tarik-dino/play`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.evaluate((prompt) => {
    const bank = {
      arab: [
        { id: "long-1", subjectId: "arab", prompt, isArabic: false, options: ["Pilihan A", "Pilihan B", "Pilihan C", "Pilihan D"], correct: "Pilihan A" },
      ],
      matematika: [], biologi: [], fisika: [],
    };
    localStorage.setItem("adu-tarik-dino:bank:v1", JSON.stringify(bank));
  }, LONG);

  const start = async (mode) => {
    await page.goto(`${BASE}/game/adu-tarik-dino/play`, { waitUntil: "domcontentloaded", timeout: 180000 });
    await page.waitForTimeout(600);
    await page.getByRole("button", { name: /MULAI BERMAIN/i }).click();
    await page.waitForTimeout(200);
    await page.getByRole("button", { name: new RegExp(mode) }).first().click();
    await page.waitForTimeout(200);
    await page.getByRole("button", { name: /Bahasa Arab/ }).first().click();
    await page.waitForTimeout(5200);
  };

  const audit = async (label) => {
    const canvasBox = await page.locator("canvas").boundingBox();
    const host = page.locator("[data-slots]");
    const panel = page.locator("[data-panel]").first();
    const span = panel.locator("span[dir]").first();

    const qbox = panel.locator("div.overflow-y-auto").first();
    const qm = await qbox.evaluate((el) => ({ sh: el.scrollHeight, ch: el.clientHeight }));

    const h0 = await host.evaluate((el) => ({ sh: el.scrollHeight, ch: el.clientHeight }));
    const scrollable = h0.sh > h0.ch + 1;

    // gulir ke paling bawah, lalu kembali ke atas
    await host.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await page.waitForTimeout(200);
    const down = await host.evaluate((el) => el.scrollTop);
    await host.evaluate((el) => {
      el.scrollTop = 0;
    });
    await page.waitForTimeout(250);
    const up = await host.evaluate((el) => el.scrollTop);

    // gulir khusus kotak soal
    await qbox.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await page.waitForTimeout(150);
    const qDown = await qbox.evaluate((el) => el.scrollTop);
    await qbox.evaluate((el) => { el.scrollTop = 0; });
    await page.waitForTimeout(200);
    const qUp = await qbox.evaluate((el) => el.scrollTop);
    const qBoxRect = await qbox.boundingBox();
    const spanRect = await span.boundingBox();
    const qTopOk = spanRect.y >= qBoxRect.y - 1.5;

    const panelBox = await panel.boundingBox();
    const spanBox = await span.boundingBox();
    const hostBox = await host.boundingBox();
    const topVisible = spanBox.y >= hostBox.y - 1.5;
    const optionsVisible = await panel.locator("button").first().isVisible();

    rows.push(
      `${label}: host ${Math.round(hostBox.width)}x${Math.round(hostBox.height)} isi ${h0.sh}px · bisa_scroll=${scrollable}` +
        ` · turun_ke=${Math.round(down)} · balik_ke=${Math.round(up)} · soal_teratas_terlihat=${topVisible}` +
        ` · panel=${Math.round(panelBox.width)}x${Math.round(panelBox.height)} · opsi_tampak=${optionsVisible}` +
        ` · kotak_soal ${qm.sh}px/${qm.ch}px scroll=${qm.sh > qm.ch + 1} turun=${Math.round(qDown)} balik=${Math.round(qUp)} atas_terlihat=${qTopOk}` +
        ` · canvas=${Math.round(canvasBox.width)}x${Math.round(canvasBox.height)}`,
    );
    await page.screenshot({ path: `docs/papaninteraktif-audit/scroll-${label}.png` });
  };

  await start("SQUAD");
  await audit("bawah-squad");
  await page.locator('button[title^="Ganti tata letak"]').first().click();
  await page.waitForTimeout(900);
  rows.push(`layout setelah tombol = ${await page.locator("[data-slots]").getAttribute("data-layout")}`);
  await audit("samping-squad");

  console.log(rows.join("\n"));
  await browser.close();
})().catch((e) => {
  console.error("ERR:", e.message);
  process.exit(2);
});
