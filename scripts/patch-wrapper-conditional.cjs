/** Wrapper hanya jadi baris kalau layout = samping. */
const fs = require("fs");
const path = require("path");
const p = path.resolve(__dirname, "..", "components", "games", "adu-tarik-dino", "Game.tsx");
let s = fs.readFileSync(p, "utf8");
const before = s;
s = s.replace(
  '          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">',
  '          <div className={`flex min-h-0 flex-1 flex-col ${isSide ? "lg:flex-row" : ""}`}>',
);
fs.writeFileSync(p, s, "utf8");
console.log("wrapper kondisional:", before !== s);
