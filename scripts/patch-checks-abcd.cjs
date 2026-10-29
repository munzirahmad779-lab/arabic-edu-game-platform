/**
 * Opsi jawaban sekarang punya chip "A/B/C/D" di dalam tombol,
 * jadi selector exact-name tidak lagi cocok. Ganti ke regex.
 */
const fs = require("fs");
const path = require("path");
const dir = path.resolve(__dirname);

const adu = path.join(dir, "check-adu-tarik.cjs");
let s = fs.readFileSync(adu, "utf8");
const log = [];
const sub = (from, to, label) => {
  const before = s;
  s = s.replace(from, to);
  log.push(`${label}: ${before !== s ? "ok" : "GAGAL"}`);
};

sub(
  'await page.getByRole("button", { name: "Mubtada\'", exact: true }).first().click();',
  'await page.getByRole("button", { name: /Mubtada/ }).first().click();',
  "click-benar",
);
sub(
  'await page.getByRole("button", { name: "Fa\'il", exact: true }).first().click();',
  'await page.getByRole("button", { name: /Fa\'il/ }).first().click();',
  "click-salah",
);
sub(
  ': page.getByRole("button", { name: target, exact: true }).first();',
  ": page.getByRole(\"button\", { name: new RegExp(target.replace(/[.*+?^${}()|[\\\\]\\\\\\\\]/g, \"\\\\$&\")) }).first();",
  "loop-selector",
);
fs.writeFileSync(adu, s, "utf8");

const squad = path.join(dir, "check-squad.cjs");
let q = fs.readFileSync(squad, "utf8");
const beforeQ = q;
q = q.replace('await page.getByRole("button", { name: "Ribosom", exact: true }).first().click();', 'await page.getByRole("button", { name: /Ribosom/ }).first().click();');
log.push(`squad-click: ${beforeQ !== q ? "ok" : "GAGAL"}`);
fs.writeFileSync(squad, q, "utf8");

console.log(log.join("\n"));
