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

sub('const isSide = layout !== "bottom";', 'const isSide = layout !== "bottom" && vw >= 1024;', "isSide-vw");

sub(
  'className="rounded-full bg-slate-800 px-2 py-1 text-[10px] font-black text-slate-200"',
  'className="hidden rounded-full bg-slate-800 px-2 py-1 text-[10px] font-black text-slate-200 lg:block"',
  "tombol-lg",
);

fs.writeFileSync(p, s, "utf8");
console.log(log.join("\n"));
