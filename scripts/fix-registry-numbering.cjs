const fs = require("fs");
const path = require("path");
const p = path.resolve(__dirname, "extract-game-registry.cjs");
let s = fs.readFileSync(p, "utf8");
const log = [];
const sub = (from, to, label) => {
  const before = s;
  s = s.replace(from, to);
  log.push(`${label}: ${before !== s ? "ok" : "GAGAL"}`);
};

sub(
  `const DONE = {
  "adu-tarik-dino": { no: 1, status: "selesai", folder: "components/games/adu-tarik-dino" },
  "souq-fishing": { no: 2, status: "selesai", folder: "src/modules/souq-fishing" },
};`,
  `// 34 game referensi papaninteraktif.com. souq-fishing adalah game internal
// (tidak termasuk daftar referensi) dan sudah selesai — dicatat terpisah.
const DONE = {
  "adu-tarik-dino": { no: 1, status: "selesai", folder: "components/games/adu-tarik-dino" },
};`,
  "done-map",
);

sub("let nextNo = 3;", "let nextNo = 2;", "next-no");

fs.writeFileSync(p, s, "utf8");
console.log(log.join("\n"));
