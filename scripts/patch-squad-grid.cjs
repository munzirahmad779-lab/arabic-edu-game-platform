/** SQUAD + panel samping: pakai grid 2x2 supaya 4 opsi tiap panel tetap terlihat. */
const fs = require("fs");
const path = require("path");
const p = path.resolve(__dirname, "..", "components", "games", "adu-tarik-dino", "Game.tsx");
let s = fs.readFileSync(p, "utf8");
const before = s;

s = s.replace(
  `      ? "auto-rows-fr overflow-y-auto border-t lg:h-full lg:w-[40%] lg:max-w-[580px] lg:border-l lg:border-t-0 lg:p-3 " +
        (mode === "SQUAD" ? "grid-cols-2 lg:grid-cols-1" : "grid-cols-2 lg:grid-cols-1")`,
  `      ? "auto-rows-fr overflow-y-auto border-t lg:h-full lg:w-[44%] lg:max-w-[660px] lg:border-l lg:border-t-0 lg:p-3 " +
        (mode === "SQUAD" ? "grid-cols-2 lg:grid-cols-2" : "grid-cols-2 lg:grid-cols-1")`,
);

fs.writeFileSync(p, s, "utf8");
console.log("panelWrap SQUAD 2x2:", before !== s);
