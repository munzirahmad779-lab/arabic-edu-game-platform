const fs = require("fs");
const path = require("path");
const p = path.resolve(__dirname, "..", "components", "games", "adu-tarik-dino", "Game.tsx");
let s = fs.readFileSync(p, "utf8");
const before = s;
s = s.replace(
  '"max-h-[46vh] overflow-y-auto border-t "',
  '"max-h-[52vh] overflow-y-auto border-t lg:max-h-[46vh] "',
);
fs.writeFileSync(p, s, "utf8");
console.log("host max-h:", before !== s);
const m = s.match(/max-h-\[5?\d*vh\][^"]*/);
console.log("sekarang:", m && m[0]);
