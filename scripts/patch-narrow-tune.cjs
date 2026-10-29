/** Arena sempit: karakter sedikit lebih besar + tali lebih panjang (±110px). */
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
  "const cellOf = () => (isNarrow() ? Math.min(h * 0.74, w * 0.44) : Math.min(h * 0.68, w * 0.27));",
  "const cellOf = () => (isNarrow() ? Math.min(h * 0.74, w * 0.46) : Math.min(h * 0.68, w * 0.27));",
  "cell-naik",
);

sub(
  'const spread = isNarrow() ? 0.27 : 0.31;',
  'const spread = isNarrow() ? 0.24 : 0.31;',
  "spread-turun",
);

fs.writeFileSync(p, s, "utf8");
console.log(log.join("\n"));
