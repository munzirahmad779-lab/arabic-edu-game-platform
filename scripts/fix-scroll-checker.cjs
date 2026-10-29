const fs = require("fs");
const path = require("path");
const p = path.resolve(__dirname, "check-scroll.cjs");
let s = fs.readFileSync(p, "utf8");
const log = [];
const sub = (from, to, label) => {
  const before = s;
  s = s.replace(from, to);
  log.push(`${label}: ${before !== s ? "ok" : "GAGAL"}`);
};

sub(
  `    const h0 = await host.evaluate((el) => ({ sh: el.scrollHeight, ch: el.clientHeight }));`,
  `    const qbox = panel.locator("div.overflow-y-auto").first();
    const qm = await qbox.evaluate((el) => ({ sh: el.scrollHeight, ch: el.clientHeight }));

    const h0 = await host.evaluate((el) => ({ sh: el.scrollHeight, ch: el.clientHeight }));`,
  "qbox",
);

sub(
  `    const panelBox = await panel.boundingBox();`,
  `    // gulir khusus kotak soal
    await qbox.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await page.waitForTimeout(150);
    const qDown = await qbox.evaluate((el) => el.scrollTop);
    await qbox.evaluate((el) => { el.scrollTop = 0; });
    await page.waitForTimeout(200);
    const qUp = await qbox.evaluate((el) => el.scrollTop);
    const qBoxRect = await qbox.boundingBox();
    const spanRect = await span.boundingBox();
    const qTopOk = spanRect.y >= qBoxRect.y - 1.5;

    const panelBox = await panel.boundingBox();`,
  "qbox-scroll",
);

sub(
  `        \` · panel=\${Math.round(panelBox.width)}x\${Math.round(panelBox.height)} · opsi_tampak=\${optionsVisible}\` +`,
  `        \` · panel=\${Math.round(panelBox.width)}x\${Math.round(panelBox.height)} · opsi_tampak=\${optionsVisible}\` +
        \` · kotak_soal \${qm.sh}px/\${qm.ch}px scroll=\${qm.sh > qm.ch + 1} turun=\${Math.round(qDown)} balik=\${Math.round(qUp)} atas_terlihat=\${qTopOk}\` +`,
  "report",
);

fs.writeFileSync(p, s, "utf8");
console.log(log.join("\n"));
