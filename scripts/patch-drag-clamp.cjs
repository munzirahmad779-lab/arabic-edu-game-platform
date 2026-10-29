/** Saat arena sempit, tarikan penutup jangan sampai membuat tali terbalik. */
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
  `    dragP1 = dirSign === 0 ? 0 : (dirSign < 0 ? -w * 0.02 : w * 0.1) * dragE;
    dragP2 = dirSign === 0 ? 0 : (dirSign < 0 ? -w * 0.1 : w * 0.02) * dragE;`,
  `    const loserDrag = isNarrow() ? 0.05 : 0.1;
    dragP1 = dirSign === 0 ? 0 : (dirSign < 0 ? -w * 0.02 : w * loserDrag) * dragE;
    dragP2 = dirSign === 0 ? 0 : (dirSign < 0 ? -w * loserDrag : w * 0.02) * dragE;`,
  "drag-narrow",
);

sub(
  `    // diagnostik: posisi ujung tali (untuk uji kesejajaran)`,
  `    // jaga tali tidak terbalik walau yang kalah terseret jauh
    const minGap = Math.max(26, cell * 0.12);
    if (x1 - x0 < minGap) x1 = x0 + minGap;

    // diagnostik: posisi ujung tali (untuk uji kesejajaran)`,
  "min-gap",
);

fs.writeFileSync(p, s, "utf8");
console.log(log.join("\n"));
