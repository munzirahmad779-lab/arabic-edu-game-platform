const fs = require("fs");
const path = require("path");
const p = path.resolve(__dirname, "..", "components", "games", "adu-tarik-dino", "Game.tsx");
let s = fs.readFileSync(p, "utf8");
const log = [];
const sub = (from, to, label) => {
  const before = s;
  s = s.replace(from, to);
  log.push(`${label}: ${before !== s ? "ok" : "GAGAL"}`);
};

sub(
  `                          isSide
                            ? "min-h-[54px] px-2 py-1.5 text-[13px] sm:min-h-[58px] sm:text-sm"
                            : "min-h-[44px] px-1.5 py-1 text-[12px] sm:min-h-[50px] sm:text-[13px]"`,
  `                          isSide
                            ? "min-h-[42px] px-1.5 py-1 text-[11px] sm:min-h-[46px] sm:text-[12px]"
                            : "min-h-[36px] px-1.5 py-1 text-[10px] sm:min-h-[40px] sm:text-[11px]"`,
  "font-opsi",
);

fs.writeFileSync(p, s, "utf8");
console.log(log.join("\n"));
