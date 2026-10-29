/**
 * - Jangan paksa panel ke bawah kecuali layar sangat kecil (<640px).
 * - Tombol ganti tata letak selalu terlihat (tidak lagi hanya di layar lebar).
 */
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
  'if (typeof window !== "undefined" && window.innerWidth < 1024) setLayout("bottom");',
  'if (typeof window !== "undefined" && window.innerWidth < 640) setLayout("bottom");',
  "ambang-kecil",
);

sub(
  'className="hidden rounded-full bg-slate-800 px-2 py-1 text-[10px] font-black text-slate-200 lg:block"',
  'className="rounded-full bg-slate-800 px-2 py-1 text-[10px] font-black text-slate-200"',
  "tombol-selalu",
);

fs.writeFileSync(p, s, "utf8");
console.log(log.join("\n"));
