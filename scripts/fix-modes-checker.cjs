const fs = require("fs");
const path = require("path");
const p = path.resolve(__dirname, "check-layout-modes.cjs");
let s = fs.readFileSync(p, "utf8");
const log = [];
const sub = (from, to, label) => {
  const before = s;
  s = s.replace(from, to);
  log.push(`${label}: ${before !== s ? "ok" : "GAGAL"}`);
};

sub(
  `    await measure("lebar");
    await page.getByRole("button", { name: /PANEL SEDANG/ }).first().click();
    await page.waitForTimeout(900);
    await measure("sedang");
    await page.getByRole("button", { name: /PANEL BAWAH/ }).first().click();
    await page.waitForTimeout(900);
    await measure("bawah");`,
  `    const toggle = page.locator('button[title^="Ganti tata letak"]');
    for (let i = 0; i < 3; i++) {
      const lay = await page.locator("[data-slots]").getAttribute("data-layout");
      await measure(lay ?? "mode" + i);
      await toggle.first().click();
      await page.waitForTimeout(900);
    }`,
  "cycle",
);

sub(
  `      out.push(
        \`\${vp.tag} \${label.padEnd(9)}`,
  `      out.push(
        \`\${vp.tag} \${String(label).padEnd(9)}`,
  "label",
);

fs.writeFileSync(p, s, "utf8");
console.log(log.join("\n"));
