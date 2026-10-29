/** Arena menyesuaikan diri: kalau kanvas sempit (panel di samping), karakter dibesarkan. */
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
  "  const cellOf = () => Math.min(h * 0.68, w * 0.27);",
  "  const isNarrow = () => w > 0 && h > 0 && w / h < 1.35;\n  const cellOf = () => (isNarrow() ? Math.min(h * 0.74, w * 0.44) : Math.min(h * 0.68, w * 0.27));",
  "cell-narrow",
);

sub(
  '    const base = side === "p1" ? w * 0.31 : w * 0.69;',
  "    const spread = isNarrow() ? 0.27 : 0.31;\n    const base = side === \"p1\" ? w * spread : w * (1 - spread);",
  "spread-narrow",
);

fs.writeFileSync(p, s, "utf8");
console.log(log.join("\n"));
