/** Geser blok drag dari feetOf ke dalam loop. */
const fs = require("fs");
const path = require("path");
const file = path.resolve(__dirname, "..", "components", "games", "adu-tarik-dino", "render.ts");
let s = fs.readFileSync(file, "utf8");
const log = [];
const sub = (from, to, label) => {
  const before = s;
  s = s.replace(from, to);
  log.push(`${label}: ${before !== s ? "ok" : "GAGAL"}`);
};

// 1. buang blok drag dari feetOf
sub(
  `    const shift = (shown / view.maxOffset) * (w * 0.18);

    const res = view.result.current;
    if (res && resultStart < 0) resultStart = now;
    if (!res) resultStart = -1;
    const dragP = res ? clamp((now - resultStart) / 1400, 0, 1) : 0;
    dragE = 1 - Math.pow(1 - dragP, 3);
    const dirSign = res === "p1" ? -1 : res === "p2" ? 1 : 0;
    dragP1 = dirSign === 0 ? 0 : dirSign < 0 ? -w * 0.04 * dragE : w * 0.26 * dragE;
    dragP2 = dirSign === 0 ? 0 : dirSign > 0 ? w * 0.04 * dragE : -w * 0.26 * dragE;
    const base = side === "p1" ? w * 0.31 : w * 0.69;`,
  `    const shift = (shown / view.maxOffset) * (w * 0.18);
    const base = side === "p1" ? w * 0.31 : w * 0.69;`,
  "feetOf-clean",
);

// 2. sisipkan blok drag di loop (jangkar unik: cellOf + groundY + shift)
sub(
  `    const cell = cellOf();
    const groundY = h * 0.82;
    const shift = (shown / view.maxOffset) * (w * 0.18);`,
  `    const cell = cellOf();
    const groundY = h * 0.82;
    const shift = (shown / view.maxOffset) * (w * 0.18);

    const res: "p1" | "p2" | "draw" | null = view.result.current;
    if (res && resultStart < 0) resultStart = now;
    if (!res) resultStart = -1;
    const dragP = res ? clamp((now - resultStart) / 1400, 0, 1) : 0;
    dragE = 1 - Math.pow(1 - dragP, 3);
    const dirSign = res === "p1" ? -1 : res === "p2" ? 1 : 0;
    dragP1 = dirSign === 0 ? 0 : dirSign < 0 ? -w * 0.04 * dragE : w * 0.26 * dragE;
    dragP2 = dirSign === 0 ? 0 : dirSign > 0 ? w * 0.04 * dragE : -w * 0.26 * dragE;`,
  "loop-drag",
);

fs.writeFileSync(file, s, "utf8");
console.log(log.join("\n"));
