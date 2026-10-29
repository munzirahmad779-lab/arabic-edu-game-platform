/** Perbaikan tarikan saat menang: pemenang mundur, yang kalah terseret, tali tidak terbalik. */
const fs = require("fs");
const path = require("path");
const p = path.resolve(__dirname, "..", "components", "games", "adu-tarik-dino", "render.ts");
let s = fs.readFileSync(p, "utf8");
const log = [];
const sub = (from, to, label) => {
  const before = s;
  s = s.replace(from, to);
  log.push(`${label}: ${before !== s ? "ok" : "GAGAL"}`);
};

sub(
  `    dragP1 = dirSign === 0 ? 0 : dirSign < 0 ? -w * 0.04 * dragE : w * 0.26 * dragE;
    dragP2 = dirSign === 0 ? 0 : dirSign > 0 ? w * 0.04 * dragE : -w * 0.26 * dragE;`,
  `    dragP1 = dirSign === 0 ? 0 : (dirSign < 0 ? -w * 0.02 : w * 0.1) * dragE;
    dragP2 = dirSign === 0 ? 0 : (dirSign < 0 ? -w * 0.1 : w * 0.02) * dragE;`,
  "drag-arah",
);

sub(
  "const dragLean = (isLoser ? (res === \"p1\" ? -1 : 1) * 0.26 : 0) + (isWinner ? (res === \"p1\" ? 1 : -1) * 0.1 : 0);",
  "const dragLean = (isLoser ? (res === \"p1\" ? -1 : 1) * 0.34 : 0) + (isWinner ? (res === \"p1\" ? 1 : -1) * 0.1 : 0);",
  "drag-lean-besar",
);

fs.writeFileSync(p, s, "utf8");
console.log(log.join("\n"));
