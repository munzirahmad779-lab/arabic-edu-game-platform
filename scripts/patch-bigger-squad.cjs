/** Perbesar karakter kedua tiap sisi (Anoa & Yaki) sedikit. */
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

sub(
  "const scale = i === 0 ? cell : cell * 0.9;",
  "const scale = i === 0 ? cell : cell * 1.07;",
  "skala-karakter-belakang",
);

sub(
  "return { x: base + shift + dir * index * cell * 0.44, y: h * 0.82 };",
  "return { x: base + shift + dir * index * cell * 0.54, y: h * 0.82 };",
  "jarak-squad",
);

fs.writeFileSync(file, s, "utf8");
console.log(log.join("\n"));
