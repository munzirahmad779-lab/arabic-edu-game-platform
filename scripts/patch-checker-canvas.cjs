const fs = require("fs");
const path = require("path");
const p = path.resolve(__dirname, "check-arena-v5.cjs");
let s = fs.readFileSync(p, "utf8");
const log = [];
const sub = (from, to, label) => {
  const before = s;
  s = s.replace(from, to);
  log.push(`${label}: ${before !== s ? "ok" : "GAGAL"}`);
};

sub(
  'await page.screenshot({ path: `${OUT}/arena-v5-duel.png` });',
  'await page.screenshot({ path: `${OUT}/arena-v5-duel.png` });\n  await page.locator("canvas").screenshot({ path: `${OUT}/arena-v5-duel-canvas.png` });',
  "duel-canvas",
);

sub(
  'await page.screenshot({ path: `${OUT}/arena-v5-win.png` });',
  'await page.screenshot({ path: `${OUT}/arena-v5-win.png` });\n  await page.locator("canvas").screenshot({ path: `${OUT}/arena-v5-win-canvas.png` });',
  "win-canvas",
);

sub(
  'await page.screenshot({ path: `${OUT}/arena-v5-squad.png` });',
  'await page.screenshot({ path: `${OUT}/arena-v5-squad.png` });\n  await page.locator("canvas").screenshot({ path: `${OUT}/arena-v5-squad-canvas.png` });',
  "squad-canvas",
);

fs.writeFileSync(p, s, "utf8");
console.log(log.join("\n"));
