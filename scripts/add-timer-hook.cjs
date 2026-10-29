/** Tandai elemen timer agar bisa diukur titik tengahnya. */
const fs = require("fs");
const path = require("path");
const p = path.resolve(__dirname, "..", "components", "games", "adu-tarik-dino", "Game.tsx");
let s = fs.readFileSync(p, "utf8");
const before = s;
s = s.replace(
  '<span className="text-2xl font-black leading-none tabular-nums sm:text-3xl">{fmtTimer(timeLeft)}</span>',
  '<span data-timer className="text-2xl font-black leading-none tabular-nums sm:text-3xl">{fmtTimer(timeLeft)}</span>',
);
console.log("data-timer:", before !== s ? "ok" : "GAGAL");
fs.writeFileSync(p, s, "utf8");
