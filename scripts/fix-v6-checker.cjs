const fs = require("fs");
const path = require("path");
const p = path.resolve(__dirname, "check-v6-features.cjs");
let s = fs.readFileSync(p, "utf8");
const before = s;

s = s.split('page.getByRole("button", { name: /\u{1F4DD}/ }).first()').join('page.getByRole("button", { name: /BANK SOAL/i }).first()');
s = s.replace(
  'const p = await page.locator("[data-panel]").first().locator("span").nth(1).innerText().catch(() => "");',
  'const p = await page.locator("[data-panel]").first().locator("span[dir]").first().innerText().catch(() => "");',
);

fs.writeFileSync(p, s, "utf8");
console.log("BANK SOAL selector:", s.includes("BANK SOAL"));
console.log("prompt selector:", s.includes('locator("span[dir]")'));
console.log("changed:", before !== s);
